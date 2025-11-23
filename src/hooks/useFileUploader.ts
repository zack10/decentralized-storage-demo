// hooks/useFileUploader.ts
import { useEffect, useState } from 'react';
import { SecureKeyManager } from '../utils/keyManager';
import { SecureCryptoUtils } from '../utils/cryptoUtils';

interface FileMetadata {
    originalFileName: string;
    originalExtension: string;
    originalSize: number;
    totalChunks: number;
    timestamp: number;
    hash: string;
    chunkSize: number;
}

interface DownloadProgress {
    current: number;
    total: number;
    status: 'encrypting' | 'downloading' | 'complete' | 'error';
    currentFile: string;
}

export const useFileUploader = (onNotification?: (message: string, severity: 'success' | 'info' | 'warning' | 'error') => void) => {
    const [isInitialized, setIsInitialized] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [currentMetadata, setCurrentMetadata] = useState<FileMetadata | null>(null);
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [initializationMode, setInitializationMode] = useState<'setup' | 'unlock'>('setup');
    const [downloadMethod, setDownloadMethod] = useState<'auto' | 'manual' | 'zip'>('auto');
    const [pendingChunks, setPendingChunks] = useState<{ blob: Blob; filename: string }[]>([]);

    const CONSTANTS = {
        CHUNK_SIZE: 1024 * 1024, // 1MB
        DOWNLOAD_DELAY: 500, // 500ms between downloads
        MAX_CONCURRENT_DOWNLOADS: 3
    };

    useEffect(() => {
        checkInitialSetup();
    }, []);

    const checkInitialSetup = async () => {
        try {
            const hasKey = await SecureKeyManager.hasMasterKey();
            if (hasKey) {
                setInitializationMode('unlock');
                setShowPasswordDialog(true);
            } else {
                setInitializationMode('setup');
                setShowPasswordDialog(true);
            }
        } catch (error) {
            console.error('Failed to check setup:', error);
        }
    };

    const handlePasswordSubmit = async () => {
        if (!password.trim()) {
            setPasswordError('Password is required');
            return;
        }

        setIsProcessing(true);
        setPasswordError('');

        try {
            await SecureCryptoUtils.initialize(password);
            setIsInitialized(true);
            setShowPasswordDialog(false);
            setPassword('');

            if (initializationMode === 'setup') {
                onNotification?.('Secure key management system initialized!', 'success');
            } else {
                onNotification?.('System unlocked successfully!', 'success');
            }
        } catch (error: any) {
            setPasswordError('Failed to initialize: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        // State
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

        // Constants
        CONSTANTS,

        // Setters
        setIsProcessing,
        setDownloadProgress,
        setCurrentMetadata,
        setShowPasswordDialog,
        setPassword,
        setPasswordError,
        setDownloadMethod,
        setPendingChunks,

        // Methods
        handlePasswordSubmit
    };
};