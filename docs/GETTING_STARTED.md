# Getting Started Guide

## Quick Start for MFE Application

This guide will help you set up and run the Micro Frontend application locally.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the Application](#running-the-application)
4. [Project Structure](#project-structure)
5. [Development Workflow](#development-workflow)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x+ | JavaScript runtime |
| npm | 9.x+ | Package manager |
| Git | 2.x+ | Version control |

### Verify Installation

```bash
node --version
# Expected: v18.x.x or higher

npm --version
# Expected: 9.x.x or higher

git --version
# Expected: git version 2.x.x
```

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/mfe-app.git
cd mfe-app
```

### 2. Install Dependencies

Install dependencies for all projects:

```bash
# Install root dependencies
npm install

# Install shared library
cd shared
npm install
cd ..

# Install Shell
cd shell
npm install
cd ..

# Install Login MFE
cd login-mfe
npm install
cd ..

# Install Weather MFE
cd weather-mfe
npm install
cd ..

# Install Population MFE
cd population-mfe
npm install
cd ..
```

Or use the install script:

```bash
npm run install:all
```

### 3. Environment Setup

Create environment files for each project:

```bash
# Shell (.env)
VITE_LOGIN_MFE_URL=http://localhost:3001/assets/remoteEntry.js
VITE_WEATHER_MFE_URL=http://localhost:3002/assets/remoteEntry.js
VITE_POPULATION_MFE_URL=http://localhost:3003/assets/remoteEntry.js

# Weather MFE (.env)
VITE_OPENWEATHER_API_KEY=your_api_key_here
```

---

## Running the Application

### Development Mode

Start all services concurrently:

```bash
# From root directory
npm run dev
```

Or start individually:

```bash
# Terminal 1: Shared Library (if using watch mode)
cd shared
npm run build:watch

# Terminal 2: Login MFE
cd login-mfe
npm run dev

# Terminal 3: Weather MFE
cd weather-mfe
npm run dev

# Terminal 4: Population MFE
cd population-mfe
npm run dev

# Terminal 5: Shell (start last)
cd shell
npm run dev
```

### Access the Application

| Service | URL | Port |
|---------|-----|------|
| Shell (Main App) | http://localhost:3000 | 3000 |
| Login MFE | http://localhost:3001 | 3001 |
| Weather MFE | http://localhost:3002 | 3002 |
| Population MFE | http://localhost:3003 | 3003 |

### Demo Credentials

```
Admin User:
  Username: admin
  Password: admin123

Regular User:
  Username: user
  Password: user123
```

---

## Project Structure

```
mfe-app/
├── shared/                 # Shared library
│   ├── src/
│   │   ├── eventBus.js     # Pub-sub system
│   │   ├── stateStore.js   # State management
│   │   ├── authService.js  # Authentication
│   │   ├── middleware.js   # Middleware factories
│   │   ├── hooks.js        # React hooks
│   │   └── index.js        # Exports
│   └── package.json
│
├── shell/                  # Host application
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── routes/
│   │   └── styles/
│   ├── vite.config.js      # Module Federation config
│   └── package.json
│
├── login-mfe/              # Login micro frontend
│   ├── src/
│   │   ├── App.jsx
│   │   └── components/
│   ├── vite.config.js
│   └── package.json
│
├── weather-mfe/            # Weather micro frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── services/
│   ├── vite.config.js
│   └── package.json
│
├── population-mfe/         # Population micro frontend
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   └── services/
│   ├── vite.config.js
│   └── package.json
│
├── docs/                   # Documentation
│   ├── README.md
│   ├── ARCHITECTURE.md
│   └── ...
│
└── package.json            # Root package.json
```

---

## Development Workflow

### 1. Making Changes to Shared Library

```bash
cd shared
# Make your changes to src/*.js

# Build the library
npm run build

# The MFEs will pick up changes on next import
```

### 2. Developing an MFE

```bash
cd weather-mfe
npm run dev

# MFE runs standalone at http://localhost:3002
# Changes hot-reload automatically
```

### 3. Testing Integration

1. Start all MFEs
2. Start the Shell
3. Access http://localhost:3000
4. Test the full integration

### 4. Running Tests

```bash
# Unit tests (Jest)
npm run test

# E2E tests (Cypress)
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## Common Tasks

### Adding a New Event Type

```javascript
// shared/src/eventBus.js
export const EventTypes = {
  // ... existing types
  
  CUSTOM: {
    MY_EVENT: 'mfe:custom:my-event',
  },
};
```

### Creating a New Hook

```javascript
// shared/src/hooks.js
export function useMyCustomHook() {
  const [data, setData] = useState(null);
  
  useEventBus(EventTypes.CUSTOM.MY_EVENT, (payload) => {
    setData(payload);
  });
  
  return data;
}
```

### Adding a New MFE

1. Create the MFE directory:
```bash
mkdir new-mfe
cd new-mfe
npm init -y
```

2. Add Vite config with Module Federation:
```javascript
// vite.config.js
import federation from '@originjs/vite-plugin-federation';

export default {
  plugins: [
    federation({
      name: 'newMFE',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.jsx',
      },
      shared: ['react', 'react-dom'],
    }),
  ],
  server: {
    port: 3004,
  },
};
```

3. Register in Shell:
```javascript
// shell/vite.config.js
remotes: {
  // ... existing
  newMFE: 'http://localhost:3004/assets/remoteEntry.js',
},
```

### Building for Production

```bash
# Build all projects
npm run build

# Build individually
cd shell && npm run build
cd login-mfe && npm run build
cd weather-mfe && npm run build
cd population-mfe && npm run build
```

---

## Troubleshooting

### Common Issues

#### 1. "Module not found" Error

**Problem:** MFE fails to load in Shell

**Solution:**
- Ensure all MFEs are running
- Check the remoteEntry.js URLs in Shell's vite.config.js
- Clear browser cache

```bash
# Verify MFE is accessible
curl http://localhost:3001/assets/remoteEntry.js
```

#### 2. "Shared module is not available"

**Problem:** Shared library not found

**Solution:**
- Rebuild the shared library:
```bash
cd shared
npm run build
```

#### 3. Port Already in Use

**Problem:** Address already in use error

**Solution:**
```bash
# Find process using the port
npx kill-port 3000 3001 3002 3003
```

#### 4. CORS Errors

**Problem:** Cross-origin request blocked

**Solution:**
- Ensure all MFEs have CORS enabled in vite.config.js:
```javascript
server: {
  cors: true,
}
```

#### 5. Hot Reload Not Working

**Problem:** Changes don't reflect immediately

**Solution:**
- Check vite.config.js has correct HMR settings
- Restart the development server
- Clear browser cache (Ctrl+Shift+R)

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('debug', 'mfe:*');

// Or in code
import { eventBus, createLoggingMiddleware } from '@mfe/shared';
eventBus.use(createLoggingMiddleware({ level: 'debug' }));
```

### Getting Help

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Search existing issues
3. Create a new issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details

---

## Next Steps

After getting the application running:

1. **Explore the Architecture** - [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Learn the Event Bus** - [API_EVENT_BUS.md](./API_EVENT_BUS.md)
3. **Understand State Management** - [API_STATE_STORE.md](./API_STATE_STORE.md)
4. **Review React Hooks** - [API_REACT_HOOKS.md](./API_REACT_HOOKS.md)
5. **Run Tests** - [TESTING.md](./TESTING.md)
