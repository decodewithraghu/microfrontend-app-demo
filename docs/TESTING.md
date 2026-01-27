# Testing Guide

## Comprehensive Testing for MFE Application

This guide covers testing strategies for the micro frontend application including unit tests, integration tests, and end-to-end tests.

---

## Table of Contents

1. [Testing Strategy](#testing-strategy)
2. [Unit Testing with Jest](#unit-testing-with-jest)
3. [Component Testing](#component-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing with Cypress](#e2e-testing-with-cypress)
6. [Testing the Shared Library](#testing-the-shared-library)
7. [Test Coverage](#test-coverage)
8. [CI/CD Integration](#cicd-integration)
9. [Best Practices](#best-practices)

---

## Testing Strategy

### ⚠️ Important Note on Integration Testing

**Module Federation requires build before testing.** For integration tests involving multiple MFEs:

```bash
# Build all MFEs first
npm run build

# Then run preview for E2E tests
npm run preview
```

### Testing Pyramid

```
                    ┌──────────┐
                    │   E2E    │ ← Fewer, slower, more comprehensive
                    │  Tests   │
                   ─┴──────────┴─
                 ┌────────────────┐
                 │  Integration   │ ← Medium coverage
                 │    Tests       │
                ─┴────────────────┴─
              ┌──────────────────────┐
              │    Unit Tests         │ ← Many, fast, focused
              │  (Jest + RTL)        │
              └──────────────────────┘
```

### What to Test

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | Jest | Functions, hooks, utilities |
| Component | React Testing Library | UI components, user interactions |
| Integration | Jest + RTL | Component communication, state |
| E2E | Cypress | Full user flows, MFE integration |

---

## Unit Testing with Jest

### Setup

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': 'identity-obj-proxy',
    '^@mfe/shared$': '<rootDir>/../shared/src/index.js',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
    '!src/**/*.test.{js,jsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

```javascript
// jest.setup.js
import '@testing-library/jest-dom';

// Mock window.matchMedia
window.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn(),
  removeItem: jest.fn(),
};
global.localStorage = localStorageMock;
```

### Testing Utility Functions

```javascript
// utils/formatters.test.js
import { formatNumber, formatArea, formatDensity } from './formatters';

describe('formatNumber', () => {
  test('formats millions correctly', () => {
    expect(formatNumber(67390000)).toBe('67.39M');
  });

  test('formats billions correctly', () => {
    expect(formatNumber(1400000000)).toBe('1.40B');
  });

  test('formats thousands correctly', () => {
    expect(formatNumber(5000)).toBe('5.0K');
  });

  test('handles small numbers', () => {
    expect(formatNumber(999)).toBe('999');
  });

  test('handles null/undefined', () => {
    expect(formatNumber(null)).toBe('N/A');
    expect(formatNumber(undefined)).toBe('N/A');
  });
});

describe('formatArea', () => {
  test('formats area with unit', () => {
    expect(formatArea(643801)).toBe('643,801 km²');
  });

  test('handles zero', () => {
    expect(formatArea(0)).toBe('N/A');
  });
});

describe('formatDensity', () => {
  test('formats density with one decimal', () => {
    expect(formatDensity(104.7)).toBe('104.7/km²');
  });

  test('handles zero', () => {
    expect(formatDensity(0)).toBe('N/A');
  });
});
```

### Testing Custom Hooks

```javascript
// hooks/useWeather.test.js
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWeather } from './useWeather';
import { fetchWeather } from '../services/weatherApi';

jest.mock('../services/weatherApi');

describe('useWeather', () => {
  const mockWeatherData = {
    main: { temp: 22, humidity: 45 },
    weather: [{ description: 'clear sky' }],
  };

  beforeEach(() => {
    fetchWeather.mockResolvedValue(mockWeatherData);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('fetches weather data', async () => {
    const { result } = renderHook(() => useWeather('Paris'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockWeatherData);
    expect(fetchWeather).toHaveBeenCalledWith('Paris');
  });

  test('handles errors', async () => {
    fetchWeather.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useWeather('InvalidCity'));

    await waitFor(() => {
      expect(result.current.error).toBe('API Error');
    });
  });

  test('refetches when city changes', async () => {
    const { result, rerender } = renderHook(
      ({ city }) => useWeather(city),
      { initialProps: { city: 'Paris' } }
    );

    await waitFor(() => {
      expect(fetchWeather).toHaveBeenCalledWith('Paris');
    });

    rerender({ city: 'London' });

    await waitFor(() => {
      expect(fetchWeather).toHaveBeenCalledWith('London');
    });
  });
});
```

---

## Component Testing

### Testing React Components

```javascript
// components/LoginForm.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';
import { useAuth } from '@mfe/shared';

jest.mock('@mfe/shared', () => ({
  useAuth: jest.fn(),
  useEventPublisher: () => jest.fn(),
  useNotifications: () => ({
    showSuccess: jest.fn(),
    showError: jest.fn(),
  }),
}));

describe('LoginForm', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    useAuth.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders login form elements', () => {
      render(<LoginForm />);

      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    test('displays demo credentials', () => {
      render(<LoginForm />);

      expect(screen.getByText(/admin/)).toBeInTheDocument();
      expect(screen.getByText(/user/)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    test('shows error for empty username', async () => {
      render(<LoginForm />);

      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByText('Username is required')).toBeInTheDocument();
    });

    test('shows error for short username', async () => {
      render(<LoginForm />);

      await userEvent.type(screen.getByLabelText(/username/i), 'ab');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });

    test('shows error for empty password', async () => {
      render(<LoginForm />);

      await userEvent.type(screen.getByLabelText(/username/i), 'admin');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    test('calls login with credentials', async () => {
      mockLogin.mockResolvedValue({ success: true, user: { name: 'Admin' } });

      render(<LoginForm />);

      await userEvent.type(screen.getByLabelText(/username/i), 'admin');
      await userEvent.type(screen.getByLabelText(/password/i), 'admin123');
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123');
    });

    test('disables form during submission', () => {
      useAuth.mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
      });

      render(<LoginForm />);

      expect(screen.getByLabelText(/username/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    test('displays authentication error', () => {
      useAuth.mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Invalid credentials',
      });

      render(<LoginForm />);

      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
```

### Testing with Context

```javascript
// components/Header.test.jsx
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Header from './Header';

const mockUseAuth = jest.fn();
const mockUseCountry = jest.fn();

jest.mock('@mfe/shared', () => ({
  useAuth: () => mockUseAuth(),
  useCountry: () => mockUseCountry(),
}));

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Header', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
    });
    mockUseCountry.mockReturnValue({
      selectedCountry: null,
    });
  });

  test('shows login link when not authenticated', () => {
    renderWithRouter(<Header />);
    
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  test('shows user menu when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { name: 'Admin' },
      logout: jest.fn(),
    });

    renderWithRouter(<Header />);
    
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('displays selected country', () => {
    mockUseCountry.mockReturnValue({
      selectedCountry: {
        name: { common: 'France' },
        flags: { png: 'https://example.com/fr.png' },
      },
    });

    renderWithRouter(<Header />);
    
    expect(screen.getByText('France')).toBeInTheDocument();
  });
});
```

---

## Integration Testing

### Testing Event Bus Integration

```javascript
// integration/eventBus.test.js
import { eventBus, EventTypes, stateStore } from '@mfe/shared';

describe('Event Bus Integration', () => {
  beforeEach(() => {
    eventBus.clearAllSubscriptions();
    stateStore.reset();
  });

  test('country selection updates state store', async () => {
    const country = { cca2: 'FR', name: { common: 'France' } };

    await eventBus.publish(EventTypes.STATE.COUNTRY_SELECTED, { country });

    const state = stateStore.getState();
    expect(state.country.selectedCountry).toEqual(country);
  });

  test('login event updates auth state', async () => {
    const user = { id: 1, name: 'Admin', role: 'admin' };

    await eventBus.publish(EventTypes.AUTH.LOGIN, { user, token: 'abc123' });

    const state = stateStore.getState();
    expect(state.auth.isAuthenticated).toBe(true);
    expect(state.auth.user).toEqual(user);
  });

  test('logout clears auth and country state', async () => {
    // Setup initial state
    stateStore.dispatch({
      type: 'SET_AUTH',
      payload: { user: { name: 'Admin' }, isAuthenticated: true },
    });
    stateStore.dispatch({
      type: 'SET_COUNTRY',
      payload: { selectedCountry: { name: 'France' } },
    });

    await eventBus.publish(EventTypes.AUTH.LOGOUT);

    const state = stateStore.getState();
    expect(state.auth.isAuthenticated).toBe(false);
    expect(state.country.selectedCountry).toBeNull();
  });
});
```

### Testing MFE Communication

```javascript
// integration/mfeCommunication.test.js
import { render, screen, waitFor } from '@testing-library/react';
import { eventBus, EventTypes } from '@mfe/shared';
import WeatherDisplay from '../weather-mfe/src/components/WeatherDisplay';
import PopulationDisplay from '../population-mfe/src/components/PopulationDisplay';

describe('MFE Communication', () => {
  const mockCountry = {
    cca2: 'FR',
    name: { common: 'France' },
    region: 'Europe',
    capital: ['Paris'],
    population: 67390000,
    area: 643801,
    flags: { png: '' },
  };

  test('Weather MFE responds to country selection', async () => {
    render(<WeatherDisplay country={mockCountry} />);

    // Simulate country selection from another MFE
    await eventBus.publish(EventTypes.STATE.COUNTRY_SELECTED, {
      country: { ...mockCountry, name: { common: 'Germany' } },
    });

    await waitFor(() => {
      expect(screen.getByText('Germany')).toBeInTheDocument();
    });
  });

  test('Population MFE responds to country selection', async () => {
    render(<PopulationDisplay country={mockCountry} />);

    await eventBus.publish(EventTypes.STATE.COUNTRY_SELECTED, {
      country: { ...mockCountry, name: { common: 'Spain' } },
    });

    await waitFor(() => {
      expect(screen.getByText('Spain')).toBeInTheDocument();
    });
  });
});
```

---

## E2E Testing with Cypress

### Setup

```javascript
// cypress.config.js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
```

### Custom Commands

```javascript
// cypress/support/commands.js

// Login command
Cypress.Commands.add('login', (username, password) => {
  cy.visit('/login');
  cy.get('input[name="username"]').type(username);
  cy.get('input[name="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('not.include', '/login');
});

// Logout command
Cypress.Commands.add('logout', () => {
  cy.contains('Logout').click();
  cy.url().should('include', '/login');
});

// Select country command
Cypress.Commands.add('selectCountry', (countryName) => {
  cy.visit('/');
  cy.get('.country-search').type(countryName);
  cy.contains(countryName).click();
});

// Wait for MFE to load
Cypress.Commands.add('waitForMFE', (mfeName) => {
  cy.get(`[data-mfe="${mfeName}"]`, { timeout: 10000 }).should('be.visible');
});
```

### E2E Test Suites

```javascript
// cypress/e2e/auth.cy.js
describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('redirects to login when not authenticated', () => {
    cy.visit('/weather');
    cy.url().should('include', '/login');
  });

  it('successfully logs in with valid credentials', () => {
    cy.login('admin', 'admin123');
    cy.contains('Welcome');
    cy.contains('admin');
  });

  it('shows error with invalid credentials', () => {
    cy.visit('/login');
    cy.get('input[name="username"]').type('invalid');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.contains('Invalid credentials');
  });

  it('successfully logs out', () => {
    cy.login('admin', 'admin123');
    cy.logout();
    cy.contains('Login');
  });

  it('persists session across page refresh', () => {
    cy.login('admin', 'admin123');
    cy.reload();
    cy.contains('admin');
  });
});
```

```javascript
// cypress/e2e/weather.cy.js
describe('Weather MFE', () => {
  beforeEach(() => {
    cy.login('admin', 'admin123');
    cy.selectCountry('France');
  });

  it('displays weather information', () => {
    cy.visit('/weather');
    cy.contains('France');
    cy.get('.temperature').should('be.visible');
    cy.get('.weather-details').should('be.visible');
  });

  it('shows loading state while fetching', () => {
    cy.intercept('GET', '**/weather*', {
      delay: 1000,
      body: { main: { temp: 20 }, weather: [{ description: 'sunny' }] },
    }).as('getWeather');

    cy.visit('/weather');
    cy.get('.loading-spinner').should('be.visible');
    cy.wait('@getWeather');
    cy.get('.loading-spinner').should('not.exist');
  });

  it('handles API errors gracefully', () => {
    cy.intercept('GET', '**/weather*', {
      statusCode: 500,
      body: { error: 'Server error' },
    }).as('getWeatherError');

    cy.visit('/weather');
    cy.wait('@getWeatherError');
    cy.contains('Something went wrong');
    cy.contains('Try Again').should('be.visible');
  });

  it('refreshes data when clicking refresh button', () => {
    cy.intercept('GET', '**/weather*').as('getWeather');
    cy.visit('/weather');
    cy.wait('@getWeather');

    cy.contains('Refresh').click();
    cy.wait('@getWeather');
    cy.get('@getWeather.all').should('have.length', 2);
  });
});
```

```javascript
// cypress/e2e/fullFlow.cy.js
describe('Full User Flow', () => {
  it('completes entire user journey', () => {
    // 1. Visit app
    cy.visit('/');

    // 2. Login
    cy.login('admin', 'admin123');
    cy.contains('Welcome');

    // 3. Select a country
    cy.selectCountry('Germany');

    // 4. View weather
    cy.visit('/weather');
    cy.contains('Germany');
    cy.get('.temperature').should('be.visible');

    // 5. View population
    cy.visit('/population');
    cy.contains('Germany');
    cy.contains('Population');
    cy.get('.stat-card').should('have.length.at.least', 4);

    // 6. Change country
    cy.selectCountry('Japan');
    cy.contains('Japan');

    // 7. Verify weather updated
    cy.visit('/weather');
    cy.contains('Japan');

    // 8. Logout
    cy.logout();
    cy.url().should('include', '/login');
  });
});
```

---

## Testing the Shared Library

```javascript
// shared/src/__tests__/eventBus.test.js
import { eventBus, EventTypes } from '../index';

describe('EventBus', () => {
  beforeEach(() => {
    eventBus.clearAllSubscriptions();
  });

  describe('subscribe/publish', () => {
    test('delivers events to subscribers', async () => {
      const handler = jest.fn();
      eventBus.subscribe(EventTypes.AUTH.LOGIN, handler);

      await eventBus.publish(EventTypes.AUTH.LOGIN, { user: 'test' });

      expect(handler).toHaveBeenCalledWith(
        { user: 'test' },
        expect.any(Object)
      );
    });

    test('supports wildcard subscriptions', async () => {
      const handler = jest.fn();
      eventBus.subscribe('mfe:auth:*', handler);

      await eventBus.publish(EventTypes.AUTH.LOGIN, { user: 'test' });
      await eventBus.publish(EventTypes.AUTH.LOGOUT, {});

      expect(handler).toHaveBeenCalledTimes(2);
    });

    test('unsubscribe stops event delivery', async () => {
      const handler = jest.fn();
      const unsubscribe = eventBus.subscribe(EventTypes.AUTH.LOGIN, handler);

      await eventBus.publish(EventTypes.AUTH.LOGIN, {});
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      await eventBus.publish(EventTypes.AUTH.LOGIN, {});
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('middleware', () => {
    test('middleware can modify events', async () => {
      const handler = jest.fn();
      eventBus.subscribe(EventTypes.AUTH.LOGIN, handler);

      eventBus.use(async (event, next) => {
        event.payload.modified = true;
        return next();
      });

      await eventBus.publish(EventTypes.AUTH.LOGIN, { user: 'test' });

      expect(handler).toHaveBeenCalledWith(
        { user: 'test', modified: true },
        expect.any(Object)
      );
    });

    test('middleware can block events', async () => {
      const handler = jest.fn();
      eventBus.subscribe(EventTypes.AUTH.LOGIN, handler);

      eventBus.use(async (event, next) => {
        return false; // Block event
      });

      await eventBus.publish(EventTypes.AUTH.LOGIN, { user: 'test' });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
```

---

## Test Coverage

### Running Coverage Report

```bash
# Run tests with coverage
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
  './src/components/': {
    branches: 80,
    functions: 80,
  },
  './src/services/': {
    branches: 90,
    functions: 90,
  },
},
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run start &
      - run: npx wait-on http://localhost:3000
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: cypress-screenshots
          path: cypress/screenshots
```

---

## Best Practices

### 1. Test Naming Convention

```javascript
// ✅ Good: Descriptive test names
test('displays error message when login fails with invalid credentials', () => {});

// ❌ Bad: Vague test names
test('error test', () => {});
```

### 2. Arrange-Act-Assert Pattern

```javascript
test('increments counter on button click', () => {
  // Arrange
  render(<Counter initialValue={0} />);
  
  // Act
  fireEvent.click(screen.getByText('Increment'));
  
  // Assert
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### 3. Avoid Testing Implementation Details

```javascript
// ✅ Good: Test behavior
test('submits form with user data', async () => {
  render(<LoginForm />);
  await userEvent.type(screen.getByLabelText('Username'), 'admin');
  await userEvent.click(screen.getByText('Submit'));
  expect(mockSubmit).toHaveBeenCalledWith({ username: 'admin' });
});

// ❌ Bad: Test implementation
test('sets state correctly', () => {
  const { result } = renderHook(() => useLoginForm());
  act(() => result.current.setUsername('admin'));
  expect(result.current.state.username).toBe('admin');
});
```

### 4. Use Test Data Factories

```javascript
// testUtils/factories.js
export const createUser = (overrides = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
  ...overrides,
});

export const createCountry = (overrides = {}) => ({
  cca2: 'US',
  name: { common: 'United States' },
  population: 331000000,
  area: 9833520,
  flags: { png: 'https://example.com/us.png' },
  ...overrides,
});

// Usage
test('displays user name', () => {
  const user = createUser({ name: 'Admin' });
  render(<UserProfile user={user} />);
  expect(screen.getByText('Admin')).toBeInTheDocument();
});
```

---

## Next Steps

- [Deployment Guide](./DEPLOYMENT.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Architecture Overview](./ARCHITECTURE.md)
