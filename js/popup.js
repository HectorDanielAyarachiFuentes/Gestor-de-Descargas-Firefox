// popup.js

import { applyI18n, setHTML } from './utils.js';
import { initTheme } from './theme-manager.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener("DOMContentLoaded", () => {
  applyI18n(); // <-- Llama a la función de traducción

  // --- Elementos de la UI ---
  const openOptionsBtn = document.getElementById("openOptions");
  const autoOrganizeToggle = document.getElementById("autoOrganizeToggle");
  const forceFolderInput = document.getElementById("forceFolderInput");
  const forceNextDownloadBtn = document.getElementById("forceNextDownloadBtn");
  const cancelForceBtn = document.getElementById("cancelForceBtn");

  // --- Carga de estado y datos iniciales ---
  initTheme();
  loadAppSettings();
  loadHistory();
  loadFolderSuggestions();

  // --- Listeners de eventos ---
  openOptionsBtn.addEventListener("click", () => {
    api.runtime.openOptionsPage();
  });

  autoOrganizeToggle.addEventListener("change", (e) => {
    api.storage.sync.set({ autoOrganize: e.target.checked });
  });

  forceNextDownloadBtn.addEventListener("click", activateForceMode);
  cancelForceBtn.addEventListener("click", deactivateForceMode);
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