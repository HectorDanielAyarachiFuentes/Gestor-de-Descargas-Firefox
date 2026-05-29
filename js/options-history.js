import { showStatus } from './options-ui.js';
const api = typeof browser !== 'undefined' ? browser : chrome;

let fullHistory = [];

export function updateHistory() {
  api.storage.local.get({ downloadHistory: [] }, (result) => {
    fullHistory = result.downloadHistory;
    renderHistoryList(fullHistory);
    renderDashboard(fullHistory);
  });
}

function renderDashboard(history) {
  const dashboard = document.getElementById("history-dashboard");
  const foldersList = document.getElementById("stats-folders");
  const extList = document.getElementById("stats-extensions");
  if (!dashboard || !foldersList || !extList) return;

  if (history.length === 0) {
    dashboard.style.display = "none";
    return;
  }
  dashboard.style.display = "block";

  const folderCounts = {};
  const extCounts = {};

  history.forEach(item => {
    if (item.folder) {
      folderCounts[item.folder] = (folderCounts[item.folder] || 0) + 1;
    }
    if (item.filename) {
      const extMatch = item.filename.match(/\.([a-z0-9]+)$/i);
      if (extMatch) {
        const ext = extMatch[1].toLowerCase();
        extCounts[ext] = (extCounts[ext] || 0) + 1;
      }
    }
  });

  const sortedFolders = Object.entries(folderCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sortedExts = Object.entries(extCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  foldersList.innerHTML = sortedFolders.map(([folder, count]) => `
    <li style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">📁 ${folder}</span>
      <span style="font-weight:bold; color:var(--primary-color);">${count}</span>
    </li>
  `).join('');

  extList.innerHTML = sortedExts.map(([ext, count]) => `
    <li style="display:flex; justify-content:space-between; margin-bottom:4px;">
      <span style="text-transform:uppercase;">📄 .${ext}</span>
      <span style="font-weight:bold; color:var(--primary-color);">${count}</span>
    </li>
  `).join('');
}

export function filterHistory(query) {
  if (!query) {
    renderHistoryList(fullHistory);
    return;
  }
  const filtered = fullHistory.filter(entry =>
    entry.filename.toLowerCase().includes(query) ||
    entry.folder.toLowerCase().includes(query) ||
    (entry.date && new Date(entry.date).toLocaleString().toLowerCase().includes(query))
  );
  renderHistoryList(filtered);
}

export function renderHistoryList(historyArray) {
  const historyList = document.getElementById("downloadHistory");
  historyList.innerHTML = "";
  if (!historyArray.length) {
    historyList.innerHTML = `<li class="history-list-empty-message">${api.i18n.getMessage("feedback_noHistoryResults")}</li>`;
    return;
  }
  const reversed = [...historyArray].reverse();
  reversed.forEach(entry => {
    const listItem = document.createElement("li");
    const textSpan = document.createElement("span");
    textSpan.className = "history-item-text";
    const displayDate = entry.date ? new Date(entry.date).toLocaleString() : api.i18n.getMessage("label_invalidDate");
    textSpan.textContent = `${displayDate}: ${entry.filename} → ${entry.folder}`;
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "history-item-actions";
    if (entry.id !== undefined && entry.id !== null) {
      const openFolderBtn = document.createElement("button");
      openFolderBtn.textContent = api.i18n.getMessage("button_openContainingFolder");
      openFolderBtn.addEventListener("click", () => openFolderInExplorer(entry.id));
      actionsDiv.appendChild(openFolderBtn);
    }
    if (entry.url) {
      const reDownloadBtn = document.createElement("button");
      reDownloadBtn.textContent = api.i18n.getMessage("redownloadButton");
      reDownloadBtn.addEventListener("click", () => {
        api.storage.local.get({ forceNextDownload: {} }, (data) => {
            let organizeUrls = data.forceNextDownload.organizeUrls || [];
            organizeUrls.push(entry.url);
            api.storage.local.set({ forceNextDownload: { ...data.forceNextDownload, organizeUrls } }, () => {
                api.downloads.download({ url: entry.url });
            });
        });
      });
      actionsDiv.appendChild(reDownloadBtn);
      const copyLinkBtn = document.createElement("button");
      copyLinkBtn.textContent = api.i18n.getMessage("button_copyLink");
      copyLinkBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(entry.url)
          .then(() => showStatus(api.i18n.getMessage("feedback_linkCopied"), "success"))
          .catch(err => showStatus(api.i18n.getMessage("feedback_errorCopyLink"), "error"));
      });
      actionsDiv.appendChild(copyLinkBtn);
    }
    listItem.appendChild(textSpan);
    listItem.appendChild(actionsDiv);
    historyList.appendChild(listItem);
  });
}

export function clearHistory() {
  if (confirm(api.i18n.getMessage("confirmClearHistory"))) {
    api.storage.local.set({ downloadHistory: [] }, () => {
      showStatus(api.i18n.getMessage("statusHistoryCleared"), "success");
    });
  }
}

export function openFolderInExplorer(downloadId) {
  const numId = Number(downloadId);
  if (isNaN(numId)) {
    showStatus(api.i18n.getMessage("feedback_errorInvalidDownloadId"), "error");
    return;
  }
  api.downloads.search({ id: numId }, (results) => {
    if (api.runtime.lastError) {
      showStatus(api.i18n.getMessage("feedback_errorSearchingDownload", api.runtime.lastError.message), "error");
      return;
    }
    if (!results || !results.length) {
      showStatus(api.i18n.getMessage("feedback_errorNotInHistory"), "info");
      return;
    }
    if (!results[0].exists) {
      showStatus(api.i18n.getMessage("feedback_errorFileNotExists"), "error");
      return;
    }
    api.downloads.show(numId);
  });
}

function getFolderNameByI18n(ext, defaultCats = {}) {
  const cats = {
    pdf: true, images: true, video: true, audio: true,
    compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true,
    ...defaultCats
  };
  const keyMap = {
    'pdf': cats.pdf ? 'folder_pdfs' : null,
    'jpg': cats.images ? 'folder_images' : null, 'jpeg': cats.images ? 'folder_images' : null, 'png': cats.images ? 'folder_images' : null, 'gif': cats.images ? 'folder_images' : null, 'webp': cats.images ? 'folder_images' : null,
    'mp4': cats.video ? 'folder_videos' : null, 'mkv': cats.video ? 'folder_videos' : null, 'avi': cats.video ? 'folder_videos' : null, 'webm': cats.video ? 'folder_videos' : null,
    'mp3': cats.audio ? 'folder_audio' : null, 'wav': cats.audio ? 'folder_audio' : null, 'ogg': cats.audio ? 'folder_audio' : null,
    'zip': cats.compressed ? 'folder_compressed' : null, 'rar': cats.compressed ? 'folder_compressed' : null, '7z': cats.compressed ? 'folder_compressed' : null,
    'docx': cats.documents ? 'folder_documents' : null, 'doc': cats.documents ? 'folder_documents' : null, 'odt': cats.documents ? 'folder_documents' : null,
    'txt': cats.documents ? 'folder_text' : null, 'md': cats.documents ? 'folder_text' : null,
    'csv': cats.spreadsheets ? 'folder_spreadsheets' : null, 'xlsx': cats.spreadsheets ? 'folder_spreadsheets' : null, 'xls': cats.spreadsheets ? 'folder_spreadsheets' : null,
    'ppt': cats.presentations ? 'folder_presentations' : null, 'pptx': cats.presentations ? 'folder_presentations' : null, 'odp': cats.presentations ? 'folder_presentations' : null,
    'exe': cats.programs ? 'folder_programs' : null, 'msi': cats.programs ? 'folder_programs' : null,
    'js': null, 'html': null, 'css': null, 'py': null, 'json': null
  };
  const i18nKey = keyMap[ext];
  if (i18nKey === undefined) return null;
  return i18nKey ? api.i18n.getMessage(i18nKey) : null;
}

export function setupOnDemandOrganizer() {
  const scanBtn = document.getElementById("scanHistoryBtn");
  const researchBtn = document.getElementById("researchBtn");
  const loadingSpinner = document.getElementById("scanner-loading");
  const resultsContainer = document.getElementById("scanResultsContainer");
  const resultsList = document.getElementById("scanResultsList");
  const organizeBtn = document.getElementById("organizeSelectedBtn");
  const cancelBtn = document.getElementById("cancelScanBtn");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");

  if(!scanBtn) return;

  scanBtn.addEventListener("click", scanHistoryAndSuggest);
  researchBtn.addEventListener("click", scanHistoryAndSuggest);
  organizeBtn.addEventListener("click", organizeSelectedFiles);
  cancelBtn.addEventListener("click", exitScanMode);

  selectAllCheckbox.addEventListener("change", (event) => {
    const isChecked = event.target.checked;
    document.querySelectorAll('#scanResultsList input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = isChecked;
    });
  });

  resultsList.addEventListener('click', (event) => {
    if (event.target.type === 'checkbox') updateSelectAllCheckboxState();
  });

  function exitScanMode() {
    resultsContainer.style.display = "none";
    loadingSpinner.style.display = "none";
    researchBtn.style.display = "none";
    scanBtn.style.display = "inline-block";
    resultsList.innerHTML = "";
  }

  function updateSelectAllCheckboxState() {
    const allCheckboxes = document.querySelectorAll('#scanResultsList input[type="checkbox"]');
    const checkedCount = document.querySelectorAll('#scanResultsList input[type="checkbox"]:checked').length;
    if (allCheckboxes.length > 0) {
      selectAllCheckbox.checked = checkedCount === allCheckboxes.length;
      selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  async function scanHistoryAndSuggest() {
    scanBtn.style.display = "none";
    researchBtn.style.display = "none";
    loadingSpinner.style.display = "block";

    const startDate = document.getElementById("filterStartDate").value;
    const endDate = document.getElementById("filterEndDate").value;
    const forceInclude = document.getElementById("forceInclude").checked;

    const query = { orderBy: ['-startTime'] };
    if (startDate) query.startedAfter = new Date(startDate + 'T00:00:00').toISOString();
    if (endDate) query.startedBefore = new Date(endDate + 'T23:59:59.999').toISOString();

    const { autoOrganize = true, customRules = [], customCategories = [], defaultCategories = {} } = await api.storage.sync.get(['autoOrganize', 'customRules', 'customCategories', 'defaultCategories']);

    if (!autoOrganize) {
      exitScanMode();
      showStatus(api.i18n.getMessage("feedback_autoOrganizeDisabled"), "error");
      return;
    }

    api.downloads.search(query, (downloadItems) => {
      const filteredFiles = downloadItems.filter(item => {
        const passesExistenceCheck = forceInclude || item.exists;
        return passesExistenceCheck && item.state === 'complete';
      });

      const suggestions = filteredFiles.map(item => {
        let suggestedFolder = null;
        const baseFilename = item.filename.split(/[\\/]/).pop();

        for (const rule of customRules) {
          const ruleValue = (rule.value || '').toLowerCase();
          if (!ruleValue) continue;
          if (rule.type === 'keyword' && baseFilename.toLowerCase().includes(ruleValue)) { suggestedFolder = rule.folder; break; }
          if (rule.type === 'url' && item.url.toLowerCase().includes(ruleValue)) { suggestedFolder = rule.folder; break; }
        }

        if (!suggestedFolder && customCategories.length > 0) {
          const ext = (baseFilename.split('.').pop() || "").toLowerCase();
          for (const cat of customCategories) {
            if (cat.extensions.includes(ext)) { suggestedFolder = cat.folder; break; }
          }
        }

        if (!suggestedFolder) {
          const ext = (baseFilename.split('.').pop() || "").toLowerCase();
          suggestedFolder = getFolderNameByI18n(ext, defaultCategories);
        }
        return { ...item, suggestedFolder };
      }).filter(item => item.suggestedFolder);

      loadingSpinner.style.display = "none";
      document.getElementById("scanResultsTitle").textContent = api.i18n.getMessage("title_scanResults", String(suggestions.length));
      renderScanResults(suggestions);
      resultsContainer.style.display = "block";
      researchBtn.style.display = "inline-block";
    });
  }

  function renderScanResults(files) {
    resultsList.innerHTML = "";
    if (files.length === 0) {
      resultsList.innerHTML = `<li class="history-list-empty-message">${api.i18n.getMessage("feedback_noScanResults")}</li>`;
      document.getElementById("organizeSelectedBtn").style.display = 'none';
    } else {
      document.getElementById("organizeSelectedBtn").style.display = 'inline-block';
      files.forEach(file => {
        const li = document.createElement("li");
        li.className = "scan-result-item";
        li.innerHTML = `<input type="checkbox" data-url="${file.url}" checked> <span class="history-item-text">${file.filename} → <strong>📂 ${file.suggestedFolder}</strong></span>`;
        resultsList.appendChild(li);
      });
    }
    updateSelectAllCheckboxState();
  }

  function organizeSelectedFiles() {
    const selectedCheckboxes = document.querySelectorAll('#scanResultsList input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
      showStatus(api.i18n.getMessage("feedback_selectAtLeastOneFile"), "info");
      return;
    }
    let urls = [];
    let organizedCount = 0;
    selectedCheckboxes.forEach(checkbox => {
      const url = checkbox.dataset.url;
      if (url) {
        urls.push(url);
        organizedCount++;
      }
    });

    if (urls.length > 0) {
        api.storage.local.get({ forceNextDownload: {} }, (data) => {
            let organizeUrls = data.forceNextDownload.organizeUrls || [];
            organizeUrls = organizeUrls.concat(urls);
            api.storage.local.set({ forceNextDownload: { ...data.forceNextDownload, organizeUrls } }, () => {
                urls.forEach(url => api.downloads.download({ url: url, conflictAction: 'uniquify' }));
                showStatus(api.i18n.getMessage("feedback_organizationStarted", String(organizedCount)), "success");
                exitScanMode();
            });
        });
    } else {
        showStatus(api.i18n.getMessage("feedback_organizationStarted", String(organizedCount)), "success");
        exitScanMode();
    }
  }
}
