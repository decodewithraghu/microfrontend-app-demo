# Deployment Guide

## Deploying the MFE Application

This guide covers deployment strategies and best practices for the micro frontend application.

---

## Table of Contents

1. [Deployment Overview](#deployment-overview)
2. [Build Process](#build-process)
3. [Deployment Strategies](#deployment-strategies)
4. [Environment Configuration](#environment-configuration)
5. [CDN Setup](#cdn-setup)
6. [Docker Deployment](#docker-deployment)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [CI/CD Pipelines](#cicd-pipelines)
9. [Monitoring & Logging](#monitoring--logging)
10. [Rollback Strategies](#rollback-strategies)

---

## Deployment Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         PRODUCTION                              │
│                                                                 │
│  ┌───────────────────┐                                         │
│  │   Load Balancer   │                                         │
│  └─────────┬─────────┘                                         │
│            │                                                    │
│  ┌─────────▼─────────┐                                         │
│  │       CDN         │ ← Static assets (JS, CSS, images)       │
│  │   (CloudFront)    │                                         │
│  └─────────┬─────────┘                                         │
│            │                                                    │
│  ┌─────────┴──────────────────────────────────────────────┐   │
│  │                   Origin Servers                        │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │   │
│  │  │  Shell  │ │ Login   │ │ Weather │ │ Population  │  │   │
│  │  │  :3000  │ │  :3001  │ │  :3002  │ │    :3003    │  │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘  │   │
│  └────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Build Process

### ⚠️ Important: Build Order Matters

Module Federation requires the `remoteEntry.js` files to be generated during build. Always build in this order:

1. **Shared Library** - Must be built first as MFEs depend on it
2. **MFEs** (Login, Weather, Population) - Can be built in parallel
3. **Shell** - Must be built last as it references MFE remoteEntry.js files

### Building All Projects

```bash
# Build script
#!/bin/bash

echo "Building shared library..."
cd shared && npm run build && cd ..

echo "Building MFEs in parallel..."
npm run build:mfes

echo "Building Shell..."
cd shell && npm run build && cd ..

echo "Build complete!"
```

Or use the npm script:

```bash
npm run build
```

### package.json Scripts

```json
{
  "scripts": {
    "build": "npm run build:shared && npm run build:mfes && npm run build:shell",
    "build:shared": "cd shared && npm run build",
    "build:mfes": "concurrently \"cd login-mfe && npm run build\" \"cd weather-mfe && npm run build\" \"cd population-mfe && npm run build\"",
    "build:shell": "cd shell && npm run build",
    "build:prod": "NODE_ENV=production npm run build"
  }
}
```

### Build Output Structure

```
dist/
├── shell/
│   ├── index.html
│   └── assets/
│       ├── index-[hash].js
│       └── index-[hash].css
├── login-mfe/
│   └── assets/
│       └── remoteEntry.js
├── weather-mfe/
│   └── assets/
│       └── remoteEntry.js
└── population-mfe/
    └── assets/
        └── remoteEntry.js
```

---

## Deployment Strategies

### 1. Independent MFE Deployment

Each MFE can be deployed independently:

```yaml
# deploy-mfe.yml
name: Deploy MFE

on:
  push:
    paths:
      - 'login-mfe/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Login MFE
        run: |
          cd login-mfe
          npm ci
          npm run build
      - name: Deploy to S3
        run: |
          aws s3 sync login-mfe/dist s3://mfe-bucket/login/
          aws cloudfront create-invalidation --distribution-id $CF_ID --paths "/login/*"
```

### 2. Versioned Deployments

```javascript
// shell/vite.config.js
const MFE_VERSION = process.env.MFE_VERSION || 'latest';

export default {
  plugins: [
    federation({
      remotes: {
        loginMFE: `https://cdn.example.com/login/${MFE_VERSION}/remoteEntry.js`,
        weatherMFE: `https://cdn.example.com/weather/${MFE_VERSION}/remoteEntry.js`,
        populationMFE: `https://cdn.example.com/population/${MFE_VERSION}/remoteEntry.js`,
      },
    }),
  ],
};
```

### 3. Blue-Green Deployment

```nginx
# nginx.conf
upstream blue {
    server shell-blue:3000;
}

upstream green {
    server shell-green:3000;
}

server {
    listen 80;
    
    location / {
        # Switch between blue and green
        proxy_pass http://blue;
        # proxy_pass http://green;
    }
}
```

### 4. Canary Deployment

```nginx
# nginx.conf with canary
upstream stable {
    server shell-stable:3000 weight=90;
    server shell-canary:3000 weight=10;
}

server {
    location / {
        proxy_pass http://stable;
    }
}
```

---

## Environment Configuration

### Environment Files

```bash
# .env.production
VITE_API_URL=https://api.example.com
VITE_LOGIN_MFE_URL=https://cdn.example.com/login/remoteEntry.js
VITE_WEATHER_MFE_URL=https://cdn.example.com/weather/remoteEntry.js
VITE_POPULATION_MFE_URL=https://cdn.example.com/population/remoteEntry.js
VITE_OPENWEATHER_API_KEY=production_api_key
```

### Runtime Configuration

```javascript
// config.js - Load config at runtime
window.MFE_CONFIG = {
  apiUrl: '%%API_URL%%',
  mfeUrls: {
    login: '%%LOGIN_MFE_URL%%',
    weather: '%%WEATHER_MFE_URL%%',
    population: '%%POPULATION_MFE_URL%%',
  },
};

// Replace placeholders at deploy time
// sed -i 's/%%API_URL%%/https:\/\/api.example.com/g' config.js
```

### Config Service

```javascript
// configService.js
class ConfigService {
  static async load() {
    const response = await fetch('/config.json');
    const config = await response.json();
    window.MFE_CONFIG = config;
    return config;
  }
  
  static get(key) {
    return window.MFE_CONFIG?.[key];
  }
}

// Usage
await ConfigService.load();
const apiUrl = ConfigService.get('apiUrl');
```

---

## CDN Setup

### AWS CloudFront Configuration

```json
{
  "Origins": {
    "Items": [
      {
        "Id": "S3-mfe-bucket",
        "DomainName": "mfe-bucket.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": "origin-access-identity/cloudfront/EXAMPLE"
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true
  },
  "CacheBehaviors": {
    "Items": [
      {
        "PathPattern": "*/remoteEntry.js",
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "TTL": 300
      },
      {
        "PathPattern": "*.js",
        "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
        "TTL": 31536000
      }
    ]
  }
}
```

### Cache Headers

```nginx
# nginx cache headers
location ~* \.(?:css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location ~* remoteEntry\.js$ {
    expires 5m;
    add_header Cache-Control "public, max-age=300";
}

location / {
    expires -1;
    add_header Cache-Control "no-cache, must-revalidate";
}
```

---

## Docker Deployment

### Dockerfile for MFE

```dockerfile
# Dockerfile.mfe
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  shell:
    build:
      context: ./shell
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - LOGIN_MFE_URL=http://login-mfe/assets/remoteEntry.js
      - WEATHER_MFE_URL=http://weather-mfe/assets/remoteEntry.js
      - POPULATION_MFE_URL=http://population-mfe/assets/remoteEntry.js
    depends_on:
      - login-mfe
      - weather-mfe
      - population-mfe

  login-mfe:
    build:
      context: ./login-mfe
      dockerfile: Dockerfile
    ports:
      - "3001:80"

  weather-mfe:
    build:
      context: ./weather-mfe
      dockerfile: Dockerfile
    ports:
      - "3002:80"

  population-mfe:
    build:
      context: ./population-mfe
      dockerfile: Dockerfile
    ports:
      - "3003:80"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - shell
```

### Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream shell {
        server shell:80;
    }

    upstream login-mfe {
        server login-mfe:80;
    }

    upstream weather-mfe {
        server weather-mfe:80;
    }

    upstream population-mfe {
        server population-mfe:80;
    }

    server {
        listen 80;

        # Shell (main app)
        location / {
            proxy_pass http://shell;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Login MFE assets
        location /login/ {
            proxy_pass http://login-mfe/;
        }

        # Weather MFE assets
        location /weather/ {
            proxy_pass http://weather-mfe/;
        }

        # Population MFE assets
        location /population/ {
            proxy_pass http://population-mfe/;
        }
    }
}
```

---

## Kubernetes Deployment

### Deployment Manifests

```yaml
# k8s/shell-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shell
  labels:
    app: shell
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shell
  template:
    metadata:
      labels:
        app: shell
    spec:
      containers:
        - name: shell
          image: myregistry/mfe-shell:latest
          ports:
            - containerPort: 80
          env:
            - name: LOGIN_MFE_URL
              valueFrom:
                configMapKeyRef:
                  name: mfe-config
                  key: login_mfe_url
          resources:
            limits:
              memory: "128Mi"
              cpu: "100m"
          livenessProbe:
            httpGet:
              path: /health
              port: 80
            initialDelaySeconds: 30
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: shell
spec:
  selector:
    app: shell
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP
```

### Ingress Configuration

```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mfe-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
    - hosts:
        - app.example.com
      secretName: tls-secret
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: shell
                port:
                  number: 80
          - path: /mfe/login
            pathType: Prefix
            backend:
              service:
                name: login-mfe
                port:
                  number: 80
          - path: /mfe/weather
            pathType: Prefix
            backend:
              service:
                name: weather-mfe
                port:
                  number: 80
          - path: /mfe/population
            pathType: Prefix
            backend:
              service:
                name: population-mfe
                port:
                  number: 80
```

### ConfigMap

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mfe-config
data:
  login_mfe_url: "https://cdn.example.com/login/remoteEntry.js"
  weather_mfe_url: "https://cdn.example.com/weather/remoteEntry.js"
  population_mfe_url: "https://cdn.example.com/population/remoteEntry.js"
  api_url: "https://api.example.com"
```

---

## CI/CD Pipelines

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: mfe-app
  ECS_CLUSTER: mfe-cluster

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        mfe: [shell, login-mfe, weather-mfe, population-mfe]
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd ${{ matrix.mfe }}
          npm ci

      - name: Build
        run: |
          cd ${{ matrix.mfe }}
          npm run build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd ${{ matrix.mfe }}
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY-${{ matrix.mfe }}:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY-${{ matrix.mfe }}:$IMAGE_TAG

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster $ECS_CLUSTER --service mfe-service --force-new-deployment
```

---

## Monitoring & Logging

### Health Checks

```javascript
// health.js
export function healthCheck() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
    dependencies: {
      api: checkApiHealth(),
      cache: checkCacheHealth(),
    },
  };
}

// Express endpoint
app.get('/health', (req, res) => {
  res.json(healthCheck());
});
```

### Error Tracking (Sentry)

```javascript
// sentry.js
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 0.1,
});
```

### Application Metrics

```javascript
// metrics.js
import { eventBus, EventTypes } from '@mfe/shared';

// Track MFE load times
eventBus.subscribe(EventTypes.SYSTEM.MFE_MOUNTED, (payload) => {
  const loadTime = Date.now() - window.performance.timing.navigationStart;
  
  // Send to monitoring
  sendMetric('mfe.load.time', loadTime, {
    mfe: payload.name,
  });
});

// Track errors
eventBus.subscribe(EventTypes.SYSTEM.MFE_ERROR, (payload) => {
  sendMetric('mfe.error.count', 1, {
    mfe: payload.mfe,
    error: payload.error,
  });
});
```

---

## Rollback Strategies

### Version Pinning

```javascript
// Deploy specific versions
const MFE_VERSIONS = {
  login: 'v1.2.3',
  weather: 'v2.0.1',
  population: 'v1.5.0',
};

// Rollback to previous version
const ROLLBACK_VERSIONS = {
  login: 'v1.2.2',
  weather: 'v2.0.0',
  population: 'v1.4.9',
};
```

### Instant Rollback Script

```bash
#!/bin/bash
# rollback.sh

MFE=$1
VERSION=$2

echo "Rolling back $MFE to version $VERSION..."

# Update deployment
aws ecs update-service \
  --cluster mfe-cluster \
  --service $MFE-service \
  --task-definition $MFE:$VERSION \
  --force-new-deployment

# Invalidate CDN cache
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/$MFE/*"

echo "Rollback complete!"
```

### Feature Flags

```javascript
// featureFlags.js
const flags = {
  useNewWeatherAPI: false,
  enableDarkMode: true,
  showPopulationChart: true,
};

export function isFeatureEnabled(feature) {
  return flags[feature] ?? false;
}

// Usage
if (isFeatureEnabled('useNewWeatherAPI')) {
  // Use new API
} else {
  // Use old API (rollback)
}
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Build successful
- [ ] Environment variables configured
- [ ] Health checks implemented
- [ ] Error tracking enabled
- [ ] Rollback plan documented

### Deployment
- [ ] Deploy MFEs first
- [ ] Deploy Shell last
- [ ] Verify MFE remoteEntry.js accessible
- [ ] Check health endpoints
- [ ] Monitor error rates

### Post-Deployment
- [ ] Smoke test critical flows
- [ ] Verify metrics collection
- [ ] Check CDN cache status
- [ ] Monitor performance
- [ ] Document deployment

---

## Next Steps

- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Testing Guide](./TESTING.md)
- [Architecture Overview](./ARCHITECTURE.md)
