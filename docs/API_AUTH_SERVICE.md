# Authentication Service API Documentation

## Secure Session Management for Micro Frontends

The Authentication Service provides enterprise-grade session management with encryption, token-based authentication, role-based access control, and automatic session refresh.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Security Features](#security-features)
4. [Core API](#core-api)
5. [Session Management](#session-management)
6. [Role-Based Access Control](#role-based-access-control)
7. [Country Selection](#country-selection)
8. [Token Management](#token-management)
9. [Integration Examples](#integration-examples)
10. [Best Practices](#best-practices)

---

## Overview

The Authentication Service provides:

- **Secure Storage**: Encrypted session data with integrity checks
- **Token Management**: JWT-style tokens with signature verification
- **Auto Refresh**: Automatic session renewal before expiry
- **RBAC**: Role-based access control with permissions
- **Event Integration**: Automatic EventBus notifications
- **State Sync**: Automatic StateStore updates

---

## Quick Start

```javascript
import { 
  login, 
  logout, 
  isAuthenticated, 
  getUser,
  hasRole,
  Roles 
} from '@mfe/shared';

// Login
const result = await login('admin', 'admin123');
console.log('Logged in as:', result.user.username);

// Check authentication
if (isAuthenticated()) {
  const user = getUser();
  console.log('Current user:', user.name);
  
  // Check role
  if (hasRole(Roles.ADMIN)) {
    console.log('User is admin');
  }
}

// Logout
logout();
```

---

## Security Features

### Data Encryption

All session data is encrypted before storage:

```
┌─────────────────────────────────────────────────────┐
│                 Encryption Flow                      │
│                                                      │
│  Data → JSON → URL Encode → XOR Cipher → Base64    │
│                                                      │
│  { user: 'john' }                                   │
│       ↓                                              │
│  '{"user":"john"}'                                  │
│       ↓                                              │
│  '%7B%22user%22%3A%22john%22%7D'                    │
│       ↓                                              │
│  'encrypted_string'                                 │
│       ↓                                              │
│  'YmFzZTY0X2VuY29kZWQ='                             │
└─────────────────────────────────────────────────────┘
```

### Integrity Verification

Data integrity verified on every read:

```javascript
// Storage format
{
  data: encryptedPayload,
  checksum: 'a1b2c3d4',  // Hash of original data
  timestamp: 1704067200000
}

// On read: recalculate checksum and compare
```

### Token Structure

JWT-style tokens with signature:

```
header.payload.signature

header:    { "alg": "HS256", "typ": "JWT" }
payload:   { userId, username, role, iat, exp, jti }
signature: encrypted(header.payload)
```

---

## Core API

### `login(username, password)`

Authenticate user with credentials.

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | `string` | Username |
| `password` | `string` | Password |

**Returns:** `Promise<LoginResult>`

```javascript
try {
  const result = await login('admin', 'admin123');
  
  console.log(result);
  // {
  //   success: true,
  //   user: {
  //     id: 'user_1704067200000',
  //     username: 'admin',
  //     name: 'Administrator',
  //     role: 'admin',
  //     permissions: ['read', 'write', 'delete', 'admin'],
  //     createdAt: 1704067200000,
  //     expiresAt: 1704153600000,
  //   },
  //   token: 'eyJhbGciOiJIUzI1NiJ9...'
  // }
  
} catch (error) {
  console.error('Login failed:', error.message);
  // 'Invalid username or password'
}
```

### `logout()`

End current session.

```javascript
const result = logout();
// { success: true }

// Clears:
// - Session storage
// - Refresh token
// - Selected country
// - StateStore auth state

// Publishes:
// - EventTypes.AUTH.LOGOUT
```

### `isAuthenticated()`

Check if user is logged in.

```javascript
if (isAuthenticated()) {
  // User is logged in
}
```

### `getSession()`

Get current session data.

```javascript
const session = getSession();
// {
//   id: 'user_123',
//   username: 'admin',
//   name: 'Administrator',
//   role: 'admin',
//   permissions: [...],
//   createdAt: 1704067200000,
//   expiresAt: 1704153600000,
//   lastActivity: 1704070000000,
//   token: 'eyJ...'
// }
```

### `getUser()`

Get current user info (without sensitive data).

```javascript
const user = getUser();
// {
//   id: 'user_123',
//   username: 'admin',
//   name: 'Administrator',
//   role: 'admin',
//   permissions: ['read', 'write', 'delete', 'admin']
// }
```

---

## Session Management

### Session Lifecycle

```
┌────────────────────────────────────────────────────────────────┐
│                    Session Lifecycle                            │
│                                                                 │
│   login()                                                       │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────────┐                                           │
│   │ Session Created │ ─── expiresAt: now + 24 hours            │
│   └────────┬────────┘                                           │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐     ┌─────────────────┐                  │
│   │ Active Session  │────►│ Auto Refresh    │                  │
│   └────────┬────────┘     │ (30 min before  │                  │
│            │              │  expiry)        │                  │
│            │              └─────────────────┘                  │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐     ┌─────────────────┐                  │
│   │ logout() or     │────►│ Session Cleared │                  │
│   │ Session Expired │     └─────────────────┘                  │
│   └─────────────────┘                                           │
└────────────────────────────────────────────────────────────────┘
```

### Auto Refresh

Sessions automatically refresh when:
- Less than 30 minutes until expiry
- User is still active

```javascript
// Manually trigger refresh
const result = await refreshSession();
// { token: 'new_token', expiresAt: newExpiry }
```

### Session Expiration

When session expires:
1. Storage cleared
2. StateStore reset
3. `SESSION_EXPIRED` event published
4. User redirected to login

```javascript
// Listen for session expiry
eventBus.subscribe(EventTypes.AUTH.SESSION_EXPIRED, (payload) => {
  console.log('Session expired:', payload.expiredAt);
  navigate('/login');
});
```

---

## Role-Based Access Control

### Available Roles

```javascript
import { Roles, Permissions } from '@mfe/shared';

Roles = {
  ADMIN: 'admin',  // Full access
  USER: 'user',    // Read/write
  GUEST: 'guest',  // Read only
}

Permissions = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete',
  ADMIN: 'admin',
}
```

### Role Permissions Matrix

| Role | Read | Write | Delete | Admin |
|------|------|-------|--------|-------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| USER | ✅ | ✅ | ❌ | ❌ |
| GUEST | ✅ | ❌ | ❌ | ❌ |

### Check Role

```javascript
import { hasRole, Roles } from '@mfe/shared';

if (hasRole(Roles.ADMIN)) {
  // Show admin features
}

if (hasRole(Roles.USER) || hasRole(Roles.ADMIN)) {
  // Show user features
}
```

### Check Permission

```javascript
import { hasPermission, Permissions } from '@mfe/shared';

if (hasPermission(Permissions.WRITE)) {
  // Allow editing
}

if (hasPermission(Permissions.DELETE)) {
  // Show delete button
}

if (hasPermission(Permissions.ADMIN)) {
  // Show admin panel
}
```

### Conditional Rendering

```javascript
function AdminPanel() {
  const { hasRole } = useAuth();
  
  if (!hasRole(Roles.ADMIN)) {
    return <AccessDenied />;
  }
  
  return <AdminDashboard />;
}
```

---

## Country Selection

### Set Selected Country

```javascript
import { setSelectedCountry, getSelectedCountry } from '@mfe/shared';

// Must be authenticated
const country = {
  name: { common: 'Germany', official: 'Federal Republic of Germany' },
  cca2: 'DE',
  capital: ['Berlin'],
  latlng: [51, 9],
  population: 83240525,
  // ... other REST Countries API fields
};

setSelectedCountry(country);
// Returns: { success: true }

// Publishes EVENT_TYPES.STATE.COUNTRY_SELECTED
// Updates StateStore country.selected
```

### Get Selected Country

```javascript
const country = getSelectedCountry();
// Returns country object or null
```

### Clear Selected Country

```javascript
import { clearSelectedCountry } from '@mfe/shared';

clearSelectedCountry();
// Publishes EVENT_TYPES.STATE.COUNTRY_CLEARED
```

---

## Token Management

### Get Auth Token

```javascript
import { getAuthToken } from '@mfe/shared';

const token = getAuthToken();
// 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ1c2VyXzEyMyIsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MDQwNjcyMDAwMDAsImV4cCI6MTcwNDA3MDgwMDAwMCwianRpIjoiMTcwNDA2NzIwMDAwMC14eXphYmMxMjMifQ.c2lnbmF0dXJl'

// Use in API calls
fetch('/api/data', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

### Validate Token

```javascript
import { validateToken } from '@mfe/shared';

const result = validateToken(token);
// {
//   valid: true,
//   payload: {
//     userId: 'user_123',
//     username: 'admin',
//     role: 'admin',
//     iat: 1704067200000,
//     exp: 1704070800000,
//     jti: 'unique_id'
//   }
// }

// Or if invalid
// {
//   valid: false,
//   error: 'Token expired' | 'Invalid signature' | 'Invalid token format'
// }
```

---

## Integration Examples

### React Login Component

```javascript
import { useAuth } from '@mfe/shared';

function LoginForm() {
  const { login, isLoading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/countries');
    } catch (err) {
      // Error handled by hook
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <input
        type="text"
        value={username}
        onChange={e => setUsername(e.target.value)}
        disabled={isLoading}
      />
      
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        disabled={isLoading}
      />
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### Protected Route

```javascript
import { isAuthenticated, hasRole, Roles } from '@mfe/shared';

function ProtectedRoute({ children, requiredRole }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  
  if (requiredRole && !hasRole(requiredRole)) {
    return <AccessDenied />;
  }
  
  return children;
}

// Usage
<Route path="/admin">
  <ProtectedRoute requiredRole={Roles.ADMIN}>
    <AdminPanel />
  </ProtectedRoute>
</Route>
```

### API Integration

```javascript
import { getAuthToken, isAuthenticated } from '@mfe/shared';

async function fetchData(endpoint) {
  if (!isAuthenticated()) {
    throw new Error('Not authenticated');
  }
  
  const token = getAuthToken();
  
  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (response.status === 401) {
    // Token expired, session will be cleared automatically
    throw new Error('Session expired');
  }
  
  return response.json();
}
```

---

## Best Practices

### 1. Use Hooks in React

```javascript
// ✅ Good
const { user, isAuthenticated, login, logout } = useAuth();

// ❌ Avoid direct service calls in render
const user = authService.getUser(); // May not trigger re-render
```

### 2. Handle Session Expiry

```javascript
// Listen for expiry across all MFEs
useEffect(() => {
  const unsubscribe = eventBus.subscribe(
    EventTypes.AUTH.SESSION_EXPIRED,
    () => {
      showNotification('Session expired. Please login again.');
      navigate('/login');
    }
  );
  return () => unsubscribe();
}, []);
```

### 3. Check Permissions Before Actions

```javascript
function DeleteButton({ onDelete }) {
  const { hasPermission } = useAuth();
  
  if (!hasPermission(Permissions.DELETE)) {
    return null; // Don't render
  }
  
  return <button onClick={onDelete}>Delete</button>;
}
```

### 4. Don't Store Sensitive Data

```javascript
// ✅ Good - minimal user data
const user = getUser();
// { id, username, name, role, permissions }

// ❌ Bad - never store
// { password, creditCard, ssn }
```

---

## Demo Credentials

For testing purposes:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `user` | `user123` | User |
| `guest` | `guest123` | Guest |

---

## API Reference Summary

| Function | Description |
|----------|-------------|
| `login(user, pass)` | Authenticate user |
| `logout()` | End session |
| `isAuthenticated()` | Check auth status |
| `getSession()` | Get full session |
| `getUser()` | Get user info |
| `hasRole(role)` | Check user role |
| `hasPermission(perm)` | Check permission |
| `refreshSession()` | Refresh token |
| `getAuthToken()` | Get auth token |
| `validateToken(token)` | Validate token |
| `setSelectedCountry(c)` | Set country |
| `getSelectedCountry()` | Get country |
| `clearSelectedCountry()` | Clear country |

---

## Next Steps

- [React Hooks](./API_REACT_HOOKS.md)
- [Middleware Guide](./API_MIDDLEWARE.md)
- [Shell Application](./MFE_SHELL.md)
