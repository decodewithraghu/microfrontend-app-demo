import React, { Suspense, useState, useEffect, lazy, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

// Import core shared library services
import {
  eventBus,
  EventTypes,
  store,
} from '@mfe/shared';

// Simple session helpers (compatible with Login MFE)
const AUTH_KEY = 'mfe_auth_session';
const COUNTRY_KEY = 'mfe_selected_country';

const decryptData = (encrypted) => {
  try {
    const jsonStr = decodeURIComponent(atob(encrypted));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};

const getSession = () => {
  const encrypted = sessionStorage.getItem(AUTH_KEY);
  if (!encrypted) return null;
  const sessionData = decryptData(encrypted);
  if (!sessionData || Date.now() > sessionData.expiresAt) {
    sessionStorage.removeItem(AUTH_KEY);
    return null;
  }
  return sessionData.user;
};

const getSelectedCountry = () => {
  const encrypted = sessionStorage.getItem(COUNTRY_KEY);
  if (!encrypted) return null;
  return decryptData(encrypted);
};

// Lazy load remote MFEs
const LoginApp = lazy(() => import('loginMfe/LoginApp'));
const WeatherApp = lazy(() => import('weatherMfe/WeatherApp'));
const PopulationApp = lazy(() => import('populationMfe/PopulationApp'));

// Loading Component
const Loading = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading micro frontend...</p>
  </div>
);

// Error Page Component
const ErrorPage = ({ error, onRetry, onGoHome }) => {
  useEffect(() => {
    console.error('MFE load error:', error?.message);
  }, [error]);

  return (
    <div className="error-page">
      <div className="error-page-content">
        <div className="error-icon">⚠️</div>
        <h1 className="error-title">Oops! Something went wrong</h1>
        <h2 className="error-subtitle">Failed to load micro frontend</h2>
        <p className="error-message">{error?.message || 'An unexpected error occurred while loading the application.'}</p>
        <div className="error-details">
          <p>This could be due to:</p>
          <ul>
            <li>Network connectivity issues</li>
            <li>The micro frontend service is temporarily unavailable</li>
            <li>An internal application error</li>
          </ul>
        </div>
        <div className="error-actions">
          <button onClick={onRetry} className="error-btn error-btn-retry">
            🔄 Try Again
          </button>
          <button onClick={onGoHome} className="error-btn error-btn-home">
            🏠 Go to Home
          </button>
        </div>
      </div>
    </div>
  );
};

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('MFE Error caught by boundary:', error, errorInfo);
    
    // Publish error event to event bus
    eventBus.publish(EventTypes.SYSTEM.ERROR, {
      error: error?.message,
      componentStack: errorInfo?.componentStack,
    }, { source: 'Shell' });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage 
          error={this.state.error} 
          onRetry={this.handleRetry} 
          onGoHome={this.handleGoHome} 
        />
      );
    }
    return this.props.children;
  }
}

// Protected Route Component - Uses simple session check
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const user = getSession();
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error('Auth check failed:', error.message);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    // Subscribe to auth events
    const unsubLogin = eventBus.subscribe(EventTypes.AUTH.LOGIN, () => {
      setIsAuthenticated(true);
    });
    
    const unsubLogout = eventBus.subscribe(EventTypes.AUTH.LOGOUT, () => {
      setIsAuthenticated(false);
    });
    
    const unsubExpired = eventBus.subscribe(EventTypes.AUTH.SESSION_EXPIRED, () => {
      setIsAuthenticated(false);
    });
    
    return () => {
      unsubLogin();
      unsubLogout();
      unsubExpired();
    };
  }, []);

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Navigation Component - Uses simple session helpers
const Navigation = () => {
  const [user, setUser] = useState(null);
  const [country, setCountry] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const updateState = () => {
      try {
        const currentUser = getSession();
        const currentCountry = getSelectedCountry();
        setUser(currentUser);
        setCountry(currentCountry);
      } catch (error) {
        console.error('Failed to update navigation state:', error.message);
      }
    };

    updateState();
    
    // Subscribe to events
    const unsubLogin = eventBus.subscribe(EventTypes.AUTH.LOGIN, (data) => {
      setUser(data.user);
    });
    
    const unsubLogout = eventBus.subscribe(EventTypes.AUTH.LOGOUT, () => {
      setUser(null);
      setCountry(null);
    });
    
    const unsubCountry = eventBus.subscribe(EventTypes.STATE.COUNTRY_SELECTED, (data) => {
      setCountry(data.country);
    });

    return () => {
      unsubLogin();
      unsubLogout();
      unsubCountry();
    };
  }, []);

  const handleLogout = useCallback(() => {
    try {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(COUNTRY_KEY);
      eventBus.publish(EventTypes.AUTH.LOGOUT, {});
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error.message);
    }
  }, []);

  return (
    <header className="shell-header">
      <div className="header-brand">
        <h1>🏢 MFE Application</h1>
      </div>
      {user && (
        <nav className="header-nav">
          <Link to="/countries" className={location.pathname === '/countries' ? 'active' : ''}>
            🌍 Countries
          </Link>
          <Link to="/weather" className={location.pathname === '/weather' ? 'active' : ''}>
            🌤️ Weather
          </Link>
          <Link to="/population" className={location.pathname === '/population' ? 'active' : ''}>
            👥 Population
          </Link>
        </nav>
      )}
      <div className="header-user">
        {user ? (
          <>
            <span className="user-info">
              👤 {user.name}
              {country && <span className="country-badge">📍 {country.name}</span>}
            </span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </>
        ) : (
          <span>Not logged in</span>
        )}
      </div>
    </header>
  );
};

// Main App
function App() {
  useEffect(() => {
    console.log('Shell application initialized');
    
    // Subscribe to global error events
    const unsubError = eventBus.subscribe(EventTypes.SYSTEM.ERROR, (data) => {
      console.error('Global error handler: MFE error', data);
    });

    return () => {
      unsubError();
    };
  }, []);

  return (
    <BrowserRouter>
      <div className="shell-container">
        <Navigation />
        <main className="shell-main">
          <ErrorBoundary>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/login" element={<LoginApp />} />
                <Route path="/countries" element={
                  <ProtectedRoute>
                    <LoginApp showCountries={true} />
                  </ProtectedRoute>
                } />
                <Route path="/weather" element={
                  <ProtectedRoute>
                    <WeatherApp />
                  </ProtectedRoute>
                } />
                <Route path="/population" element={
                  <ProtectedRoute>
                    <PopulationApp />
                  </ProtectedRoute>
                } />
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <footer className="shell-footer">
          <p>© 2026 MFE Application - Micro Frontend Architecture Demo</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
