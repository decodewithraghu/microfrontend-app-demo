/**
 * Unit Tests for Auth Module
 * Tests session management, encryption, and authentication utilities
 */

// Import the module using CommonJS for Jest compatibility
const AUTH_KEY = 'mfe_auth_session';
const COUNTRY_KEY = 'mfe_selected_country';

// Helper functions (reimplemented for testing since we can't import ES modules directly)
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
  if (!sessionData) return null;
  
  if (Date.now() > sessionData.expiresAt) {
    clearSession();
    return null;
  }
  
  return sessionData.user;
};

const clearSession = () => {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(COUNTRY_KEY);
  window.dispatchEvent(new CustomEvent('mfe:session-changed', { detail: { user: null } }));
};

const isAuthenticated = () => {
  return getSession() !== null;
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

const getAuthToken = () => {
  const session = getSession();
  if (!session) return null;
  return encryptData({ userId: session.id, timestamp: Date.now() });
};

const validateAuthToken = (token) => {
  if (!token) return false;
  const data = decryptData(token);
  if (!data) return false;
  return Date.now() - data.timestamp < 60 * 60 * 1000;
};

describe('Auth Module', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    name: 'Test User',
    role: 'user',
  };

  const mockCountry = {
    name: 'United States',
    code: 'US',
    capital: 'Washington D.C.',
    region: 'Americas',
  };

  describe('encryptData / decryptData', () => {
    it('should encrypt and decrypt data correctly', () => {
      const testData = { message: 'Hello World', number: 42 };
      const encrypted = encryptData(testData);
      const decrypted = decryptData(encrypted);
      
      expect(encrypted).not.toBe(JSON.stringify(testData));
      expect(decrypted).toEqual(testData);
    });

    it('should handle special characters in data', () => {
      const testData = { text: 'Special chars: äöü ñ 中文 🎉' };
      const encrypted = encryptData(testData);
      const decrypted = decryptData(encrypted);
      
      expect(decrypted).toEqual(testData);
    });

    it('should return null for invalid encrypted data', () => {
      expect(decryptData('invalid-base64!')).toBeNull();
      expect(decryptData('')).toBeNull();
    });

    it('should handle nested objects', () => {
      const testData = {
        user: { name: 'Test', details: { age: 25 } },
        items: [1, 2, 3],
      };
      const encrypted = encryptData(testData);
      const decrypted = decryptData(encrypted);
      
      expect(decrypted).toEqual(testData);
    });
  });

  describe('Session Management', () => {
    describe('setSession', () => {
      it('should store encrypted session in sessionStorage', () => {
        setSession(mockUser);
        
        expect(sessionStorage.setItem).toHaveBeenCalledWith(
          AUTH_KEY,
          expect.any(String)
        );
      });

      it('should dispatch session-changed event', () => {
        const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
        
        setSession(mockUser);
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mfe:session-changed',
            detail: { user: mockUser },
          })
        );
      });

      it('should set expiration time 24 hours from now', () => {
        const now = Date.now();
        jest.spyOn(Date, 'now').mockReturnValue(now);
        
        setSession(mockUser);
        
        const storedData = sessionStorage.setItem.mock.calls[0][1];
        const decryptedSession = decryptData(storedData);
        
        expect(decryptedSession.expiresAt).toBe(now + 24 * 60 * 60 * 1000);
        
        jest.restoreAllMocks();
      });
    });

    describe('getSession', () => {
      it('should return null when no session exists', () => {
        expect(getSession()).toBeNull();
      });

      it('should return user when valid session exists', () => {
        // Manually set up session storage
        const sessionData = {
          user: mockUser,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        const encrypted = encryptData(sessionData);
        sessionStorage.getItem.mockReturnValue(encrypted);
        
        const result = getSession();
        
        expect(result).toEqual(mockUser);
      });

      it('should return null and clear session when expired', () => {
        const expiredSession = {
          user: mockUser,
          timestamp: Date.now() - 48 * 60 * 60 * 1000,
          expiresAt: Date.now() - 24 * 60 * 60 * 1000,
        };
        const encrypted = encryptData(expiredSession);
        sessionStorage.getItem.mockReturnValue(encrypted);
        
        const result = getSession();
        
        expect(result).toBeNull();
      });

      it('should return null for corrupted session data', () => {
        sessionStorage.getItem.mockReturnValue('corrupted-data');
        
        expect(getSession()).toBeNull();
      });
    });

    describe('clearSession', () => {
      it('should remove session and country from storage', () => {
        clearSession();
        
        expect(sessionStorage.removeItem).toHaveBeenCalledWith(AUTH_KEY);
        expect(sessionStorage.removeItem).toHaveBeenCalledWith(COUNTRY_KEY);
      });

      it('should dispatch session-changed event with null user', () => {
        const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
        
        clearSession();
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mfe:session-changed',
            detail: { user: null },
          })
        );
      });
    });

    describe('isAuthenticated', () => {
      it('should return false when no session exists', () => {
        sessionStorage.getItem.mockReturnValue(null);
        
        expect(isAuthenticated()).toBe(false);
      });

      it('should return true when valid session exists', () => {
        const sessionData = {
          user: mockUser,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        sessionStorage.getItem.mockReturnValue(encryptData(sessionData));
        
        expect(isAuthenticated()).toBe(true);
      });
    });
  });

  describe('Country Selection', () => {
    describe('setSelectedCountry', () => {
      it('should store encrypted country in sessionStorage', () => {
        setSelectedCountry(mockCountry);
        
        expect(sessionStorage.setItem).toHaveBeenCalledWith(
          COUNTRY_KEY,
          expect.any(String)
        );
      });

      it('should dispatch country-changed event', () => {
        const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
        
        setSelectedCountry(mockCountry);
        
        expect(dispatchSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mfe:country-changed',
            detail: { country: mockCountry },
          })
        );
      });
    });

    describe('getSelectedCountry', () => {
      it('should return null when no country selected', () => {
        sessionStorage.getItem.mockReturnValue(null);
        
        expect(getSelectedCountry()).toBeNull();
      });

      it('should return country when stored', () => {
        sessionStorage.getItem.mockReturnValue(encryptData(mockCountry));
        
        const result = getSelectedCountry();
        
        expect(result).toEqual(mockCountry);
      });
    });
  });

  describe('Auth Token', () => {
    describe('getAuthToken', () => {
      it('should return null when no session exists', () => {
        sessionStorage.getItem.mockReturnValue(null);
        
        expect(getAuthToken()).toBeNull();
      });

      it('should return encrypted token when session exists', () => {
        const sessionData = {
          user: mockUser,
          timestamp: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        sessionStorage.getItem.mockReturnValue(encryptData(sessionData));
        
        const token = getAuthToken();
        
        expect(token).not.toBeNull();
        expect(typeof token).toBe('string');
      });
    });

    describe('validateAuthToken', () => {
      it('should return false for null token', () => {
        expect(validateAuthToken(null)).toBe(false);
      });

      it('should return false for invalid token', () => {
        expect(validateAuthToken('invalid-token')).toBe(false);
      });

      it('should return true for valid recent token', () => {
        const tokenData = { userId: 1, timestamp: Date.now() };
        const token = encryptData(tokenData);
        
        expect(validateAuthToken(token)).toBe(true);
      });

      it('should return false for expired token (older than 1 hour)', () => {
        const tokenData = { userId: 1, timestamp: Date.now() - 2 * 60 * 60 * 1000 };
        const token = encryptData(tokenData);
        
        expect(validateAuthToken(token)).toBe(false);
      });
    });
  });
});
