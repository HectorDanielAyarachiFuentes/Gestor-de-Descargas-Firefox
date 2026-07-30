console.log("🚀 Gestor de Descargas: Background script inicializado!");

import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';
import { sanitize } from './utils.js';
import { getFolderNameByExtension, applyRenamePattern } from './rules-engine.js';
import { showNotification, showErrorNotification } from './notifications.js';
import { saveToDownloadHistory } from './storage.js';

const api = typeof browser !== 'undefined' ? browser : chrome;
const IS_FIREFOX = navigator.userAgent.toLowerCase().includes('firefox') || typeof browser !== 'undefined';

let lastClickedTabUrl = '';
const restartedDownloadIds = new Set();
const restartedUrls = new Map();
const pendingFilenameCheckIds = new Set();

// ========================================================
// Listeners para URL de pestaña activa
// ========================================================
api.tabs.onActivated.addListener(async activeInfo => {
    try {
        const tab = await api.tabs.get(activeInfo.tabId);
        if (tab && tab.url) {
            lastClickedTabUrl = tab.url;
        }
    } catch (e) { /* ignore */ }
});
api.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        lastClickedTabUrl = changeInfo.url;
    }
});

// ======================================================================
// Interceptar URL de origen
// ======================================================================
async function getOriginUrl(downloadItem) {
    if (downloadItem.referrer) {
        return downloadItem.referrer;
    }
    
    if (lastClickedTabUrl) {
        return lastClickedTabUrl;
    }

    try {
        const tabs = await api.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs.length > 0 && tabs[0].url) {
            return tabs[0].url;
        }
    } catch (e) {
        console.error("Error getting origin url:", e);
    }
    
    return downloadItem.url || "";
}

// ========================================================
// Actualización del Menú Contextual
// ========================================================
async function updateContextMenu() {
    try {
        const res = await api.storage.sync.get(["customRules", "customCategories"]);
        const customRules = res.customRules || [];
        const customCategories = res.customCategories || [];

        if (customRules.length === 0 && customCategories.length === 0) {
            if (api.contextMenus.removeAll) {
                api.contextMenus.removeAll(() => {});
            }
            return;
        }

        if (api.contextMenus.removeAll) {
            api.contextMenus.removeAll(() => {
                api.contextMenus.create({
                    id: "save-in-parent",
                    title: api.i18n.getMessage("contextMenuSaveIn") || "Guardar en subcarpeta",
                    contexts: ["link", "image", "video", "audio"]
                });

                const addedFolders = new Set();
                for (const rule of customRules) {
                    if (rule.folder && !addedFolders.has(rule.folder)) {
                        api.contextMenus.create({
                            id: rule.folder,
                            parentId: "save-in-parent",
                            title: rule.folder,
                            contexts: ["link", "image", "video", "audio"]
                        });
                        addedFolders.add(rule.folder);
                    }
                }

                for (const cat of customCategories) {
                    if (cat.folder && !addedFolders.has(cat.folder)) {
                        api.contextMenus.create({
                            id: cat.folder,
                            parentId: "save-in-parent",
                            title: cat.folder,
                            contexts: ["link", "image", "video", "audio"]
                        });
                        addedFolders.add(cat.folder);
                    }
                }
            });
        }
    } catch (e) {
        console.error("Error actualizando menú contextual:", e);
    }
}

api.runtime.onInstalled.addListener(() => {
    updateContextMenu();
});

api.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && (changes.customRules || changes.contextMenu)) {
        updateContextMenu();
    }
});

if (api.contextMenus) {
    api.contextMenus.onClicked.addListener(async (info) => {
        const destinationFolder = info.menuItemId;
        const downloadUrl = info.srcUrl || info.linkUrl;
        if (!downloadUrl || !destinationFolder || destinationFolder === "save-in-parent") return;

        try {
            const downloadId = await api.downloads.download({ url: downloadUrl, conflictAction: 'uniquify' });
            // Guardar en sesión de forma segura
            try {
                if (api.storage.session) {
                    const result = await api.storage.session.get({ determinedDestinations: {} });
                    const dests = result.determinedDestinations || {};
                    dests[downloadId] = { folder: destinationFolder, isManual: true };
                    await api.storage.session.set({ determinedDestinations: dests });
                }
            } catch (e) { console.log("Context menu session storage not ready"); }
        } catch (error) {
            console.error("Error al iniciar descarga desde menú contextual:", error.message);
            showErrorNotification(
                api.i18n.getMessage("notificationErrorTitle") || "Error",
                error.message
            );
        }
    });
}

// ======================================================================
// onCreated: Para capturar reglas de URL y referrer ANTES de la descarga
// ======================================================================
// ======================================================================
// Lógica compartida para calcular el destino
// ======================================================================
async function determineDestination(downloadItem, originUrl) {
    const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
    
    let tempFilename = downloadItem.filename;
    if (!tempFilename) {
        try {
            const urlObj = new URL(downloadItem.url);
            tempFilename = urlObj.pathname.split('/').pop() || "descarga";
        } catch(e) {
            tempFilename = "descarga";
        }
    }
    const baseFilename = tempFilename.split(/[/\\]/).pop() || "descarga";

    if (forceNextDownload) {
        if (forceNextDownload.undo) {
            await api.storage.local.remove("forceNextDownload");
            return null;
        }
        if (forceNextDownload.folder) {
            return {
                folderName: forceNextDownload.folder,
                finalFilename: sanitize(baseFilename),
                isForce: true,
                isManual: false
            };
        }
    }

    const { autoOrganize, customRules = [], customCategories = [], defaultCategories = {} } = await api.storage.sync.get({
        autoOrganize: true,
        customRules: [],
        customCategories: [],
        defaultCategories: {
            pdf: true, images: true, video: true, audio: true,
            compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true,
            design: true, code: true, books: true, threed: true, fonts: true,
            emails: true, diagrams: true, databases: true, certificates: true, templates: true, cad: true
        }
    });

    if (!autoOrganize) return null;

    let determinedDestinations = {};
    try {
        if (api.storage.session) {
            const result = await api.storage.session.get("determinedDestinations");
            determinedDestinations = result.determinedDestinations || {};
        }
    } catch (e) {}

    let destinationInfo = determinedDestinations[downloadItem.id];
    let folderName = null;
    let finalFilename = sanitize(baseFilename);

    if (!destinationInfo) {
        for (const rule of customRules) {
            const ruleValue = rule.useRegex ? (rule.value ?? '') : (rule.value ?? '').toLowerCase();
            if (!ruleValue) continue;
            let match = false;
            const targetFilename = rule.useRegex ? finalFilename : finalFilename.toLowerCase();
            const downloadUrl = downloadItem.url;
            const referrerUrl = downloadItem.referrer || "";
            const originUrlToUse = originUrl || "";
            
            if (rule.useRegex) {
                try {
                    const regex = new RegExp(ruleValue, 'i');
                    if (rule.type === 'keyword' && regex.test(targetFilename)) match = true;
                    else if (rule.type === 'url' && (regex.test(downloadUrl) || regex.test(referrerUrl) || regex.test(originUrlToUse))) match = true;
                } catch(e) { console.error("Regex inválida:", e); }
            } else {
                if (rule.type === 'keyword' && targetFilename.includes(ruleValue)) {
                    match = true;
                } else if (rule.type === 'url') {
                    const dUrlLower = downloadUrl.toLowerCase();
                    const rUrlLower = referrerUrl.toLowerCase();
                    const oUrlLower = originUrlToUse.toLowerCase();
                    if (dUrlLower.includes(ruleValue) || rUrlLower.includes(ruleValue) || oUrlLower.includes(ruleValue)) {
                        match = true;
                    }
                }
            }

            if (match) {
                if (downloadItem.fileSize && downloadItem.fileSize > 0) {
                    if (rule.minSize && downloadItem.fileSize < rule.minSize * 1024 * 1024) match = false;
                    if (rule.maxSize && downloadItem.fileSize > rule.maxSize * 1024 * 1024) match = false;
                }
            }

            if (match) {
                destinationInfo = { folder: rule.folder, isManual: false, rule: rule };
                break;
            }
        }

        if (!destinationInfo && customCategories.length > 0) {
            const ext = (baseFilename.split('.').pop() || "").toLowerCase();
            for (const cat of customCategories) {
                if (cat.extensions.includes(ext)) {
                    destinationInfo = { folder: cat.folder, isManual: false, rule: null };
                    break;
                }
            }
        }
    }

    if (destinationInfo) {
        folderName = destinationInfo.folder;
        if (destinationInfo.rule && destinationInfo.rule.renamePattern) {
            // Le pasamos el baseFilename temporalmente emulando lo que esperaba 
            const tempItem = { ...downloadItem, filename: baseFilename };
            const newName = applyRenamePattern(destinationInfo.rule.renamePattern, tempItem, originUrl);
            finalFilename = sanitize(newName);
        }
    } else {
        let ext = (baseFilename.split('.').pop() || "").toLowerCase();
        if ((!ext || ext === baseFilename.toLowerCase() || ext === 'php' || ext === 'aspx' || ext === 'jsp' || ext === 'cgi') && downloadItem.mime) {
            const mimeMap = {
                'application/pdf': 'pdf',
                'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
                'video/mp4': 'mp4', 'video/webm': 'webm', 'video/x-matroska': 'mkv',
                'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg',
                'application/zip': 'zip', 'application/x-rar-compressed': 'rar', 'application/x-7z-compressed': '7z'
            };
            const mappedExt = mimeMap[downloadItem.mime.toLowerCase()];
            if (mappedExt) {
                ext = mappedExt;
                if (!baseFilename.toLowerCase().endsWith('.' + ext)) {
                    baseFilename += '.' + ext;
                    finalFilename += '.' + ext;
                }
            }
        }
        folderName = getFolderNameByExtension(ext, defaultCategories);
        if (!folderName) return null;
    }

    return {
        folderName: folderName,
        finalFilename: finalFilename,
        isForce: false,
        isManual: destinationInfo ? destinationInfo.isManual : false,
        rule: destinationInfo ? destinationInfo.rule : null,
        originalDestinationInfo: destinationInfo
    };
}

async function processDownloadSuccess(downloadItem, result, originUrl) {
    if (result.isForce) {
        await api.storage.local.remove("forceNextDownload");
        api.action.setBadgeText({ text: '' });
    } else if (result.originalDestinationInfo) {
        try {
            if (api.storage.session) {
                const sessionData = await api.storage.session.get("determinedDestinations");
                const dests = sessionData.determinedDestinations || {};
                if (dests[downloadItem.id]) {
                    delete dests[downloadItem.id];
                    await api.storage.session.set({ determinedDestinations: dests });
                }
            }
        } catch(e) {}
    }

    saveToDownloadHistory(result.finalFilename, result.folderName, downloadItem.id, downloadItem.finalUrl || downloadItem.url);

    if (!result.isManual) {
        showNotification(result.finalFilename, result.folderName, downloadItem.id);
        api.action.setBadgeText({ text: '✓' });
        api.action.setBadgeBackgroundColor({ color: '#4688F1' });
        setTimeout(() => api.action.setBadgeText({ text: '' }), 3000);
    }

    if (api.notifications.onButtonClicked && !api.notifications.onButtonClicked.hasListener(handleNotificationButtonClick)) {
        api.notifications.onButtonClicked.addListener(handleNotificationButtonClick);
    }

    if (!result.isManual && !result.rule) {
        try {
            if (originUrl) {
                const domain = new URL(originUrl).hostname.replace(/^www\./, '');
                const ext = (result.finalFilename.split('.').pop() || "").toLowerCase();
                if (domain && ext) {
                    const { suggestionTracker = {}, ignoredSuggestions = [] } = await api.storage.sync.get(["suggestionTracker", "ignoredSuggestions"]);
                    const trackKey = `${domain}|${ext}|${result.folderName || 'root'}`;
                    if (!ignoredSuggestions.includes(trackKey)) {
                        suggestionTracker[trackKey] = (suggestionTracker[trackKey] || 0) + 1;
                        if (suggestionTracker[trackKey] >= 3) {
                            const notifOptions = {
                                type: 'basic',
                                iconUrl: api.runtime.getURL("assets/icon.svg"),
                                title: api.i18n.getMessage("notificationSuggestionTitle") || "Nueva Sugerencia",
                                message: (api.i18n.getMessage("notificationSuggestionMessage") || "").replace('$1', ext).replace('$2', domain).replace('$3', result.folderName || 'Descargas'),
                                priority: 1
                            };
                            if (!IS_FIREFOX) {
                                notifOptions.buttons = [
                                    { title: api.i18n.getMessage("notificationButtonYes") || "Sí" },
                                    { title: api.i18n.getMessage("notificationButtonNo") || "No" }
                                ];
                            }
                            api.notifications.create(`sug|${trackKey}`, notifOptions);
                            delete suggestionTracker[trackKey];
                        }
                        await api.storage.sync.set({ suggestionTracker });
                    }
                }
            }
        } catch (e) { console.error("Tracker error", e); }
    }
}

async function tryOrganizeFirefoxDownload(downloadItem) {
    if (!IS_FIREFOX) return false;

    if (!downloadItem || !downloadItem.url) {
        return false;
    }

    if (restartedDownloadIds.has(downloadItem.id) || restartedUrls.has(downloadItem.url)) {
        restartedDownloadIds.add(downloadItem.id);
        return false;
    }
    if (downloadItem.byExtensionId === api.runtime.id) {
        return false;
    }

    try {
        const originUrl = await getOriginUrl(downloadItem);
        const dest = await determineDestination(downloadItem, originUrl);

        if (!dest) {
            return false;
        }

        const safeFolder = dest.folderName.replace(/[<>:"|?*\\]+/g, '_');
        const safeName = sanitize(dest.finalFilename);
        const finalPath = `${safeFolder}/${safeName}`;

        const downloadOptions = {
            url: downloadItem.url,
            filename: finalPath,
            conflictAction: 'uniquify',
            saveAs: false
        };

        if (downloadItem.referrer && (downloadItem.referrer.startsWith('http://') || downloadItem.referrer.startsWith('https://'))) {
            downloadOptions.headers = [{ name: 'Referer', value: downloadItem.referrer }];
        }
        if (downloadItem.cookieStoreId) {
            downloadOptions.cookieStoreId = downloadItem.cookieStoreId;
        }

        restartedUrls.set(downloadItem.url, Date.now());
        setTimeout(() => restartedUrls.delete(downloadItem.url), 15000);

        let newId;
        try {
            newId = await api.downloads.download(downloadOptions);
        } catch (downloadErr) {
            console.warn("Retrying download without headers/cookieStoreId:", downloadErr);
            delete downloadOptions.headers;
            delete downloadOptions.cookieStoreId;
            newId = await api.downloads.download(downloadOptions);
        }

        restartedDownloadIds.add(newId);
        setTimeout(() => restartedDownloadIds.delete(newId), 30000);

        try {
            await api.downloads.cancel(downloadItem.id);
            await api.downloads.erase({ id: downloadItem.id });
        } catch (e) {}

        const updatedItem = { ...downloadItem, id: newId, filename: finalPath };
        processDownloadSuccess(updatedItem, dest, originUrl);
        return true;
    } catch (err) {
        console.error("Error al re-lanzar descarga en Firefox:", err);
        return false;
    }
}

api.downloads.onCreated.addListener(async (downloadItem) => {
    console.log("🚀 [Gestor de Descargas] EVENTO onCreated DISPARADO!", downloadItem);

    let isManualBypass = false;
    try {
        const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
        if (forceNextDownload && forceNextDownload.organizeUrls && forceNextDownload.organizeUrls.includes(downloadItem.url)) {
            isManualBypass = true;
            const newUrls = forceNextDownload.organizeUrls.filter(u => u !== downloadItem.url);
            if (newUrls.length > 0) {
                await api.storage.local.set({ forceNextDownload: { ...forceNextDownload, organizeUrls: newUrls } });
            } else {
                await api.storage.local.remove("forceNextDownload");
            }
        }
    } catch(e) { console.log("Error checking manual bypass", e); }

    if (IS_FIREFOX && !isManualBypass) {
        if (restartedDownloadIds.has(downloadItem.id) || (downloadItem.url && restartedUrls.has(downloadItem.url))) {
            restartedDownloadIds.add(downloadItem.id);
            return;
        }
        if (downloadItem.byExtensionId === api.runtime.id) {
            return;
        }
    }

    let determinedDestinations = {};
    try {
        if (api.storage.session) {
            const result = await api.storage.session.get("determinedDestinations");
            determinedDestinations = result.determinedDestinations || {};
        }
    } catch (e) { console.log("Session storage error onCreated", e); }

    if (downloadItem.id in determinedDestinations) return;

    const { autoOrganize = true, customRules = [] } = await api.storage.sync.get({ autoOrganize: true, customRules: [] });
    if (!autoOrganize) return;

    if (IS_FIREFOX) {
        // --- LÓGICA DE FIREFOX ---
        const organized = await tryOrganizeFirefoxDownload(downloadItem);
        if (!organized) {
            pendingFilenameCheckIds.add(downloadItem.id);
            setTimeout(() => pendingFilenameCheckIds.delete(downloadItem.id), 60000);
        }
        return;
    }

    // --- LÓGICA DE CHROME ---
    for (const rule of customRules) {
        if (rule.type === 'url') {
            const ruleValue = (rule.value ?? '').toLowerCase();
            if (!ruleValue) continue;

            const downloadUrl = downloadItem.url.toLowerCase();
            const referrerUrl = (downloadItem.referrer || "").toLowerCase();
            const originUrlLower = originUrl.toLowerCase();

            if (downloadUrl.includes(ruleValue) || referrerUrl.includes(ruleValue) || originUrlLower.includes(ruleValue)) {
                try {
                    if (api.storage.session) {
                        const sessionData = await api.storage.session.get({ determinedDestinations: {} });
                        const dests = sessionData.determinedDestinations || {};
                        dests[downloadItem.id] = { folder: rule.folder, isManual: false, rule: rule };
                        await api.storage.session.set({ determinedDestinations: dests });
                    }
                } catch (e) { console.log("Session storage error assigning url rule", e); }
                return;
            }
        }
    }
});

// ======================================================================
// onChanged: FIREFOX FILENAME HEADER CHECK (GitHub, Moodle, Drive)
// ======================================================================
if (IS_FIREFOX && api.downloads.onChanged) {
    api.downloads.onChanged.addListener(async (delta) => {
        if (delta.filename && delta.filename.current && pendingFilenameCheckIds.has(delta.id)) {
            pendingFilenameCheckIds.delete(delta.id);
            try {
                const results = await api.downloads.search({ id: delta.id });
                if (results && results.length > 0) {
                    await tryOrganizeFirefoxDownload(results[0]);
                }
            } catch (e) {
                console.error("[Gestor] Error en onChanged filename check:", e);
            }
        }
    });
}

// ======================================================================
// onDeterminingFilename: LÓGICA PRINCIPAL DE ORGANIZACIÓN (Chrome/Edge)
// ======================================================================
if (!IS_FIREFOX && api.downloads.onDeterminingFilename) {
    api.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
        const processDownload = async () => {
            try {
                const originUrl = await getOriginUrl(downloadItem);
                const dest = await determineDestination(downloadItem, originUrl);

                if (!dest) return null;

                const safeFolder = dest.folderName.replace(/[<>:"|?*\\]+/g, '_');
                const safeName = sanitize(dest.finalFilename);
                const finalPath = `${safeFolder}/${safeName}`;

                await processDownloadSuccess(downloadItem, dest, originUrl);

                return { filename: finalPath, conflictAction: 'uniquify' };
            } catch (error) {
                console.error("Error fatal en onDeterminingFilename:", error);
                showErrorNotification("Error Organizador", error.message);
                return null;
            }
        };

        processDownload().then(result => {
            if (result) {
                suggest(result);
            } else {
                suggest();
            }
        }).catch(e => {
            console.error("Error en processDownload:", e);
            suggest();
        });
        return true;
    });
}

// Helper for Undo button in notifications
function handleNotificationButtonClick(notifId, btnIdx) {
    if (btnIdx === 0) { // Undo Organization
        const downloadId = Number(notifId);
        if (!isNaN(downloadId)) {
            api.downloads.search({ id: downloadId }, (results) => {
                if (results && results[0] && results[0].url) {
                    api.storage.local.set({ forceNextDownload: { undo: true } }, () => {
                        api.downloads.download({ url: results[0].url });
                    });
                }
            });
            api.notifications.clear(notifId);
        }
    }
}

api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.downloadHistory) {
        // Removed badge text update as per user request
    }
});

api.runtime.onInstalled.addListener(() => {
    if (api.action && api.action.setBadgeText) {
        api.action.setBadgeText({ text: '' });
    }
});

