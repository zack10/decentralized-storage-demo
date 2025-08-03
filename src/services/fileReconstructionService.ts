// services/fileReconstructionService.ts
import {SecureCryptoUtils} from "../utils/cryptoUtils";
import {DownloadManager} from "../utils/downloadManager";

export class FileReconstructionService {
    static async reconstructFromArchiveV0(archiveFile: File) {
        const archiveText = await archiveFile.text();
        const archiveData = JSON.parse(archiveText);
        const metadata = archiveData.metadata;

        console.log(`🔄 Reconstructing from archive: ${metadata.originalFileName}.${metadata.originalExtension}`);

        const decryptedChunks: Uint8Array[] = [];

        for (let i = 0; i < archiveData.chunks.length; i++) {
            const chunkData = new Uint8Array(archiveData.chunks[i].data);
            const decrypted = await SecureCryptoUtils.decryptChunk(chunkData);
            decryptedChunks.push(decrypted);
        }

        const reconstructed = SecureCryptoUtils.combineChunks(decryptedChunks);
        const blob = new Blob([reconstructed]);

        await DownloadManager.downloadWithDelay(
            blob,
            `${metadata.originalFileName}_reconstructed.${metadata.originalExtension}`,
            0
        );

        return {
            success: true,
            message: `✅ File reconstructed from archive! Size: ${(reconstructed.length / 1024 / 1024).toFixed(2)} MB`
        };
    }

    static async reconstructFromChunks(files: FileList) {
        const metadataFile = Array.from(files).find(f => f.name.endsWith('_metadata.json'));
        if (!metadataFile) {
            throw new Error('Metadata file not found. Please include the _metadata.json file.');
        }

        const metadataText = await metadataFile.text();
        const metadata = JSON.parse(metadataText);

        console.log(`🔄 Reconstructing: ${metadata.originalFileName}.${metadata.originalExtension}`);
        console.log(`📊 Expected: ${metadata.totalChunks} chunks, ${(metadata.originalSize / 1024 / 1024).toFixed(2)} MB`);

        const chunkFiles = Array.from(files)
            .filter(f => f.name.endsWith('.enc'))
            .sort((a, b) => {
                const aMatch = a.name.match(/chunk_(\d+)/);
                const bMatch = b.name.match(/chunk_(\d+)/);
                const aNum = aMatch ? parseInt(aMatch[1]) : 0;
                const bNum = bMatch ? parseInt(bMatch[1]) : 0;
                return aNum - bNum;
            });

        if (chunkFiles.length !== metadata.totalChunks) {
            const missing = metadata.totalChunks - chunkFiles.length;
            throw new Error(`Missing ${missing} chunk files! Expected ${metadata.totalChunks}, found ${chunkFiles.length}. Please ensure all chunk files are selected.`);
        }

        console.log(`🔓 Decrypting ${chunkFiles.length} chunks...`);

        const decryptedChunks: Uint8Array[] = [];

        for (let i = 0; i < chunkFiles.length; i++) {
            const file = chunkFiles[i];
            try {
                const buffer = await file.arrayBuffer();
                const decrypted = await SecureCryptoUtils.decryptChunk(new Uint8Array(buffer));
                decryptedChunks.push(decrypted);

                console.log(`✅ Decrypted chunk ${i + 1}/${chunkFiles.length}: ${decrypted.length} bytes`);
            } catch (error: any) {
                throw new Error(`Failed to decrypt chunk ${i} (${file.name}): ${error.message}`);
            }
        }

        const reconstructed = SecureCryptoUtils.combineChunks(decryptedChunks);

        // Verify integrity
        const reconstructedHash = await SecureCryptoUtils.calculateHash(reconstructed);
        const hashMatch = reconstructedHash === metadata.hash;

        if (!hashMatch) {
            console.warn('⚠️ Hash mismatch - file may be corrupted');
            // eslint-disable-next-line no-restricted-globals
            if (!confirm('Hash verification failed. The reconstructed file may be corrupted. Download anyway?')) {
                throw new Error('User cancelled due to hash mismatch');
            }
        }

        const blob = new Blob([reconstructed]);
        await DownloadManager.downloadWithDelay(
            blob,
            `${metadata.originalFileName}_reconstructed.${metadata.originalExtension}`,
            0
        );

        return {
            success: true,
            reconstructed,
            metadata,
            hashMatch,
            chunkFiles
        };
    }

    static async reconstructFromArchive(archiveFile: File) {
        if (archiveFile.name.endsWith('.zip')) {
            return await this.reconstructFromZip(archiveFile);
        } else if (archiveFile.name.endsWith('_encrypted_archive.json')) {
            // Keep old JSON method for backward compatibility
            return await this.reconstructFromArchiveV0(archiveFile);
        }
        throw new Error('Unsupported archive format');
    }

    static async reconstructFromZip(zipFile: File) {
        const JSZip = require('jszip'); // or import JSZip from 'jszip'

        const zip = await JSZip.loadAsync(zipFile);

        // Find metadata
        const metadataFile = Object.keys(zip.files).find(f => f.endsWith('_metadata.json'));
        // @ts-ignore
        const metadata = JSON.parse(await zip.files[metadataFile].async('text'));

        // Get chunks in order
        const chunkFiles = Object.keys(zip.files)
            .filter(f => f.endsWith('.enc'))
            .sort(/* your sorting logic */);

        // Decrypt chunks
        const decryptedChunks = [];
        for (const fileName of chunkFiles) {
            const chunkData = await zip.files[fileName].async('uint8array');
            const decrypted = await SecureCryptoUtils.decryptChunk(chunkData);
            decryptedChunks.push(decrypted);
        }

        // Reconstruct file
        const reconstructed = SecureCryptoUtils.combineChunks(decryptedChunks);
        const blob = new Blob([reconstructed]);

        await DownloadManager.downloadWithDelay(
            blob,
            `${metadata.originalFileName}_reconstructed.${metadata.originalExtension}`,
            0
        );

        return {success: true, message: 'File reconstructed from ZIP!'};
    }
}