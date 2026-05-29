// storage.js
import { debounce } from './utils.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Obtiene datos de storage.sync
 */
export async function getSyncSettings() {
    return await api.storage.sync.get(DEFAULT_SETTINGS);
}

/**
 * Guarda un dato en storage.sync (directo)
 */
export async function saveSync(key, value) {
    await api.storage.sync.set({ [key]: value });
}

/**
 * Guarda un dato en storage.local (directo)
 */
export async function saveLocal(key, value) {
    await api.storage.local.set({ [key]: value });
}

// Wrapper debounced para proteger la cuota de escritura de storage.sync
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
        await api.storage.sync.set(dataToSave);
    } catch (e) {
        console.error("Error saving to sync storage (quota exceeded?):", e);
    }
}, 500); // 500ms debounce

/**
 * Guarda un dato en storage.sync usando debounce para evitar quota exceeded.
 */
export function saveSyncDebounced(key, value) {
    pendingSyncSaves[key] = value;
    executeSyncSave();
}

/**
 * Guarda una entrada en el historial local de descargas, manteniendo el límite (50).
 */
export async function saveToDownloadHistory(filename, folderName, downloadId, fileUrl) {
    try {
        const result = await api.storage.local.get({ [STORAGE_KEYS.DOWNLOAD_HISTORY]: [] });
        const history = result[STORAGE_KEYS.DOWNLOAD_HISTORY];
        if (history.length >= 50) { history.shift(); }
        const newEntry = { filename, folder: folderName, date: new Date().toISOString(), id: downloadId, url: fileUrl };
        history.push(newEntry);
        await api.storage.local.set({ [STORAGE_KEYS.DOWNLOAD_HISTORY]: history });
    } catch (e) {
        console.error("Error guardando historial:", e);
    }
}
