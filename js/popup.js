// popup.js

import { applyI18n, setHTML } from './utils.js';
import { initTheme } from './theme-manager.js';
import { getFolderNameByExtension } from './rules-engine.js';

const api = typeof browser !== 'undefined' ? browser : chrome;
let downloadQueue = [];

let currentViewMode = 'popup';

document.addEventListener("DOMContentLoaded", () => {
  applyI18n(); // <-- Llama a la función de traducción
  detectViewMode();

  // --- Elementos de la UI ---
  const openOptionsBtn = document.getElementById("openOptions");
  const openTabBtn = document.getElementById("openTab");
  const openSidebarBtn = document.getElementById("openSidebar");
  const autoOrganizeToggle = document.getElementById("autoOrganizeToggle");
  const forceFolderInput = document.getElementById("forceFolderInput");
  const clearForceInputBtn = document.getElementById("clearForceInputBtn");
  const forceNextDownloadBtn = document.getElementById("forceNextDownloadBtn");
  const cancelForceBtn = document.getElementById("cancelForceBtn");
  const downloadAllQueueBtn = document.getElementById("downloadAllQueueBtn");
  const clearQueueBtn = document.getElementById("clearQueueBtn");
  const historySearchInput = document.getElementById("historySearchInput");

  // --- Carga de estado y datos iniciales ---
  initTheme();
  loadAppSettings();
  loadHistory();
  loadFolderSuggestions();
  loadDownloadQueue();
  setupDragAndDrop();
  initDragTargetControls();
  initTabNavigation();

  // --- Preset Chips de carpetas rápidas ---
  const presetChips = document.querySelectorAll(".chip-preset");
  presetChips.forEach(chip => {
    chip.addEventListener("click", () => {
      if (forceFolderInput) {
        forceFolderInput.value = chip.dataset.folder || "";
        forceFolderInput.focus();
        if (clearForceInputBtn) clearForceInputBtn.style.display = "block";
      }
    });
  });

  if (forceFolderInput && clearForceInputBtn) {
    forceFolderInput.addEventListener("input", () => {
      clearForceInputBtn.style.display = forceFolderInput.value.length > 0 ? "block" : "none";
    });
    clearForceInputBtn.addEventListener("click", () => {
      forceFolderInput.value = "";
      clearForceInputBtn.style.display = "none";
      forceFolderInput.focus();
    });
  }

  // --- Botón de salto de pestaña (Ver todas) ---
  const tabTargetBtns = document.querySelectorAll("[data-tab-target]");
  tabTargetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tabTarget;
      if (targetTab && typeof switchTab === "function") {
        switchTab(targetTab);
        api.storage.local.set({ activeTab: targetTab });
      }
    });
  });

  // --- Buscador en el historial ---
  if (historySearchInput) {
    historySearchInput.addEventListener("input", (e) => {
      filterHistory(e.target.value.toLowerCase().trim());
    });
  }

  // --- Listeners de eventos ---
  const openFullOptionsBtn = document.getElementById("openFullOptionsBtn");
  if (openFullOptionsBtn) {
    openFullOptionsBtn.addEventListener("click", () => {
      api.runtime.openOptionsPage();
    });
  }

  if (openOptionsBtn) {
    openOptionsBtn.addEventListener("click", () => {
      api.runtime.openOptionsPage();
    });
  }

  if (openTabBtn) {
    openTabBtn.addEventListener("click", () => {
      api.tabs.create({ url: api.runtime.getURL("pages/popup.html") });
    });
  }

  if (openSidebarBtn) {
    openSidebarBtn.addEventListener("click", async () => {
      if (api.sidebarAction && typeof api.sidebarAction.open === "function") {
        try {
          await api.sidebarAction.open();
        } catch (e) {
          if (typeof api.sidebarAction.toggle === "function") {
            await api.sidebarAction.toggle();
          }
        }
      } else if (api.sidebarAction && typeof api.sidebarAction.toggle === "function") {
        await api.sidebarAction.toggle();
      } else {
        api.tabs.create({ url: api.runtime.getURL("pages/popup.html") });
      }
    });
  }

  if (autoOrganizeToggle) {
    autoOrganizeToggle.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      api.storage.sync.set({ autoOrganize: isChecked });
      updateAutoOrganizeUI(isChecked);
    });
  }

  if (forceNextDownloadBtn) forceNextDownloadBtn.addEventListener("click", activateForceMode);
  if (cancelForceBtn) cancelForceBtn.addEventListener("click", deactivateForceMode);

  if (downloadAllQueueBtn) {
    downloadAllQueueBtn.addEventListener("click", processAllQueue);
  }

  if (clearQueueBtn) {
    clearQueueBtn.addEventListener("click", clearQueue);
  }
});

function updateAutoOrganizeUI(isEnabled) {
  const toggle = document.getElementById("autoOrganizeToggle");
  const badge = document.getElementById("statusBadge");
  const statusText = document.getElementById("statusText");

  // Propagar el estado al body para que CSS también pueda reaccionar
  document.body.dataset.autoOrganize = isEnabled ? "on" : "off";

  if (toggle) toggle.checked = isEnabled;

  if (badge) {
    badge.className = isEnabled ? "status-badge active" : "status-badge inactive";
  }

  if (statusText) {
    if (isEnabled) {
      const msg = api.i18n.getMessage("autoOrganizeActive");
      statusText.textContent = (msg && msg.length > 0) ? msg : "Organización Activa";
    } else {
      const msg = api.i18n.getMessage("autoOrganizeDisabled");
      statusText.textContent = (msg && msg.length > 0) ? msg : "Organización Desactivada";
    }
  }
}

async function loadAppSettings() {
  const { autoOrganize = true } = await api.storage.sync.get("autoOrganize");
  updateAutoOrganizeUI(autoOrganize);

  const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
  if (forceNextDownload && forceNextDownload.folder) {
    showActiveForceView(forceNextDownload.folder);
  }
}

async function activateForceMode() {
  const folder = document.getElementById("forceFolderInput").value.trim();
  if (!folder) return;

  const forceRule = { folder: folder };
  await api.storage.local.set({ forceNextDownload: forceRule });
  api.action.setBadgeText({ text: '1' });
  api.action.setBadgeBackgroundColor({ color: '#007bff' });
  showActiveForceView(folder);
}

async function deactivateForceMode() {
  await api.storage.local.remove("forceNextDownload");
  api.action.setBadgeText({ text: '' });
  showIdleForceView();
}

function showActiveForceView(folder) {
  document.getElementById("force-idle-view").style.display = "none";
  const activeView = document.getElementById("force-active-view");
  // Usamos getMessage con un marcador de posición
  setHTML(activeView.querySelector(".force-active-text"), api.i18n.getMessage("popup_forceActiveText", folder));
  activeView.style.display = "block";
}

function showIdleForceView() {
  document.getElementById("force-active-view").style.display = "none";
  document.getElementById("force-idle-view").style.display = "block";
  document.getElementById("forceFolderInput").value = "";
}

async function loadFolderSuggestions() {
  const { customRules = [] } = await api.storage.sync.get("customRules");
  const uniqueFolders = [...new Set(customRules.map(rule => rule.folder))];

  const suggestionsDatalist = document.getElementById("folder-suggestions");
  if (!suggestionsDatalist) return;

  suggestionsDatalist.textContent = "";
  uniqueFolders.forEach(folder => {
    const option = document.createElement("option");
    option.value = folder;
    suggestionsDatalist.appendChild(option);
  });
}

function getFileTypeIcon(filename) {
  const ext = (filename.split('.').pop() || "").toLowerCase();
  const fileIcons = {
    pdf: '📄', doc: '📄', docx: '📄', odt: '📄', txt: '📄', md: '📄', rtf: '📄',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', tiff: '🖼️', heic: '🖼️', raw: '🖼️', bmp: '🖼️', ico: '🖼️',
    mp4: '🎬', mkv: '🎬', avi: '🎬', webm: '🎬', mov: '🎬', flv: '🎬', ts: '🎬', m3u8: '🎬',
    mp3: '🎵', wav: '🎵', ogg: '🎵', flac: '🎵', m4a: '🎵', aac: '🎵',
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦', bz2: '📦', xz: '📦',
    xls: '📊', xlsx: '📊', csv: '📊', ods: '📊',
    ppt: '📊', pptx: '📊', odp: '📊',
    exe: '⚙️', msi: '⚙️', apk: '⚙️', appx: '⚙️', bat: '⚙️', cmd: '⚙️', sh: '⚙️', dmg: '⚙️', pkg: '⚙️', iso: '💿', img: '💿',
    psd: '🎨', ai: '🎨', indd: '🎨', blend: '🎨', fig: '🎨', cdr: '🎨',
    html: '💻', css: '💻', js: '💻', ts: '💻', json: '💻', xml: '💻', py: '💻', java: '💻', cpp: '💻', php: '💻', sql: '💻',
    epub: '📚', mobi: '📚', azw3: '📚', cbz: '📚', cbr: '📚',
    stl: '🧊', obj: '🧊', fbx: '🧊', gcode: '🧊',
    ttf: '🔤', otf: '🔤', woff: '🔤', woff2: '🔤',
    default: '📄'
  };
  return fileIcons[ext] || fileIcons.default;
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function detectViewMode() {
  const params = new URLSearchParams(window.location.search);
  let mode = params.get("mode") || params.get("view");

  if (!mode) {
    if (window.innerWidth < 420) {
      mode = "popup";
    } else {
      mode = "sidebar";
    }
  }

  document.body.classList.remove("mode-popup", "mode-sidebar");
  document.body.classList.add(`mode-${mode}`);
  currentViewMode = mode;
  return mode;
}

async function loadHistory() {
  const result = await api.storage.local.get({ downloadHistory: [] });
  const historyList = document.getElementById("popupHistory");
  const downloadCountTextElem = document.getElementById("downloadCount");
  const totalDownloads = result.downloadHistory.length;

  const proCount = document.getElementById("proTotalDownloadsCount");
  if (proCount) proCount.textContent = String(totalDownloads);

  // Renderizar la vista previa de las últimas descargas (2 para popup compacto, 6 para panel sidebar Pro)
  const recentCount = currentViewMode === 'popup' ? 2 : 6;
  renderRecentDownloadsPreview(result.downloadHistory.slice(-recentCount).reverse());

  if (!historyList || !downloadCountTextElem) return;

  // Usamos getMessage con un marcador de posición
  downloadCountTextElem.textContent = api.i18n.getMessage("popup_downloadCount", String(totalDownloads));
  historyList.textContent = "";

  const emptyHistoryElem = document.getElementById("emptyHistory");

  if (totalDownloads === 0) {
    historyList.style.display = "none";
    if (emptyHistoryElem) emptyHistoryElem.style.display = "flex";
    return;
  }
  
  historyList.style.display = "flex";
  if (emptyHistoryElem) emptyHistoryElem.style.display = "none";

  const lastDownloads = result.downloadHistory.slice(-15).reverse();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'];

  lastDownloads.forEach(entry => {
    const listItem = document.createElement("li");
    listItem.className = "history-item";

    const ext = (entry.filename.split('.').pop() || '').toLowerCase();
    const isImage = imageExts.includes(ext) || (entry.url && entry.url.startsWith('data:image/'));

    const thumbHtml = (isImage && entry.url)
      ? `<img src="${entry.url}" class="history-thumb" alt="" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" /><div class="history-item-icon" style="display:none;">${getFileTypeIcon(entry.filename)}</div>`
      : `<div class="history-item-icon">${getFileTypeIcon(entry.filename)}</div>`;

    const formattedDate = new Date(entry.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const displayExt = ext ? ext.toUpperCase() : 'FILE';

    setHTML(listItem, `
      <div class="history-item-icon-wrapper">${thumbHtml}</div>
      <div class="history-item-details">
        <div class="history-item-title-row">
          <strong title="${entry.filename}">${entry.filename}</strong>
          <span class="history-ext-badge">${displayExt}</span>
        </div>
        <div class="history-item-meta">
          <span class="history-date">${formattedDate}</span>
          <span class="history-folder">📂 ${entry.folder}</span>
          <span class="history-size"></span>
          <span class="history-dims"></span>
        </div>
      </div>
      <div class="popup-history-actions"></div>
    `);

    const img = listItem.querySelector(".history-thumb");
    if (img) {
      img.onload = function() {
        if (this.naturalWidth && this.naturalHeight) {
          const dimsElem = listItem.querySelector(".history-dims");
          if (dimsElem) {
            dimsElem.textContent = `📏 ${this.naturalWidth}×${this.naturalHeight} px`;
          }
        }
      };
    }

    if (entry.id !== undefined) {
      const numId = Number(entry.id);
      if (!isNaN(numId)) {
        api.downloads.search({ id: numId }).then(results => {
          if (results && results[0]) {
            const size = results[0].fileSize || results[0].bytesReceived;
            if (size) {
              const sizeElem = listItem.querySelector(".history-size");
              if (sizeElem) {
                sizeElem.textContent = `💾 ${formatBytes(size)}`;
              }
            }
          }
        }).catch(() => {});
      }
    }

    const actionsContainer = listItem.querySelector(".popup-history-actions");

    if (entry.id !== undefined) {
      const openFolderBtn = document.createElement("button");
      openFolderBtn.textContent = api.i18n.getMessage("openFolderButton") || "Carpeta";
      openFolderBtn.title = api.i18n.getMessage("openFolderTooltip") || "Abrir en explorador";
      openFolderBtn.addEventListener("click", () => openFolderInExplorer(entry.id, listItem));
      actionsContainer.appendChild(openFolderBtn);
    }
    if (entry.url) {
      const reDownloadBtn = document.createElement("button");
      reDownloadBtn.textContent = api.i18n.getMessage("redownloadButton") || "Re-descargar";
      reDownloadBtn.title = api.i18n.getMessage("redownloadTooltip") || "Descargar de nuevo";
      reDownloadBtn.addEventListener("click", () => api.downloads.download({ url: entry.url }));
      actionsContainer.appendChild(reDownloadBtn);
    }

    historyList.appendChild(listItem);
  });
}

function renderRecentDownloadsPreview(recentList) {
  const container = document.getElementById("recentDownloadsPreview");
  if (!container) return;

  container.textContent = "";

  if (!recentList || recentList.length === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "empty-recent-card";
    emptyCard.textContent = "No hay descargas recientes aún.";
    container.appendChild(emptyCard);
    return;
  }

  recentList.forEach(entry => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "recent-preview-item";

    const icon = getFileTypeIcon(entry.filename);
    const folder = entry.folder || 'Descargas';

    setHTML(itemDiv, `
      <span class="recent-preview-icon">${icon}</span>
      <div class="recent-preview-info">
        <span class="recent-preview-title" title="${entry.filename}">${entry.filename}</span>
        <span class="recent-preview-folder">📂 ${folder}</span>
      </div>
      <div class="popup-history-actions"></div>
    `);

    const actionsContainer = itemDiv.querySelector(".popup-history-actions");

    if (entry.id !== undefined) {
      const openFolderBtn = document.createElement("button");
      openFolderBtn.textContent = "📂";
      openFolderBtn.title = api.i18n.getMessage("openFolderTooltip") || "Abrir carpeta";
      openFolderBtn.addEventListener("click", () => openFolderInExplorer(entry.id, itemDiv));
      actionsContainer.appendChild(openFolderBtn);
    }
    if (entry.url) {
      const reDownloadBtn = document.createElement("button");
      reDownloadBtn.textContent = "🔄";
      reDownloadBtn.title = api.i18n.getMessage("redownloadTooltip") || "Re-descargar";
      reDownloadBtn.addEventListener("click", () => api.downloads.download({ url: entry.url }));
      actionsContainer.appendChild(reDownloadBtn);
    }

    container.appendChild(itemDiv);
  });
}

function filterHistory(query) {
  const historyList = document.getElementById("popupHistory");
  if (!historyList) return;

  const items = historyList.querySelectorAll("li.history-item");
  items.forEach(item => {
    const text = item.textContent.toLowerCase();
    if (!query || text.includes(query)) {
      item.style.display = "flex";
    } else {
      item.style.display = "none";
    }
  });
}

async function openFolderInExplorer(downloadId, listItemElement) {
  const numId = Number(downloadId);
  if (isNaN(numId)) return;

  try {
    const results = await api.downloads.search({ id: numId });
    if (!results || !results.length) {
      showFeedback(api.i18n.getMessage("feedback_errorNotInHistory"), false);
      return;
    }
    if (!results[0].exists) {
      // El archivo es un fantasma (se borró del disco duro)
      showFeedback(api.i18n.getMessage("feedback_errorFileNotExists"), false);

      // Lógica inteligente: Eliminar el fantasma del historial
      removeGhostFromHistory(numId, listItemElement);
      return;
    }

    // Todo bien, abrir carpeta
    api.downloads.show(numId);
  } catch (e) {
    showFeedback(api.i18n.getMessage("feedback_errorFindDownload"), false);
  }
}

async function removeGhostFromHistory(downloadId, listItemElement) {
  const result = await api.storage.local.get({ downloadHistory: [] });
  const newHistory = result.downloadHistory.filter(item => item.id !== downloadId);

  await api.storage.local.set({ downloadHistory: newHistory });
  // Eliminar visualmente de la lista con una animación
  if (listItemElement) {
    listItemElement.style.transition = "all 0.3s ease";
    listItemElement.style.opacity = "0";
    listItemElement.style.height = "0";
    listItemElement.style.padding = "0";
    listItemElement.style.border = "none";
    setTimeout(() => listItemElement.remove(), 300);
  }
  // Actualizar contador
  const countTextElem = document.getElementById("downloadCount");
  if (countTextElem) {
    countTextElem.textContent = api.i18n.getMessage("popup_downloadCount", String(newHistory.length));
  }
}

function showFeedback(message, success = true) {
  let feedbackContainer = document.getElementById("popupFeedbackToast");
  if (!feedbackContainer) {
    feedbackContainer = document.createElement("div");
    feedbackContainer.id = "popupFeedbackToast";
    document.body.appendChild(feedbackContainer);
  }

  feedbackContainer.textContent = message;
  feedbackContainer.className = "popup-feedback-toast";
  feedbackContainer.classList.add(success ? "success" : "error");

  void feedbackContainer.offsetWidth;

  feedbackContainer.classList.add("visible");

  setTimeout(() => {
    feedbackContainer.classList.remove("visible");
  }, 3000);
}

/* ============================================
   LÓGICA DE COLA DE DESCARGAS Y DRAG & DROP
   ============================================ */

async function loadDownloadQueue() {
  const result = await api.storage.local.get({ downloadQueue: [] });
  downloadQueue = result.downloadQueue;
  renderQueueList();
}

async function saveDownloadQueue() {
  await api.storage.local.set({ downloadQueue });
  renderQueueList();
}

function setupDragAndDrop() {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("drag-active");
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target === dropZone || !document.body.contains(e.relatedTarget)) {
        dropZone.classList.remove("drag-active");
      }
    }, false);
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-active");

    const htmlData = e.dataTransfer ? e.dataTransfer.getData('text/html') : null;
    const urls = extractUrlsFromDrop(e);
    if (!urls || urls.length === 0) return;

    for (const url of urls) {
      await addToQueue(url, htmlData);
    }
  });
}

function extractUrlsFromDrop(e) {
  const urls = [];
  const dt = e.dataTransfer;
  if (!dt) return urls;

  // 1. URL directo
  const uriList = dt.getData('text/uri-list') || dt.getData('URL');
  if (uriList) {
    uriList.split('\n').forEach(u => {
      const trimmed = u.trim();
      if (trimmed && !trimmed.startsWith('#') && (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/'))) {
        urls.push(trimmed);
      }
    });
  }

  // 2. HTML data (extraer src de img o href de a)
  const htmlData = dt.getData('text/html');
  if (htmlData && urls.length === 0) {
    const doc = new DOMParser().parseFromString(htmlData, 'text/html');
    const imgs = doc.querySelectorAll('img[src]');
    imgs.forEach(img => {
      const src = img.getAttribute('src');
      if (src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:image/'))) {
        urls.push(src);
      }
    });

    if (urls.length === 0) {
      const links = doc.querySelectorAll('a[href]');
      links.forEach(a => {
        const href = a.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          urls.push(href);
        }
      });
    }
  }

  // 3. Plain text fallback
  const textData = dt.getData('text/plain');
  if (textData && urls.length === 0) {
    const trimmed = textData.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
      urls.push(trimmed);
    }
  }

  return [...new Set(urls)];
}

const VALID_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp', 'ico'];

function extractRealImageUrl(rawUrl) {
  if (!rawUrl) return rawUrl;

  // 1. Google Images imgres
  if (rawUrl.includes('google.') && rawUrl.includes('/imgres')) {
    try {
      const u = new URL(rawUrl);
      const imgurl = u.searchParams.get('imgurl');
      if (imgurl) return decodeURIComponent(imgurl);
    } catch (e) {}
  }

  // 2. Parámetros de imagen directa en URL
  try {
    const u = new URL(rawUrl);
    for (const param of ['imgurl', 'img_url', 'image_url', 'media', 'src']) {
      const val = u.searchParams.get(param);
      if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
        return decodeURIComponent(val);
      }
    }
  } catch (e) {}

  return rawUrl;
}

function detectImageExtension(url, contentTypeHeader = null) {
  if (!url) return 'jpg';

  if (url.startsWith('data:image/')) {
    const mime = url.substring(5, url.indexOf(';'));
    const ext = mime.split('/')[1] || 'png';
    return ext === 'jpeg' ? 'jpg' : ext;
  }

  if (contentTypeHeader) {
    const mime = contentTypeHeader.toLowerCase().split(';')[0].trim();
    const mimeMap = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'image/avif': 'avif',
      'image/bmp': 'bmp',
      'image/x-icon': 'ico',
      'image/vnd.microsoft.icon': 'ico'
    };
    if (mimeMap[mime]) return mimeMap[mime];
  }

  try {
    const u = new URL(url);
    const formatParam = u.searchParams.get('format') || u.searchParams.get('fm') || u.searchParams.get('ext');
    if (formatParam && VALID_IMAGE_EXTENSIONS.includes(formatParam.toLowerCase())) {
      return formatParam.toLowerCase() === 'jpeg' ? 'jpg' : formatParam.toLowerCase();
    }

    const pathname = u.pathname;
    const parts = pathname.split('/');
    const lastPart = parts.pop() || '';
    if (lastPart.includes('.')) {
      const ext = lastPart.split('.').pop().toLowerCase();
      if (VALID_IMAGE_EXTENSIONS.includes(ext)) {
        return ext === 'jpeg' ? 'jpg' : ext;
      }
    }
  } catch (e) {}

  return 'jpg';
}

async function fetchImageContentType(url) {
  if (!url || url.startsWith('data:') || !url.startsWith('http')) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      return resp.headers.get('content-type');
    }
  } catch (e) {}
  return null;
}

function cleanFolderName(folder) {
  if (!folder) return api.i18n.getMessage("folder_images") || "Imágenes";
  return folder.replace(/[\\:*?"<>|]/g, '_').trim();
}

async function extractFilenameAndExtension(rawUrl) {
  const realUrl = extractRealImageUrl(rawUrl);
  let extension = detectImageExtension(realUrl);
  let rawName = 'imagen';

  try {
    if (realUrl.startsWith('data:image/')) {
      rawName = `imagen_${Date.now().toString().slice(-4)}`;
    } else {
      const u = new URL(realUrl);
      let pathLast = u.pathname.split('/').filter(Boolean).pop() || '';

      if (pathLast.includes('.')) {
        const parts = pathLast.split('.');
        const possibleExt = parts.pop().toLowerCase();
        if (VALID_IMAGE_EXTENSIONS.includes(possibleExt)) {
          extension = possibleExt === 'jpeg' ? 'jpg' : possibleExt;
          rawName = parts.join('.');
        } else {
          rawName = pathLast;
        }
      } else if (pathLast) {
        rawName = pathLast;
      }

      if (!VALID_IMAGE_EXTENSIONS.includes(extension) || extension === 'jpg') {
        const mime = await fetchImageContentType(realUrl);
        if (mime) {
          extension = detectImageExtension(realUrl, mime);
        }
      }
    }
  } catch (e) {
    rawName = `imagen_${Date.now().toString().slice(-4)}`;
  }

  rawName = decodeURIComponent(rawName)
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$|com$|cat$|org$|net$/gi, '')
    .trim();

  if (!rawName || rawName.toLowerCase() === 'imgres' || rawName.toLowerCase() === 'images') {
    rawName = `imagen_${Date.now().toString().slice(-4)}`;
  }

  return {
    realUrl,
    filename: `${rawName}.${extension}`,
    extension
  };
}

async function initDragTargetControls() {
  const dragTargetModeSelect = document.getElementById("dragTargetMode");
  const dragCustomFolderInput = document.getElementById("dragCustomFolderInput");
  if (!dragTargetModeSelect || !dragCustomFolderInput) return;

  const { dragTargetMode = 'auto', dragCustomFolder = '' } = await api.storage.local.get(["dragTargetMode", "dragCustomFolder"]);
  dragTargetModeSelect.value = dragTargetMode;
  dragCustomFolderInput.value = dragCustomFolder;

  if (dragTargetMode === 'custom') {
    dragCustomFolderInput.style.display = "inline-block";
  } else {
    dragCustomFolderInput.style.display = "none";
  }

  dragTargetModeSelect.addEventListener("change", async (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      dragCustomFolderInput.style.display = "inline-block";
      dragCustomFolderInput.focus();
    } else {
      dragCustomFolderInput.style.display = "none";
    }
    await api.storage.local.set({ dragTargetMode: val });
  });

  dragCustomFolderInput.addEventListener("input", async (e) => {
    await api.storage.local.set({ dragCustomFolder: e.target.value.trim() });
  });
}

async function resolveTargetFolder(url, filename) {
  // 1. Comprobar preferencia de carpeta aparte para arrastrados
  const { dragTargetMode = 'auto', dragCustomFolder = '' } = await api.storage.local.get(["dragTargetMode", "dragCustomFolder"]);
  if (dragTargetMode === 'custom' && dragCustomFolder.trim()) {
    return cleanFolderName(dragCustomFolder.trim());
  }

  // 2. Comprobar modo forzado activo
  const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
  if (forceNextDownload && forceNextDownload.folder) {
    return cleanFolderName(forceNextDownload.folder);
  }

  // 3. Comprobar reglas personalizadas de sync
  const { customRules = [], enabledCategories = {} } = await api.storage.sync.get(["customRules", "enabledCategories"]);
  for (const rule of customRules) {
    if (rule.type === 'url' && url.toLowerCase().includes(rule.value.toLowerCase())) {
      return cleanFolderName(rule.folder);
    }
    if (rule.type === 'filename' && filename.toLowerCase().includes(rule.value.toLowerCase())) {
      return cleanFolderName(rule.folder);
    }
  }

  const ext = filename.split('.').pop() || "";
  const catFolder = getFolderNameByExtension(ext, enabledCategories);
  if (catFolder) return cleanFolderName(catFolder);

  return cleanFolderName(api.i18n.getMessage("folder_images") || "Imágenes");
}

async function resolveDirectImageUrl(rawUrl, htmlData = null) {
  if (!rawUrl) return rawUrl;

  let realUrl = extractRealImageUrl(rawUrl);
  const cleanPath = realUrl.split('?')[0].split('#')[0].toLowerCase();
  const isDirectImage = VALID_IMAGE_EXTENSIONS.some(ext => cleanPath.endsWith('.' + ext)) || realUrl.startsWith('data:image/');
  if (isDirectImage) return realUrl;

  if (htmlData) {
    try {
      const doc = new DOMParser().parseFromString(htmlData, 'text/html');
      const img = doc.querySelector('img[src]');
      if (img && img.src && (img.src.startsWith('http://') || img.src.startsWith('https://') || img.src.startsWith('data:image/'))) {
        return img.src;
      }
      const meta = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
      if (meta && meta.content) {
        return meta.content;
      }
    } catch (e) {}
  }

  if (realUrl.startsWith('http://') || realUrl.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const resp = await fetch(realUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const text = await resp.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        
        const ogImg = doc.querySelector('meta[property="og:image"], meta[name="twitter:image"]');
        if (ogImg && ogImg.content) {
          let ogUrl = ogImg.content;
          if (ogUrl.startsWith('//')) ogUrl = 'https:' + ogUrl;
          else if (ogUrl.startsWith('/')) ogUrl = new URL(ogUrl, realUrl).href;
          return ogUrl;
        }

        const imgs = Array.from(doc.querySelectorAll('img[src]'));
        for (const img of imgs) {
          let src = img.getAttribute('src');
          if (src && !src.includes('avatar') && !src.includes('logo') && !src.includes('icon')) {
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/')) src = new URL(src, realUrl).href;
            if (src.startsWith('http://') || src.startsWith('https://')) {
              return src;
            }
          }
        }
      } else if (contentType.includes('image/')) {
        return realUrl;
      }
    } catch (e) {}
  }

  return realUrl;
}

async function addToQueue(rawUrl, htmlData = null) {
  const resolvedUrl = await resolveDirectImageUrl(rawUrl, htmlData);
  const { realUrl, filename, extension } = await extractFilenameAndExtension(resolvedUrl);

  if (['html', 'htm', 'php', 'aspx'].includes(extension.toLowerCase())) {
    showFeedback("No se encontró una imagen válida en el enlace arrastrado", false);
    return;
  }

  const folder = await resolveTargetFolder(realUrl, filename);
  const isImage = VALID_IMAGE_EXTENSIONS.includes(extension) || realUrl.startsWith('data:image/');

  let size = 0;
  if (realUrl.startsWith('data:')) {
    size = Math.round((realUrl.length - (realUrl.indexOf(',') + 1)) * 0.75);
  }

  const item = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    url: realUrl,
    filename,
    folder,
    isImage,
    size,
    addedAt: Date.now()
  };

  downloadQueue.push(item);
  await saveDownloadQueue();
  showFeedback(`Añadido a la cola (📂 ${folder})`, true);
}

function renderQueueList() {
  const queueSection = document.getElementById("queueSection");
  const queueList = document.getElementById("queueList");
  const queueBadge = document.getElementById("queueBadge");

  if (!queueSection || !queueList || !queueBadge) return;

  queueBadge.textContent = String(downloadQueue.length);

  if (downloadQueue.length === 0) {
    queueSection.style.display = "none";
    queueList.textContent = "";
    return;
  }

  queueSection.style.display = "block";
  queueList.textContent = "";

  downloadQueue.forEach(item => {
    const li = document.createElement("li");
    li.className = "queue-item";

    const previewHtml = item.isImage 
      ? `<img src="${item.url}" class="queue-thumb" alt="" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" /><div class="queue-thumb-fallback-icon" style="display:none;">🖼️</div>`
      : `<div class="queue-thumb-icon">${getFileTypeIcon(item.filename)}</div>`;

    setHTML(li, `
      <div class="queue-thumb-wrapper">${previewHtml}</div>
      <div class="queue-item-details">
        <strong title="${item.filename}">${item.filename}</strong>
        <div class="queue-meta-row">
          <small class="target-badge-wrapper">📂 <input type="text" class="queue-folder-input" value="${item.folder}" title="Haz clic para cambiar la carpeta de destino de este archivo" /></small>
          <span class="queue-dims"></span>
          <span class="queue-size">${item.size ? '💾 ' + formatBytes(item.size) : ''}</span>
        </div>
      </div>
      <div class="queue-item-actions"></div>
    `);

    const img = li.querySelector(".queue-thumb");
    if (img) {
      img.onload = function() {
        if (this.naturalWidth && this.naturalHeight) {
          const dimsElem = li.querySelector(".queue-dims");
          if (dimsElem) {
            dimsElem.textContent = `📏 ${this.naturalWidth}×${this.naturalHeight} px`;
          }
        }
      };
    }

    const folderInput = li.querySelector(".queue-folder-input");
    if (folderInput) {
      folderInput.addEventListener("change", async (e) => {
        const newFolder = cleanFolderName(e.target.value);
        item.folder = newFolder;
        await saveDownloadQueue();
      });
    }

    const actionsContainer = li.querySelector(".queue-item-actions");

    const dlBtn = document.createElement("button");
    dlBtn.className = "btn-queue-dl";
    dlBtn.textContent = api.i18n.getMessage("downloadItemButton") || "Descargar";
    dlBtn.addEventListener("click", () => processSingleQueueItem(item.id));

    const rmBtn = document.createElement("button");
    rmBtn.className = "btn-queue-rm";
    rmBtn.textContent = "✖";
    rmBtn.title = api.i18n.getMessage("removeItemButton") || "Quitar";
    rmBtn.addEventListener("click", () => removeFromQueue(item.id));

    actionsContainer.appendChild(dlBtn);
    actionsContainer.appendChild(rmBtn);

    queueList.appendChild(li);
  });
}

// Guarda un item de la cola en el historial local de descargas
async function saveQueueItemToHistory(item, downloadId) {
  try {
    const result = await api.storage.local.get({ downloadHistory: [] });
    const history = result.downloadHistory;
    while (history.length >= 50) { history.shift(); }
    history.push({
      filename: item.filename,
      folder: item.folder || 'Descargas',
      date: new Date().toISOString(),
      id: downloadId,
      url: item.url,
      fileSize: item.fileSize || null,
      width: item.width || null,
      height: item.height || null
    });
    await api.storage.local.set({ downloadHistory: history });
  } catch (e) {
    console.error('Error guardando en historial:', e);
  }
}

async function processSingleQueueItem(itemId) {
  const index = downloadQueue.findIndex(i => i.id === itemId);
  if (index === -1) return;

  const item = downloadQueue[index];
  const targetPath = item.folder ? `${item.folder}/${item.filename}` : item.filename;

  try {
    const dlId = await api.downloads.download({
      url: item.url,
      filename: targetPath,
      conflictAction: 'uniquify'
    });
    // Guardar en el historial
    await saveQueueItemToHistory(item, dlId);
    downloadQueue.splice(index, 1);
    await saveDownloadQueue();
    loadHistory();
  } catch (err) {
    console.error("Error al descargar item de la cola:", err);
    showFeedback(api.i18n.getMessage("statusErrorGeneric") + ": " + (err.message || "Error"), false);
  }
}

async function removeFromQueue(itemId) {
  downloadQueue = downloadQueue.filter(i => i.id !== itemId);
  await saveDownloadQueue();
}

async function processAllQueue() {
  if (downloadQueue.length === 0) return;

  const itemsToProcess = [...downloadQueue];
  downloadQueue = [];
  await saveDownloadQueue();

  let count = 0;
  for (const item of itemsToProcess) {
    const targetPath = item.folder ? `${item.folder}/${item.filename}` : item.filename;
    try {
      const dlId = await api.downloads.download({
        url: item.url,
        filename: targetPath,
        conflictAction: 'uniquify'
      });
      // Guardar en el historial
      await saveQueueItemToHistory(item, dlId);
      count++;
    } catch (e) {
      console.error("Error descargando elemento de la cola:", e);
    }
  }

  loadHistory();
  showFeedback(`Se iniciaron ${count} descargas desde la cola.`, true);
}

async function clearQueue() {
  downloadQueue = [];
  await saveDownloadQueue();
}

/* ============================================
   NAVEGACIÓN POR PESTAÑAS
   ============================================ */

async function initTabNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  const { activeTab = 'downloads' } = await api.storage.local.get("activeTab");
  switchTab(activeTab);

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;
      switchTab(targetTab);
      api.storage.local.set({ activeTab: targetTab });
    });
  });
}

function switchTab(tabId) {
  const tabs = document.querySelectorAll(".nav-tab");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach(t => {
    if (t.dataset.tab === tabId) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  tabContents.forEach(content => {
    if (content.id === `tab-${tabId}`) {
      content.style.display = "block";
      content.classList.add("active");
    } else {
      content.style.display = "none";
      content.classList.remove("active");
    }
  });
}