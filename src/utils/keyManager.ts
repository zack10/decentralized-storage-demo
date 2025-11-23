// keyManager.ts - Secure key management system
export class SecureKeyManager {
    private static readonly STORAGE_PREFIX = 'secure_file_splitter_';
    private static readonly MASTER_KEY_ID = 'master_key';
    private static readonly KEY_VERSION = 'v1';

    // Generate a new master key and store it securely
    static async generateAndStoreMasterKey(password?: string): Promise<string> {
        function isCryptoAvailable() {
            return window.crypto && window.crypto.subtle &&
                (window.location.protocol === 'https:' ||
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1');
        }

        try {
            if (!isCryptoAvailable()) {
                throw new Error('Web Crypto API is not available. Please use HTTPS or localhost.');
            }
            // Generate a cryptographically secure random key
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));

            let storageKey: string;
            let keyData: string;

            if (password) {
                // Encrypt the key with user password for extra security
                const encryptedKey = await this.encryptKeyWithPassword(keyMaterial, password);
                storageKey = `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_encrypted_${this.KEY_VERSION}`;
                keyData = JSON.stringify({
                    encrypted: true,
                    data: encryptedKey,
                    timestamp: Date.now(),
                    version: this.KEY_VERSION
                });
            } else {
                // Store key directly (less secure but simpler)
                const hexKey = Array.from(keyMaterial).map(b => b.toString(16).padStart(2, '0')).join('');
                storageKey = `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_${this.KEY_VERSION}`;
                keyData = JSON.stringify({
                    encrypted: false,
                    data: hexKey,
                    timestamp: Date.now(),
                    version: this.KEY_VERSION
                });
            }

            // Store in localStorage first (primary storage)
            localStorage.setItem(storageKey, keyData);
            console.log('✅ Master key stored in localStorage');

            // Try to create backup in IndexedDB (secondary storage - don't fail if this fails)
            try {
                await this.storeInIndexedDB(storageKey, keyData);
                console.log('✅ Master key backup created in IndexedDB');
            } catch (indexedDBError) {
                console.warn('⚠️ Failed to create IndexedDB backup (continuing anyway):', indexedDBError);
                // Don't throw - localStorage storage succeeded
            }

            console.log('✅ Master key generated and stored securely');
            return Array.from(keyMaterial).map(b => b.toString(16).padStart(2, '0')).join('');

        } catch (error) {
            console.error('❌ Failed to generate master key:', error);
            throw new Error('Failed to generate secure master key');
        }
    }

    // Retrieve the master key
    static async getMasterKey(password?: string): Promise<Uint8Array> {
        try {
            // Try to get from localStorage first
            let keyData = await this.getFromLocalStorage(password);

            // Fallback to IndexedDB if localStorage fails
            if (!keyData) {
                keyData = await this.getFromIndexedDB(password);
            }

            if (!keyData) {
                throw new Error('No master key found. Please generate a new one.');
            }

            return keyData;

        } catch (error) {
            console.error('❌ Failed to retrieve master key:', error);
            throw error;
        }
    }

    // Check if master key exists
    static async hasMasterKey(): Promise<boolean> {
        const storageKeys = [
            `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_${this.KEY_VERSION}`,
            `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_encrypted_${this.KEY_VERSION}`
        ];

        // Check localStorage
        for (const key of storageKeys) {
            if (localStorage.getItem(key)) return true;
        }

        // Check IndexedDB
        try {
            for (const key of storageKeys) {
                const data = await this.getDataFromIndexedDB(key);
                if (data) return true;
            }
        } catch (error) {
            console.warn('Could not check IndexedDB:', error);
        }

        return false;
    }

    // Clear all stored keys (for security or reset)
    static async clearAllKeys(): Promise<void> {
        // Clear localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith(this.STORAGE_PREFIX)) {
                localStorage.removeItem(key);
            }
        });

        // Clear IndexedDB
        try {
            await this.clearIndexedDB();
        } catch (error) {
            console.warn('Could not clear IndexedDB:', error);
        }

        console.log('🗑️ All stored keys cleared');
    }

    // Export key for backup (encrypted with password)
    static async exportKeyForBackup(password: string): Promise<string> {
        const masterKey = await this.getMasterKey();
        const encryptedBackup = await this.encryptKeyWithPassword(masterKey, password);

        const backupData = {
            version: this.KEY_VERSION,
            timestamp: Date.now(),
            data: encryptedBackup,
            checksum: await this.calculateChecksum(masterKey)
        };

        return btoa(JSON.stringify(backupData));
    }

    // Import key from backup
    static async importKeyFromBackup(backupString: string, password: string): Promise<void> {
        try {
            const backupData = JSON.parse(atob(backupString));
            const decryptedKey = await this.decryptKeyWithPassword(backupData.data, password);

            // Verify checksum
            const checksum = await this.calculateChecksum(decryptedKey);
            if (checksum !== backupData.checksum) {
                throw new Error('Backup verification failed - corrupted data or wrong password');
            }

            // Store the imported key
            const hexKey = Array.from(decryptedKey).map(b => b.toString(16).padStart(2, '0')).join('');
            const storageKey = `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_${this.KEY_VERSION}`;
            const keyData = JSON.stringify({
                encrypted: false,
                data: hexKey,
                timestamp: Date.now(),
                version: this.KEY_VERSION,
                imported: true
            });

            localStorage.setItem(storageKey, keyData);
            await this.storeInIndexedDB(storageKey, keyData);

            console.log('✅ Key imported successfully from backup');

        } catch (error) {
            console.error('❌ Failed to import key from backup:', error);
            throw new Error('Failed to import key - check your backup string and password');
        }
    }

    // Private helper methods
    private static async getFromLocalStorage(password?: string): Promise<Uint8Array | null> {
        const keys = [
            `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_${this.KEY_VERSION}`,
            `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_encrypted_${this.KEY_VERSION}`
        ];

        for (const key of keys) {
            const stored = localStorage.getItem(key);
            if (stored) {
                const result = await this.parseStoredKey(stored, password);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    private static async getFromIndexedDB(password?: string): Promise<Uint8Array | null> {
        const keys = [
            `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_${this.KEY_VERSION}`,
            `${this.STORAGE_PREFIX}${this.MASTER_KEY_ID}_encrypted_${this.KEY_VERSION}`
        ];

        for (const key of keys) {
            const stored = await this.getDataFromIndexedDB(key);
            if (stored) {
                const result = await this.parseStoredKey(stored, password);
                if (result) {
                    return result;
                }
            }
        }

        return null;
    }

    private static async parseStoredKey(stored: string, password?: string): Promise<Uint8Array | null> {
        try {
            const keyInfo = JSON.parse(stored);

            if (keyInfo.encrypted && password) {
                return await this.decryptKeyWithPassword(keyInfo.data, password);
            } else if (!keyInfo.encrypted) {
                return new Uint8Array(keyInfo.data.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
            } else if (keyInfo.encrypted && !password) {
                // Key is encrypted but no password provided
                throw new Error('Password required for encrypted key');
            }

            return null;
        } catch (error) {
            console.warn('Failed to parse stored key:', error);
            return null;
        }
    }

    private static async encryptKeyWithPassword(keyMaterial: Uint8Array, password: string): Promise<string> {
        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            {name: 'PBKDF2'},
            false,
            ['deriveKey']
        );

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            {name: 'AES-GCM', length: 256},
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            {name: 'AES-GCM', iv: iv},
            derivedKey,
            keyMaterial
        );

        // Combine salt + iv + encrypted data
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);

        return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private static async decryptKeyWithPassword(encryptedHex: string, password: string): Promise<Uint8Array> {
        const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        const salt = encrypted.slice(0, 16);
        const iv = encrypted.slice(16, 28);
        const ciphertext = encrypted.slice(28);

        const encoder = new TextEncoder();
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            {name: 'PBKDF2'},
            false,
            ['deriveKey']
        );

        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            {name: 'AES-GCM', length: 256},
            false,
            ['decrypt']
        );

        const decrypted = await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: iv},
            derivedKey,
            ciphertext
        );

        return new Uint8Array(decrypted);
    }

    private static async storeInIndexedDB(key: string, data: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SecureFileSplitterDB', 1);

            request.onerror = () => {
                console.error('IndexedDB open error:', request.error);
                reject(request.error);
            };

            request.onblocked = () => {
                console.warn('IndexedDB open blocked');
                reject(new Error('Database open blocked'));
            };

            request.onupgradeneeded = (event) => {
                console.log('IndexedDB upgrade needed, creating object store...');
                const db = (event.target as IDBOpenDBRequest).result;

                // Delete existing object store if it exists (for clean slate)
                if (db.objectStoreNames.contains('keys')) {
                    db.deleteObjectStore('keys');
                }

                // Create new object store
                db.createObjectStore('keys');
                console.log('Object store "keys" created successfully');
            };

            request.onsuccess = () => {
                const db = request.result;
                console.log('IndexedDB opened successfully, version:', db.version);

                // Double-check that object store exists
                if (!db.objectStoreNames.contains('keys')) {
                    console.error('Object store "keys" still not found after upgrade');
                    db.close();
                    reject(new Error('Object store "keys" not found after database upgrade'));
                    return;
                }

                try {
                    const transaction = db.transaction(['keys'], 'readwrite');

                    transaction.onerror = () => {
                        console.error('Transaction error:', transaction.error);
                        db.close();
                        reject(transaction.error);
                    };

                    transaction.oncomplete = () => {
                        console.log('IndexedDB transaction completed successfully');
                        db.close();
                        resolve();
                    };

                    const store = transaction.objectStore('keys');
                    const putRequest = store.put(data, key);

                    putRequest.onerror = () => {
                        console.error('Put request error:', putRequest.error);
                        db.close();
                        reject(putRequest.error);
                    };

                    putRequest.onsuccess = () => {
                        console.log('Data stored successfully in IndexedDB');
                    };

                } catch (error) {
                    console.error('Transaction creation error:', error);
                    db.close();
                    reject(error);
                }
            };
        });
    }

    private static async getDataFromIndexedDB(key: string): Promise<string | null> {
        return new Promise((resolve) => {
            const request = indexedDB.open('SecureFileSplitterDB', 1);

            request.onerror = () => {
                console.warn('Failed to open IndexedDB for reading:', request.error);
                resolve(null);
            };

            request.onupgradeneeded = (event) => {
                // If we need to upgrade while reading, something is wrong
                console.log('Unexpected upgrade needed during read operation');
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys');
                }
            };

            request.onsuccess = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains('keys')) {
                    console.warn('Object store "keys" not found during read');
                    db.close();
                    resolve(null);
                    return;
                }

                try {
                    const transaction = db.transaction(['keys'], 'readonly');

                    transaction.onerror = () => {
                        console.warn('Read transaction error:', transaction.error);
                        db.close();
                        resolve(null);
                    };

                    const store = transaction.objectStore('keys');
                    const getRequest = store.get(key);

                    getRequest.onerror = () => {
                        console.warn('Get request error:', getRequest.error);
                        db.close();
                        resolve(null);
                    };

                    getRequest.onsuccess = () => {
                        db.close();
                        resolve(getRequest.result || null);
                    };

                } catch (error) {
                    console.warn('Error during read operation:', error);
                    db.close();
                    resolve(null);
                }
            };
        });
    }

    private static async clearIndexedDB(): Promise<void> {
        return new Promise((resolve) => {
            const request = indexedDB.open('SecureFileSplitterDB', 1);

            request.onerror = () => {
                console.warn('Failed to open IndexedDB for clearing');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys');
                }
            };

            request.onsuccess = () => {
                const db = request.result;

                if (db.objectStoreNames.contains('keys')) {
                    try {
                        const transaction = db.transaction(['keys'], 'readwrite');
                        const store = transaction.objectStore('keys');
                        store.clear();

                        transaction.oncomplete = () => {
                            console.log('IndexedDB cleared successfully');
                            db.close();
                            resolve();
                        };

                        transaction.onerror = () => {
                            console.warn('Error clearing IndexedDB:', transaction.error);
                            db.close();
                            resolve();
                        };
                    } catch (error) {
                        console.warn('Error during clear operation:', error);
                        db.close();
                        resolve();
                    }
                } else {
                    db.close();
                    resolve();
                }
            };
        });
    }

    private static async calculateChecksum(data: Uint8Array): Promise<string> {
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Also add this method to handle the case when no master key exists
    static async initializeOrGetMasterKey(password?: string): Promise<Uint8Array> {
        try {
            // First check if master key exists
            const hasKey = await this.hasMasterKey();

            if (!hasKey) {
                // No key exists, generate a new one
                console.log('🔑 No master key found, generating new one...');
                const hexKey = await this.generateAndStoreMasterKey(password);
                return new Uint8Array(hexKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            } else {
                // Key exists, retrieve it
                return await this.getMasterKey(password);
            }
        } catch (error) {
            console.error('❌ Failed to initialize or get master key:', error);
            throw error;
        }
    }
}