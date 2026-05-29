// storage.js
import { debounce } from './utils.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

/**
 * Obtiene datos de chrome.storage.sync
 */
export async function getSyncSettings() {
    return await chrome.storage.sync.get(DEFAULT_SETTINGS);
}

/**
 * Guarda un dato en chrome.storage.sync (directo)
 */
export async function saveSync(key, value) {
    await chrome.storage.sync.set({ [key]: value });
}

/**
 * Guarda un dato en chrome.storage.local (directo)
 */
export async function saveLocal(key, value) {
    await chrome.storage.local.set({ [key]: value });
}

// Wrapper debounced para proteger la cuota de escritura de chrome.storage.sync
// Usaremos un diccionario interno para almacenar las operaciones pendientes
const pendingSyncSaves = {};

const executeSyncSave = debounce(async () => {
    const keysToSave = Object.keys(pendingSyncSaves);
    if (keysToSave.length === 0) return;

    const dataToSave = {};
    keysToSave.forEach(k => {
        dataToSave[k] = pendingSyncSaves[k];
        delete pendingSyncSaves[k];
    });

    try {
        await chrome.storage.sync.set(dataToSave);
    } catch (e) {
        console.error("Error saving to sync storage (quota exceeded?):", e);
    }
}, 500); // 500ms debounce

/**
 * Guarda un dato en chrome.storage.sync usando debounce para evitar quota exceeded.
 */
export function saveSyncDebounced(key, value) {
    pendingSyncSaves[key] = value;
    executeSyncSave();
}

/**
 * Guarda una entrada en el historial local de descargas, manteniendo el límite (50).
 */
export function saveToDownloadHistory(filename, folderName, downloadId, fileUrl) {
    chrome.storage.local.get({ [STORAGE_KEYS.DOWNLOAD_HISTORY]: [] }, (result) => {
        const history = result[STORAGE_KEYS.DOWNLOAD_HISTORY];
        if (history.length >= 50) { history.shift(); }
        const newEntry = { filename, folder: folderName, date: new Date().toISOString(), id: downloadId, url: fileUrl };
        history.push(newEntry);
        chrome.storage.local.set({ [STORAGE_KEYS.DOWNLOAD_HISTORY]: history });
    });
}
