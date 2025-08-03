// services/fileEncryptionService.ts
import {SecureCryptoUtils} from "../utils/cryptoUtils";

export class FileEncryptionService {
    static async encryptFile(
        file: File,
        chunkSize: number,
        onProgressUpdate: (progress: any) => void
    ) {
        console.log(`🔄 Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        const buffer = await file.arrayBuffer();
        const originalData = new Uint8Array(buffer);
        const originalHash = await SecureCryptoUtils.calculateHash(originalData);
        const chunks = SecureCryptoUtils.splitIntoChunks(buffer, chunkSize);

        const extension = file.name.split('.').pop() || 'bin';
        const fileName = file.name.replace(`.${extension}`, '');

        const metadata = {
            originalFileName: fileName,
            originalExtension: extension,
            originalSize: file.size,
            totalChunks: chunks.length,
            timestamp: Date.now(),
            hash: originalHash,
            chunkSize: chunkSize
        };

        onProgressUpdate({
            current: 0,
            total: chunks.length + 1,
            status: 'encrypting',
            currentFile: 'Encrypting chunks...'
        });

        console.log(`🔐 Encrypting ${chunks.length} chunks...`);

        const encryptedChunks: { blob: Blob; filename: string }[] = [];

        for (let i = 0; i < chunks.length; i++) {
            try {
                const encrypted = await SecureCryptoUtils.encryptChunk(chunks[i]);
                const blob = new Blob([encrypted]);
                const filename = `${fileName}_chunk_${i.toString().padStart(4, '0')}.enc`;

                encryptedChunks.push({blob, filename});

                onProgressUpdate({
                    current: i + 1,
                    total: chunks.length + 1,
                    status: 'encrypting',
                    currentFile: `Encrypting chunk ${i + 1}/${chunks.length}`
                });

            } catch (error: any) {
                console.error(`Failed to encrypt chunk ${i}: ${(error instanceof Error ? error.message : String(error))}`);
            }
        }

        // Add metadata file
        const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {type: 'application/json'});
        encryptedChunks.push({
            blob: metadataBlob,
            filename: `${fileName}_metadata.json`
        });

        return {encryptedChunks, metadata};
    }
}
