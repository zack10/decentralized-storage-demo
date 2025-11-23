import { createTheme, CssBaseline, ThemeProvider } from "@mui/material";
import React, { useEffect, useState } from 'react';
import { useFileUploader } from "../hooks/useFileUploader";
import { FileEncryptionService } from "../services/fileEncryptionService";
import { FileReconstructionService } from "../services/fileReconstructionService";
import { DownloadManager } from "../utils/downloadManager";
import { FileUploaderTemplate } from "./FileUploaderTemplate";

export const FileUploader: React.FC = () => {
    // Theme state
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : false;
    });

    // Notification state
    const [notification, setNotification] = useState<{
        open: boolean;
        message: string;
        severity: 'success' | 'info' | 'warning' | 'error';
    }>({
        open: false,
        message: '',
        severity: 'info'
    });

    const showNotification = (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'info') => {
        setNotification({
            open: true,
            message,
            severity
        });
    };

    const handleCloseNotification = () => {
        setNotification(prev => ({ ...prev, open: false }));
    };

    // File uploader hook
    const {
        isInitialized,
        isProcessing,
        downloadProgress,
        currentMetadata,
        showPasswordDialog,
        password,
        passwordError,
        initializationMode,
        downloadMethod,
        pendingChunks,
        CONSTANTS,
        setIsProcessing,
        setDownloadProgress,
        setCurrentMetadata,
        setPassword,
        setDownloadMethod,
        setPendingChunks,
        handlePasswordSubmit
    } = useFileUploader(showNotification);

    // Create theme based on dark mode state
    const theme = createTheme({
        palette: {
            mode: darkMode ? 'dark' : 'light',
        },
    });

    // Save theme preference to localStorage
    useEffect(() => {
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode]);

    // Event handlers
    const handleThemeToggle = () => {
        setDarkMode(!darkMode);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !isInitialized) return;

        setIsProcessing(true);
        setPendingChunks([]);

        try {
            // Use the generator for streaming processing
            const generator = FileEncryptionService.encryptFileGenerator(
                file,
                CONSTANTS.CHUNK_SIZE,
                setDownloadProgress
            );

            const chunksList: { blob: Blob; filename: string; downloaded?: boolean }[] = [];
            let metadata: any = null;

            if (downloadMethod === 'auto') {
                setDownloadProgress({
                    current: 0,
                    total: 0,
                    status: 'downloading',
                    currentFile: 'Starting streaming download...'
                });

                let chunkIndex = 0;
                // Iterate over the generator
                // We use a manual iterator to get the return value (metadata) at the end
                const iterator = generator[Symbol.asyncIterator]();
                let result = await iterator.next();

                while (!result.done) {
                    const chunk = result.value;

                    // Download immediately
                    await DownloadManager.downloadWithDelay(chunk.blob, chunk.filename, 0);

                    // Add to list but WITHOUT the blob to save memory
                    chunksList.push({ ...chunk, blob: null as any, downloaded: true });

                    chunkIndex++;
                    const currentIndex = chunkIndex; // Fix no-loop-func
                    setDownloadProgress(prev => prev ? {
                        ...prev,
                        current: currentIndex,
                        currentFile: `Downloaded ${chunk.filename}`
                    } : null);

                    result = await iterator.next();
                }

                metadata = result.value;

            } else {
                // Manual or Zip: We MUST keep the blobs
                // Note: This will still crash for 3GB files if the browser can't handle it
                // But "Auto" is the recommended way for large files
                const iterator = generator[Symbol.asyncIterator]();
                let result = await iterator.next();

                while (!result.done) {
                    chunksList.push(result.value);
                    result = await iterator.next();
                }
                metadata = result.value;
            }

            setCurrentMetadata(metadata);

            // Add metadata file to list
            const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
            const metadataFilename = `${metadata.originalFileName}_metadata.json`;

            if (downloadMethod === 'auto') {
                await DownloadManager.downloadWithDelay(metadataBlob, metadataFilename, 0);
                chunksList.push({ blob: null as any, filename: metadataFilename, downloaded: true });
            } else {
                chunksList.push({ blob: metadataBlob, filename: metadataFilename });
            }

            setPendingChunks([...chunksList]);

            setDownloadProgress({
                current: chunksList.length,
                total: chunksList.length,
                status: 'complete',
                currentFile: 'All downloads complete!'
            });

            // Handle Zip download if selected (requires all chunks, so we kept them in the else block above)
            if (downloadMethod === 'zip') {
                await DownloadManager.createZipDownload(chunksList.slice(0, -1), metadata);
            }

            if (downloadMethod !== 'manual') {
                const message = `✅ File successfully encrypted and split!\n` +
                    `Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n` +
                    `Total files: ${chunksList.length} (${metadata.totalChunks} chunks + metadata)\n` +
                    `Download method: ${downloadMethod}\n` +
                    `Keep ALL files for reconstruction!`;

                console.log(message);
                showNotification('File successfully encrypted and split!', 'success');
            }

        } catch (error: any) {
            console.error('❌ Upload failed:', error);
            showNotification('Upload failed: ' + error.message, 'error');
            setDownloadProgress({
                current: 0,
                total: 0,
                status: 'error',
                currentFile: error.message
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFileReconstruction = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !isInitialized) return;

        setIsProcessing(true);
        try {
            const archiveFile = Array.from(files).find(f => f.name.endsWith('_encrypted_archive.json'));

            if (archiveFile) {
                const result = await FileReconstructionService.reconstructFromArchive(archiveFile);
                console.log(result.message);
                showNotification(result.message, 'success');
            } else {
                const result = await FileReconstructionService.reconstructFromChunks(files);
                const message = `✅ File reconstructed successfully!\n` +
                    `Reconstructed size: ${(result.reconstructed.length / 1024 / 1024).toFixed(2)} MB\n` +
                    `Original size: ${(result.metadata.originalSize / 1024 / 1024).toFixed(2)} MB\n` +
                    `Hash verified: ${result.hashMatch ? '✅' : '❌'}\n` +
                    `Chunks processed: ${result.chunkFiles.length}/${result.metadata.totalChunks}`;

                console.log(message);
                showNotification('File reconstructed successfully!', 'success');
            }
        } catch (error: any) {
            console.error('❌ Reconstruction failed:', error);
            showNotification('Reconstruction failed: ' + error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadSingleFile = async (chunk: { blob: Blob; filename: string }, index: number) => {
        if (!chunk.blob) {
            showNotification('File already downloaded and cleared from memory', 'info');
            return;
        }
        await DownloadManager.downloadWithDelay(chunk.blob, chunk.filename, 0);
        const updatedChunks = [...pendingChunks];
        updatedChunks[index] = { ...updatedChunks[index], downloaded: true } as any;
        setPendingChunks(updatedChunks);
    };

    const handleDownloadAllRemaining = async () => {
        const remaining = pendingChunks.filter((_, index) => !(pendingChunks[index] as any).downloaded);

        if (remaining.length === 0) {
            showNotification('All files already downloaded!', 'info');
            return;
        }

        setIsProcessing(true);
        try {
            await DownloadManager.downloadInBatches(
                remaining,
                CONSTANTS.MAX_CONCURRENT_DOWNLOADS,
                () => {
                } // No progress update needed for manual downloads
            );
            showNotification(`Downloaded ${remaining.length} remaining files!`, 'success');
        } catch (error: any) {
            showNotification('Failed to download remaining files: ' + error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePasswordChange = (value: string) => {
        setPassword(value);
    };

    const handleDownloadMethodChange = (value: string) => {
        setDownloadMethod(value as any);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <FileUploaderTemplate
                isInitialized={isInitialized}
                isProcessing={isProcessing}
                downloadProgress={downloadProgress}
                currentMetadata={currentMetadata}
                showPasswordDialog={showPasswordDialog}
                password={password}
                passwordError={passwordError}
                initializationMode={initializationMode}
                downloadMethod={downloadMethod}
                pendingChunks={pendingChunks}
                darkMode={darkMode}
                onFileUpload={handleFileUpload}
                onFileReconstruction={handleFileReconstruction}
                onPasswordChange={handlePasswordChange}
                onPasswordSubmit={handlePasswordSubmit}
                onDownloadMethodChange={handleDownloadMethodChange}
                onDownloadSingleFile={handleDownloadSingleFile}
                onDownloadAllRemaining={handleDownloadAllRemaining}
                onThemeToggle={handleThemeToggle}
                notification={notification}
                onCloseNotification={handleCloseNotification}
            />
        </ThemeProvider>
    );
};