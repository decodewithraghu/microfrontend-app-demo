# MFE Application Documentation

## Comprehensive Micro Frontend Architecture & Implementation Guide

This documentation directory contains complete technical documentation for the Micro Frontend (MFE) Application, including architecture, APIs, deployment guides, and best practices.

---

## 📚 Documentation Index

### Getting Started
| Document | Description |
|----------|-------------|
| [Getting Started](./GETTING_STARTED.md) | Quick start guide, installation, running the app |
| [Architecture Overview](./ARCHITECTURE.md) | System architecture, design patterns, data flow |
| [Architecture Diagrams](./ARCHITECTURE_DIAGRAMS_UPDATED.md) | **Updated Mermaid diagrams** |
| [PWA Guide](./PWA.md) | **🆕 Progressive Web App** - Offline support, installation, service worker |

### API Reference
| Document | Description |
|----------|-------------|
| [Event Bus API](./API_EVENT_BUS.md) | Enterprise pub-sub communication system |
| [State Store API](./API_STATE_STORE.md) | Centralized state management with Redux patterns |
| [Auth Service API](./API_AUTH_SERVICE.md) | Authentication, sessions, RBAC |
| [Middleware API](./API_MIDDLEWARE.md) | Event processing middleware (logging, validation, etc.) |
| [React Hooks API](./API_REACT_HOOKS.md) | Custom hooks for MFE integration |

### MFE Documentation
| Document | Description |
|----------|-------------|
| [Shell Application](./MFE_SHELL.md) | Host container, routing, orchestration, **PWA** |
| [Login MFE](./MFE_LOGIN.md) | Authentication form, validation, session |
| [Weather MFE](./MFE_WEATHER.md) | Weather display, API integration |
| [Population MFE](./MFE_POPULATION.md) | Population stats, regional charts |

### Operations
| Document | Description |
|----------|-------------|
| [Testing Guide](./TESTING.md) | Jest unit tests, Cypress E2E tests |
| [Deployment Guide](./DEPLOYMENT.md) | Build, Docker, Kubernetes, CI/CD |
| [Troubleshooting](./TROUBLESHOOTING.md) | Common issues and solutions |

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build all MFEs (required for Module Federation)
npm run build

# Start in preview mode
npm run preview

# Open http://localhost:3000
```

> **Important**: Module Federation requires `npm run build` before `npm run preview`. The `remoteEntry.js` files are only generated during build.

---

## 🏗️ Quick Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        SHELL APPLICATION                          │
│                    (Container - Port 3000)                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Module Federation                         │ │
│  │         (Dynamic MFE Loading & Routing)                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   LOGIN MFE     │  │  WEATHER MFE    │  │ POPULATION MFE  │
│   (Port 3001)   │  │   (Port 3002)   │  │   (Port 3003)   │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • Authentication│  │ • Weather Data  │  │ • Population    │
│ • Country List  │  │ • 7-Day Forecast│  │ • Statistics    │
│ • Session Mgmt  │  │ • Open-Meteo API│  │ • World Bank API│
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
         ┌─────────────────────────────────────────┐
         │            SHARED LIBRARY               │
         │  ┌─────────────┬─────────────────────┐ │
         │  │  EventBus   │    StateStore       │ │
         │  │  (Pub-Sub)  │  (State Mgmt)       │ │
         │  ├─────────────┼─────────────────────┤ │
         │  │ AuthService │    Middleware       │ │
         │  │ (Session)   │   (Processing)      │ │
         │  ├─────────────┴─────────────────────┤ │
         │  │         React Hooks               │ │
         │  └───────────────────────────────────┘ │
         └─────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
# Clone and install dependencies
cd mfe-app
npm install

# Install all MFE dependencies
npm run install:all

# Build all applications
npm run build:all

# Start development servers
npm run dev

# Or start preview servers
npm run preview
```

**Application URLs:**
- Shell: http://localhost:3000
- Login MFE: http://localhost:3001
- Weather MFE: http://localhost:3002
- Population MFE: http://localhost:3003

---

## 🔑 Key Features

### Progressive Web App (PWA) 🆕
- **Offline Support**: Service worker caches assets for offline use
- **Installable**: Users can add the app to their home screen
- **Update Notifications**: Automatic detection of new versions
- **Network Status**: Visual indicators for online/offline state
- **Caching Strategies**: Cache-first for static assets, network-first for APIs

### Data Sharing & Communication
- **Enterprise Pub-Sub System**: Type-safe event bus with middleware support
- **Centralized State Store**: Immutable state with persistence and time-travel debugging
- **Secure Session Management**: Encrypted storage with automatic refresh

### Modern Best Practices
- **Module Federation**: Vite-powered dynamic MFE loading
- **React 18**: Latest React features with Suspense and lazy loading
- **TypeScript Ready**: Full TypeScript support in shared library

### Testing Infrastructure
- **Jest**: Unit testing with React Testing Library
- **Cypress**: End-to-end testing with custom commands

---

## 📦 Technology Stack

| Layer | Technology |
|-------|------------|
| UI Framework | React 18.2.0 |
| Build Tool | Vite 5.0.0 |
| Module Federation | @originjs/vite-plugin-federation |
| State Management | Custom StateStore (Redux-like) |
| Communication | Custom EventBus (Pub-Sub) |
| Session Storage | Base64 Encoded sessionStorage |
| Styling | CSS Modules / CSS-in-JS |
| Unit Testing | Jest 29.7.0 + React Testing Library |
| E2E Testing | Cypress 13.6.0 |
| APIs | REST Countries, Open-Meteo, World Bank |

---

## 🔒 Security Features

1. **Session Encoding**: Base64 + URI encoding for session data
2. **Session Expiration**: 24-hour session timeout
3. **EventBus Communication**: Pub-Sub for cross-MFE events
4. **Role-Based Access Control**: Admin, User, Guest roles
5. **Protected Routes**: Authentication required for Weather/Population MFEs

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | Jan 2026 | Architecture diagrams, EventBus integration, session format update |
| 2.0.0 | 2024 | Enterprise pub-sub, state store, middleware system |
| 1.0.0 | 2024 | Initial MFE implementation |

---

## 📞 Support

For questions or issues, please refer to the [Troubleshooting Guide](./TROUBLESHOOTING.md).
