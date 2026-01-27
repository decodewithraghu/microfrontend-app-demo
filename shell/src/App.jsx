import React, { Suspense, useState, useEffect, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';

// Lazy load remote MFEs
const LoginApp = lazy(() => import('loginMfe/LoginApp'));
const WeatherApp = lazy(() => import('weatherMfe/WeatherApp'));
const PopulationApp = lazy(() => import('populationMfe/PopulationApp'));

// Auth helpers (duplicated here for shell - in production use shared package)
const getSession = () => {
  const encrypted = sessionStorage.getItem('mfe_auth_session');
  if (!encrypted) return null;
  try {
    const jsonStr = decodeURIComponent(atob(encrypted));
    const sessionData = JSON.parse(jsonStr);
    if (Date.now() > sessionData.expiresAt) {
      sessionStorage.removeItem('mfe_auth_session');
      return null;
    }
    return sessionData.user;
  } catch {
    return null;
  }
};

const getSelectedCountry = () => {
  const encrypted = sessionStorage.getItem('mfe_selected_country');
  if (!encrypted) return null;
  try {
    return JSON.parse(decodeURIComponent(atob(encrypted)));
  } catch {
    return null;
  }
};

// Loading Component
const Loading = () => (
  <div className="loading-container">
    <div className="spinner"></div>
    <p>Loading micro frontend...</p>
  </div>
);

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>⚠️ Failed to load micro frontend</h2>
          <p>{this.state.error?.message || 'Unknown error occurred'}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    setIsAuthenticated(!!session);
    setIsLoading(false);
  }, []);

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Navigation Component
const Navigation = () => {
  const [user, setUser] = useState(null);
  const [country, setCountry] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const updateState = () => {
      setUser(getSession());
      setCountry(getSelectedCountry());
    };

    updateState();
    window.addEventListener('mfe:session-changed', updateState);
    window.addEventListener('mfe:country-changed', updateState);

    return () => {
      window.removeEventListener('mfe:session-changed', updateState);
      window.removeEventListener('mfe:country-changed', updateState);
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('mfe_auth_session');
    sessionStorage.removeItem('mfe_selected_country');
    window.dispatchEvent(new CustomEvent('mfe:session-changed', { detail: { user: null } }));
    window.location.href = '/login';
  };

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
