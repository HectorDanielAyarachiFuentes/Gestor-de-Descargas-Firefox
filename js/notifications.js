// notifications.js
import { STORAGE_KEYS } from './constants.js';

/**
 * Muestra una notificación de éxito general.
 */
export function showNotification(sanitizedFilename, folderName) {
    chrome.storage.sync.get({ [STORAGE_KEYS.NOTIFICATIONS]: 'always' }, (data) => {
        if (data[STORAGE_KEYS.NOTIFICATIONS] !== 'always') return;

        chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("assets/icon.svg"),
            title: chrome.i18n.getMessage("notificationSuccessTitle"),
            message: chrome.i18n.getMessage("notificationSuccessMessage", [sanitizedFilename, folderName]),
            priority: 1
        });
    });
}

/**
 * Muestra una notificación de error.
 */
export function showErrorNotification(title, message) {
    chrome.storage.sync.get({ [STORAGE_KEYS.NOTIFICATIONS]: 'always' }, (data) => {
        if (data[STORAGE_KEYS.NOTIFICATIONS] === 'never') return;

        chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("assets/icon.svg"),
            title: title,
            message: message,
            priority: 2
        });
    });
}
