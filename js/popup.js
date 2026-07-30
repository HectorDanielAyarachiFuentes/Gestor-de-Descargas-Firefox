// popup.js

import { applyI18n, setHTML } from './utils.js';
import { initTheme } from './theme-manager.js';
import { getFolderNameByExtension } from './rules-engine.js';

const api = typeof browser !== 'undefined' ? browser : chrome;
let downloadQueue = [];

document.addEventListener("DOMContentLoaded", () => {
  applyI18n(); // <-- Llama a la función de traducción

  // --- Elementos de la UI ---
  const openOptionsBtn = document.getElementById("openOptions");
  const openTabBtn = document.getElementById("openTab");
  const openSidebarBtn = document.getElementById("openSidebar");
  const autoOrganizeToggle = document.getElementById("autoOrganizeToggle");
  const forceFolderInput = document.getElementById("forceFolderInput");
  const forceNextDownloadBtn = document.getElementById("forceNextDownloadBtn");
  const cancelForceBtn = document.getElementById("cancelForceBtn");
  const downloadAllQueueBtn = document.getElementById("downloadAllQueueBtn");
  const clearQueueBtn = document.getElementById("clearQueueBtn");

  // --- Carga de estado y datos iniciales ---
  initTheme();
  loadAppSettings();
  loadHistory();
  loadFolderSuggestions();
  loadDownloadQueue();
  setupDragAndDrop();

  // --- Listeners de eventos ---
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
        // En navegadores o vistas donde no está la API de sidebarAction, abrir como pestaña
        api.tabs.create({ url: api.runtime.getURL("pages/popup.html") });
      }
    });
  }

  autoOrganizeToggle.addEventListener("change", (e) => {
    api.storage.sync.set({ autoOrganize: e.target.checked });
  });

  forceNextDownloadBtn.addEventListener("click", activateForceMode);
  cancelForceBtn.addEventListener("click", deactivateForceMode);

  if (downloadAllQueueBtn) {
    downloadAllQueueBtn.addEventListener("click", processAllQueue);
  }

  if (clearQueueBtn) {
    clearQueueBtn.addEventListener("click", clearQueue);
  }
});

async function loadAppSettings() {
  const { autoOrganize = true } = await api.storage.sync.get("autoOrganize");
  document.getElementById("autoOrganizeToggle").checked = autoOrganize;

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

async function loadHistory() {
  const result = await api.storage.local.get({ downloadHistory: [] });
  const historyList = document.getElementById("popupHistory");
  const downloadCountTextElem = document.getElementById("downloadCount");
  const totalDownloads = result.downloadHistory.length;

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
  
  historyList.style.display = "block";
  if (emptyHistoryElem) emptyHistoryElem.style.display = "none";

  const lastDownloads = result.downloadHistory.slice(-5).reverse();
  lastDownloads.forEach(entry => {
    const listItem = document.createElement("li");

    setHTML(listItem, `
        <div class="history-item-icon">${getFileTypeIcon(entry.filename)}</div>
        <div class="history-item-details">
          <strong>${entry.filename}</strong>
          <small>${new Date(entry.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} → 📂 ${entry.folder}</small>
        </div>
        <div class="popup-history-actions"></div>
      `);

    const actionsContainer = listItem.querySelector(".popup-history-actions");

    if (entry.id !== undefined) {
      const openFolderBtn = document.createElement("button");
      openFolderBtn.textContent = api.i18n.getMessage("openFolderButton");
      openFolderBtn.title = api.i18n.getMessage("openFolderTooltip");
      openFolderBtn.addEventListener("click", () => openFolderInExplorer(entry.id, listItem));
      actionsContainer.appendChild(openFolderBtn);
    }
    if (entry.url) {
      const reDownloadBtn = document.createElement("button");
      reDownloadBtn.textContent = api.i18n.getMessage("redownloadButton");
      reDownloadBtn.title = api.i18n.getMessage("redownloadTooltip");
      reDownloadBtn.addEventListener("click", () => api.downloads.download({ url: entry.url }));
      actionsContainer.appendChild(reDownloadBtn);
    }

    historyList.appendChild(listItem);
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

async function resolveTargetFolder(url, filename) {
  const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
  if (forceNextDownload && forceNextDownload.folder) {
    return cleanFolderName(forceNextDownload.folder);
  }

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

  const item = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    url: realUrl,
    filename,
    folder,
    isImage,
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
        <small><span class="target-badge">📂 ${item.folder}</span></small>
      </div>
      <div class="queue-item-actions"></div>
    `);

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

async function processSingleQueueItem(itemId) {
  const index = downloadQueue.findIndex(i => i.id === itemId);
  if (index === -1) return;

  const item = downloadQueue[index];
  const targetPath = item.folder ? `${item.folder}/${item.filename}` : item.filename;

  try {
    await api.downloads.download({
      url: item.url,
      filename: targetPath,
      conflictAction: 'uniquify'
    });
    downloadQueue.splice(index, 1);
    await saveDownloadQueue();
  } catch (err) {
    console.error("Error al descargar ítem de la cola:", err);
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
      await api.downloads.download({
        url: item.url,
        filename: targetPath,
        conflictAction: 'uniquify'
      });
      count++;
    } catch (e) {
      console.error("Error descargando elemento de la cola:", e);
    }
  }

  showFeedback(`✅ Se iniciaron ${count} descargas desde la cola.`, true);
}

async function clearQueue() {
  downloadQueue = [];
  await saveDownloadQueue();
}