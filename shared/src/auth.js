// Shared Authentication Module for Cross-MFE Session Management
const AUTH_KEY = 'mfe_auth_session';
const COUNTRY_KEY = 'mfe_selected_country';

// Simple encryption/decryption for session data (for demo purposes)
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

// Session Management
export const setSession = (user) => {
  const sessionData = {
    user,
    timestamp: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const encrypted = encryptData(sessionData);
  sessionStorage.setItem(AUTH_KEY, encrypted);
  window.dispatchEvent(new CustomEvent('mfe:session-changed', { detail: { user } }));
};

export const getSession = () => {
  const encrypted = sessionStorage.getItem(AUTH_KEY);
  if (!encrypted) return null;
  
  const sessionData = decryptData(encrypted);
  if (!sessionData) return null;
  
  // Check if session expired
  if (Date.now() > sessionData.expiresAt) {
    clearSession();
    return null;
  }
  
  return sessionData.user;
};

export const clearSession = () => {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(COUNTRY_KEY);
  window.dispatchEvent(new CustomEvent('mfe:session-changed', { detail: { user: null } }));
};

export const isAuthenticated = () => {
  return getSession() !== null;
};

// Country Selection Management
export const setSelectedCountry = (country) => {
  const encrypted = encryptData(country);
  sessionStorage.setItem(COUNTRY_KEY, encrypted);
  window.dispatchEvent(new CustomEvent('mfe:country-changed', { detail: { country } }));
};

export const getSelectedCountry = () => {
  const encrypted = sessionStorage.getItem(COUNTRY_KEY);
  if (!encrypted) return null;
  return decryptData(encrypted);
};

// Session validation token for API calls
export const getAuthToken = () => {
  const session = getSession();
  if (!session) return null;
  return encryptData({ userId: session.id, timestamp: Date.now() });
};

export const validateAuthToken = (token) => {
  if (!token) return false;
  const data = decryptData(token);
  if (!data) return false;
  // Token valid for 1 hour
  return Date.now() - data.timestamp < 60 * 60 * 1000;
};
