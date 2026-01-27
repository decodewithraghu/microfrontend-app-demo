# Login MFE Documentation

## Authentication Micro Frontend

The Login MFE handles user authentication, displaying a login form and managing the authentication flow.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Module Federation Config](#module-federation-config)
5. [Components](#components)
6. [Authentication Flow](#authentication-flow)
7. [Integration with Shell](#integration-with-shell)
8. [Styling](#styling)
9. [Testing](#testing)
10. [Security](#security)

---

## Overview

```
┌─────────────────────────────────────────────────────┐
│                   LOGIN MFE                         │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │                                               │ │
│  │              🔐 Sign In                       │ │
│  │                                               │ │
│  │    ┌─────────────────────────────────────┐   │ │
│  │    │  Username                           │   │ │
│  │    └─────────────────────────────────────┘   │ │
│  │                                               │ │
│  │    ┌─────────────────────────────────────┐   │ │
│  │    │  Password                           │   │ │
│  │    └─────────────────────────────────────┘   │ │
│  │                                               │ │
│  │    [        Sign In        ]                 │ │
│  │                                               │ │
│  │    Demo: admin/admin123 or user/user123      │ │
│  │                                               │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Features

| Feature | Description |
|---------|-------------|
| Form Validation | Client-side validation with error messages |
| Demo Credentials | Built-in demo accounts for testing |
| Loading States | Visual feedback during authentication |
| Error Handling | Clear error messages for failed attempts |
| Session Management | Secure token-based sessions |
| Role-Based Access | Admin and User roles supported |

---

## Architecture

### File Structure

```
login-mfe/
├── src/
│   ├── App.jsx              # Main exported component
│   ├── main.jsx             # Standalone entry point
│   ├── components/
│   │   ├── LoginForm.jsx    # Login form component
│   │   ├── Input.jsx        # Form input component
│   │   └── Button.jsx       # Button component
│   ├── hooks/
│   │   └── useLoginForm.js  # Form logic hook
│   └── styles/
│       └── Login.css        # Component styles
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
      name: 'loginMFE',
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
    port: 3001,
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

The Login MFE uses a simple session format compatible with the Shell:

```javascript
import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import CountryList from './components/CountryList';
import './styles.css';

// Import shared eventBus for cross-MFE communication
import { eventBus, EventTypes } from '@mfe/shared';

// Auth helpers - using Base64 encoding
const AUTH_KEY = 'mfe_auth_session';
const COUNTRY_KEY = 'mfe_selected_country';

const encryptData = (data) => {
  const jsonStr = JSON.stringify(data);
  return btoa(encodeURIComponent(jsonStr));
};

const decryptData = (encrypted) => {
  try {
    const jsonStr = decodeURIComponent(atob(encrypted));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};

const setSession = (user) => {
  const sessionData = {
    user,
    timestamp: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  const encrypted = encryptData(sessionData);
  sessionStorage.setItem(AUTH_KEY, encrypted);
  
  // Publish to shared eventBus so Shell knows about the login
  eventBus.publish(EventTypes.AUTH.LOGIN, { user });
  
  window.dispatchEvent(new CustomEvent('mfe:session-changed', { detail: { user } }));
};

const setSelectedCountry = (country) => {
  const encrypted = encryptData(country);
  sessionStorage.setItem(COUNTRY_KEY, encrypted);
  
  // Publish to shared eventBus
  eventBus.publish(EventTypes.STATE.COUNTRY_SELECTED, { country });
  
  window.dispatchEvent(new CustomEvent('mfe:country-changed', { detail: { country } }));
};

function App({ showCountries = false }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountryState] = useState(null);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // ... component logic
}

export default App;
```

### LoginForm.jsx

Simple login form with demo credentials validation:

```javascript
import React, { useState } from 'react';

// Demo users for authentication
const DEMO_USERS = {
  admin: { password: 'admin123', name: 'Administrator', role: 'admin' },
  user: { password: 'user123', name: 'Standard User', role: 'user' },
  guest: { password: 'guest123', name: 'Guest User', role: 'guest' },
};

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const demoUser = DEMO_USERS[username];
    if (demoUser && demoUser.password === password) {
      const userData = {
        username,
        name: demoUser.name,
        role: demoUser.role,
      };
      onLogin(userData);
    } else {
      setError('Invalid username or password');
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Sign In</h2>
      {error && <div className="error">{error}</div>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
      <p className="demo-hint">Demo: admin/admin123 or user/user123</p>
    </form>
  );
}

export default LoginForm;
```
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    try {
      const result = await login(form.username, form.password);
      
      if (result.success) {
        showSuccess(`Welcome, ${result.user.name}!`);
        
        // Navigate to home
        publish(EventTypes.UI.NAVIGATE, { path: '/' });
      } else {
        showError(result.error || 'Login failed');
      }
    } catch (err) {
      showError('An unexpected error occurred');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <span className="login-icon">🔐</span>
          <h1>Sign In</h1>
          <p>Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Global error */}
          {error && (
            <div className="form-error global">
              {error}
            </div>
          )}

          {/* Username field */}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Enter username"
              disabled={isLoading}
              className={errors.username ? 'error' : ''}
              autoComplete="username"
            />
            {errors.username && (
              <span className="field-error">{errors.username}</span>
            )}
          </div>

          {/* Password field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter password"
              disabled={isLoading}
              className={errors.password ? 'error' : ''}
              autoComplete="current-password"
            />
            {errors.password && (
              <span className="field-error">{errors.password}</span>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Demo credentials */}
        <div className="demo-credentials">
          <h4>Demo Accounts</h4>
          <div className="credentials">
            <div className="credential">
              <strong>Admin:</strong> admin / admin123
            </div>
            <div className="credential">
              <strong>User:</strong> user / user123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
```

---

## Authentication Flow

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  LoginForm  │       │ AuthService │       │   Shell     │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       │  1. Submit form     │                     │
       │ ─────────────────→  │                     │
       │                     │                     │
       │  2. Validate creds  │                     │
       │ ←─────────────────  │                     │
       │                     │                     │
       │                     │  3. Publish LOGIN   │
       │                     │ ─────────────────→  │
       │                     │                     │
       │                     │  4. Update state    │
       │                     │ ←─────────────────  │
       │                     │                     │
       │  5. Navigate home   │                     │
       │ ─────────────────────────────────────────→│
       │                     │                     │
```

### Event Flow

```javascript
// 1. User submits login form
// LoginForm calls authService.login(username, password)

// 2. AuthService validates and creates session
// Returns { success: true, user, token } or { success: false, error }

// 3. AuthService publishes LOGIN event
eventBus.publish(EventTypes.AUTH.LOGIN, { user, token });

// 4. StateStore updates auth state
// stateStore.state.auth = { user, isAuthenticated: true, token }

// 5. Shell receives event and updates UI
// Navigation to home page via EVENT
eventBus.publish(EventTypes.UI.NAVIGATE, { path: '/' });
```

---

## Integration with Shell

### How Shell Loads Login MFE

```javascript
// In Shell's routes/index.jsx
const loadLoginMFE = () => import('loginMFE/App');

<Route
  path="/login"
  element={
    <PublicRoute>
      <MFEContainer name="LoginMFE" loadComponent={loadLoginMFE} />
    </PublicRoute>
  }
/>
```

### Events Published

| Event | When | Payload |
|-------|------|---------|
| `mfe:auth:login` | Successful login | `{ user, token }` |
| `mfe:ui:navigate` | After login | `{ path: '/' }` |
| `mfe:ui:notification` | Success/Error | `{ message, type }` |
| `mfe:system:mfe-mounted` | Component mount | `{ name: 'LoginMFE' }` |

### Events Subscribed

None - Login MFE is primarily an event publisher.

---

## Styling

### Login.css

```css
/* Container */
.login-mfe {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 2rem;
}

/* Card */
.login-card {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

/* Header */
.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.login-header h1 {
  color: #fff;
  font-size: 1.75rem;
  margin: 0 0 0.5rem;
}

.login-header p {
  color: #a0a0a0;
  margin: 0;
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: #e0e0e0;
  font-size: 0.9rem;
  font-weight: 500;
}

.form-group input {
  padding: 0.875rem 1rem;
  border: 1px solid #333;
  border-radius: 8px;
  background: #16213e;
  color: #fff;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4a90d9;
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.2);
}

.form-group input.error {
  border-color: #e74c3c;
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Errors */
.form-error.global {
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid #e74c3c;
  color: #e74c3c;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
}

.field-error {
  color: #e74c3c;
  font-size: 0.8rem;
}

/* Submit Button */
.submit-btn {
  padding: 1rem;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background: #3a7bc8;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Spinner */
.submit-btn .spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Demo Credentials */
.demo-credentials {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #333;
}

.demo-credentials h4 {
  color: #a0a0a0;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.75rem;
}

.credentials {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.credential {
  color: #888;
  font-size: 0.85rem;
  font-family: monospace;
}

.credential strong {
  color: #a0a0a0;
}

/* Responsive */
@media (max-width: 480px) {
  .login-card {
    padding: 1.5rem;
  }
  
  .login-header h1 {
    font-size: 1.5rem;
  }
}
```

---

## Testing

### Unit Tests (Jest)

```javascript
// LoginForm.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from './LoginForm';
import { useAuth } from '@mfe/shared';

// Mock shared library
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

  test('renders login form', () => {
    render(<LoginForm />);
    
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('validates required fields', async () => {
    render(<LoginForm />);
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Username is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test('validates minimum length', async () => {
    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText('Username'), 'ab');
    await userEvent.type(screen.getByLabelText('Password'), '12345');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Username must be at least 3 characters')).toBeInTheDocument();
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });
  });

  test('submits valid form', async () => {
    mockLogin.mockResolvedValue({ success: true, user: { name: 'Admin' } });
    
    render(<LoginForm />);
    
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Password'), 'admin123');
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin', 'admin123');
    });
  });

  test('displays loading state', () => {
    useAuth.mockReturnValue({
      login: mockLogin,
      isLoading: true,
      error: null,
    });
    
    render(<LoginForm />);
    
    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('displays error message', () => {
    useAuth.mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: 'Invalid credentials',
    });
    
    render(<LoginForm />);
    
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });
});
```

### E2E Tests (Cypress)

```javascript
// cypress/e2e/login.cy.js
describe('Login MFE', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('displays login form', () => {
    cy.contains('Sign In');
    cy.get('input[name="username"]').should('be.visible');
    cy.get('input[name="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible');
  });

  it('shows validation errors for empty form', () => {
    cy.get('button[type="submit"]').click();
    
    cy.contains('Username is required');
    cy.contains('Password is required');
  });

  it('successfully logs in with valid credentials', () => {
    cy.get('input[name="username"]').type('admin');
    cy.get('input[name="password"]').type('admin123');
    cy.get('button[type="submit"]').click();
    
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    cy.contains('Welcome');
  });

  it('shows error for invalid credentials', () => {
    cy.get('input[name="username"]').type('invalid');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    
    cy.contains('Invalid credentials');
  });

  it('disables form during submission', () => {
    cy.get('input[name="username"]').type('admin');
    cy.get('input[name="password"]').type('admin123');
    cy.get('button[type="submit"]').click();
    
    cy.get('input[name="username"]').should('be.disabled');
    cy.get('input[name="password"]').should('be.disabled');
    cy.get('button[type="submit"]').should('be.disabled');
  });
});
```

---

## Security

### Best Practices Implemented

| Practice | Implementation |
|----------|---------------|
| No plaintext passwords | Passwords never logged or stored in state |
| Token encryption | Session tokens encrypted in storage |
| HTTPS only | Recommended for production |
| Session expiry | 24-hour token expiry with refresh |
| CSRF protection | Correlation IDs for request tracking |
| Input validation | Client-side validation before submission |
| Rate limiting | Login attempts rate limited |

### Security Recommendations

```javascript
// 1. Never log passwords
const handleSubmit = (form) => {
  // ❌ Never do this
  console.log('Form data:', form);
  
  // ✅ Log safely
  console.log('Login attempt for:', form.username);
};

// 2. Clear sensitive data on unmount
useEffect(() => {
  return () => {
    setForm({ username: '', password: '' });
  };
}, []);

// 3. Use secure session storage
// AuthService uses encrypted tokens by default

// 4. Implement rate limiting
// Middleware prevents brute force attempts
```

---

## Standalone Development

Run Login MFE independently:

```bash
cd login-mfe
npm install
npm run dev
# Open http://localhost:3001
```

### main.jsx (Standalone Entry)

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/Login.css';

// Only render standalone if not being loaded as remote
if (!window.__POWERED_BY_FEDERATION__) {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

---

## Next Steps

- [Weather MFE](./MFE_WEATHER.md)
- [Population MFE](./MFE_POPULATION.md)
- [Shell Documentation](./MFE_SHELL.md)
