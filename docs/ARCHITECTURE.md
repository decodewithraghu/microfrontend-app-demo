# Architecture Overview

## Micro Frontend Application Architecture

This document describes the complete architecture of the MFE Application, including design decisions, patterns, and data flow.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [Module Federation](#module-federation)
4. [Communication Patterns](#communication-patterns)
5. [State Management](#state-management)
6. [Security Architecture](#security-architecture)
7. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Overview

### High-Level Architecture

The application follows a **Micro Frontend Architecture** pattern where:

- **Shell Application**: Acts as the container/host, managing routing and MFE orchestration
- **Micro Frontends**: Independent applications (Login, Weather, Population) loaded dynamically
- **Shared Library**: Common utilities for communication, state, and authentication

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    SHELL APPLICATION                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │ │
│  │  │ Router   │  │Navigation│  │ErrorBound│  │ Layout   │    │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │ │
│  │  ┌────────────────────────────────────────────────────┐    │ │
│  │  │              Module Federation Host                │    │ │
│  │  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────┐ │    │ │
│  │  │  │ Login   │  │ Weather │  │    Population       │ │    │ │
│  │  │  │  MFE    │  │   MFE   │  │       MFE           │ │    │ │
│  │  │  └─────────┘  └─────────┘  └─────────────────────┘ │    │ │
│  │  └────────────────────────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    SHARED LIBRARY                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │ │
│  │  │ EventBus │  │StateStore│  │AuthService│  │Middleware│   │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
mfe-app/
├── docs/                    # Documentation (you are here)
├── shared/                  # Shared library
│   └── src/
│       ├── eventBus.js      # Pub-Sub communication
│       ├── stateStore.js    # Centralized state
│       ├── authService.js   # Authentication
│       ├── middleware.js    # Event middlewares
│       ├── hooks.js         # React hooks
│       └── index.js         # Main exports
├── shell/                   # Container application
│   └── src/
│       ├── App.jsx          # Main app with routing
│       └── main.jsx         # Entry point
├── login-mfe/               # Login micro frontend
│   └── src/
│       └── components/
│           ├── LoginForm.jsx
│           └── CountryList.jsx
├── weather-mfe/             # Weather micro frontend
│   └── src/
│       └── components/
│           └── WeatherDisplay.jsx
├── population-mfe/          # Population micro frontend
│   └── src/
│       └── components/
│           └── PopulationDisplay.jsx
└── cypress/                 # E2E tests
    └── e2e/
```

---

## Architecture Principles

### 1. Independence
Each MFE is:
- **Independently deployable**: Can be built and deployed without affecting others
- **Technology agnostic**: Could use different frameworks (all use React currently)
- **Team autonomous**: Different teams can own different MFEs

### 2. Isolation
- Each MFE runs in its own context
- CSS is scoped to prevent conflicts
- JavaScript execution is sandboxed

### 3. Resilience
- Failure in one MFE doesn't crash the application
- Error boundaries catch and contain errors
- Fallback UI for loading/error states

### 4. Communication via Contracts
- MFEs communicate through well-defined event contracts
- State shared via centralized store with strict schemas
- No direct MFE-to-MFE dependencies

---

## Module Federation

### Configuration

The application uses **Vite Module Federation** for dynamic MFE loading.

**Shell (Host) Configuration:**
```javascript
// shell/vite.config.js
federation({
  name: 'shell',
  remotes: {
    loginMfe: 'http://localhost:3001/assets/remoteEntry.js',
    weatherMfe: 'http://localhost:3002/assets/remoteEntry.js',
    populationMfe: 'http://localhost:3003/assets/remoteEntry.js',
  },
  shared: ['react', 'react-dom', 'shared'],
})
```

**MFE (Remote) Configuration:**
```javascript
// login-mfe/vite.config.js
federation({
  name: 'loginMfe',
  filename: 'remoteEntry.js',
  exposes: {
    './LoginApp': './src/App.jsx',
    './LoginForm': './src/components/LoginForm.jsx',
    './CountryList': './src/components/CountryList.jsx',
  },
  shared: ['react', 'react-dom', 'shared'],
})
```

### Loading Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    Shell Application                        │
│                                                             │
│  1. User navigates to /login                                │
│     ▼                                                       │
│  2. Router matches LoginMFE route                           │
│     ▼                                                       │
│  3. React.lazy() triggers dynamic import                    │
│     ▼                                                       │
│  4. Module Federation fetches remoteEntry.js from :3001     │
│     ▼                                                       │
│  5. Shared dependencies resolved (React, shared lib)        │
│     ▼                                                       │
│  6. MFE component rendered with Suspense fallback           │
└─────────────────────────────────────────────────────────────┘
```

---

## Communication Patterns

### 1. Event-Driven (Pub-Sub)

The **EventBus** provides loosely-coupled communication:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Login MFE  │         │  EventBus   │         │ Weather MFE │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  publish(LOGIN)       │                       │
       │──────────────────────►│                       │
       │                       │  notify(LOGIN)        │
       │                       │──────────────────────►│
       │                       │                       │
       │  publish(COUNTRY)     │                       │
       │──────────────────────►│                       │
       │                       │  notify(COUNTRY)      │
       │                       │──────────────────────►│
       │                       │                       │
```

### 2. State-Based

The **StateStore** provides centralized state:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Login MFE  │         │ StateStore  │         │ Weather MFE │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  dispatch(SET_USER)   │                       │
       │──────────────────────►│                       │
       │                       │◄──────────────────────│
       │                       │   subscribe('auth')   │
       │                       │                       │
       │                       │  notify(state)        │
       │                       │──────────────────────►│
       │                       │                       │
```

### 3. Storage-Based (Persistence)

For cross-tab and persistence:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│    Tab 1    │         │ SessionStore│         │    Tab 2    │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  setSession(data)     │                       │
       │──────────────────────►│                       │
       │                       │  storage event        │
       │                       │──────────────────────►│
       │                       │                       │
       │                       │◄──────────────────────│
       │                       │   getSession()        │
       │                       │                       │
```

---

## State Management

### State Structure

```javascript
{
  auth: {
    user: { id, username, name, role, permissions },
    session: { token, expiresAt },
    isAuthenticated: boolean,
    lastActivity: timestamp,
  },
  country: {
    selected: { name, code, capital, coordinates, ... },
    list: Country[],
    lastUpdated: timestamp,
  },
  data: {
    weather: WeatherData,
    population: PopulationData,
    cache: { [key]: { data, timestamp } },
  },
  ui: {
    loading: { [key]: boolean },
    errors: { [key]: string },
    notifications: Notification[],
  },
  preferences: {
    theme: 'light' | 'dark',
    language: string,
    timezone: string,
  },
  meta: {
    version: string,
    lastUpdated: timestamp,
    stateId: string,
  },
}
```

### State Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        State Update Flow                        │
│                                                                 │
│   Component          Action           Store           UI        │
│      │                 │                │              │        │
│      │  user action    │                │              │        │
│      │────────────────►│                │              │        │
│      │                 │  dispatch()    │              │        │
│      │                 │───────────────►│              │        │
│      │                 │                │ middleware   │        │
│      │                 │                │─────┐        │        │
│      │                 │                │◄────┘        │        │
│      │                 │                │ reduce       │        │
│      │                 │                │─────┐        │        │
│      │                 │                │◄────┘        │        │
│      │                 │                │ persist      │        │
│      │                 │                │─────────────►│        │
│      │                 │                │ notify       │        │
│      │◄─────────────────────────────────│──────────────│        │
│      │                 │                │              │        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Authentication Flow                        │
│                                                                 │
│   User           Login MFE        AuthService      Storage      │
│    │                 │                │              │          │
│    │  credentials    │                │              │          │
│    │────────────────►│                │              │          │
│    │                 │  login()       │              │          │
│    │                 │───────────────►│              │          │
│    │                 │                │ validate     │          │
│    │                 │                │─────┐        │          │
│    │                 │                │◄────┘        │          │
│    │                 │                │ generateToken│          │
│    │                 │                │─────┐        │          │
│    │                 │                │◄────┘        │          │
│    │                 │                │ encrypt      │          │
│    │                 │                │─────────────►│          │
│    │                 │  session       │              │          │
│    │                 │◄───────────────│              │          │
│    │  redirect       │                │              │          │
│    │◄────────────────│                │              │          │
│    │                 │                │              │          │
└─────────────────────────────────────────────────────────────────┘
```

### Session Security

1. **Encryption**: Data encrypted before storage
2. **Integrity**: Checksum validation on read
3. **Expiration**: 24-hour session with auto-refresh
4. **Token Validation**: JWT-style signature verification

### Role-Based Access Control

```javascript
Roles: {
  ADMIN: ['read', 'write', 'delete', 'admin'],
  USER:  ['read', 'write'],
  GUEST: ['read'],
}
```

---

## Data Flow Diagrams

### User Login Flow

```
┌──────┐   ┌─────────┐   ┌───────────┐   ┌──────────┐   ┌─────────┐
│ User │──►│LoginForm│──►│AuthService│──►│StateStore│──►│EventBus │
└──────┘   └─────────┘   └───────────┘   └──────────┘   └────┬────┘
                                                              │
                    ┌─────────────────────────────────────────┘
                    ▼
           ┌───────────────┐   ┌────────────┐
           │ Shell Router  │──►│CountryList │
           └───────────────┘   └────────────┘
```

### Country Selection Flow

```
┌──────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐
│ User │──►│CountryList│──►│AuthService│──►│StateStore│
└──────┘   └───────────┘   └───────────┘   └─────┬────┘
                                                 │
                    ┌────────────────────────────┘
                    ▼
           ┌────────────┐              ┌────────────────┐
           │EventBus    │──────────────►│Weather/Pop MFE│
           └────────────┘              └────────────────┘
```

### Weather Data Flow

```
┌──────────────┐   ┌───────────┐   ┌────────────┐   ┌──────────┐
│WeatherDisplay│──►│Open-Meteo │──►│ StateStore │──►│ UI Cache │
│              │   │    API    │   │  (cache)   │   │          │
└──────────────┘   └───────────┘   └────────────┘   └──────────┘
```

---

## Design Patterns Used

| Pattern | Usage |
|---------|-------|
| **Module Federation** | Dynamic MFE loading |
| **Pub-Sub** | Cross-MFE communication |
| **Singleton** | EventBus, StateStore instances |
| **Observer** | State subscriptions |
| **Middleware** | Event processing chain |
| **Factory** | Creating middleware instances |
| **Facade** | AuthService API |
| **Strategy** | Different middleware behaviors |

---

## Performance Considerations

1. **Lazy Loading**: MFEs loaded on-demand
2. **Shared Dependencies**: React/shared lib loaded once
3. **State Caching**: Weather/Population data cached
4. **Event Debouncing**: Prevents excessive updates
5. **Memoization**: Selector results cached

---

## Next Steps

- [Getting Started Guide](./GETTING_STARTED.md)
- [Event Bus API](./API_EVENT_BUS.md)
- [State Store API](./API_STATE_STORE.md)
