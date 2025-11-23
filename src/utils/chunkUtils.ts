// src/utils/chunkUtils.ts

import { CHUNK_SIZE } from "../config";

export async function generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export function generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
}

export async function encryptChunk(chunk: Uint8Array, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, chunk as BufferSource);
}

export async function decryptChunk(data: ArrayBuffer, key: CryptoKey, iv: Uint8Array): Promise<ArrayBuffer> {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data);
}

export const splitFile = (file: File): Blob[] => {
    const chunks: Blob[] = [];
    let offset = 0;
    while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK_SIZE);
        chunks.push(chunk);
        offset += CHUNK_SIZE;
    }
    return chunks;
};

export function reassembleChunks(chunks: Uint8Array[]): ArrayBuffer {
    const totalSize = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    return merged.buffer;
}

export function splitIntoChunks(buffer: ArrayBuffer): Uint8Array[] {
    const uint8 = new Uint8Array(buffer);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < uint8.length; i += CHUNK_SIZE) {
        chunks.push(uint8.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
}

export function combineChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
    }
    return combined;
}

