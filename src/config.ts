// config.ts - Updated configuration (no more random keys!)
export const CHUNK_SIZE = 1024 * 1024; // 1MB

// ❌ OLD - DON'T USE THIS ANYMORE:
// export const ENCRYPTION_KEY = crypto.getRandomValues(new Uint8Array(32));

// ✅ NEW - Key management is now handled by SecureKeyManager
// The encryption key is generated once, stored securely, and retrieved as needed
// No more random keys that change every time!

// Optional: Default chunk size options
export const CHUNK_SIZE_OPTIONS = {
    SMALL: 512 * 1024,      // 512KB - for slow connections
    MEDIUM: 1024 * 1024,    // 1MB - default
    LARGE: 5 * 1024 * 1024, // 5MB - for fast connections
    XLARGE: 10 * 1024 * 1024 // 10MB - for very fast connections
};

// Security settings
export const SECURITY_CONFIG = {
    PBKDF2_ITERATIONS: 100000,     // Key derivation iterations
    AES_KEY_LENGTH: 256,           // AES-256
    IV_LENGTH: 12,                 // GCM IV length
    SALT_LENGTH: 16,               // PBKDF2 salt length
    MAX_FILE_SIZE: 100 * 1024 * 1024 * 1024, // 100GB max file size
};

// Storage keys (used internally by SecureKeyManager)
export const STORAGE_KEYS = {
    KEY_STORAGE_PREFIX: 'secure_file_splitter_',
    METADATA_KEY: 'fileMetadata',
    SESSION_KEY: 'sessionData'
};

// Application info
export const APP_INFO = {
    NAME: 'Secure File Splitter',
    VERSION: '2.0.0',
    DESCRIPTION: 'Encrypt and split large files into secure chunks'
};