import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';
import { sanitize } from './utils.js';
import { getFolderNameByExtension, applyRenamePattern } from './rules-engine.js';
import { showNotification, showErrorNotification } from './notifications.js';
import { saveToDownloadHistory } from './storage.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

let lastClickedTabUrl = '';

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
api.downloads.onCreated.addListener(async (downloadItem) => {
    let determinedDestinations = {};
    try {
        if (api.storage.session) {
            const result = await api.storage.session.get("determinedDestinations");
            determinedDestinations = result.determinedDestinations || {};
        }
    } catch (e) { console.log("Session storage error onCreated", e); }

    if (downloadItem.id in determinedDestinations) return;

    const { autoOrganize, customRules = [] } = await api.storage.sync.get(["autoOrganize", "customRules"]);
    if (!autoOrganize) return;

    const originUrl = await getOriginUrl(downloadItem);

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
// onDeterminingFilename: LÓGICA PRINCIPAL DE ORGANIZACIÓN (Cross-browser Async)
// ======================================================================
api.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    const processDownload = async () => {
        try {
            const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
            if (forceNextDownload && forceNextDownload.folder) {
                const finalFilename = sanitize(downloadItem.filename);
                // Carpeta puede tener subcarpetas (Proyectos/Web) — solo sanitizar chars peligrosos, no la /
                const safeFolder = forceNextDownload.folder.replace(/[<>:"|?*\\]+/g, '_');
                
                await api.storage.local.remove("forceNextDownload");
                api.action.setBadgeText({ text: '' });
                saveToDownloadHistory(finalFilename, forceNextDownload.folder, downloadItem.id, downloadItem.finalUrl || downloadItem.url);
                showNotification(finalFilename, forceNextDownload.folder);
                
                return { filename: `${safeFolder}/${finalFilename}`, conflictAction: 'uniquify' };
            }

            const { autoOrganize, customRules = [], customCategories = [], defaultCategories = {} } = await api.storage.sync.get({
                autoOrganize: true,
                customRules: [],
                customCategories: [],
                defaultCategories: {
                    pdf: true, images: true, video: true, audio: true,
                    compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true
                }
            });

            if (!autoOrganize) return null;

            let determinedDestinations = {};
            try {
                if (api.storage.session) {
                    const result = await api.storage.session.get("determinedDestinations");
                    determinedDestinations = result.determinedDestinations || {};
                }
            } catch(e) { console.log("Session storage error onDeterminingFilename", e); }

            let destinationInfo = determinedDestinations[downloadItem.id]; 
            let folderName = null;
            let finalFilename = sanitize(downloadItem.filename);
            let originUrl = '';

            if (!destinationInfo) {
                originUrl = await getOriginUrl(downloadItem);
                for (const rule of customRules) {
                    const ruleValue = (rule.value ?? '').toLowerCase();
                    if (!ruleValue) continue;
                    let match = false;
                    if (rule.type === 'keyword' && finalFilename.toLowerCase().includes(ruleValue)) {
                        match = true;
                    } else if (rule.type === 'url') {
                        const downloadUrl = downloadItem.url.toLowerCase();
                        const referrerUrl = (downloadItem.referrer || "").toLowerCase();
                        const originUrlLower = originUrl.toLowerCase();
                        if (downloadUrl.includes(ruleValue) || referrerUrl.includes(ruleValue) || originUrlLower.includes(ruleValue)) {
                            match = true;
                        }
                    }
                    if (match) {
                        destinationInfo = { folder: rule.folder, isManual: false, rule: rule };
                        break;
                    }
                }

                if (!destinationInfo && customCategories.length > 0) {
                    const ext = (downloadItem.filename.split('.').pop() || "").toLowerCase();
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
                    if (!originUrl) originUrl = await getOriginUrl(downloadItem);
                    const newName = applyRenamePattern(destinationInfo.rule.renamePattern, downloadItem, originUrl);
                    finalFilename = sanitize(newName);
                }
            } else {
                const ext = (downloadItem.filename.split('.').pop() || "").toLowerCase();
                folderName = getFolderNameByExtension(ext, defaultCategories);

                if (!folderName) return null;
            }

            // Solo sanitizar nombre de archivo; la carpeta puede tener subcarpetas (/) válidas
            const safeFolder = folderName.replace(/[<>:"|?*\\]+/g, '_');
            const safeName = sanitize(finalFilename);
            let finalPath = `${safeFolder}/${safeName}`;

            if (destinationInfo) {
                delete determinedDestinations[downloadItem.id];
                try {
                    if (api.storage.session) {
                        await api.storage.session.set({ determinedDestinations });
                    }
                } catch(e) {}
            }

            saveToDownloadHistory(finalFilename, folderName, downloadItem.id, downloadItem.finalUrl || downloadItem.url);

            if (!destinationInfo || !destinationInfo.isManual) {
                showNotification(finalFilename, folderName);
                api.action.setBadgeText({ text: '✓' });
                api.action.setBadgeBackgroundColor({ color: '#4688F1' });
                setTimeout(() => api.action.setBadgeText({ text: '' }), 3000);
            }

            // Fire-and-forget del rastreador
            if (!destinationInfo || (!destinationInfo.isManual && !destinationInfo.rule)) {
                (async () => {
                    try {
                        let trackerOriginUrl = originUrl || await getOriginUrl(downloadItem);
                        if (trackerOriginUrl) {
                            const domain = new URL(trackerOriginUrl).hostname.replace(/^www\./, '');
                            const ext = (downloadItem.filename.split('.').pop() || "").toLowerCase();
                            if (domain && ext) {
                                const { suggestionTracker = {}, ignoredSuggestions = [] } = await api.storage.sync.get(["suggestionTracker", "ignoredSuggestions"]);
                                const trackKey = `${domain}|${ext}|${folderName || 'root'}`;
                                if (!ignoredSuggestions.includes(trackKey)) {
                                    suggestionTracker[trackKey] = (suggestionTracker[trackKey] || 0) + 1;
                                    if (suggestionTracker[trackKey] >= 3) {
                                        // Firefox no soporta 'buttons' en notificaciones
                                        const notifOptions = {
                                            type: 'basic',
                                            iconUrl: api.runtime.getURL("assets/icon.svg"),
                                            title: api.i18n.getMessage("notificationSuggestionTitle") || "Nueva Sugerencia",
                                            message: (api.i18n.getMessage("notificationSuggestionMessage") || "").replace('$1', ext).replace('$2', domain).replace('$3', folderName || 'Descargas'),
                                            priority: 1
                                        };
                                        // Solo Chrome soporta buttons en notificaciones
                                        if (typeof browser === 'undefined') {
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
                })();
            }

            return { filename: finalPath, conflictAction: 'uniquify' };

        } catch (error) {
            console.error("Error fatal en onDeterminingFilename:", error);
            showErrorNotification("Error Organizador", error.message);
            return null;
        }
    };

    if (typeof browser !== 'undefined') {
        // En Firefox, debemos retornar el Promise directamente para que lo resuelva.
        return processDownload();
    } else {
        // En Chrome/Edge, usamos suggest() asíncronamente y retornamos true
        processDownload().then(result => {
            if (result) suggest(result);
            else suggest();
        }).catch(e => {
            suggest();
        });
        return true;
    }
});