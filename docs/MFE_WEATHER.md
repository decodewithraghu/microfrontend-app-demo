# Weather MFE Documentation

## Weather Display Micro Frontend

The Weather MFE displays weather information for the selected country, fetching data from the **Open-Meteo API** (free, no API key required).

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Module Federation Config](#module-federation-config)
5. [Components](#components)
6. [API Integration](#api-integration)
7. [Event Integration](#event-integration)
8. [Styling](#styling)
9. [Testing](#testing)
10. [Error States](#error-states)

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        WEATHER MFE                              │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Selected: 🇫🇷 France                    ☀️ Clear Sky      │ │
│  │                                                           │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐│ │
│  │  │                 │  │  Temperature: 22°C              ││ │
│  │  │   [Weather      │  │  Feels Like: 20°C               ││ │
│  │  │    Icon]        │  │  Humidity: 45%                  ││ │
│  │  │                 │  │  Wind: 12 km/h                  ││ │
│  │  │                 │  │  Pressure: 1015 hPa             ││ │
│  │  └─────────────────┘  └─────────────────────────────────┘│ │
│  │                                                           │ │
│  │  Last updated: 2 minutes ago    [🔄 Refresh]             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| Real-time Data | Fetches current weather from Open-Meteo API (free) |
| 7-Day Forecast | Extended weather forecast |
| Auto-update | Listens for country selection via EventBus |
| No API Key | Uses Open-Meteo which requires no authentication |
| Error Handling | Graceful degradation with retry options |
| Responsive | Works on all screen sizes |

---

## Architecture

### File Structure

```
weather-mfe/
├── src/
│   ├── App.jsx              # Main exported component
│   ├── main.jsx             # Standalone entry point
│   ├── components/
│   │   ├── WeatherDisplay.jsx   # Main weather display
│   │   ├── WeatherCard.jsx      # Weather info card
│   │   ├── WeatherIcon.jsx      # Weather condition icon
│   │   ├── LoadingState.jsx     # Loading indicator
│   │   └── ErrorState.jsx       # Error display
│   ├── hooks/
│   │   └── useWeather.js    # Weather data hook
│   ├── services/
│   │   └── weatherApi.js    # API integration
│   └── styles/
│       └── Weather.css      # Component styles
├── public/
├── vite.config.js           # Module Federation config
└── package.json
```

---

## Module Federation Config

### vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'weatherMFE',
      filename: 'remoteEntry.js',
      
      // Expose components to shell
      exposes: {
        './App': './src/App.jsx',
      },
      
      // Shared dependencies
      shared: ['react', 'react-dom'],
    }),
  ],
  
  server: {
    port: 3002,
    strictPort: true,
    cors: true,
  },
  
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
});
```

---

## Components

### App.jsx (Main Export)

```javascript
import React from 'react';
import {
  useMFELifecycle,
  useAuth,
  useCountry,
} from '@mfe/shared';
import WeatherDisplay from './components/WeatherDisplay';
import './styles/Weather.css';

function App() {
  // Track MFE lifecycle
  useMFELifecycle('WeatherMFE');

  const { isAuthenticated } = useAuth();
  const { selectedCountry, hasCountry } = useCountry();

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="weather-mfe auth-required">
        <p>Please login to view weather information.</p>
      </div>
    );
  }

  // Country selection required
  if (!hasCountry) {
    return (
      <div className="weather-mfe no-country">
        <p>Please select a country to view its weather.</p>
      </div>
    );
  }

  return (
    <div className="weather-mfe">
      <WeatherDisplay country={selectedCountry} />
    </div>
  );
}

export default App;
```

### WeatherDisplay.jsx

```javascript
import React, { useEffect, useState } from 'react';
import {
  useEventBus,
  useEventPublisher,
  useLoading,
  useError,
  EventTypes,
} from '@mfe/shared';
import { fetchWeather } from '../services/weatherApi';
import WeatherCard from './WeatherCard';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

function WeatherDisplay({ country }) {
  const [weather, setWeather] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const { isLoading, withLoading } = useLoading('weather');
  const { error, setError, clearError } = useError('weather');
  const publish = useEventPublisher();

  // Fetch weather for country
  const loadWeather = async (countryData) => {
    clearError();
    
    try {
      const data = await withLoading(async () => {
        // Get capital city for weather lookup
        const city = countryData.capital?.[0] || countryData.name.common;
        return await fetchWeather(city);
      });
      
      setWeather(data);
      setLastUpdated(new Date());
      
      // Publish success event
      publish(EventTypes.DATA.WEATHER_LOADED, {
        country: countryData.name.common,
        weather: data,
      });
    } catch (err) {
      setError(err.message || 'Failed to load weather data');
      
      // Publish error event
      publish(EventTypes.SYSTEM.MFE_ERROR, {
        mfe: 'WeatherMFE',
        error: err.message,
      });
    }
  };

  // Load weather when country changes
  useEffect(() => {
    if (country) {
      loadWeather(country);
    }
  }, [country?.cca2]);

  // Listen for country selection changes
  useEventBus(EventTypes.STATE.COUNTRY_SELECTED, (payload) => {
    if (payload.country) {
      loadWeather(payload.country);
    }
  });

  // Listen for cache invalidation
  useEventBus(EventTypes.DATA.CACHE_INVALIDATED, (payload) => {
    if (payload.dataType === 'weather' && country) {
      loadWeather(country);
    }
  });

  // Handle refresh
  const handleRefresh = () => {
    if (country) {
      loadWeather(country);
    }
  };

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading weather data..." />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState 
        message={error} 
        onRetry={handleRefresh}
      />
    );
  }

  // No data state
  if (!weather) {
    return <LoadingState message="Initializing..." />;
  }

  return (
    <div className="weather-display">
      <header className="weather-header">
        <div className="country-info">
          <img 
            src={country.flags?.png} 
            alt={`${country.name.common} flag`}
            className="country-flag"
          />
          <h1>{country.name.common}</h1>
        </div>
        <div className="weather-summary">
          <span className="condition">{weather.weather[0].description}</span>
        </div>
      </header>

      <WeatherCard weather={weather} />

      <footer className="weather-footer">
        <span className="last-updated">
          {lastUpdated && (
            <>Last updated: {formatTimeAgo(lastUpdated)}</>
          )}
        </span>
        <button 
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          🔄 Refresh
        </button>
      </footer>
    </div>
  );
}

// Helper function
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return date.toLocaleDateString();
}

export default WeatherDisplay;
```

### WeatherCard.jsx

```javascript
import React from 'react';
import WeatherIcon from './WeatherIcon';

function WeatherCard({ weather }) {
  const { main, wind, weather: conditions } = weather;
  const condition = conditions[0];

  return (
    <div className="weather-card">
      <div className="weather-icon-section">
        <WeatherIcon code={condition.icon} />
        <div className="temperature">
          <span className="temp-value">{Math.round(main.temp)}</span>
          <span className="temp-unit">°C</span>
        </div>
      </div>

      <div className="weather-details">
        <div className="detail-row">
          <span className="detail-label">Feels Like</span>
          <span className="detail-value">{Math.round(main.feels_like)}°C</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">Humidity</span>
          <span className="detail-value">{main.humidity}%</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">Wind Speed</span>
          <span className="detail-value">{Math.round(wind.speed * 3.6)} km/h</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">Pressure</span>
          <span className="detail-value">{main.pressure} hPa</span>
        </div>
        
        <div className="detail-row">
          <span className="detail-label">Min / Max</span>
          <span className="detail-value">
            {Math.round(main.temp_min)}°C / {Math.round(main.temp_max)}°C
          </span>
        </div>
      </div>
    </div>
  );
}

export default WeatherCard;
```

### WeatherIcon.jsx

```javascript
import React from 'react';

const iconMap = {
  '01d': '☀️',  // clear sky day
  '01n': '🌙',  // clear sky night
  '02d': '⛅',  // few clouds day
  '02n': '☁️',  // few clouds night
  '03d': '☁️',  // scattered clouds
  '03n': '☁️',
  '04d': '☁️',  // broken clouds
  '04n': '☁️',
  '09d': '🌧️',  // shower rain
  '09n': '🌧️',
  '10d': '🌦️',  // rain day
  '10n': '🌧️',  // rain night
  '11d': '⛈️',  // thunderstorm
  '11n': '⛈️',
  '13d': '❄️',  // snow
  '13n': '❄️',
  '50d': '🌫️',  // mist
  '50n': '🌫️',
};

function WeatherIcon({ code, size = 64 }) {
  const icon = iconMap[code] || '🌡️';

  return (
    <span 
      className="weather-icon" 
      style={{ fontSize: size }}
      role="img"
      aria-label="weather condition"
    >
      {icon}
    </span>
  );
}

export default WeatherIcon;
```

---

## API Integration

### services/weatherApi.js

```javascript
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || 'demo_key';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Simple cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchWeather(city) {
  const cacheKey = `weather:${city.toLowerCase()}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Weather data not found for "${city}"`);
      }
      if (response.status === 401) {
        throw new Error('Invalid API key');
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Cache the response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });

    return data;
  } catch (error) {
    if (error.name === 'TypeError') {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
}

// Clear cache
export function clearWeatherCache() {
  cache.clear();
}

// Get cache stats
export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()),
  };
}
```

### API Response Format

```javascript
// OpenWeatherMap API Response
{
  "coord": { "lon": 2.3488, "lat": 48.8534 },
  "weather": [
    {
      "id": 800,
      "main": "Clear",
      "description": "clear sky",
      "icon": "01d"
    }
  ],
  "main": {
    "temp": 22.5,
    "feels_like": 20.3,
    "temp_min": 19.0,
    "temp_max": 25.0,
    "pressure": 1015,
    "humidity": 45
  },
  "wind": {
    "speed": 3.5,
    "deg": 180
  },
  "name": "Paris"
}
```

---

## Event Integration

### Events Subscribed

| Event | Handler | Description |
|-------|---------|-------------|
| `mfe:state:country-selected` | `loadWeather()` | Reload weather when country changes |
| `mfe:data:cache-invalidated` | `loadWeather()` | Refresh data when cache cleared |

### Events Published

| Event | When | Payload |
|-------|------|---------|
| `mfe:data:weather-loaded` | Data loaded | `{ country, weather }` |
| `mfe:system:mfe-mounted` | Component mount | `{ name: 'WeatherMFE' }` |
| `mfe:system:mfe-unmounted` | Component unmount | `{ name: 'WeatherMFE' }` |
| `mfe:system:mfe-error` | API error | `{ mfe, error }` |

### Integration Example

```javascript
// Subscribe to weather data from another MFE
useEventBus(EventTypes.DATA.WEATHER_LOADED, (payload) => {
  console.log(`Weather loaded for ${payload.country}:`, payload.weather);
});

// Trigger weather refresh from another MFE
publish(EventTypes.DATA.CACHE_INVALIDATED, { dataType: 'weather' });
```

---

## Styling

### Weather.css

```css
/* Container */
.weather-mfe {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.weather-mfe.auth-required,
.weather-mfe.no-country {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #a0a0a0;
}

/* Header */
.weather-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #333;
}

.country-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.country-flag {
  width: 48px;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.country-info h1 {
  margin: 0;
  color: #fff;
  font-size: 1.75rem;
}

.weather-summary .condition {
  color: #a0a0a0;
  font-size: 1.1rem;
  text-transform: capitalize;
}

/* Weather Card */
.weather-card {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
  background: #1a1a2e;
  border-radius: 12px;
  padding: 2rem;
}

.weather-icon-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.weather-icon {
  font-size: 80px;
  line-height: 1;
}

.temperature {
  display: flex;
  align-items: flex-start;
}

.temp-value {
  font-size: 4rem;
  font-weight: 300;
  color: #fff;
  line-height: 1;
}

.temp-unit {
  font-size: 1.5rem;
  color: #a0a0a0;
  margin-top: 0.5rem;
}

/* Weather Details */
.weather-details {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #333;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: #a0a0a0;
}

.detail-value {
  color: #fff;
  font-weight: 500;
}

/* Footer */
.weather-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #333;
}

.last-updated {
  color: #666;
  font-size: 0.85rem;
}

.refresh-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #4a90d9;
  color: #4a90d9;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #4a90d9;
  color: white;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #333;
  border-top-color: #4a90d9;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  color: #a0a0a0;
}

/* Error State */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1rem;
  text-align: center;
}

.error-icon {
  font-size: 3rem;
}

.error-state h3 {
  color: #e74c3c;
  margin: 0;
}

.error-state p {
  color: #a0a0a0;
  max-width: 400px;
}

.retry-btn {
  padding: 0.75rem 1.5rem;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background: #3a7bc8;
}

/* Responsive */
@media (max-width: 600px) {
  .weather-card {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .weather-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }
  
  .weather-footer {
    flex-direction: column;
    gap: 1rem;
  }
}
```

---

## Testing

### Unit Tests (Jest)

```javascript
// WeatherDisplay.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherDisplay from './WeatherDisplay';
import { fetchWeather } from '../services/weatherApi';

jest.mock('../services/weatherApi');
jest.mock('@mfe/shared', () => ({
  useEventBus: jest.fn(),
  useEventPublisher: () => jest.fn(),
  useLoading: () => ({
    isLoading: false,
    withLoading: (fn) => fn(),
  }),
  useError: () => ({
    error: null,
    setError: jest.fn(),
    clearError: jest.fn(),
  }),
  EventTypes: {
    STATE: { COUNTRY_SELECTED: 'mfe:state:country-selected' },
    DATA: { WEATHER_LOADED: 'mfe:data:weather-loaded', CACHE_INVALIDATED: 'mfe:data:cache-invalidated' },
    SYSTEM: { MFE_ERROR: 'mfe:system:mfe-error' },
  },
}));

const mockCountry = {
  cca2: 'FR',
  name: { common: 'France' },
  capital: ['Paris'],
  flags: { png: 'https://example.com/fr.png' },
};

const mockWeather = {
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  main: { temp: 22, feels_like: 20, humidity: 45, pressure: 1015, temp_min: 19, temp_max: 25 },
  wind: { speed: 3.5 },
};

describe('WeatherDisplay', () => {
  beforeEach(() => {
    fetchWeather.mockResolvedValue(mockWeather);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('displays weather data for country', async () => {
    render(<WeatherDisplay country={mockCountry} />);
    
    await waitFor(() => {
      expect(screen.getByText('France')).toBeInTheDocument();
      expect(screen.getByText('22')).toBeInTheDocument();
      expect(screen.getByText('clear sky')).toBeInTheDocument();
    });
  });

  test('fetches weather from capital city', async () => {
    render(<WeatherDisplay country={mockCountry} />);
    
    await waitFor(() => {
      expect(fetchWeather).toHaveBeenCalledWith('Paris');
    });
  });

  test('displays humidity and wind', async () => {
    render(<WeatherDisplay country={mockCountry} />);
    
    await waitFor(() => {
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText(/km\/h/)).toBeInTheDocument();
    });
  });

  test('refresh button reloads data', async () => {
    render(<WeatherDisplay country={mockCountry} />);
    
    await waitFor(() => {
      expect(fetchWeather).toHaveBeenCalledTimes(1);
    });
    
    await userEvent.click(screen.getByText(/Refresh/));
    
    expect(fetchWeather).toHaveBeenCalledTimes(2);
  });
});
```

### E2E Tests (Cypress)

```javascript
// cypress/e2e/weather.cy.js
describe('Weather MFE', () => {
  beforeEach(() => {
    cy.login('admin', 'admin123');
    cy.selectCountry('France');
    cy.visit('/weather');
  });

  it('displays weather information', () => {
    cy.contains('France');
    cy.get('.temperature').should('be.visible');
    cy.get('.weather-details').should('be.visible');
  });

  it('shows weather details', () => {
    cy.contains('Humidity');
    cy.contains('Wind Speed');
    cy.contains('Pressure');
  });

  it('can refresh weather data', () => {
    cy.contains('Refresh').click();
    cy.get('.loading-spinner').should('be.visible');
    cy.get('.weather-card').should('be.visible');
  });

  it('updates when country changes', () => {
    cy.selectCountry('Germany');
    cy.contains('Germany');
  });
});
```

---

## Error States

### LoadingState.jsx

```javascript
function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-state">
      <div className="loading-spinner"></div>
      <p>{message}</p>
    </div>
  );
}
```

### ErrorState.jsx

```javascript
function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <span className="error-icon">⚠️</span>
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="retry-btn" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  );
}
```

---

## Environment Variables

```env
# .env
VITE_OPENWEATHER_API_KEY=your_api_key_here

# .env.development
VITE_OPENWEATHER_API_KEY=demo_key

# .env.production
VITE_OPENWEATHER_API_KEY=production_api_key
```

---

## Standalone Development

```bash
cd weather-mfe
npm install
npm run dev
# Open http://localhost:3002
```

---

## Next Steps

- [Population MFE](./MFE_POPULATION.md)
- [Shell Documentation](./MFE_SHELL.md)
- [Architecture Overview](./ARCHITECTURE.md)
