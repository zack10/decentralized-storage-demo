import React, {useEffect, useState} from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    createTheme,
    CssBaseline,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    LinearProgress,
    Radio,
    RadioGroup,
    Switch,
    TextField,
    ThemeProvider
} from "@mui/material";
import {useFileUploader} from "../hooks/useFileUploader";
import {FileEncryptionService} from "../services/fileEncryptionService";
import {DownloadManager} from "../utils/downloadManager";
import {FileReconstructionService} from "../services/fileReconstructionService";

import {
    Archive,
    Assessment,
    CheckCircle,
    CloudDownload,
    CloudUpload,
    DarkMode,
    Description,
    GetApp,
    LightMode,
    Lock,
    LockOpen,
    Loop,
    Security
} from "@mui/icons-material";

export const FileUploader: React.FC = () => {
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : false;
    });

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
                // Metadata is now included inside the ZIP file automatically
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

    const downloadSingleFile = async (chunk: { blob: Blob; filename: string }, index: number) => {
        await DownloadManager.downloadWithDelay(chunk.blob, chunk.filename, 0);
        const updatedChunks = [...pendingChunks];
        updatedChunks[index] = {...updatedChunks[index], downloaded: true} as any;
        setPendingChunks(updatedChunks);
    };

    const downloadAllRemaining = async () => {
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

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline/>
            <div style={{maxWidth: '900px', margin: '0 auto', padding: '20px'}}>
                {/* Theme Toggle */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    mb: 2,
                    gap: 1
                }}>
                    <LightMode sx={{color: darkMode ? 'text.secondary' : 'warning.main'}}/>
                    <Switch
                        checked={darkMode}
                        onChange={handleThemeToggle}
                        color="default"
                    />
                    <DarkMode sx={{color: darkMode ? 'primary.main' : 'text.secondary'}}/>
                </Box>

                <Card>
                    <CardContent>
                        <div style={{padding: '20px'}}>
                            <h1 style={{
                                textAlign: 'center',
                                marginBottom: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px'
                            }}>
                                <Security/> Enhanced Secure File Splitter
                            </h1>

                            {!isInitialized ? (
                                <Alert severity="warning" style={{marginBottom: '20px'}}>
                                    System not initialized. Please set up your encryption key first.
                                </Alert>
                            ) : (
                                <Alert severity="success"
                                       style={{
                                           marginBottom: '20px',
                                           display: 'flex',
                                           alignItems: 'center',
                                           gap: '8px'
                                       }}>
                                    Secure encryption system is active and ready.
                                </Alert>
                            )}

                            <div style={{marginBottom: '30px'}}>
                                <h2 style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <CloudUpload/> Encrypt & Split File
                                </h2>

                                {/* Download Method Selection */}
                                <FormControl component="fieldset" style={{
                                    marginBottom: '15px',
                                    padding: '10px',
                                    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8f9fa',
                                    borderRadius: '5px',
                                    width: '100%',
                                    border: darkMode ? '1px solid rgba(255, 255, 255, 0.12)' : 'none'
                                }}>
                                    <FormLabel component="legend" style={{fontWeight: 'bold', marginBottom: '10px'}}>
                                        Download Method:
                                    </FormLabel>
                                    <RadioGroup
                                        row
                                        value={downloadMethod}
                                        onChange={(e) => setDownloadMethod(e.target.value as any)}
                                    >
                                        <FormControlLabel
                                            value="auto"
                                            control={<Radio/>}
                                            label="Auto (Batched)"
                                            style={{marginRight: '20px'}}
                                        />
                                        <FormControlLabel
                                            value="manual"
                                            control={<Radio/>}
                                            label="Manual (Click each)"
                                            style={{marginRight: '20px'}}
                                        />
                                        <FormControlLabel
                                            value="zip"
                                            control={<Radio/>}
                                            label="Archive (JSON)"
                                        />
                                    </RadioGroup>
                                </FormControl>

                                <input
                                    type="file"
                                    onChange={handleFileUpload}
                                    disabled={!isInitialized || isProcessing}
                                    style={{
                                        padding: '10px',
                                        border: '2px dashed #ccc',
                                        borderRadius: '5px',
                                        width: '100%',
                                        backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                        color: darkMode ? 'white' : 'black'
                                    }}
                                />

                                {/* Progress Display */}
                                {downloadProgress && (
                                    <div style={{
                                        marginTop: '15px',
                                        padding: '15px',
                                        backgroundColor: darkMode ? 'rgba(33, 150, 243, 0.1)' : '#f0f8ff',
                                        borderRadius: '5px',
                                        border: darkMode ? '1px solid rgba(33, 150, 243, 0.3)' : 'none'
                                    }}>
                                        <h4 style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                            <Assessment/> Progress: {downloadProgress.status.toUpperCase()}
                                        </h4>
                                        <LinearProgress
                                            variant="determinate"
                                            value={(downloadProgress.current / downloadProgress.total) * 100}
                                            style={{marginBottom: '10px'}}
                                        />
                                        <p>{downloadProgress.current}/{downloadProgress.total} - {downloadProgress.currentFile}</p>
                                    </div>
                                )}

                                {/* Manual Download Controls */}
                                {downloadMethod === 'manual' && pendingChunks.length > 0 && (
                                    <div style={{
                                        marginTop: '15px',
                                        padding: '15px',
                                        backgroundColor: darkMode ? 'rgba(255, 193, 7, 0.1)' : '#fff8e1',
                                        borderRadius: '5px',
                                        border: darkMode ? '1px solid rgba(255, 193, 7, 0.3)' : 'none'
                                    }}>
                                        <h4 style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                            <Archive/> Ready for Download ({pendingChunks.length} files)
                                        </h4>
                                        <Button
                                            variant="contained"
                                            onClick={downloadAllRemaining}
                                            disabled={isProcessing}
                                            style={{marginBottom: '10px'}}
                                            startIcon={<GetApp/>}
                                        >
                                            Download All
                                            ({pendingChunks.filter((_, i) => !(pendingChunks[i] as any).downloaded).length} remaining)
                                        </Button>

                                        <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                                            {pendingChunks.map((chunk, index) => (
                                                <div key={index} style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '5px 0',
                                                    borderBottom: darkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #eee'
                                                }}>
                                                    <span style={{
                                                        fontSize: '12px',
                                                        color: (chunk as any).downloaded ? '#28a745' : (darkMode ? 'white' : '#333'),
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}>
                                                        {(chunk as any).downloaded ? <CheckCircle fontSize="small"/> :
                                                            <Description fontSize="small"/>} {chunk.filename}
                                                    </span>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => downloadSingleFile(chunk, index)}
                                                        disabled={(chunk as any).downloaded}
                                                    >
                                                        {(chunk as any).downloaded ? 'Downloaded' : 'Download'}
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{marginBottom: '30px'}}>
                                <h2 style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                    <CloudDownload/> Reconstruct File
                                </h2>
                                <p style={{color: darkMode ? 'rgba(255, 255, 255, 0.7)' : '#666', fontSize: '14px'}}>
                                    Select ALL chunk files (.enc) AND metadata.json, OR select the archive (.json) file.
                                </p>
                                <input
                                    type="file"
                                    onChange={handleFileReconstruction}
                                    multiple
                                    disabled={!isInitialized || isProcessing}
                                    accept=".enc,.json"
                                    style={{
                                        padding: '10px',
                                        border: '2px dashed #ccc',
                                        borderRadius: '5px',
                                        width: '100%',
                                        backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : 'white',
                                        color: darkMode ? 'white' : 'black'
                                    }}
                                />
                            </div>

                            {isProcessing && (
                                <Alert severity="info"
                                       style={{
                                           marginBottom: '20px',
                                           display: 'flex',
                                           alignItems: 'center',
                                           gap: '8px'
                                       }}>
                                    <div style={{display: "flex", gap: "1vh", alignItems: "anchor-center"}}>
                                        <Loop className="rotating"/> Processing... Please wait and don't close the
                                        browser.
                                    </div>
                                </Alert>
                            )}

                            {currentMetadata && (
                                <div style={{
                                    marginTop: '20px',
                                    padding: '15px',
                                    backgroundColor: darkMode ? 'rgba(255, 255, 255, 0.05)' : '#f8f9fa',
                                    borderRadius: '5px',
                                    border: darkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #dee2e6'
                                }}>
                                    <h3 style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                        <Description/> Last Processed File Info:
                                    </h3>
                                    <p>
                                        <strong>File:</strong> {currentMetadata.originalFileName}.{currentMetadata.originalExtension}
                                    </p>
                                    <p>
                                        <strong>Size:</strong> {(currentMetadata.originalSize / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                    <p><strong>Chunks:</strong> {currentMetadata.totalChunks}</p>
                                    <p><strong>Hash:</strong> {currentMetadata.hash.substring(0, 16)}...</p>
                                    <p><strong>Date:</strong> {new Date(currentMetadata.timestamp).toLocaleString()}</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Password Setup/Unlock Dialog */}
                <Dialog open={showPasswordDialog} onClose={() => {
                }} maxWidth="sm" fullWidth>
                    <DialogTitle style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        {initializationMode === 'setup' ? (
                            <><Lock/> Set Up Encryption</>
                        ) : (
                            <><LockOpen/> Unlock System</>
                        )}
                    </DialogTitle>
                    <DialogContent>
                        <div style={{padding: '10px 0'}}>
                            {initializationMode === 'setup' ? (
                                <>
                                    <Alert severity="info" style={{marginBottom: '20px'}}>
                                        This is your first time using the secure file splitter.
                                        Please create a strong password to protect your encryption key.
                                    </Alert>
                                    <p><strong>Your password will be used to:</strong></p>
                                    <ul>
                                        <li>Protect your encryption key</li>
                                        <li>Create secure backups</li>
                                        <li>Unlock the system in future sessions</li>
                                    </ul>
                                </>
                            ) : (
                                <Alert severity="warning" style={{marginBottom: '20px'}}>
                                    Enter your password to unlock the encryption system.
                                </Alert>
                            )}

                            <TextField
                                type="password"
                                label="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                                error={!!passwordError}
                                helperText={passwordError}
                                fullWidth
                                margin="normal"
                                autoFocus
                            />
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={handlePasswordSubmit}
                            variant="contained"
                            disabled={isProcessing || !password.trim()}
                            startIcon={isProcessing ? <Loop className="rotating"/> : (initializationMode === 'setup' ?
                                <Lock/> : <LockOpen/>)}
                        >
                            {isProcessing ? 'Processing...' : (initializationMode === 'setup' ? 'Set Up' : 'Unlock')}
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        </ThemeProvider>
    );
};