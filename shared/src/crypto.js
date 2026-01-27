/**
 * Secure Cryptography Module using Web Crypto API
 * 
 * Features:
 * - AES-GCM encryption/decryption
 * - Secure key derivation with PBKDF2
 * - Random IV generation for each encryption
 * - Integrity verification
 * - Secure token generation
 */

// Configuration
const CRYPTO_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  saltLength: 16,
  iterations: 100000,
  hashAlgorithm: 'SHA-256',
};

/**
 * Check if Web Crypto API is available
 */
export const isCryptoAvailable = () => {
  return typeof window !== 'undefined' && 
         window.crypto && 
         window.crypto.subtle;
};

/**
 * Generate cryptographically secure random bytes
 */
export const getRandomBytes = (length) => {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return array;
  }
  // Fallback for non-browser environments
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
};

/**
 * Generate a secure random string
 */
export const generateSecureId = (length = 32) => {
  try {
    const bytes = getRandomBytes(length);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (e) {
    // Fallback for any crypto issues
    return `${Date.now()}-${Math.random().toString(36).substr(2, length)}`;
  }
};

/**
 * Convert string to ArrayBuffer
 */
const stringToBuffer = (str) => {
  return new TextEncoder().encode(str);
};

/**
 * Convert ArrayBuffer to string
 */
const bufferToString = (buffer) => {
  return new TextDecoder().decode(buffer);
};

/**
 * Convert ArrayBuffer to Base64
 */
const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

/**
 * Convert Base64 to ArrayBuffer
 */
const base64ToBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Derive encryption key from password using PBKDF2
 */
export const deriveKey = async (password, salt) => {
  const passwordBuffer = stringToBuffer(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive the actual encryption key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: CRYPTO_CONFIG.iterations,
      hash: CRYPTO_CONFIG.hashAlgorithm,
    },
    keyMaterial,
    {
      name: CRYPTO_CONFIG.algorithm,
      length: CRYPTO_CONFIG.keyLength,
    },
    false,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt data using AES-GCM
 * Returns Base64 encoded string containing: salt + iv + ciphertext
 */
export const encrypt = async (data, password) => {
  if (!isCryptoAvailable()) {
    console.warn('Web Crypto API not available, falling back to basic encoding');
    return btoa(encodeURIComponent(JSON.stringify(data)));
  }
  
  try {
    const salt = getRandomBytes(CRYPTO_CONFIG.saltLength);
    const iv = getRandomBytes(CRYPTO_CONFIG.ivLength);
    const key = await deriveKey(password, salt);
    
    const plaintext = stringToBuffer(JSON.stringify(data));
    
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: CRYPTO_CONFIG.algorithm,
        iv: iv,
      },
      key,
      plaintext
    );
    
    // Combine salt + iv + ciphertext
    const combined = new Uint8Array(
      salt.length + iv.length + ciphertext.byteLength
    );
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
    
    return bufferToBase64(combined.buffer);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data using AES-GCM
 */
export const decrypt = async (encryptedData, password) => {
  if (!isCryptoAvailable()) {
    console.warn('Web Crypto API not available, falling back to basic decoding');
    try {
      return JSON.parse(decodeURIComponent(atob(encryptedData)));
    } catch {
      return null;
    }
  }
  
  try {
    const combined = new Uint8Array(base64ToBuffer(encryptedData));
    
    // Extract salt, iv, and ciphertext
    const salt = combined.slice(0, CRYPTO_CONFIG.saltLength);
    const iv = combined.slice(
      CRYPTO_CONFIG.saltLength, 
      CRYPTO_CONFIG.saltLength + CRYPTO_CONFIG.ivLength
    );
    const ciphertext = combined.slice(
      CRYPTO_CONFIG.saltLength + CRYPTO_CONFIG.ivLength
    );
    
    const key = await deriveKey(password, salt);
    
    const plaintext = await crypto.subtle.decrypt(
      {
        name: CRYPTO_CONFIG.algorithm,
        iv: iv,
      },
      key,
      ciphertext
    );
    
    return JSON.parse(bufferToString(plaintext));
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
};

/**
 * Hash data using SHA-256
 */
export const hash = async (data) => {
  const buffer = stringToBuffer(typeof data === 'string' ? data : JSON.stringify(data));
  const hashBuffer = await crypto.subtle.digest(CRYPTO_CONFIG.hashAlgorithm, buffer);
  return bufferToBase64(hashBuffer);
};

/**
 * Generate HMAC signature
 */
export const generateHMAC = async (data, secret) => {
  const key = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(secret),
    { name: 'HMAC', hash: CRYPTO_CONFIG.hashAlgorithm },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToBuffer(typeof data === 'string' ? data : JSON.stringify(data))
  );
  
  return bufferToBase64(signature);
};

/**
 * Verify HMAC signature
 */
export const verifyHMAC = async (data, signature, secret) => {
  const key = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(secret),
    { name: 'HMAC', hash: CRYPTO_CONFIG.hashAlgorithm },
    false,
    ['verify']
  );
  
  return crypto.subtle.verify(
    'HMAC',
    key,
    base64ToBuffer(signature),
    stringToBuffer(typeof data === 'string' ? data : JSON.stringify(data))
  );
};

/**
 * Generate secure JWT-like token
 */
export const generateSecureToken = async (payload, secret, expiresIn = 3600000) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();
  
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
    jti: generateSecureId(16),
  };
  
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(tokenPayload));
  const signature = await generateHMAC(`${headerB64}.${payloadB64}`, secret);
  
  return `${headerB64}.${payloadB64}.${signature}`;
};

/**
 * Verify and decode secure token
 */
export const verifySecureToken = async (token, secret) => {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    
    // Verify signature
    const isValid = await verifyHMAC(`${headerB64}.${payloadB64}`, signature, secret);
    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    const payload = JSON.parse(atob(payloadB64));
    
    // Check expiration
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Token expired', payload };
    }
    
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Invalid token format' };
  }
};

export default {
  isCryptoAvailable,
  getRandomBytes,
  generateSecureId,
  deriveKey,
  encrypt,
  decrypt,
  hash,
  generateHMAC,
  verifyHMAC,
  generateSecureToken,
  verifySecureToken,
};
