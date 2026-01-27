# Micro Frontend Application

A complete micro frontend architecture demonstration using **React**, **Vite**, and **Module Federation**.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Shell Application                         │
│                     (Host - Port 3000)                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Navigation Bar                        │ │
│  │  [Countries] [Weather] [Population]     👤 User | Logout │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │                 Micro Frontend Container                 │ │
│  │                                                          │ │
│  │   ┌──────────┐   ┌──────────┐   ┌──────────────┐        │ │
│  │   │  Login   │   │ Weather  │   │  Population  │        │ │
│  │   │   MFE    │   │   MFE    │   │     MFE      │        │ │
│  │   │  :3001   │   │  :3002   │   │    :3003     │        │ │
│  │   └──────────┘   └──────────┘   └──────────────┘        │ │
│  │                                                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Shared Session (Encrypted)
                              │ Event Bus Communication
                              ▼
                    ┌─────────────────────┐
                    │   Session Storage   │
                    │   (Encrypted Data)  │
                    └─────────────────────┘
```

## 📦 Project Structure

```
mfe-app/
├── package.json          # Root package with workspace scripts
├── shared/               # Shared authentication & event utilities
│   └── src/
│       ├── auth.js       # Session management with encryption
│       ├── events.js     # Cross-MFE event bus
│       └── index.js
├── shell/                # Host application (Port 3000)
│   ├── src/
│   │   ├── App.jsx       # Main routing & layout
│   │   ├── main.jsx
│   │   └── index.css     # Global styles
│   └── vite.config.js    # Module Federation config
├── login-mfe/            # Login & Countries MFE (Port 3001)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── LoginForm.jsx
│   │   │   └── CountryList.jsx
│   │   └── styles.css
│   └── vite.config.js
├── weather-mfe/          # Weather Display MFE (Port 3002)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   └── WeatherDisplay.jsx
│   │   └── styles.css
│   └── vite.config.js
└── population-mfe/       # Population Stats MFE (Port 3003)
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   └── PopulationDisplay.jsx
    │   └── styles.css
    └── vite.config.js
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

### Development Mode

```bash
# Start all MFEs in development mode
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
- **Encrypted Storage**: Session data is encrypted using Base64 + URI encoding
- **Expiration**: Sessions auto-expire after 24 hours
- **Token Validation**: API calls validate auth tokens with timestamp checks

### Cross-MFE Communication
- **Event Bus**: Secure custom events for state synchronization
- **Scoped Storage**: Each MFE accesses shared state through controlled APIs
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
- **Module Federation** - Micro Frontend Architecture
- **React Router 6** - Navigation

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
2. Session stored encrypted in sessionStorage
      ↓
3. Event dispatched: 'mfe:session-changed'
      ↓
4. Shell & other MFEs receive session update
      ↓
5. User selects country (Login MFE)
      ↓
6. Country stored encrypted in sessionStorage
      ↓
7. Event dispatched: 'mfe:country-changed'
      ↓
8. Weather & Population MFEs fetch data for selected country
```

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

## 📝 License

MIT License - Feel free to use this for learning and development!
