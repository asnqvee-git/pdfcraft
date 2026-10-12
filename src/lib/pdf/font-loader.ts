/**
 * PDFCraft Font Loader Utility
 * Provides Unicode font loading and embedding for Thai, CJK, and other international scripts.
 */

import type { PDFDocument, PDFFont } from 'pdf-lib';

export const THAI_REGEX = /[\u0E00-\u0E7F]/;
export const CJK_REGEX = /[\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

export function containsThai(text: string): boolean {
  return THAI_REGEX.test(text);
}

export function containsCJK(text: string): boolean {
  return CJK_REGEX.test(text);
}

export function containsNonAscii(text: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(text);
}

export type ScriptType = 'thai' | 'cjk' | 'latin';

export function detectScript(text: string): ScriptType {
  if (containsThai(text)) return 'thai';
  if (containsCJK(text)) return 'cjk';
  return 'latin';
}

const FONT_CONFIGS: Record<ScriptType, { id: string; url: string; fallbackUrl?: string }> = {
  thai: {
    id: 'sarabun',
    url: '/fonts/Sarabun-Regular.ttf',
    fallbackUrl: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf',
  },
  cjk: {
    id: 'noto-sans-sc',
    url: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf',
  },
  latin: {
    id: 'standard',
    url: '',
  },
};

const fontMemoryCache = new Map<string, ArrayBuffer>();
const DB_NAME = 'pdfcraft-fonts';
const DB_VERSION = 1;
const STORE_NAME = 'fonts';

async function openFontDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => resolve(null);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

async function getCachedFontFromDB(fontId: string): Promise<ArrayBuffer | null> {
  try {
    const db = await openFontDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(fontId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveFontToDB(fontId: string, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openFontDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, fontId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Ignore IndexedDB caching errors
  }
}

export async function loadFontBuffer(script: ScriptType): Promise<ArrayBuffer | null> {
  if (script === 'latin') return null;
  const config = FONT_CONFIGS[script];
  if (!config) return null;

  // 1. Check memory cache
  if (fontMemoryCache.has(config.id)) {
    return fontMemoryCache.get(config.id)!;
  }

  // 2. Check IndexedDB cache
  const dbCached = await getCachedFontFromDB(config.id);
  if (dbCached) {
    fontMemoryCache.set(config.id, dbCached);
    return dbCached;
  }

  // 3. Node.js environment: load from local filesystem if available
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const localPath = path.resolve(process.cwd(), 'public', config.url.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        const fileBuf = fs.readFileSync(localPath);
        const buffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
        fontMemoryCache.set(config.id, buffer);
        return buffer;
      }
    } catch {
      // Continue to fetch
    }
  }

  // 4. Fetch via URL
  try {
    let res = await fetch(config.url);
    if (!res.ok && config.fallbackUrl) {
      res = await fetch(config.fallbackUrl);
    }
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      fontMemoryCache.set(config.id, buffer);
      await saveFontToDB(config.id, buffer);
      return buffer;
    }
  } catch {
    if (config.fallbackUrl) {
      try {
        const fallbackRes = await fetch(config.fallbackUrl);
        if (fallbackRes.ok) {
          const buffer = await fallbackRes.arrayBuffer();
          fontMemoryCache.set(config.id, buffer);
          await saveFontToDB(config.id, buffer);
          return buffer;
        }
      } catch {
        // Fallback failed
      }
    }
  }

  return null;
}

export async function getFontForText(
  pdfDoc: PDFDocument,
  text: string,
  defaultFont: PDFFont
): Promise<PDFFont> {
  const script = detectScript(text);
  if (script === 'latin') {
    return defaultFont;
  }

  const fontBuffer = await loadFontBuffer(script);
  if (!fontBuffer) {
    return defaultFont;
  }

  try {
    const fontkit = await import('@pdf-lib/fontkit');
    pdfDoc.registerFontkit(fontkit.default || fontkit);
    const fontBytes = fontBuffer instanceof Uint8Array ? fontBuffer : new Uint8Array(fontBuffer);
    return await pdfDoc.embedFont(fontBytes, { subset: false });
  } catch {
    return defaultFont;
  }
}
