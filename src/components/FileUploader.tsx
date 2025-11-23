import React, {useEffect, useState} from 'react';
import {createTheme, CssBaseline, ThemeProvider} from "@mui/material";
import {useFileUploader} from "../hooks/useFileUploader";
import {FileEncryptionService} from "../services/fileEncryptionService";
import {DownloadManager} from "../utils/downloadManager";
import {FileReconstructionService} from "../services/fileReconstructionService";
import {FileUploaderTemplate} from "./FileUploaderTemplate";

export const FileUploader: React.FC = () => {
    // Theme state
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : false;
    });

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
    } = useFileUploader();

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
            const {encryptedChunks, metadata} = await FileEncryptionService.encryptFile(
                file,
                CONSTANTS.CHUNK_SIZE,
                setDownloadProgress
            );

            setCurrentMetadata(metadata);
            setPendingChunks(encryptedChunks);

            setDownloadProgress({
                current: 0,
                total: encryptedChunks.length,
                status: 'downloading',
                currentFile: 'Starting downloads...'
            });

            // Handle different download methods
            if (downloadMethod === 'zip') {
                await DownloadManager.createZipDownload(encryptedChunks.slice(0, -1), metadata);
            } else if (downloadMethod === 'auto') {
                await DownloadManager.downloadInBatches(
                    encryptedChunks,
                    CONSTANTS.MAX_CONCURRENT_DOWNLOADS,
                    (current, currentFile) => {
                        setDownloadProgress(prev => prev ? {
                            ...prev,
                            current,
                            currentFile
                        } : null);
                    }
                );
            }

            setDownloadProgress({
                current: encryptedChunks.length,
                total: encryptedChunks.length,
                status: 'complete',
                currentFile: 'All downloads complete!'
            });

            if (downloadMethod !== 'manual') {
                alert(`✅ File successfully encrypted and split!\n\n` +
                    `Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB\n` +
                    `Total files: ${encryptedChunks.length} (${metadata.totalChunks} chunks + metadata)\n` +
                    `Download method: ${downloadMethod}\n\n` +
                    `Keep ALL files for reconstruction!`);
            }

        } catch (error: any) {
            console.error('❌ Upload failed:', error);
            alert('❌ Upload failed: ' + error.message);
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
                alert(result.message);
            } else {
                const result = await FileReconstructionService.reconstructFromChunks(files);
                alert(`✅ File reconstructed successfully!\n\n` +
                    `Reconstructed size: ${(result.reconstructed.length / 1024 / 1024).toFixed(2)} MB\n` +
                    `Original size: ${(result.metadata.originalSize / 1024 / 1024).toFixed(2)} MB\n` +
                    `Hash verified: ${result.hashMatch ? '✅' : '❌'}\n` +
                    `Chunks processed: ${result.chunkFiles.length}/${result.metadata.totalChunks}`);
            }
        } catch (error: any) {
            console.error('❌ Reconstruction failed:', error);
            alert('❌ Reconstruction failed: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadSingleFile = async (chunk: { blob: Blob; filename: string }, index: number) => {
        await DownloadManager.downloadWithDelay(chunk.blob, chunk.filename, 0);
        const updatedChunks = [...pendingChunks];
        updatedChunks[index] = {...updatedChunks[index], downloaded: true} as any;
        setPendingChunks(updatedChunks);
    };

    const handleDownloadAllRemaining = async () => {
        const remaining = pendingChunks.filter((_, index) => !(pendingChunks[index] as any).downloaded);

        if (remaining.length === 0) {
            alert('All files already downloaded!');
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
            alert(`✅ Downloaded ${remaining.length} remaining files!`);
        } catch (error: any) {
            alert('❌ Failed to download remaining files: ' + error.message);
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
            <CssBaseline/>
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
            />
        </ThemeProvider>
    );
};