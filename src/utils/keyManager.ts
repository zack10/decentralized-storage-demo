// keyManager.ts - Secure key management system
export class SecureKeyManager {
    private static readonly STORAGE_PREFIX = 'secure_file_splitter_';
    private static readonly MASTER_KEY_ID = 'master_key';
    private static readonly KEY_VERSION = 'v1';

    // Generate a new master key and store it securely
    static async generateAndStoreMasterKey(password?: string): Promise<string> {
        try {
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

            localStorage.setItem(storageKey, keyData);

            // Create backup in IndexedDB for redundancy
            await this.storeInIndexedDB(storageKey, keyData);

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
                this.parseStoredKey(stored, password);
                /*const keyInfo = JSON.parse(stored);

                if (keyInfo.encrypted && password) {
                    return await this.decryptKeyWithPassword(keyInfo.data, password);
                } else if (!keyInfo.encrypted) {
                    return new Uint8Array(keyInfo.data.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
                }*/
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
                this.parseStoredKey(stored, password);
            }
        }

        return null;
    }

    private static parseStoredKey(stored: string, password?: string): Uint8Array | Promise<Uint8Array> | null {
        const keyInfo = JSON.parse(stored);

        if (keyInfo.encrypted && password) {
            return this.decryptKeyWithPassword(keyInfo.data, password);
        } else if (!keyInfo.encrypted) {
            return new Uint8Array(keyInfo.data.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16)));
        }
        return null;
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

            request.onerror = () => reject(request.error);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys');
                }
            };

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['keys'], 'readwrite');
                const store = transaction.objectStore('keys');

                const putRequest = store.put(data, key);
                putRequest.onerror = () => reject(putRequest.error);
                putRequest.onsuccess = () => resolve();

                db.close();
            };
        });
    }

    private static async getDataFromIndexedDB(key: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SecureFileSplitterDB', 1);

            request.onerror = () => resolve(null); // Fail silently

            request.onsuccess = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains('keys')) {
                    db.close();
                    resolve(null);
                    return;
                }

                const transaction = db.transaction(['keys'], 'readonly');
                const store = transaction.objectStore('keys');
                const getRequest = store.get(key);

                getRequest.onerror = () => resolve(null);
                getRequest.onsuccess = () => {
                    db.close();
                    resolve(getRequest.result || null);
                };
            };
        });
    }

    private static async clearIndexedDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('SecureFileSplitterDB', 1);

            request.onerror = () => resolve(); // Fail silently

            request.onsuccess = () => {
                const db = request.result;

                if (db.objectStoreNames.contains('keys')) {
                    const transaction = db.transaction(['keys'], 'readwrite');
                    const store = transaction.objectStore('keys');
                    store.clear();
                }

                db.close();
                resolve();
            };
        });
    }

    private static async calculateChecksum(data: Uint8Array): Promise<string> {
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}