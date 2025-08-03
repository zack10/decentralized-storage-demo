import {SecureKeyManager} from './keyManager';

export class SecureCryptoUtils {
    private static cryptoKey: CryptoKey | null = null;

    // Initialize the crypto system - call this before any encryption/decryption
    static async initialize(password?: string): Promise<void> {
        try {
            // Check if we have a master key
            const hasMasterKey = await SecureKeyManager.hasMasterKey();

            let masterKeyData: Uint8Array;

            if (!hasMasterKey) {
                console.log('🔑 No master key found, generating new one...');
                const hexKey = await SecureKeyManager.generateAndStoreMasterKey(password);
                masterKeyData = new Uint8Array(hexKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            } else {
                console.log('✅ Master key found, loading...');
                masterKeyData = await SecureKeyManager.getMasterKey(password);
            }

            // Import the key for use with Web Crypto API
            this.cryptoKey = await crypto.subtle.importKey(
                'raw',
                masterKeyData,
                'AES-GCM',
                false,
                ['encrypt', 'decrypt']
            );

            console.log('🔐 Crypto system initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize crypto system:', error);
            if (error instanceof Error) {
                throw new Error('Crypto system initialization failed: ' + error.message);
            } else {
                throw new Error('Crypto system initialization failed: ' + String(error));
            }
        }
    }

    // Get the current crypto key (throws if not initialized)
    static getCryptoKey(): CryptoKey {
        if (!this.cryptoKey) {
            throw new Error('Crypto system not initialized. Call initialize() first.');
        }
        return this.cryptoKey;
    }

    // Check if crypto system is ready
    static isInitialized(): boolean {
        return this.cryptoKey !== null;
    }

    // Encrypt a chunk of data
    static async encryptChunk(data: Uint8Array): Promise<Uint8Array> {
        if (!this.cryptoKey) {
            throw new Error('Crypto system not initialized. Call initialize() first.');
        }

        try {
            const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM IV
            const encrypted = await crypto.subtle.encrypt(
                {name: "AES-GCM", iv},
                this.cryptoKey,
                data
            );

            // Combine IV + encrypted data
            const result = new Uint8Array(iv.length + encrypted.byteLength);
            result.set(iv, 0);
            result.set(new Uint8Array(encrypted), iv.length);

            return result;

        } catch (error) {
            console.error('❌ Encryption failed:', error);
            if (error instanceof Error) {
                throw new Error('Chunk encryption failed: ' + error.message);
            } else {
                throw new Error('Chunk encryption initialization failed failed: ' + String(error));
            }
        }
    }

    // Decrypt a chunk of data
    static async decryptChunk(data: Uint8Array): Promise<Uint8Array> {
        if (!this.cryptoKey) {
            throw new Error('Crypto system not initialized. Call initialize() first.');
        }

        if (data.length < 12) {
            throw new Error('Invalid encrypted data - too short to contain IV');
        }

        try {
            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                {name: "AES-GCM", iv},
                this.cryptoKey,
                encrypted
            );

            return new Uint8Array(decrypted);

        } catch (error) {
            console.error('❌ Decryption failed:', error);
            throw new Error('Chunk decryption failed - wrong key or corrupted data');
        }
    }

    // Reset the crypto system (clears loaded key from memory)
    static reset(): void {
        this.cryptoKey = null;
        console.log('🔄 Crypto system reset');
    }

    // Utility: Split file into chunks
    static splitIntoChunks(buffer: ArrayBuffer, chunkSize: number = 1024 * 1024): Uint8Array[] {
        const uint8 = new Uint8Array(buffer);
        const chunks: Uint8Array[] = [];

        for (let i = 0; i < uint8.length; i += chunkSize) {
            const chunk = uint8.slice(i, Math.min(i + chunkSize, uint8.length));
            chunks.push(chunk);
        }

        console.log(`📦 Split ${uint8.length} bytes into ${chunks.length} chunks`);
        return chunks;
    }

    // Utility: Combine chunks back into single buffer
    static combineChunks(chunks: Uint8Array[]): Uint8Array {
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of chunks) {
            combined.set(chunk, offset);
            offset += chunk.length;
        }

        console.log(`🔗 Combined ${chunks.length} chunks into ${totalLength} bytes`);
        return combined;
    }

    // Utility: Verify data integrity
    static async calculateHash(data: Uint8Array): Promise<string> {
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

// Legacy compatibility functions (optional - for your existing code)
export async function encryptChunk(data: Uint8Array): Promise<Uint8Array> {
    return SecureCryptoUtils.encryptChunk(data);
}

export async function decryptChunk(data: Uint8Array): Promise<Uint8Array> {
    return SecureCryptoUtils.decryptChunk(data);
}

export function splitIntoChunks(buffer: ArrayBuffer): Uint8Array[] {
    return SecureCryptoUtils.splitIntoChunks(buffer);
}

export function combineChunks(chunks: Uint8Array[]): Uint8Array {
    return SecureCryptoUtils.combineChunks(chunks);
}