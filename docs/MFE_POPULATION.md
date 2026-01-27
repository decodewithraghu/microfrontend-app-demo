# Population MFE Documentation

## Population Statistics Micro Frontend

The Population MFE displays population statistics and demographic information for the selected country using the **REST Countries API** and **World Bank API** data.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Module Federation Config](#module-federation-config)
5. [Components](#components)
6. [Data Visualization](#data-visualization)
7. [Event Integration](#event-integration)
8. [Styling](#styling)
9. [Testing](#testing)
10. [Performance](#performance)

---

## Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                       POPULATION MFE                              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  🇫🇷 France                              Population Stats    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │ Population  │ │ Area (km²)  │ │  Density    │ │   Region    ││
│  │   67.39M    │ │  643,801    │ │  104.7/km²  │ │   Europe    ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Regional Comparison                       │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │ ████████████████████████████████  Germany 83.2M      │  │ │
│  │  │ █████████████████████████  France 67.4M              │  │ │
│  │  │ ████████████████████  UK 67.2M                       │  │ │
│  │  │ ███████████████  Italy 60.4M                         │  │ │
│  │  │ ██████████████  Spain 47.4M                          │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| Population Stats | Display population, area, density |
| Regional Comparison | Compare with countries in same region |
| Demographics | Languages, currencies, capital city |
| Auto-update | Reacts to country selection via EventBus |
| REST Countries API | Primary data source for country info |
| World Bank API | Historical population data |

---

## Architecture

### File Structure

```
population-mfe/
├── src/
│   ├── App.jsx                  # Main exported component
│   ├── main.jsx                 # Standalone entry point
│   ├── components/
│   │   ├── PopulationDisplay.jsx    # Main display component
│   │   ├── StatCard.jsx             # Statistics card
│   │   ├── RegionalChart.jsx        # Regional comparison chart
│   │   ├── ComparisonBar.jsx        # Comparison bar
│   │   ├── LoadingState.jsx         # Loading indicator
│   │   └── ErrorState.jsx           # Error display
│   ├── hooks/
│   │   └── useRegionalData.js   # Regional comparison hook
│   ├── services/
│   │   └── populationApi.js     # API integration
│   ├── utils/
│   │   └── formatters.js        # Number formatting utilities
│   └── styles/
│       └── Population.css       # Component styles
├── public/
├── vite.config.js               # Module Federation config
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
      name: 'populationMFE',
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
    port: 3003,
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
import PopulationDisplay from './components/PopulationDisplay';
import './styles/Population.css';

function App() {
  // Track MFE lifecycle
  useMFELifecycle('PopulationMFE');

  const { isAuthenticated } = useAuth();
  const { selectedCountry, hasCountry } = useCountry();

  // Auth guard
  if (!isAuthenticated) {
    return (
      <div className="population-mfe auth-required">
        <p>Please login to view population statistics.</p>
      </div>
    );
  }

  // Country selection required
  if (!hasCountry) {
    return (
      <div className="population-mfe no-country">
        <p>Please select a country to view its population data.</p>
      </div>
    );
  }

  return (
    <div className="population-mfe">
      <PopulationDisplay country={selectedCountry} />
    </div>
  );
}

export default App;
```

### PopulationDisplay.jsx

```javascript
import React, { useEffect, useState } from 'react';
import {
  useEventBus,
  useEventPublisher,
  useLoading,
  useError,
  EventTypes,
} from '@mfe/shared';
import { fetchRegionalCountries } from '../services/populationApi';
import { formatNumber, formatArea, formatDensity } from '../utils/formatters';
import StatCard from './StatCard';
import RegionalChart from './RegionalChart';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

function PopulationDisplay({ country }) {
  const [regionalData, setRegionalData] = useState([]);
  
  const { isLoading, withLoading } = useLoading('population');
  const { error, setError, clearError } = useError('population');
  const publish = useEventPublisher();

  // Fetch regional comparison data
  const loadRegionalData = async (countryData) => {
    clearError();
    
    try {
      const data = await withLoading(async () => {
        return await fetchRegionalCountries(countryData.region);
      });
      
      // Sort by population and take top 10
      const sorted = data
        .sort((a, b) => b.population - a.population)
        .slice(0, 10);
      
      setRegionalData(sorted);
      
      // Publish success event
      publish(EventTypes.DATA.POPULATION_LOADED, {
        country: countryData.name.common,
        regional: sorted.length,
      });
    } catch (err) {
      setError(err.message || 'Failed to load population data');
      
      publish(EventTypes.SYSTEM.MFE_ERROR, {
        mfe: 'PopulationMFE',
        error: err.message,
      });
    }
  };

  // Load data when country changes
  useEffect(() => {
    if (country?.region) {
      loadRegionalData(country);
    }
  }, [country?.cca2]);

  // Listen for country selection changes
  useEventBus(EventTypes.STATE.COUNTRY_SELECTED, (payload) => {
    if (payload.country?.region) {
      loadRegionalData(payload.country);
    }
  });

  // Calculate density
  const density = country.area > 0 
    ? country.population / country.area 
    : 0;

  // Loading state
  if (isLoading) {
    return <LoadingState message="Loading population data..." />;
  }

  // Error state
  if (error) {
    return (
      <ErrorState 
        message={error} 
        onRetry={() => loadRegionalData(country)}
      />
    );
  }

  return (
    <div className="population-display">
      {/* Header */}
      <header className="population-header">
        <div className="country-info">
          <img 
            src={country.flags?.png} 
            alt={`${country.name.common} flag`}
            className="country-flag"
          />
          <div>
            <h1>{country.name.common}</h1>
            <span className="official-name">{country.name.official}</span>
          </div>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className="stat-cards">
        <StatCard
          icon="👥"
          label="Population"
          value={formatNumber(country.population)}
          detail="Total inhabitants"
        />
        <StatCard
          icon="📐"
          label="Area"
          value={formatArea(country.area)}
          detail="Square kilometers"
        />
        <StatCard
          icon="📊"
          label="Density"
          value={formatDensity(density)}
          detail="People per km²"
        />
        <StatCard
          icon="🌍"
          label="Region"
          value={country.region}
          detail={country.subregion}
        />
      </div>

      {/* Regional Comparison */}
      {regionalData.length > 0 && (
        <div className="regional-section">
          <h2>Regional Comparison</h2>
          <p className="section-subtitle">
            Population comparison with other {country.region} countries
          </p>
          <RegionalChart 
            data={regionalData} 
            highlighted={country.cca2}
          />
        </div>
      )}

      {/* Additional Info */}
      <div className="additional-info">
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Capital</span>
            <span className="info-value">
              {country.capital?.join(', ') || 'N/A'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Languages</span>
            <span className="info-value">
              {Object.values(country.languages || {}).join(', ') || 'N/A'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Currencies</span>
            <span className="info-value">
              {Object.values(country.currencies || {})
                .map(c => `${c.name} (${c.symbol})`)
                .join(', ') || 'N/A'}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">Timezone</span>
            <span className="info-value">
              {country.timezones?.[0] || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PopulationDisplay;
```

### StatCard.jsx

```javascript
import React from 'react';

function StatCard({ icon, label, value, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {detail && <span className="stat-detail">{detail}</span>}
      </div>
    </div>
  );
}

export default StatCard;
```

### RegionalChart.jsx

```javascript
import React from 'react';
import ComparisonBar from './ComparisonBar';
import { formatNumber } from '../utils/formatters';

function RegionalChart({ data, highlighted }) {
  // Find max population for scaling
  const maxPopulation = Math.max(...data.map(c => c.population));

  return (
    <div className="regional-chart">
      {data.map((country, index) => (
        <ComparisonBar
          key={country.cca2}
          rank={index + 1}
          country={country}
          percentage={(country.population / maxPopulation) * 100}
          isHighlighted={country.cca2 === highlighted}
          population={formatNumber(country.population)}
        />
      ))}
    </div>
  );
}

export default RegionalChart;
```

### ComparisonBar.jsx

```javascript
import React from 'react';

function ComparisonBar({ rank, country, percentage, isHighlighted, population }) {
  return (
    <div className={`comparison-bar ${isHighlighted ? 'highlighted' : ''}`}>
      <div className="bar-rank">{rank}</div>
      
      <div className="bar-country">
        <img 
          src={country.flags?.png} 
          alt="" 
          className="bar-flag"
        />
        <span className="bar-name">{country.name.common}</span>
      </div>
      
      <div className="bar-container">
        <div 
          className="bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="bar-value">{population}</div>
    </div>
  );
}

export default ComparisonBar;
```

---

## Data Visualization

### Formatters (utils/formatters.js)

```javascript
// Format large numbers with suffixes
export function formatNumber(num) {
  if (num === null || num === undefined) return 'N/A';
  
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

// Format area with proper unit
export function formatArea(area) {
  if (!area) return 'N/A';
  return area.toLocaleString() + ' km²';
}

// Format population density
export function formatDensity(density) {
  if (!density) return 'N/A';
  return density.toFixed(1) + '/km²';
}

// Format percentage
export function formatPercentage(value, total) {
  if (!value || !total) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}
```

---

## API Integration

### services/populationApi.js

```javascript
const BASE_URL = 'https://restcountries.com/v3.1';

// Cache for regional data
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchRegionalCountries(region) {
  if (!region) {
    throw new Error('Region is required');
  }

  const cacheKey = `region:${region.toLowerCase()}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${BASE_URL}/region/${encodeURIComponent(region)}?fields=name,population,area,flags,cca2,region,subregion`
    );

    if (!response.ok) {
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

// Fetch all countries (for global comparisons)
export async function fetchAllCountries() {
  const cacheKey = 'all-countries';
  
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch(
    `${BASE_URL}/all?fields=name,population,area,flags,cca2,region`
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  return data;
}

// Clear cache
export function clearPopulationCache() {
  cache.clear();
}
```

---

## Event Integration

### Events Subscribed

| Event | Handler | Description |
|-------|---------|-------------|
| `mfe:state:country-selected` | `loadRegionalData()` | Reload data when country changes |

### Events Published

| Event | When | Payload |
|-------|------|---------|
| `mfe:data:population-loaded` | Data loaded | `{ country, regional }` |
| `mfe:system:mfe-mounted` | Component mount | `{ name: 'PopulationMFE' }` |
| `mfe:system:mfe-unmounted` | Component unmount | `{ name: 'PopulationMFE' }` |
| `mfe:system:mfe-error` | API error | `{ mfe, error }` |

---

## Styling

### Population.css

```css
/* Container */
.population-mfe {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.population-mfe.auth-required,
.population-mfe.no-country {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #a0a0a0;
}

/* Header */
.population-header {
  margin-bottom: 2rem;
}

.country-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.country-flag {
  width: 64px;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.country-info h1 {
  margin: 0;
  color: #fff;
  font-size: 2rem;
}

.official-name {
  color: #a0a0a0;
  font-size: 0.9rem;
}

/* Statistics Cards */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.stat-icon {
  font-size: 2rem;
  line-height: 1;
}

.stat-content {
  display: flex;
  flex-direction: column;
}

.stat-label {
  color: #a0a0a0;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  color: #fff;
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0.25rem 0;
}

.stat-detail {
  color: #666;
  font-size: 0.8rem;
}

/* Regional Section */
.regional-section {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.regional-section h2 {
  color: #fff;
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.section-subtitle {
  color: #a0a0a0;
  margin: 0 0 1.5rem;
  font-size: 0.9rem;
}

/* Regional Chart */
.regional-chart {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.comparison-bar {
  display: grid;
  grid-template-columns: 30px 150px 1fr 80px;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.comparison-bar:hover {
  background: rgba(255, 255, 255, 0.05);
}

.comparison-bar.highlighted {
  background: rgba(74, 144, 217, 0.2);
  border-left: 3px solid #4a90d9;
}

.bar-rank {
  color: #666;
  font-weight: 500;
  text-align: center;
}

.bar-country {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bar-flag {
  width: 24px;
  height: auto;
  border-radius: 2px;
}

.bar-name {
  color: #fff;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-container {
  height: 20px;
  background: #16213e;
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a90d9, #63b3ed);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.comparison-bar.highlighted .bar-fill {
  background: linear-gradient(90deg, #4a90d9, #90cdf4);
}

.bar-value {
  color: #a0a0a0;
  font-size: 0.85rem;
  text-align: right;
}

/* Additional Info */
.additional-info {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  color: #a0a0a0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-value {
  color: #fff;
  font-size: 0.95rem;
}

/* Loading & Error States */
.loading-state,
.error-state {
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

/* Responsive */
@media (max-width: 768px) {
  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .comparison-bar {
    grid-template-columns: 25px 120px 1fr 70px;
    gap: 0.5rem;
  }
  
  .bar-name {
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .stat-cards {
    grid-template-columns: 1fr;
  }
  
  .comparison-bar {
    grid-template-columns: 25px 1fr 60px;
  }
  
  .bar-container {
    display: none;
  }
}
```

---

## Testing

### Unit Tests (Jest)

```javascript
// PopulationDisplay.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import PopulationDisplay from './PopulationDisplay';
import { fetchRegionalCountries } from '../services/populationApi';

jest.mock('../services/populationApi');
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
    DATA: { POPULATION_LOADED: 'mfe:data:population-loaded' },
    SYSTEM: { MFE_ERROR: 'mfe:system:mfe-error' },
  },
}));

const mockCountry = {
  cca2: 'FR',
  name: { common: 'France', official: 'French Republic' },
  population: 67390000,
  area: 643801,
  region: 'Europe',
  subregion: 'Western Europe',
  capital: ['Paris'],
  flags: { png: 'https://example.com/fr.png' },
  languages: { fra: 'French' },
  currencies: { EUR: { name: 'Euro', symbol: '€' } },
  timezones: ['UTC+01:00'],
};

const mockRegionalData = [
  { cca2: 'DE', name: { common: 'Germany' }, population: 83200000, flags: { png: '' } },
  { cca2: 'FR', name: { common: 'France' }, population: 67390000, flags: { png: '' } },
  { cca2: 'GB', name: { common: 'United Kingdom' }, population: 67200000, flags: { png: '' } },
];

describe('PopulationDisplay', () => {
  beforeEach(() => {
    fetchRegionalCountries.mockResolvedValue(mockRegionalData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('displays country information', async () => {
    render(<PopulationDisplay country={mockCountry} />);
    
    await waitFor(() => {
      expect(screen.getByText('France')).toBeInTheDocument();
      expect(screen.getByText('French Republic')).toBeInTheDocument();
    });
  });

  test('displays population statistics', async () => {
    render(<PopulationDisplay country={mockCountry} />);
    
    await waitFor(() => {
      expect(screen.getByText('67.39M')).toBeInTheDocument();
      expect(screen.getByText('643,801 km²')).toBeInTheDocument();
    });
  });

  test('displays regional comparison', async () => {
    render(<PopulationDisplay country={mockCountry} />);
    
    await waitFor(() => {
      expect(screen.getByText('Regional Comparison')).toBeInTheDocument();
      expect(screen.getByText('Germany')).toBeInTheDocument();
    });
  });

  test('highlights selected country in chart', async () => {
    render(<PopulationDisplay country={mockCountry} />);
    
    await waitFor(() => {
      const franceBar = screen.getByText('France').closest('.comparison-bar');
      expect(franceBar).toHaveClass('highlighted');
    });
  });
});
```

### E2E Tests (Cypress)

```javascript
// cypress/e2e/population.cy.js
describe('Population MFE', () => {
  beforeEach(() => {
    cy.login('admin', 'admin123');
    cy.selectCountry('France');
    cy.visit('/population');
  });

  it('displays population statistics', () => {
    cy.contains('France');
    cy.contains('Population');
    cy.contains('Area');
    cy.contains('Density');
  });

  it('shows regional comparison chart', () => {
    cy.contains('Regional Comparison');
    cy.get('.comparison-bar').should('have.length.at.least', 1);
  });

  it('highlights selected country', () => {
    cy.get('.comparison-bar.highlighted').should('exist');
    cy.get('.comparison-bar.highlighted').contains('France');
  });

  it('displays additional information', () => {
    cy.contains('Capital');
    cy.contains('Paris');
    cy.contains('Languages');
  });

  it('updates when country changes', () => {
    cy.selectCountry('Germany');
    cy.contains('Germany');
    cy.get('.comparison-bar.highlighted').contains('Germany');
  });
});
```

---

## Performance

### Optimization Strategies

```javascript
// 1. Cache regional data
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

// 2. Memoize expensive calculations
import { useMemo } from 'react';

function PopulationDisplay({ country }) {
  const density = useMemo(() => {
    return country.area > 0 ? country.population / country.area : 0;
  }, [country.population, country.area]);

  const sortedRegional = useMemo(() => {
    return [...regionalData].sort((a, b) => b.population - a.population);
  }, [regionalData]);
}

// 3. Virtual list for large datasets
function RegionalChart({ data }) {
  // Only render visible items
  const visibleData = data.slice(0, 10);
  return (
    <div className="regional-chart">
      {visibleData.map(country => (
        <ComparisonBar key={country.cca2} country={country} />
      ))}
    </div>
  );
}

// 4. Lazy load chart components
const RegionalChart = lazy(() => import('./RegionalChart'));
```

---

## Standalone Development

```bash
cd population-mfe
npm install
npm run dev
# Open http://localhost:3003
```

---

## Next Steps

- [Shell Documentation](./MFE_SHELL.md)
- [Weather MFE](./MFE_WEATHER.md)
- [Architecture Overview](./ARCHITECTURE.md)
