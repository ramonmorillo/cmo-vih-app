import { CASE_LIBRARY_KEY } from './config.js';

const DB_NAME = 'cmo-vih-pro-v2';
const STORE_NAME = 'saved-cases';
const DB_VERSION = 1;

let storageMode = 'indexeddb';
let dbPromise = null;

function supportsIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB;
}

function readFallbackCases() {
  try {
    return JSON.parse(localStorage.getItem(CASE_LIBRARY_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeFallbackCases(records) {
  localStorage.setItem(CASE_LIBRARY_KEY, JSON.stringify(records));
}

function openDatabase() {
  if (!supportsIndexedDb()) {
    storageMode = 'localstorage';
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'caseId' });
          store.createIndex('updatedAt', 'updatedAt');
          store.createIndex('pseudonymizedPatientLabel', 'pseudonymizedPatientLabel');
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    }).catch((error) => {
      console.warn('IndexedDB unavailable, falling back to localStorage.', error);
      storageMode = 'localstorage';
      return null;
    });
  }

  return dbPromise;
}

function runTransaction(mode, executor) {
  return openDatabase().then((db) => {
    if (!db) {
      return executor(null);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = executor(store);

      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error || request?.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || request?.error || new Error('IndexedDB transaction aborted'));
    }).catch((error) => {
      console.warn('IndexedDB transaction failed, using localStorage fallback.', error);
      storageMode = 'localstorage';
      return executor(null);
    });
  });
}

export async function initializeCaseStorage() {
  await openDatabase();
  return storageMode;
}

export function getCaseStorageMode() {
  return storageMode;
}

export async function listSavedCases() {
  return runTransaction('readonly', (store) => {
    if (!store) {
      return readFallbackCases();
    }
    return store.getAll();
  }).then((records) => Array.isArray(records) ? records : readFallbackCases());
}

export async function getSavedCase(caseId) {
  return runTransaction('readonly', (store) => {
    if (!store) {
      return readFallbackCases().find((record) => record.caseId === caseId) || null;
    }
    return store.get(caseId);
  }).then((record) => record || null);
}

export async function upsertSavedCase(record) {
  return runTransaction('readwrite', (store) => {
    if (!store) {
      const existing = readFallbackCases();
      const next = [record, ...existing.filter((item) => item.caseId !== record.caseId)];
      writeFallbackCases(next);
      return record;
    }
    return store.put(record);
  }).then(() => record);
}

export async function deleteSavedCase(caseId) {
  return runTransaction('readwrite', (store) => {
    if (!store) {
      const next = readFallbackCases().filter((record) => record.caseId !== caseId);
      writeFallbackCases(next);
      return true;
    }
    return store.delete(caseId);
  }).then(() => true);
}
