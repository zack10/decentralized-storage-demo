// services/fileEncryptionService.ts
import { SecureCryptoUtils } from "../utils/cryptoUtils";

export class FileEncryptionService {
    static async *encryptFileGenerator(
        file: File,
        chunkSize: number,
        onProgressUpdate: (progress: any) => void
    ) {
        console.log(`🔄 Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        const totalChunks = Math.ceil(file.size / chunkSize);
        const extension = file.name.split('.').pop() || 'bin';
        const fileName = file.name.replace(`.${extension}`, '');

        const chunkHashes: string[] = [];

        // We don't accumulate encryptedChunks here anymore to save memory
        // The consumer (FileUploader) decides what to do with them

        onProgressUpdate({
            current: 0,
            total: totalChunks + 1,
            status: 'encrypting',
            currentFile: 'Starting encryption...'
        });

        console.log(`🔐 Encrypting ${totalChunks} chunks...`);

        let lastUpdateTime = Date.now();

        for (let i = 0; i < totalChunks; i++) {
            try {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunkBlob = file.slice(start, end);
                let chunkBuffer = await chunkBlob.arrayBuffer();
                let chunkData = new Uint8Array(chunkBuffer);

                // Calculate hash of the original chunk
                const chunkHash = await SecureCryptoUtils.calculateHash(chunkData);
                chunkHashes.push(chunkHash);

                // Encrypt the chunk
                const encrypted = await SecureCryptoUtils.encryptChunk(chunkData);
                const blob = new Blob([encrypted as any]);
                const filename = `${fileName}_chunk_${i.toString().padStart(4, '0')}.enc`;

                // Yield the chunk immediately
                yield { blob, filename, index: i };

                // Throttle progress updates
                const now = Date.now();
                if (now - lastUpdateTime > 100 || i === totalChunks - 1) {
                    onProgressUpdate({
                        current: i + 1,
                        total: totalChunks + 1,
                        status: 'encrypting',
                        currentFile: `Encrypting chunk ${i + 1}/${totalChunks}`
                    });
                    lastUpdateTime = now;
                }

                // Help GC
                (chunkData as any) = null;
                (chunkBuffer as any) = null;

                // Yield to main thread every 50 chunks
                if (i % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

            } catch (error: any) {
                console.error(`Failed to encrypt chunk ${i}: ${(error instanceof Error ? error.message : String(error))}`);
                throw error;
            }
        }

        // Calculate composite hash
        const combinedHashes = new TextEncoder().encode(chunkHashes.join(''));
        const finalHash = await SecureCryptoUtils.calculateHash(combinedHashes);

        const metadata = {
            originalFileName: fileName,
            originalExtension: extension,
            originalSize: file.size,
            totalChunks: totalChunks,
            timestamp: Date.now(),
            hash: finalHash,
            hashType: 'composite',
            chunkSize: chunkSize
        };

        // Yield metadata as the last item (or return it)
        // We'll return it so the generator result is the metadata
        return metadata;
    }
}
