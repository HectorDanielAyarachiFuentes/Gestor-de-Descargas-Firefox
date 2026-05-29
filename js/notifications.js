// notifications.js
import { STORAGE_KEYS } from './constants.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Muestra una notificación de éxito general.
 */
export async function showNotification(sanitizedFilename, folderName, downloadId) {
    try {
        const data = await api.storage.sync.get({ [STORAGE_KEYS.NOTIFICATIONS]: 'always' });
        if (data[STORAGE_KEYS.NOTIFICATIONS] !== 'always') return;

        const notifOptions = {
            type: "basic",
            iconUrl: api.runtime.getURL("assets/icon.svg"),
            title: api.i18n.getMessage("notificationSuccessTitle"),
            message: api.i18n.getMessage("notificationSuccessMessage", [sanitizedFilename, folderName]),
            priority: 1
        };

        // Add undo button if supported (Chrome/Edge)
        const isFirefox = navigator.userAgent.toLowerCase().includes('firefox') || typeof browser !== 'undefined';
        if (!isFirefox && api.notifications.onButtonClicked) {
            notifOptions.buttons = [{ title: api.i18n.getMessage("undoButton") || "Deshacer Organización" }];
        }

        const notifId = downloadId ? downloadId.toString() : "";
        api.notifications.create(notifId, notifOptions);
    } catch (e) {
        console.error("Error mostrando notificación de éxito:", e);
    }
}

/**
 * Muestra una notificación de error.
 */
export async function showErrorNotification(title, message) {
    try {
        const data = await api.storage.sync.get({ [STORAGE_KEYS.NOTIFICATIONS]: 'always' });
        if (data[STORAGE_KEYS.NOTIFICATIONS] === 'never') return;

        api.notifications.create({
            type: "basic",
            iconUrl: api.runtime.getURL("assets/icon.svg"),
            title: title,
            message: message,
            priority: 2
        });
    } catch (e) {
        console.error("Error mostrando notificación de error:", e);
    }
}
