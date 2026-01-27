import React, { useState, useEffect } from 'react';
import WeatherDisplay from './components/WeatherDisplay';
import './styles.css';

// Auth helpers - same as other MFEs for session sharing
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
    return null;
  }
  return sessionData.user;
};

const getSelectedCountry = () => {
  const encrypted = sessionStorage.getItem(COUNTRY_KEY);
  if (!encrypted) return null;
  return decryptData(encrypted);
};

function App() {
  const [user, setUser] = useState(null);
  const [country, setCountry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial load
    setUser(getSession());
    setCountry(getSelectedCountry());
    setIsLoading(false);

    // Listen for session changes from other MFEs
    const handleSessionChange = (e) => {
      setUser(e.detail.user);
    };

    const handleCountryChange = (e) => {
      setCountry(e.detail.country);
    };

    window.addEventListener('mfe:session-changed', handleSessionChange);
    window.addEventListener('mfe:country-changed', handleCountryChange);

    return () => {
      window.removeEventListener('mfe:session-changed', handleSessionChange);
      window.removeEventListener('mfe:country-changed', handleCountryChange);
    };
  }, []);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="mfe-container weather-mfe">
        <div className="auth-required">
          <h2>🔒 Authentication Required</h2>
          <p>Please log in to view weather information.</p>
          <a href="/login" className="btn-primary">Go to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="mfe-container weather-mfe">
      <div className="mfe-header">
        <h2>🌤️ Weather Information</h2>
        <p>View current weather conditions for your selected country</p>
        <div className="session-info">
          <span>👤 Logged in as: <strong>{user.name}</strong></span>
        </div>
      </div>

      {!country ? (
        <div className="no-country">
          <div className="alert alert-info">
            <h3>📍 No Country Selected</h3>
            <p>Please select a country from the Countries page to view weather data.</p>
            <a href="/countries" className="btn-primary">Select a Country</a>
          </div>
        </div>
      ) : (
        <WeatherDisplay country={country} />
      )}
    </div>
  );
}

export default App;
