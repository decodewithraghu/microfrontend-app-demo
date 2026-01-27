# Micro Frontend Application

A complete micro frontend architecture demonstration using **React**, **Vite**, and **Module Federation**.

## � Recent Updates (January 2026)

### Architecture Enhancements
- ✅ **Updated Architecture Diagrams** - 17 Mermaid diagrams including mindmaps
- ✅ **Cross-MFE Communication** - Shell and Login MFE now use compatible session formats
- ✅ **EventBus Integration** - Login MFE publishes events to shared EventBus
- ✅ **New Shared Library Modules** - Added analytics, apiGateway, crypto, featureFlags, logger, performanceMonitor, security

### Documentation
- 📚 New [Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAMS_UPDATED.md) with Mermaid diagrams
- 📚 Updated [Documentation Index](./docs/README.md) with quick start guide

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Shell Application                         │
│                     (Host - Port 3000)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Navigation Bar                       │ │
│  │  [Countries] [Weather] [Population]     👤 User | Logout │ │
│  └─────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────── ┐ │
│  │                                                          │ │
│  │                 Micro Frontend Container                 │ │
│  │                                                          │ │
│  │   ┌──────────┐   ┌──────────┐   ┌──────────────┐         │ │
│  │   │  Login   │   │ Weather  │   │  Population  │         │ │
│  │   │   MFE    │   │   MFE    │   │     MFE      │         │ │
│  │   │  :3001   │   │  :3002   │   │    :3003     │         │ │
│  │   └──────────┘   └──────────┘   └──────────────┘         │ │
│  │                                                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Shared Session (Base64 Encoded)
                              │ EventBus Communication
                              ▼
                    ┌─────────────────────┐
                    │   Session Storage   │
                    │   + Event Bus       │
                    └─────────────────────┘
```

## 📦 Project Structure

```
mfe-app/
├── package.json          # Root package with workspace scripts
├── docs/                 # 📚 Documentation
│   ├── README.md         # Documentation index
│   ├── ARCHITECTURE.md   # Architecture overview
│   ├── ARCHITECTURE_DIAGRAMS_UPDATED.md  # 🆕 Mermaid diagrams
│   └── ...               # API docs, guides, troubleshooting
├── diagrams/             # 🖼️ Architecture diagram images
├── shared/               # Shared library (@mfe/shared)
│   └── src/
│       ├── eventBus.js   # 📡 Pub/Sub event system
│       ├── stateStore.js # 📦 Centralized state management
│       ├── authService.js # 🔐 Authentication service
│       ├── middleware.js # ⚙️ Event middleware
│       ├── hooks.js      # 🪝 React hooks
│       ├── analytics.js  # 🆕 Analytics tracking
│       ├── apiGateway.js # 🆕 API gateway
│       ├── crypto.js     # 🆕 Crypto utilities
│       ├── featureFlags.js # 🆕 Feature flags
│       ├── logger.js     # 🆕 Logging service
│       ├── performanceMonitor.js # 🆕 Performance monitoring
│       ├── security.js   # 🆕 Security utilities
│       └── index.js      # Main exports
├── shell/                # Host application (Port 3000)
│   ├── src/
│   │   ├── App.jsx       # Main routing & layout
│   │   ├── main.jsx
│   │   └── index.css     # Global styles
│   └── vite.config.js    # Module Federation config
├── login-mfe/            # Login & Countries MFE (Port 3001)
│   ├── src/
│   │   ├── App.jsx       # 🔄 Updated with EventBus
│   │   ├── components/
│   │   │   ├── LoginForm.jsx
│   │   │   └── CountryList.jsx
│   │   └── styles.css
│   └── vite.config.js
├── weather-mfe/          # Weather Display MFE (Port 3002)
│   └── ...
└── population-mfe/       # Population Stats MFE (Port 3003)
    └── ...
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

```bash
# Navigate to the project
cd mfe-app

# Install all dependencies
npm run install:all
```

### ⚠️ Important: Module Federation Requires Build

Module Federation only works in **preview mode** (after building). The `remoteEntry.js` files are only generated during the build process.

```bash
# Build all MFEs first (generates remoteEntry.js)
npm run build

# Then run in preview mode
npm run preview
```

### Development Mode (Limited)

```bash
# Start all MFEs in development mode
# Note: Module Federation won't work, MFEs run independently
npm run dev
```

This will start:
- **Shell** at http://localhost:3000
- **Login MFE** at http://localhost:3001
- **Weather MFE** at http://localhost:3002
- **Population MFE** at http://localhost:3003

### Production Build

```bash
# Build all MFEs
npm run build

# Preview production build
npm run preview
```

## 🔐 Security Features

### Session Management
- **Base64 Encoding**: Session data is encoded using Base64 + URI encoding for safe storage
- **Expiration**: Sessions auto-expire after 24 hours
- **Shared Format**: Shell and Login MFE use compatible session formats
- **Keys**: `mfe_auth_session`, `mfe_selected_country`

### Cross-MFE Communication
- **EventBus**: Pub/Sub system for real-time state synchronization
- **Event Types**: AUTH.LOGIN, AUTH.LOGOUT, STATE.COUNTRY_SELECTED, etc.
- **Middleware Support**: Log, validate, and transform events
- **No Direct DOM Access**: MFEs communicate only through the event system

## 🔑 Demo Credentials

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |
| User  | user     | user123   |
| Guest | guest    | guest123  |

## 📱 Features

### Login MFE
- User authentication with demo credentials
- Country selection from REST Countries API
- Session persistence across MFEs
- 🆕 EventBus integration for cross-MFE communication

### Weather MFE
- Real-time weather data from Open-Meteo API (free, no API key required)
- 7-day forecast
- Weather details: temperature, humidity, wind, pressure

### Population MFE
- Population statistics from REST Countries API
- Historical data from World Bank API
- Demographic information: languages, currencies, area

## 🛠️ Technology Stack

- **React 18** - UI Framework
- **Vite 5** - Build Tool
- **@originjs/vite-plugin-federation** - Module Federation Plugin
- **React Router 6** - Navigation
- **Base64 Encoding** - Session storage encoding

## 📡 APIs Used

| Service | API | Purpose |
|---------|-----|---------|
| Countries | [REST Countries](https://restcountries.com) | Country data & flags |
| Weather | [Open-Meteo](https://open-meteo.com) | Weather forecasts |
| Population | [World Bank](https://data.worldbank.org) | Historical population |

## 🔄 Data Flow

```
1. User logs in (Login MFE)
      ↓
2. Session stored (Base64 encoded) in sessionStorage
      ↓
3. EventBus publishes: AUTH.LOGIN event
      ↓
4. Shell & other MFEs receive session update
      ↓
5. User selects country (Login MFE)
      ↓
6. Country stored (Base64 encoded) in sessionStorage
      ↓
7. EventBus publishes: STATE.COUNTRY_SELECTED event
      ↓
8. Weather & Population MFEs fetch data for selected country
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAMS_UPDATED.md) | 🆕 17 Mermaid diagrams including mindmaps |
| [Getting Started](./docs/GETTING_STARTED.md) | Quick start guide |
| [Architecture](./docs/ARCHITECTURE.md) | Architecture overview |
| [EventBus API](./docs/API_EVENT_BUS.md) | EventBus documentation |
| [State Store API](./docs/API_STATE_STORE.md) | State management |
| [Auth Service API](./docs/API_AUTH_SERVICE.md) | Authentication service |
| [Testing](./docs/TESTING.md) | Testing guide |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Common issues & solutions |

## 🧪 Testing Individual MFEs

Each MFE can run standalone for development:

```bash
# Login MFE only
cd login-mfe && npm run dev

# Weather MFE only  
cd weather-mfe && npm run dev

# Population MFE only
cd population-mfe && npm run dev
```

### Running Unit Tests

```bash
# Run all tests
npm test

# Run tests for specific MFE
cd login-mfe && npm test
cd weather-mfe && npm test
cd population-mfe && npm test
cd shared && npm test
```

## 🐛 Troubleshooting

### Blank Page on Load
Module Federation requires built `remoteEntry.js` files. Run:
```bash
npm run build
npm run preview
```

### Session Not Persisting
Clear browser sessionStorage and try again:
```javascript
sessionStorage.clear()
```

### MFE Not Loading
Check that all MFEs are running on their respective ports:
- Shell: http://localhost:3000
- Login MFE: http://localhost:3001
- Weather MFE: http://localhost:3002
- Population MFE: http://localhost:3003

## 📄 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

MIT License - Feel free to use this for learning and development!
