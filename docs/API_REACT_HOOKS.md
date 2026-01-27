# React Hooks API Documentation

## Custom React Hooks for MFE Integration

The shared library provides a comprehensive set of React hooks for seamless integration with the Event Bus, State Store, and Authentication Service.

---

## Table of Contents

1. [Overview](#overview)
2. [useAuth](#useauth)
3. [useCountry](#usecountry)
4. [useEventBus](#useeventbus)
5. [useEventPublisher](#useeventpublisher)
6. [useStateStore](#usestatestore)
7. [useLoading](#useloading)
8. [useError](#useerror)
9. [useNotifications](#usenotifications)
10. [usePreferences](#usepreferences)
11. [useMFELifecycle](#usemfelifecycle)
12. [useNavigation](#usenavigation)
13. [useEventHistory](#useeventhistory)

---

## Overview

All hooks are designed to:
- **Auto-subscribe** to relevant events/state
- **Auto-cleanup** on component unmount
- **Trigger re-renders** when data changes
- **Provide type-safe** return values

```javascript
import {
  useAuth,
  useCountry,
  useEventBus,
  useEventPublisher,
  useStateStore,
  useLoading,
  useError,
  useNotifications,
  usePreferences,
  useMFELifecycle,
  useNavigation,
  useEventHistory,
} from '@mfe/shared';
```

---

## useAuth

Manage authentication state and actions.

### Returns

```typescript
{
  user: User | null;              // Current user
  isAuthenticated: boolean;       // Auth status
  isLoading: boolean;             // Login in progress
  error: string | null;           // Error message
  login: (username, password) => Promise<Result>;
  logout: () => void;
  refreshSession: () => Promise<Result>;
  hasRole: (role) => boolean;
  hasPermission: (permission) => boolean;
  getToken: () => string | null;
}
```

### Example

```javascript
import { useAuth, Roles } from '@mfe/shared';

function UserProfile() {
  const { 
    user, 
    isAuthenticated, 
    logout, 
    hasRole 
  } = useAuth();

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <h2>Welcome, {user.name}</h2>
      <p>Role: {user.role}</p>
      
      {hasRole(Roles.ADMIN) && (
        <Link to="/admin">Admin Panel</Link>
      )}
      
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Login Form Example

```javascript
function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      // Error is automatically captured in `error`
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <Alert type="error">{error}</Alert>}
      
      <input
        type="text"
        value={form.username}
        onChange={e => setForm({ ...form, username: e.target.value })}
        placeholder="Username"
        disabled={isLoading}
      />
      
      <input
        type="password"
        value={form.password}
        onChange={e => setForm({ ...form, password: e.target.value })}
        placeholder="Password"
        disabled={isLoading}
      />
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

---

## useCountry

Manage country selection state.

### Returns

```typescript
{
  selectedCountry: Country | null;  // Current selection
  isLoading: boolean;               // Selection in progress
  error: string | null;             // Error message
  selectCountry: (country) => void; // Select country
  clearCountry: () => void;         // Clear selection
  hasCountry: boolean;              // Has selection
}
```

### Example

```javascript
import { useCountry } from '@mfe/shared';

function CountrySelector({ countries }) {
  const { 
    selectedCountry, 
    selectCountry, 
    hasCountry 
  } = useCountry();

  return (
    <div>
      {hasCountry && (
        <div className="selected">
          <img src={selectedCountry.flags.png} alt="" />
          <span>{selectedCountry.name.common}</span>
        </div>
      )}
      
      <ul>
        {countries.map(country => (
          <li 
            key={country.cca2}
            onClick={() => selectCountry(country)}
            className={selectedCountry?.cca2 === country.cca2 ? 'active' : ''}
          >
            <img src={country.flags.png} alt="" />
            {country.name.common}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## useEventBus

Subscribe to Event Bus events.

### Parameters

```typescript
useEventBus(
  eventTypes: string | string[],  // Event type(s) to subscribe
  handler: (payload, meta) => void,
  options?: {
    priority?: Priority;
    enabled?: boolean;
  }
): void
```

### Example

```javascript
import { useEventBus, EventTypes } from '@mfe/shared';

function WeatherDisplay() {
  const [weather, setWeather] = useState(null);

  // Subscribe to country selection
  useEventBus(
    EventTypes.STATE.COUNTRY_SELECTED,
    (payload) => {
      fetchWeather(payload.country);
    }
  );

  // Subscribe to multiple events
  useEventBus(
    [EventTypes.AUTH.LOGOUT, EventTypes.AUTH.SESSION_EXPIRED],
    () => {
      setWeather(null);
    }
  );

  // Conditional subscription
  useEventBus(
    EventTypes.DATA.WEATHER_LOADED,
    (payload) => setWeather(payload),
    { enabled: isAuthenticated }
  );

  return weather ? <WeatherCard data={weather} /> : null;
}
```

---

## useEventPublisher

Get a function to publish events.

### Returns

```typescript
(eventType: string, payload?: any, options?: PublishOptions) => Promise<boolean>
```

### Example

```javascript
import { useEventPublisher, EventTypes } from '@mfe/shared';

function ActionButtons() {
  const publish = useEventPublisher();

  const handleRefresh = () => {
    publish(EventTypes.DATA.CACHE_INVALIDATED, { 
      dataType: 'weather' 
    });
  };

  const handleNotify = () => {
    publish(EventTypes.UI.NOTIFICATION, {
      message: 'Data refreshed!',
      type: 'success',
    });
  };

  return (
    <div>
      <button onClick={handleRefresh}>Refresh Data</button>
      <button onClick={handleNotify}>Show Notification</button>
    </div>
  );
}
```

---

## useStateStore

Access and subscribe to State Store.

### Parameters

```typescript
useStateStore(
  selector?: string  // State path (e.g., 'auth.user')
): [value, dispatch]
```

### Example

```javascript
import { useStateStore, ActionTypes } from '@mfe/shared';

function ProfileEditor() {
  // Select specific state
  const [user] = useStateStore('auth.user');
  const [preferences, dispatch] = useStateStore('preferences');

  const updateTheme = (theme) => {
    dispatch({
      type: ActionTypes.SET_PREFERENCES,
      payload: { theme },
    });
  };

  return (
    <div>
      <h2>{user?.name}</h2>
      
      <select 
        value={preferences?.theme || 'light'}
        onChange={e => updateTheme(e.target.value)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  );
}

// Get entire state
function DebugPanel() {
  const [state] = useStateStore();
  return <pre>{JSON.stringify(state, null, 2)}</pre>;
}
```

---

## useLoading

Manage loading states.

### Parameters

```typescript
useLoading(key: string): {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  withLoading: (asyncFn) => Promise<any>;
}
```

### Example

```javascript
import { useLoading } from '@mfe/shared';

function DataFetcher() {
  const { isLoading, withLoading } = useLoading('weatherData');
  const [data, setData] = useState(null);

  const fetchData = async () => {
    const result = await withLoading(async () => {
      const response = await fetch('/api/weather');
      return response.json();
    });
    setData(result);
  };

  return (
    <div>
      <button onClick={fetchData} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Fetch Data'}
      </button>
      
      {isLoading && <Spinner />}
      {data && <DataDisplay data={data} />}
    </div>
  );
}
```

---

## useError

Manage error states.

### Parameters

```typescript
useError(key: string): {
  error: string | null;
  hasError: boolean;
  setError: (message: string) => void;
  clearError: () => void;
}
```

### Example

```javascript
import { useError } from '@mfe/shared';

function FormWithValidation() {
  const { error, hasError, setError, clearError } = useError('loginForm');

  const handleSubmit = async (data) => {
    clearError();
    
    if (!data.email) {
      setError('Email is required');
      return;
    }
    
    try {
      await submitForm(data);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {hasError && (
        <div className="error-banner">
          {error}
          <button onClick={clearError}>×</button>
        </div>
      )}
      {/* form fields */}
    </form>
  );
}
```

---

## useNotifications

Show notifications to users.

### Returns

```typescript
{
  notifications: Notification[];
  showNotification: (message, type?, duration?) => void;
  showSuccess: (message, duration?) => void;
  showError: (message, duration?) => void;
  showWarning: (message, duration?) => void;
  showInfo: (message, duration?) => void;
}
```

### Example

```javascript
import { useNotifications } from '@mfe/shared';

function ActionComponent() {
  const { showSuccess, showError } = useNotifications();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Data saved successfully!');
    } catch (err) {
      showError('Failed to save: ' + err.message);
    }
  };

  return <button onClick={handleSave}>Save</button>;
}

// Notification display component
function NotificationContainer() {
  const { notifications } = useNotifications();

  return (
    <div className="notification-container">
      {notifications.map(n => (
        <div key={n.id} className={`notification ${n.type}`}>
          {n.message}
        </div>
      ))}
    </div>
  );
}
```

---

## usePreferences

Manage user preferences.

### Returns

```typescript
{
  preferences: Preferences;
  updatePreferences: (partial) => void;
  setTheme: (theme) => void;
  setLanguage: (lang) => void;
  theme: 'light' | 'dark';
  language: string;
}
```

### Example

```javascript
import { usePreferences } from '@mfe/shared';

function SettingsPanel() {
  const { theme, language, setTheme, setLanguage } = usePreferences();

  return (
    <div className="settings">
      <label>
        Theme:
        <select value={theme} onChange={e => setTheme(e.target.value)}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      
      <label>
        Language:
        <select value={language} onChange={e => setLanguage(e.target.value)}>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="de">German</option>
        </select>
      </label>
    </div>
  );
}
```

---

## useMFELifecycle

Track MFE mount/unmount lifecycle.

### Parameters

```typescript
useMFELifecycle(mfeName: string): void
```

### Example

```javascript
import { useMFELifecycle } from '@mfe/shared';

function WeatherMFE() {
  // Publishes MFE_MOUNTED on mount, MFE_UNMOUNTED on unmount
  useMFELifecycle('WeatherMFE');

  return <WeatherDisplay />;
}

// In Shell, listen for MFE lifecycle events
function Shell() {
  useEventBus(EventTypes.SYSTEM.MFE_MOUNTED, (payload) => {
    console.log(`${payload.name} mounted at ${payload.timestamp}`);
  });

  useEventBus(EventTypes.SYSTEM.MFE_UNMOUNTED, (payload) => {
    console.log(`${payload.name} unmounted at ${payload.timestamp}`);
  });

  return <MFEContainer />;
}
```

---

## useNavigation

Navigate programmatically with events.

### Returns

```typescript
{
  navigate: (path, options?) => void;
}
```

### Example

```javascript
import { useNavigation } from '@mfe/shared';

function CountryCard({ country }) {
  const { navigate } = useNavigation();

  const handleClick = () => {
    selectCountry(country);
    navigate('/weather');
  };

  return (
    <div className="country-card" onClick={handleClick}>
      <img src={country.flags.png} alt="" />
      <h3>{country.name.common}</h3>
    </div>
  );
}
```

---

## useEventHistory

Access event history for debugging.

### Parameters

```typescript
useEventHistory(filter?: string): {
  history: Event[];
  clearHistory: () => void;
}
```

### Example

```javascript
import { useEventHistory } from '@mfe/shared';

function EventDebugPanel() {
  const { history } = useEventHistory('mfe:auth:*');

  return (
    <div className="debug-panel">
      <h3>Auth Events</h3>
      <ul>
        {history.map(event => (
          <li key={event.meta.id}>
            <span>{event.type}</span>
            <span>{new Date(event.meta.timestamp).toISOString()}</span>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Complete Example

```javascript
import React, { useEffect } from 'react';
import {
  useAuth,
  useCountry,
  useLoading,
  useError,
  useNotifications,
  useEventBus,
  useMFELifecycle,
  EventTypes,
} from '@mfe/shared';

function WeatherMFE() {
  // Track lifecycle
  useMFELifecycle('WeatherMFE');

  // Auth state
  const { isAuthenticated, user } = useAuth();
  
  // Country state
  const { selectedCountry, hasCountry } = useCountry();
  
  // Loading/Error
  const { isLoading, withLoading } = useLoading('weather');
  const { error, setError, clearError } = useError('weather');
  
  // Notifications
  const { showError } = useNotifications();
  
  // Weather data
  const [weather, setWeather] = useState(null);

  // Listen for country changes
  useEventBus(EventTypes.STATE.COUNTRY_SELECTED, async (payload) => {
    clearError();
    try {
      const data = await withLoading(() => 
        fetchWeatherAPI(payload.country)
      );
      setWeather(data);
    } catch (err) {
      setError(err.message);
      showError('Failed to load weather data');
    }
  });

  // Auth check
  if (!isAuthenticated) {
    return <div>Please login to view weather</div>;
  }

  // Country check
  if (!hasCountry) {
    return <div>Please select a country</div>;
  }

  // Loading state
  if (isLoading) {
    return <Spinner />;
  }

  // Error state
  if (error) {
    return <ErrorDisplay message={error} />;
  }

  return (
    <div className="weather-mfe">
      <h1>Weather for {selectedCountry.name.common}</h1>
      {weather && <WeatherDisplay data={weather} />}
    </div>
  );
}

export default WeatherMFE;
```

---

## API Reference Summary

| Hook | Purpose |
|------|---------|
| `useAuth` | Authentication state and actions |
| `useCountry` | Country selection management |
| `useEventBus` | Subscribe to events |
| `useEventPublisher` | Publish events |
| `useStateStore` | Access state store |
| `useLoading` | Loading state management |
| `useError` | Error state management |
| `useNotifications` | Show notifications |
| `usePreferences` | User preferences |
| `useMFELifecycle` | Track MFE lifecycle |
| `useNavigation` | Programmatic navigation |
| `useEventHistory` | Debug event history |

---

## Next Steps

- [Middleware Guide](./API_MIDDLEWARE.md)
- [Login MFE](./MFE_LOGIN.md)
- [Weather MFE](./MFE_WEATHER.md)
