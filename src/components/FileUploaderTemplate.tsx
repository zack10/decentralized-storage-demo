import React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
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
    Snackbar,
    Alert as MuiAlert
} from "@mui/material";
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
import './FileUploader.css';

interface FileUploaderTemplateProps {
    // State props
    isInitialized: boolean;
    isProcessing: boolean;
    downloadProgress: any;
    currentMetadata: any;
    showPasswordDialog: boolean;
    password: string;
    passwordError: string;
    initializationMode: string;
    downloadMethod: string;
    pendingChunks: any[];
    darkMode: boolean;

    // Event handlers
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFileReconstruction: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onPasswordChange: (value: string) => void;
    onPasswordSubmit: () => void;
    onDownloadMethodChange: (value: string) => void;
    onDownloadSingleFile: (chunk: any, index: number) => void;
    onDownloadAllRemaining: () => void;
    onThemeToggle: () => void;

    // Notification props
    notification: {
        open: boolean;
        message: string;
        severity: 'success' | 'info' | 'warning' | 'error';
    };
    onCloseNotification: () => void;
}

export const FileUploaderTemplate: React.FC<FileUploaderTemplateProps> = ({
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
    darkMode,
    onFileUpload,
    onFileReconstruction,
    onPasswordChange,
    onPasswordSubmit,
    onDownloadMethodChange,
    onDownloadSingleFile,
    onDownloadAllRemaining,
    onThemeToggle,
    notification,
    onCloseNotification
}) => {
    return (
        <div className={`file-uploader-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
            <Box className="theme-toggle-box">
                <LightMode sx={{ color: darkMode ? 'text.secondary' : 'warning.main' }} />
                <Switch
                    checked={darkMode}
                    onChange={onThemeToggle}
                    color="default"
                />
                <DarkMode sx={{ color: darkMode ? 'primary.main' : 'text.secondary' }} />
            </Box>

            <Card>
                <CardContent>
                    <div className="card-content-padding">
                        <h1 className="main-header">
                            <Security /> Enhanced Secure File Splitter
                        </h1>

                        {!isInitialized ? (
                            <Alert severity="warning" className="alert-spacing">
                                System not initialized. Please set up your encryption key first.
                            </Alert>
                        ) : (
                            <Alert severity="success" className="alert-spacing alert-with-icon">
                                Secure encryption system is active and ready.
                            </Alert>
                        )}

                        <div className="section-spacing">
                            <h2 className="section-header">
                                <CloudUpload /> Encrypt & Split File
                            </h2>

                            {/* Download Method Selection */}
                            <FormControl
                                component="fieldset"
                                className={`download-method-control ${darkMode ? 'dark-mode' : 'light-mode'}`}
                            >
                                <FormLabel component="legend" className="download-method-label">
                                    Download Method:
                                </FormLabel>
                                <RadioGroup
                                    row
                                    value={downloadMethod}
                                    onChange={(e) => onDownloadMethodChange(e.target.value)}
                                >
                                    <FormControlLabel
                                        value="auto"
                                        control={<Radio />}
                                        label="Auto (Batched)"
                                        className="radio-button-spacing"
                                    />
                                    <FormControlLabel
                                        value="manual"
                                        control={<Radio />}
                                        label="Manual (Click each)"
                                        className="radio-button-spacing"
                                    />
                                    <FormControlLabel
                                        value="zip"
                                        control={<Radio />}
                                        label="Archive (JSON)"
                                    />
                                </RadioGroup>
                            </FormControl>

                            <input
                                type="file"
                                onChange={onFileUpload}
                                disabled={!isInitialized || isProcessing}
                                className={`file-input ${darkMode ? 'dark-mode' : 'light-mode'}`}
                            />

                            {/* Progress Display */}
                            {downloadProgress && (
                                <div className={`progress-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
                                    <h4 className="progress-header">
                                        <Assessment /> Progress: {downloadProgress.status.toUpperCase()}
                                    </h4>
                                    <LinearProgress
                                        variant="determinate"
                                        value={(downloadProgress.current / downloadProgress.total) * 100}
                                        className="progress-bar-spacing"
                                    />
                                    <p>{downloadProgress.current}/{downloadProgress.total} - {downloadProgress.currentFile}</p>
                                </div>
                            )}

                            {/* Manual Download Controls */}
                            {downloadMethod === 'manual' && pendingChunks.length > 0 && (
                                <div className={`manual-download-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
                                    <h4 className="section-header">
                                        <Archive /> Ready for Download ({pendingChunks.length} files)
                                    </h4>
                                    <Button
                                        variant="contained"
                                        onClick={onDownloadAllRemaining}
                                        disabled={isProcessing}
                                        className="download-button-spacing"
                                        startIcon={<GetApp />}
                                    >
                                        Download All
                                        ({pendingChunks.filter((_, i) => !(pendingChunks[i] as any).downloaded).length} remaining)
                                    </Button>

                                    <div className="chunk-list">
                                        {pendingChunks.map((chunk, index) => (
                                            <div
                                                key={index}
                                                className={`chunk-item ${darkMode ? 'dark-mode' : 'light-mode'}`}
                                            >
                                                <span className={`chunk-filename ${(chunk as any).downloaded ? 'downloaded' : ''} ${darkMode ? 'dark-mode' : 'light-mode'}`}>
                                                    {(chunk as any).downloaded ? <CheckCircle fontSize="small" /> :
                                                        <Description fontSize="small" />} {chunk.filename}
                                                </span>
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => onDownloadSingleFile(chunk, index)}
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

                        <div className="section-spacing">
                            <h2 className="section-header">
                                <CloudDownload /> Reconstruct File
                            </h2>
                            <p className={`reconstruct-instructions ${darkMode ? 'dark-mode' : 'light-mode'}`}>
                                Select ALL chunk files (.enc) AND metadata.json, OR select the archive (.json) file.
                            </p>
                            <input
                                type="file"
                                onChange={onFileReconstruction}
                                multiple
                                disabled={!isInitialized || isProcessing}
                                accept=".enc,.json"
                                className={`file-input ${darkMode ? 'dark-mode' : 'light-mode'}`}
                            />
                        </div>

                        {isProcessing && (
                            <Alert severity="info" className="alert-spacing alert-with-icon">
                                <div className="processing-content">
                                    <Loop className="rotating" /> Processing... Please wait and don't close the
                                    browser.
                                </div>
                            </Alert>
                        )}

                        {currentMetadata && (
                            <div className={`metadata-container ${darkMode ? 'dark-mode' : 'light-mode'}`}>
                                <h3 className="section-header">
                                    <Description /> Last Processed File Info:
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
            <Dialog open={showPasswordDialog} onClose={() => { }} maxWidth="sm" fullWidth>
                <DialogTitle className="section-header">
                    {initializationMode === 'setup' ? (
                        <><Lock /> Set Up Encryption</>
                    ) : (
                        <><LockOpen /> Unlock System</>
                    )}
                </DialogTitle>
                <DialogContent>
                    <div className="dialog-content-padding">
                        {initializationMode === 'setup' ? (
                            <>
                                <Alert severity="info" className="password-instructions">
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
                            <Alert severity="warning" className="password-instructions">
                                Enter your password to unlock the encryption system.
                            </Alert>
                        )}

                        <TextField
                            type="password"
                            label="Password"
                            value={password}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && onPasswordSubmit()}
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
                        onClick={onPasswordSubmit}
                        variant="contained"
                        disabled={isProcessing || !password.trim()}
                        startIcon={isProcessing ? <Loop className="rotating" /> : (initializationMode === 'setup' ?
                            <Lock /> : <LockOpen />)}
                    >
                        {isProcessing ? 'Processing...' : (initializationMode === 'setup' ? 'Set Up' : 'Unlock')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={notification?.open}
                autoHideDuration={6000}
                onClose={onCloseNotification}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <MuiAlert
                    onClose={onCloseNotification}
                    severity={notification?.severity || 'info'}
                    sx={{ width: '100%' }}
                    variant="filled"
                >
                    {notification?.message}
                </MuiAlert>
            </Snackbar>
        </div>
    );
};