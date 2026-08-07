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
// Interceptación Directa de Descargas desde Content Script (1 Solo Paso Rápido)
// ======================================================================
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === 'DIRECT_DOWNLOAD_INTERCEPT') {
        const handleDirectDownload = async () => {
            try {
                const originUrl = msg.originUrl || (sender.tab && sender.tab.url) || "";
                let filenameCandidate = msg.suggestedFilename || "";
                if (!filenameCandidate) {
                    try {
                        const urlObj = new URL(msg.url);
                        filenameCandidate = urlObj.pathname.split('/').pop() || "";
                    } catch (e) {}
                }

                const mockItem = {
                    url: msg.url,
                    filename: filenameCandidate
                };

                const dest = await determineDestination(mockItem, originUrl);
                if (!dest) {
                    return { handled: false };
                }

                const safeFolder = dest.folderName.replace(/\\/g, '/').replace(/[<>:"|?*]+/g, '_');
                const safeName = sanitize(dest.finalFilename);
                const finalPath = `${safeFolder}/${safeName}`;

                const downloadOptions = {
                    url: msg.url,
                    filename: finalPath,
                    conflictAction: 'uniquify',
                    saveAs: false
                };

                const newId = await api.downloads.download(downloadOptions);
                if (newId) {
                    restartedDownloadIds.add(newId);
                    const updatedItem = { id: newId, url: msg.url, filename: finalPath };
                    processDownloadSuccess(updatedItem, dest, originUrl);
                    return { handled: true, success: true };
                }
                return { handled: false };
            } catch (err) {
                console.error("[Gestor] Error en DIRECT_DOWNLOAD_INTERCEPT:", err);
                return { handled: false };
            }
        };

        handleDirectDownload().then(res => sendResponse(res)).catch(() => sendResponse({ handled: false }));
        return true; // Respuesta asíncrona
    }
});

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
        console.log("📋 [FORCE DEBUG] determineDestination - forceNextDownload found:", JSON.stringify(forceNextDownload));
        if (forceNextDownload.undo) {
            console.log("📋 [FORCE DEBUG] determineDestination - undo flag detected, REMOVING forceNextDownload");
            await api.storage.local.remove("forceNextDownload");
            return null;
        }
        if (forceNextDownload.folder) {
            console.log("📋 [FORCE DEBUG] determineDestination - returning force result, isPersistent:", !!forceNextDownload.persistent);
            return {
                folderName: forceNextDownload.folder,
                finalFilename: sanitize(baseFilename),
                isForce: true,
                isManual: false,
                isPersistent: !!forceNextDownload.persistent
            };
        }
    } else {
        console.log("📋 [FORCE DEBUG] determineDestination - NO forceNextDownload in storage");
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
    console.log("📋 [FORCE DEBUG] processDownloadSuccess - isForce:", result.isForce, "isPersistent:", result.isPersistent);
    if (result.isForce) {
        if (!result.isPersistent) {
            console.log("📋 [FORCE DEBUG] processDownloadSuccess - NOT persistent, REMOVING forceNextDownload");
            await api.storage.local.remove("forceNextDownload");
            api.action.setBadgeText({ text: '' });
        } else {
            console.log("📋 [FORCE DEBUG] processDownloadSuccess - IS persistent, KEEPING forceNextDownload");
        }
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
        setTimeout(async () => {
            const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
            if (forceNextDownload && forceNextDownload.folder) {
                const persistent = forceNextDownload.persistent || false;
                api.action.setBadgeText({ text: persistent ? '∞' : '1' });
                api.action.setBadgeBackgroundColor({ color: '#007bff' });
            } else {
                api.action.setBadgeText({ text: '' });
            }
        }, 3000);
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

// ======================================================================
// Lógica de Organización Automática para Firefox (100% Nativo en el Navegador)
// ======================================================================
if (IS_FIREFOX) {
    async function organizeFirefoxItem(item) {
        if (!item || !item.url) return;
        if (restartedDownloadIds.has(item.id) || item.byExtensionId === api.runtime.id) return;

        const originUrl = await getOriginUrl(item);
        const dest = await determineDestination(item, originUrl);
        if (!dest) return;

        const safeFolder = dest.folderName.replace(/\\/g, '/').replace(/[<>:"|?*]+/g, '_');
        const safeName = sanitize(dest.finalFilename);
        const finalPath = `${safeFolder}/${safeName}`;

        const normFilename = (item.filename || "").replace(/\\/g, '/');
        // Si ya se encuentra dentro de la subcarpeta destino, no hacer nada
        if (normFilename.includes(`/${safeFolder}/`) || normFilename.startsWith(`${safeFolder}/`)) {
            return;
        }

        restartedDownloadIds.add(item.id);

        const downloadOptions = {
            url: item.url,
            filename: finalPath,
            conflictAction: 'uniquify',
            saveAs: false
        };
        if (item.referrer) downloadOptions.headers = [{ name: 'Referer', value: item.referrer }];
        if (item.cookieStoreId) downloadOptions.cookieStoreId = item.cookieStoreId;

        let newId = null;
        try {
            newId = await api.downloads.download(downloadOptions);
        } catch(e) {
            delete downloadOptions.headers;
            delete downloadOptions.cookieStoreId;
            try {
                newId = await api.downloads.download(downloadOptions);
            } catch(e2) {
                console.warn("[Gestor] No se pudo relanzar:", e2);
            }
        }

        if (newId) {
            restartedDownloadIds.add(newId);
            setTimeout(() => restartedDownloadIds.delete(newId), 30000);

            // Cancelar y limpiar el archivo original de la raíz de Descargas
            try { await api.downloads.cancel(item.id); } catch(e) {}
            try { if (api.downloads.removeFile) await api.downloads.removeFile(item.id); } catch(e) {}
            try { await api.downloads.erase({ id: item.id }); } catch(e) {}

            processDownloadSuccess({ ...item, id: newId, filename: finalPath }, dest, originUrl);
        }
    }

    api.downloads.onCreated.addListener(async (downloadItem) => {
        console.log("🚀 [Gestor de Descargas] onCreated:", downloadItem);
        if (downloadItem.filename && downloadItem.filename.includes('.')) {
            await organizeFirefoxItem(downloadItem);
        }
    });

    if (api.downloads.onChanged) {
        api.downloads.onChanged.addListener(async (delta) => {
            if (delta.filename && delta.filename.current) {
                if (restartedDownloadIds.has(delta.id)) return;
                try {
                    const results = await api.downloads.search({ id: delta.id });
                    if (results && results.length > 0) {
                        await organizeFirefoxItem(results[0]);
                    }
                } catch(e) {}
            }
        });
    }
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
            api.downloads.search({ id: downloadId }, async (results) => {
                if (results && results[0] && results[0].url) {
                    // Preserve the existing force folder rule if persistent
                    const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
                    if (forceNextDownload && forceNextDownload.folder && forceNextDownload.persistent) {
                        // Add undo URL to organizeUrls so the re-download bypasses organization
                        const organizeUrls = (forceNextDownload.organizeUrls || []).concat(results[0].url);
                        await api.storage.local.set({ forceNextDownload: { ...forceNextDownload, organizeUrls } });
                    } else {
                        await api.storage.local.set({ forceNextDownload: { undo: true } });
                    }
                    api.downloads.download({ url: results[0].url });
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
    if (area === 'local' && changes.forceNextDownload) {
        console.log("📋 [FORCE DEBUG] storage.onChanged - forceNextDownload CHANGED!");
        console.log("📋 [FORCE DEBUG]   oldValue:", JSON.stringify(changes.forceNextDownload.oldValue));
        console.log("📋 [FORCE DEBUG]   newValue:", JSON.stringify(changes.forceNextDownload.newValue));
        if (!changes.forceNextDownload.newValue) {
            console.log("📋 [FORCE DEBUG]   ⚠️ forceNextDownload was DELETED!");
            console.trace("📋 [FORCE DEBUG] Stack trace for deletion:");
        }
    }
});

api.runtime.onInstalled.addListener(() => {
    if (api.action && api.action.setBadgeText) {
        api.action.setBadgeText({ text: '' });
    }
});

