import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import CountryList from './components/CountryList';
import './styles.css';

// Auth helpers
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
  window.dispatchEvent(new CustomEvent('mfe:session-changed', { detail: { user } }));
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

const setSelectedCountry = (country) => {
  const encrypted = encryptData(country);
  sessionStorage.setItem(COUNTRY_KEY, encrypted);
  window.dispatchEvent(new CustomEvent('mfe:country-changed', { detail: { country } }));
};

const getSelectedCountry = () => {
  const encrypted = sessionStorage.getItem(COUNTRY_KEY);
  if (!encrypted) return null;
  return decryptData(encrypted);
};

function App({ showCountries = false }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCountry, setSelectedCountryState] = useState(null);

  useEffect(() => {
    const session = getSession();
    setUser(session);
    setSelectedCountryState(getSelectedCountry());
    setIsLoading(false);

    const handleSessionChange = (e) => {
      setUser(e.detail.user);
    };

    const handleCountryChange = (e) => {
      setSelectedCountryState(e.detail.country);
    };

    window.addEventListener('mfe:session-changed', handleSessionChange);
    window.addEventListener('mfe:country-changed', handleCountryChange);

    return () => {
      window.removeEventListener('mfe:session-changed', handleSessionChange);
      window.removeEventListener('mfe:country-changed', handleCountryChange);
    };
  }, []);

  const handleLogin = (userData) => {
    setSession(userData);
    setUser(userData);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setSelectedCountryState(country);
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  // If user is logged in and showCountries is true, show country list
  if (user && showCountries) {
    return (
      <div className="mfe-container login-mfe">
        <CountryList 
          selectedCountry={selectedCountry} 
          onSelectCountry={handleCountrySelect}
          user={user}
        />
      </div>
    );
  }

  // If user is logged in but showCountries is false, redirect to countries
  if (user && !showCountries) {
    // Navigate to countries page
    window.location.href = '/countries';
    return null;
  }

  // Show login form
  return (
    <div className="mfe-container login-mfe">
      <LoginForm onLogin={handleLogin} />
    </div>
  );
}

export default App;
