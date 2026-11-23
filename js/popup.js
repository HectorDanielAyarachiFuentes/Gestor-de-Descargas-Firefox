// popup.js

import { applyI18n, setHTML } from './utils.js';
import { initTheme } from './theme-manager.js';
import { getFolderNameByExtension } from './rules-engine.js';
import {
  getFileTypeSvg,
  getFolderSvg,
  getFolderOpenSvg,
  getRefreshSvg,
  getHardDriveSvg,
  getMaximizeSvg,
  getXSvg
} from './icons.js';

const api = typeof browser !== 'undefined' ? browser : chrome;
let downloadQueue = [];

let currentViewMode = 'popup';

document.addEventListener("DOMContentLoaded", () => {
  applyI18n(); // <-- Llama a la función de traducción
  detectViewMode();

  // --- Elementos de la UI ---
  const openOptionsBtn = document.getElementById("openFullOptionsBtn") || document.getElementById("openOptions");
  const openTabBtn = document.getElementById("openFullTabBtn") || document.getElementById("openTab");
  const openSidebarBtn = document.getElementById("openSidebarBtn") || document.getElementById("openSidebar");
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

  // --- Árbol de Carpetas (W11 Style) ---
  const w11FolderTree = document.getElementById("w11FolderTree");
  const w11AddRootFolderBtn = document.getElementById("w11AddRootFolderBtn");

  let currentQuickFolders = [];

  function renderW11List() {
    if (!w11FolderTree) return;
    w11FolderTree.innerHTML = "";
    
    currentQuickFolders.forEach(folderPath => {
      const li = document.createElement("li");
      li.className = "quick-folder-chip";
      li.title = `Seleccionar "${folderPath}"`;
      
      const folderIcon = document.createElement("span");
      folderIcon.className = "chip-folder-icon";
      folderIcon.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="#F8D775" stroke="#DDA835" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
      
      const label = document.createElement("span");
      label.className = "chip-label";
      label.textContent = folderPath;
      
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "chip-del-btn";
      delBtn.title = "Eliminar de sugerencias";
      delBtn.innerHTML = `<svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      
      li.appendChild(folderIcon);
      li.appendChild(label);
      li.appendChild(delBtn);
      
      li.addEventListener("click", (e) => {
        if (e.target.closest('.chip-del-btn')) return;
        if (forceFolderInput) {
          forceFolderInput.value = folderPath;
          forceFolderInput.focus();
          if (clearForceInputBtn) clearForceInputBtn.style.display = "block";
          
          li.classList.add("chip-selected-pulse");
          setTimeout(() => li.classList.remove("chip-selected-pulse"), 400);
        }
      });
      
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeQuickFolder(folderPath);
      });
      
      w11FolderTree.appendChild(li);
    });
  }

  function showInlineInput() {
    if (w11FolderTree.querySelector('.quick-chip-input-container')) return;
    
    const li = document.createElement("li");
    li.className = "quick-chip-input-container";
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "quick-chip-inline-input";
    input.placeholder = "Nueva carpeta...";
    
    li.appendChild(input);
    w11FolderTree.appendChild(li);
    input.focus();
    setTimeout(() => {
      w11FolderTree.scrollTo({ left: w11FolderTree.scrollWidth, behavior: 'smooth' });
    }, 30);
    
    let isCommitted = false;
    const commit = () => {
      if (isCommitted) return;
      isCommitted = true;
      const val = input.value.trim();
      if (val) {
        addQuickFolder(val);
      } else {
        li.remove();
        renderW11List(); 
      }
    };
    
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
      if (e.key === "Escape") {
        isCommitted = true;
        li.remove();
        renderW11List();
      }
    });
    
    input.addEventListener("blur", () => {
      setTimeout(commit, 120);
    });
  }

  async function loadQuickFolders() {
    const res = await api.storage.sync.get("quickFolders");
    if (res.quickFolders && Array.isArray(res.quickFolders) && res.quickFolders.length > 0) {
      currentQuickFolders = res.quickFolders.map(f => typeof f === 'string' ? f : f.folder).filter(Boolean);
    } else {
      currentQuickFolders = ['Documentos', 'Imágenes', 'Música', 'Videos'];
      await api.storage.sync.set({ quickFolders: currentQuickFolders });
    }
    renderW11List();
  }

  async function addQuickFolder(folderPath) {
    if (!folderPath.trim()) return;
    const normalized = folderPath.replace(/\\/g, '/');
    if (!currentQuickFolders.includes(normalized)) {
      currentQuickFolders.push(normalized);
      currentQuickFolders.sort((a, b) => a.localeCompare(b));
      await api.storage.sync.set({ quickFolders: currentQuickFolders });
    }
    renderW11List();
  }

  async function removeQuickFolder(folderPath) {
    currentQuickFolders = currentQuickFolders.filter(p => p !== folderPath);
    await api.storage.sync.set({ quickFolders: currentQuickFolders });
    renderW11List();
  }

  loadQuickFolders();
  window.addQuickFolder = addQuickFolder;

  if (w11AddRootFolderBtn) {
    w11AddRootFolderBtn.addEventListener("click", () => {
      showInlineInput();
    });
  }

  // Desplazamiento horizontal fluido con la rueda del ratón en la lista de atajos
  if (w11FolderTree) {
    w11FolderTree.addEventListener("wheel", (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        w11FolderTree.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

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
  const copyPrefBtn = document.getElementById("copyPrefBtn");
  if (copyPrefBtn) {
    copyPrefBtn.addEventListener("click", async () => {
      const textToCopy = "about:preferences";
      const copyStatus = document.getElementById("copyPrefStatus");
      try {
        await navigator.clipboard.writeText(textToCopy);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = textToCopy;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }

      if (copyStatus) {
        copyStatus.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span style="color:#10b981;font-weight:700;">¡Copiado!</span>`;
        copyPrefBtn.classList.add("copied");
        setTimeout(() => {
          copyStatus.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copiar</span>`;
          copyPrefBtn.classList.remove("copied");
        }, 1800);
      }

      if (typeof showFeedback === "function") {
        showFeedback("Copiado al portapapeles: about:preferences", true);
      }
    });
  }

  function closeIfPopup() {
    if (currentViewMode === 'popup' || document.body.classList.contains("mode-popup")) {
      window.close();
    }
  }

  const optionsButtons = document.querySelectorAll("#openFullOptionsBtn, #openOptions");
  optionsButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await api.runtime.openOptionsPage();
      } catch (e) {
        api.tabs.create({ url: api.runtime.getURL("pages/options.html") });
      }
      closeIfPopup();
    });
  });

  const tabButtons = document.querySelectorAll("#openFullTabBtn, #openTab");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await api.tabs.create({ url: api.runtime.getURL("pages/popup.html") });
      } catch (e) {}
      closeIfPopup();
    });
  });

  const sidebarBtns = document.querySelectorAll("#openSidebar, #openSidebarBtn");
  sidebarBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      const isPopup = currentViewMode === 'popup' || document.body.classList.contains("mode-popup");
      if (isPopup) {
        document.body.classList.add("popup-closing-to-sidebar");
      }

      try {
        if (api.sidebarAction && typeof api.sidebarAction.open === "function") {
          await api.sidebarAction.open();
        } else if (api.sidebarAction && typeof api.sidebarAction.toggle === "function") {
          await api.sidebarAction.toggle();
        } else {
          api.tabs.create({ url: api.runtime.getURL("pages/popup.html") });
        }
      } catch (e) {
        console.warn("Error abriendo sidebarAction:", e);
      }

      if (isPopup) {
        setTimeout(() => {
          window.close();
        }, 220);
      }
    });
  });

  if (autoOrganizeToggle) {
    autoOrganizeToggle.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      api.storage.sync.set({ autoOrganize: isChecked });
      updateAutoOrganizeUI(isChecked);
    });
  }

  if (forceNextDownloadBtn) forceNextDownloadBtn.addEventListener("click", activateForceMode);
  if (cancelForceBtn) cancelForceBtn.addEventListener("click", deactivateForceMode);

  // Sincronización de radio buttons de Duración con el checkbox interno
  const radioOnce = document.getElementById("forceModeOnce");
  const radioPersistent = document.getElementById("forceModePersistent");
  const forceCheckbox = document.getElementById("forcePersistentCheckbox");
  if (radioOnce && forceCheckbox) {
    radioOnce.addEventListener("change", () => {
      if (radioOnce.checked) forceCheckbox.checked = false;
    });
  }
  if (radioPersistent && forceCheckbox) {
    radioPersistent.addEventListener("change", () => {
      if (radioPersistent.checked) forceCheckbox.checked = true;
    });
  }

  if (downloadAllQueueBtn) {
    downloadAllQueueBtn.addEventListener("click", processAllQueue);
  }

  if (clearQueueBtn) {
    clearQueueBtn.addEventListener("click", clearQueue);
  }

  // Sincronización reactiva en tiempo real del estado de desvío
  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.forceNextDownload) {
      const newVal = changes.forceNextDownload.newValue;
      if (newVal && newVal.folder) {
        showActiveForceView(newVal.folder, !!newVal.persistent);
      } else {
        showIdleForceView();
      }
    }
  });
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
      statusText.textContent = (msg && msg.length > 0) ? msg : "Activo";
    } else {
      const msg = api.i18n.getMessage("autoOrganizeDisabled");
      statusText.textContent = (msg && msg.length > 0) ? msg : "Desactivado";
    }
  }
}

async function loadAppSettings() {
  const versionBadge = document.getElementById("appVersion");
  if (versionBadge && api.runtime?.getManifest) {
    try {
      const manifest = api.runtime.getManifest();
      if (manifest && manifest.version) {
        versionBadge.textContent = `v${manifest.version}`;
      }
    } catch (e) {}
  }

  const { autoOrganize = true } = await api.storage.sync.get("autoOrganize");
  updateAutoOrganizeUI(autoOrganize);

  const { forceNextDownload } = await api.storage.local.get("forceNextDownload");
  if (forceNextDownload && forceNextDownload.folder) {
    const persistent = forceNextDownload.persistent || false;
    const checkbox = document.getElementById("forcePersistentCheckbox");
    if (checkbox) {
      checkbox.checked = persistent;
    }
    const radioOnce = document.getElementById("forceModeOnce");
    const radioPersistent = document.getElementById("forceModePersistent");
    if (radioOnce && radioPersistent) {
      radioOnce.checked = !persistent;
      radioPersistent.checked = !!persistent;
    }
    showActiveForceView(forceNextDownload.folder, persistent);
  } else {
    const radioOnce = document.getElementById("forceModeOnce");
    const radioPersistent = document.getElementById("forceModePersistent");
    const checkbox = document.getElementById("forcePersistentCheckbox");
    if (radioOnce) radioOnce.checked = true;
    if (radioPersistent) radioPersistent.checked = false;
    if (checkbox) checkbox.checked = false;
    showIdleForceView();
  }
}

async function activateForceMode() {
  const folder = document.getElementById("forceFolderInput").value.trim();
  if (!folder) return;

  const radioPersistent = document.getElementById("forceModePersistent");
  const checkbox = document.getElementById("forcePersistentCheckbox");
  const persistent = radioPersistent ? radioPersistent.checked : (checkbox ? checkbox.checked : false);

  const forceRule = { folder: folder, persistent: persistent };
  await api.storage.local.set({ forceNextDownload: forceRule });
  // Agregar automáticamente a las carpetas rápidas si no existe
  if (typeof window.addQuickFolder === "function") {
    window.addQuickFolder(folder);
  }

  api.action.setBadgeText({ text: persistent ? '∞' : '1' });
  api.action.setBadgeBackgroundColor({ color: '#007bff' });
  showActiveForceView(folder, persistent);
}

async function deactivateForceMode() {
  await api.storage.local.remove("forceNextDownload");
  api.action.setBadgeText({ text: '' });
  showIdleForceView();
}

function showActiveForceView(folder, persistent = false) {
  const idleView = document.getElementById("force-idle-view");
  const activeView = document.getElementById("force-active-view");
  if (idleView) idleView.style.display = "none";
  if (!activeView) return;

  const tagElem = activeView.querySelector("#hudStatusTag");
  if (tagElem) {
    tagElem.textContent = persistent ? "DESVÍO CONTINUO (TODAS)" : "DESVÍO TEMPORAL (1 DESCARGA)";
  }
  const folderNameElem = activeView.querySelector(".hud-folder-name");
  if (folderNameElem) {
    folderNameElem.textContent = folder;
  }
  activeView.style.display = "block";
}

function showIdleForceView() {
  const activeView = document.getElementById("force-active-view");
  const idleView = document.getElementById("force-idle-view");
  if (activeView) activeView.style.display = "none";
  if (idleView) idleView.style.display = "flex";
  const input = document.getElementById("forceFolderInput");
  if (input) input.value = "";
  const clearBtn = document.getElementById("clearForceInputBtn");
  if (clearBtn) clearBtn.style.display = "none";
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
  return getFileTypeSvg(filename);
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

  // Renderizar la vista previa de las últimas descargas (3 para popup compacto sin scroll, 8 para panel sidebar Pro)
  const recentCount = currentViewMode === 'popup' ? 3 : 8;
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
      <div class="history-item-main">
        <div class="history-item-icon-wrapper">${thumbHtml}</div>
        <div class="history-item-details">
          <div class="history-item-title-row">
            <strong title="${entry.filename}">${entry.filename}</strong>
            <span class="history-ext-badge">${displayExt}</span>
          </div>
          <div class="history-item-meta">
            <span class="history-folder" title="Carpeta destino">${getFolderSvg(12)} <span>${entry.folder}</span></span>
            <span class="history-date" title="Fecha y hora">${formattedDate}</span>
            <span class="history-size"></span>
            <span class="history-dims"></span>
          </div>
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
            setHTML(dimsElem, `${getMaximizeSvg(11)} <span>${this.naturalWidth}×${this.naturalHeight} px</span>`);
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
                setHTML(sizeElem, `${getHardDriveSvg(11)} <span>${formatBytes(size)}</span>`);
              }
            }
          }
        }).catch(() => {});
      }
    }

    const actionsContainer = listItem.querySelector(".popup-history-actions");

    if (entry.id !== undefined) {
      const openFolderBtn = document.createElement("button");
      setHTML(openFolderBtn, `${getFolderOpenSvg(13)} <span>${api.i18n.getMessage("openFolderButton") || "Carpeta"}</span>`);
      openFolderBtn.title = api.i18n.getMessage("openFolderTooltip") || "Abrir en explorador";
      openFolderBtn.addEventListener("click", () => openFolderInExplorer(entry.id, listItem));
      actionsContainer.appendChild(openFolderBtn);
    }
    if (entry.url) {
      const reDownloadBtn = document.createElement("button");
      setHTML(reDownloadBtn, `${getRefreshSvg(13)} <span>${api.i18n.getMessage("redownloadButton") || "Re-descargar"}</span>`);
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

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'];

  recentList.forEach(entry => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "recent-preview-item";

    const ext = (entry.filename.split('.').pop() || '').toLowerCase();
    const isImage = imageExts.includes(ext) || (entry.url && entry.url.startsWith('data:image/'));
    const folder = entry.folder || 'Descargas';
    const icon = getFileTypeIcon(entry.filename);
    const displayExt = ext ? ext.toUpperCase() : 'FILE';
    const extClass = ['pdf', 'epub', 'zip', 'rar', 'exe', 'msi', 'mp4', 'mp3', 'md', 'html', 'js', 'py'].includes(ext) ? `ext-${ext}` : 'ext-generic';

    const thumbHtml = (isImage && entry.url)
      ? `<img src="${entry.url}" class="recent-preview-thumb" alt="" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" /><div class="recent-preview-fallback-icon" style="display:none;">${icon}</div>`
      : `<div class="recent-preview-fallback-icon">${icon}</div>`;

    const dateObj = entry.date ? new Date(entry.date) : new Date();
    const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setHTML(itemDiv, `
      <div class="recent-preview-thumb-wrapper">${thumbHtml}</div>
      <div class="recent-preview-info">
        <div class="recent-preview-title-row">
          <span class="recent-preview-title" title="Clic para abrir en el sistema: ${entry.filename}">${entry.filename}</span>
          <span class="recent-ext-badge ${extClass}">${displayExt}</span>
        </div>
        <div class="recent-preview-meta">
          <span class="recent-preview-folder-pill" title="Carpeta: ${folder}">
            ${getFolderSvg(11)}
            <span>${folder}</span>
          </span>
          <span class="meta-dot">·</span>
          <span class="recent-preview-time" title="Hora de descarga">${timeFormatted}</span>
          <span class="recent-preview-size" style="display: none;"></span>
        </div>
      </div>
      <div class="popup-history-actions"></div>
    `);

    // Clic directo en el título para abrir el archivo en el sistema operativo
    const titleElem = itemDiv.querySelector(".recent-preview-title");
    if (titleElem && entry.id !== undefined) {
      titleElem.addEventListener("click", async (e) => {
        e.stopPropagation();
        const numId = Number(entry.id);
        if (isNaN(numId)) return;
        try {
          const results = await api.downloads.search({ id: numId });
          if (!results || !results.length || !results[0].exists) {
            showFeedback(api.i18n.getMessage("feedback_errorFileNotExists") || "El archivo ya no existe", false);
            return;
          }
          api.downloads.open(numId);
        } catch (err) {
          showFeedback(api.i18n.getMessage("feedback_errorFindDownload") || "No se pudo abrir el archivo", false);
        }
      });
    }

    // Consulta de tamaño de archivo asíncrono
    if (entry.id !== undefined) {
      const numId = Number(entry.id);
      if (!isNaN(numId)) {
        api.downloads.search({ id: numId }).then(results => {
          if (results && results[0]) {
            const size = results[0].fileSize || results[0].bytesReceived;
            if (size) {
              const sizeElem = itemDiv.querySelector(".recent-preview-size");
              if (sizeElem) {
                setHTML(sizeElem, `<span class="meta-dot">·</span><span>${formatBytes(size)}</span>`);
                sizeElem.style.display = "inline-flex";
              }
            }
          }
        }).catch(() => {});
      }
    }

    const actionsContainer = itemDiv.querySelector(".popup-history-actions");

    if (entry.id !== undefined) {
      const openFolderBtn = document.createElement("button");
      setHTML(openFolderBtn, getFolderOpenSvg(14));
      openFolderBtn.title = api.i18n.getMessage("openFolderTooltip") || "Abrir carpeta";
      openFolderBtn.addEventListener("click", () => openFolderInExplorer(entry.id, itemDiv));
      actionsContainer.appendChild(openFolderBtn);
    }
    if (entry.url) {
      const reDownloadBtn = document.createElement("button");
      setHTML(reDownloadBtn, getRefreshSvg(14));
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
  const { customRules = [], defaultCategories = {} } = await api.storage.sync.get(["customRules", "defaultCategories"]);
  for (const rule of customRules) {
    if (rule.type === 'url' && url.toLowerCase().includes(rule.value.toLowerCase())) {
      return cleanFolderName(rule.folder);
    }
    if (rule.type === 'filename' && filename.toLowerCase().includes(rule.value.toLowerCase())) {
      return cleanFolderName(rule.folder);
    }
  }

  const ext = filename.split('.').pop() || "";
  const catFolder = getFolderNameByExtension(ext, defaultCategories);
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
  showFeedback(`Añadido a la cola (${folder})`, true);
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
      ? `<img src="${item.url}" class="queue-thumb" alt="" onerror="this.style.display='none';if(this.nextElementSibling)this.nextElementSibling.style.display='flex';" /><div class="queue-thumb-fallback-icon" style="display:none;">${getFileTypeSvg('img.png')}</div>`
      : `<div class="queue-thumb-icon">${getFileTypeIcon(item.filename)}</div>`;

    const dlText = api.i18n.getMessage("downloadItemButton") || "Descargar";
    const rmTitle = api.i18n.getMessage("removeItemButton") || "Quitar";

    setHTML(li, `
      <div class="queue-item-main">
        <div class="queue-thumb-wrapper">${previewHtml}</div>
        <div class="queue-item-details">
          <div class="queue-title-row">
            <strong class="queue-filename" title="${item.filename}">${item.filename}</strong>
            <button type="button" class="btn-queue-rm" title="${rmTitle}">${getXSvg(12)}</button>
          </div>
          <div class="queue-meta-row">
            <small class="target-badge-wrapper" title="Carpeta de destino">${getFolderSvg(12)} <input type="text" class="queue-folder-input" value="${item.folder}" title="Haz clic para cambiar la carpeta de destino" /></small>
            <span class="queue-dims"></span>
            <span class="queue-size">${item.size ? getHardDriveSvg(11) + ' <span>' + formatBytes(item.size) + '</span>' : ''}</span>
          </div>
        </div>
      </div>
      <div class="queue-item-footer">
        <button type="button" class="btn-queue-dl" title="${dlText}">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>${dlText}</span>
        </button>
      </div>
    `);

    const img = li.querySelector(".queue-thumb");
    if (img) {
      img.onload = function() {
        if (this.naturalWidth && this.naturalHeight) {
          const dimsElem = li.querySelector(".queue-dims");
          if (dimsElem) {
            setHTML(dimsElem, `${getMaximizeSvg(11)} <span>${this.naturalWidth}×${this.naturalHeight}px</span>`);
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

    const rmBtn = li.querySelector(".btn-queue-rm");
    if (rmBtn) {
      rmBtn.addEventListener("click", () => removeFromQueue(item.id));
    }

    const dlBtn = li.querySelector(".btn-queue-dl");
    if (dlBtn) {
      dlBtn.addEventListener("click", () => processSingleQueueItem(item.id));
    }

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