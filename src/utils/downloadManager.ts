import JSZip from 'jszip';

// utils/downloadManager.ts
export class DownloadManager {
    static async downloadWithDelay(blob: Blob, filename: string, delay: number = 500): Promise<void> {
        return new Promise((resolve) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);

            setTimeout(() => {
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(a.href);
                    resolve();
                }, 100);
            }, delay);
        });
    }

    static async downloadInBatches(
        chunks: { blob: Blob; filename: string }[],
        maxConcurrent: number,
        onProgressUpdate: (current: number, currentFile: string) => void
    ): Promise<void> {
        const batchSize = maxConcurrent;

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);

            await Promise.all(
                batch.map((chunk, index) =>
                    this.downloadWithDelay(chunk.blob, chunk.filename, index * 200)
                )
            );

            onProgressUpdate(
                Math.min(i + batchSize, chunks.length),
                `Batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(chunks.length / batchSize)}`
            );

            if (i + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    static async createZipDownloadV0(
        chunks: { blob: Blob; filename: string }[],
        metadata: any
    ): Promise<void> {
        const archiveData = {
            metadata,
            chunks: await Promise.all(
                chunks.map(async (chunk) => ({
                    filename: chunk.filename,
                    data: Array.from(new Uint8Array(await chunk.blob.arrayBuffer()))
                }))
            )
        };

        const archiveJson = JSON.stringify(archiveData);
        const archiveBlob = new Blob([archiveJson], {type: 'application/json'});

        await this.downloadWithDelay(
            archiveBlob,
            `${metadata.originalFileName}_encrypted_archive.json`,
            0
        );
    }

    static async createZipDownload(
        chunks: { blob: Blob; filename: string }[],
        metadata: any
    ): Promise<void> {
        // Use JSZip for actual compression - much more efficient than JSON
        if (!JSZip) {
            throw new Error('JSZip library not loaded. Please include JSZip in your project.');
        }

        const zip = new JSZip();

        // Add metadata file to zip
        zip.file(`${metadata.originalFileName}_metadata.json`, JSON.stringify(metadata, null, 2));

        // Add all encrypted chunks to zip
        for (const chunk of chunks) {
            zip.file(chunk.filename, chunk.blob);
        }

        // Generate compressed zip file
        const zipBlob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {
                level: 6 // Good balance between compression and speed
            }
        });

        await this.downloadWithDelay(
            zipBlob,
            `${metadata.originalFileName}_encrypted.zip`,
            0
        );
    }
}