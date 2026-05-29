// widget.js
import { truncateName, setHTML } from './utils.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

// Estado global del widget
const widgetState = {
    currentTab: 'visible',
    ignoredFolders: JSON.parse(localStorage.getItem("ignoredFolders")) || [],
    historyCache: []
};

export function initSmartWidget() {
    const widget = document.getElementById("floating-widget");
    if (!widget) return;

    initDraggableWidget();

    const collapseBtn = document.getElementById("widget-collapse-btn");
    if (collapseBtn) {
        collapseBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            widget.classList.toggle("collapsed");
        });
    }

    const tabVisible = document.getElementById("tab-visible");
    const tabHidden = document.getElementById("tab-hidden");

    if (tabVisible) tabVisible.addEventListener("click", () => switchTab('visible'));
    if (tabHidden) tabHidden.addEventListener("click", () => switchTab('hidden'));

    refreshWidgetData();

    api.downloads.onCreated.addListener(() => setTimeout(refreshWidgetData, 1000));
    api.downloads.onChanged.addListener(() => setTimeout(refreshWidgetData, 1000));
}

function switchTab(tab) {
    widgetState.currentTab = tab;
    document.getElementById("tab-visible").classList.toggle("active", tab === 'visible');
    document.getElementById("tab-hidden").classList.toggle("active", tab === 'hidden');
    renderSmartGrid();
}

async function refreshWidgetData() {
    const result = await api.storage.local.get({ downloadHistory: [] });
    widgetState.historyCache = result.downloadHistory || [];
    renderSmartGrid();
}

function renderSmartGrid() {
    const container = document.getElementById("widget-folders-grid");
    if (!container) return;
    
    container.textContent = "";

    const uniqueFolders = [...new Set(widgetState.historyCache.map(item => item.folder))].filter(Boolean);

    const foldersToShow = uniqueFolders.filter(folder => {
        const isIgnored = widgetState.ignoredFolders.includes(folder);
        return widgetState.currentTab === 'visible' ? !isIgnored : isIgnored;
    }).sort();

    if (foldersToShow.length === 0) {
        const isVisibleTab = widgetState.currentTab === 'visible';
        const msg = isVisibleTab
            ? api.i18n.getMessage("widgetMsgNoActive")
            : api.i18n.getMessage("widgetMsgTrashEmpty");

        const svgIcon = isVisibleTab
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

        setHTML(container, `
      <div class="empty-state" style="grid-column: 1/-1;">
        ${svgIcon}
        <h4>¡Todo limpio!</h4>
        <p>${msg}</p>
      </div>
    `);
        return;
    }

    foldersToShow.forEach(folderName => {
        const div = document.createElement("div");
        div.className = "win-item";
        div.title = `Abrir: ${folderName}`;

        const rightBtnClass = widgetState.currentTab === 'visible' ? 'btn-hide' : 'btn-show';
        const removeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
        const addSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
        const rightBtnIcon = widgetState.currentTab === 'visible' ? removeSvg : addSvg;
        const rightBtnTitle = widgetState.currentTab === 'visible' ? api.i18n.getMessage("widgetBtnMoveHidden") : api.i18n.getMessage("widgetBtnRestore");

        let htmlContent = `
            <button class="action-folder-btn ${rightBtnClass}" title="${rightBtnTitle}">${rightBtnIcon}</button>
            <div class="win-icon" style="color: var(--primary-color);">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path></svg>
            </div>
            <div class="win-label">${truncateName(folderName, 12)}</div>
        `;

        if (widgetState.currentTab === 'hidden') {
            const tooltip = api.i18n.getMessage("widgetBtnForget");
            const trashSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
            htmlContent += `<button class="delete-forever-btn" title="${tooltip}">${trashSvg}</button>`;
        }

        setHTML(div, htmlContent);

        div.addEventListener("click", (e) => {
            if (e.target.tagName === 'BUTTON') return;
            openResilientFolder(folderName);
        });

        div.querySelector('.action-folder-btn').addEventListener("click", (e) => {
            e.stopPropagation();
            toggleFolderVisibility(folderName);
        });

        const deleteBtn = div.querySelector('.delete-forever-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (confirm(api.i18n.getMessage("widgetConfirmForget", folderName))) {
                    forgetFolderForever(folderName);
                }
            });
        }

        container.appendChild(div);
    });
}

async function forgetFolderForever(folderName) {
    const result = await api.storage.local.get({ downloadHistory: [] });
    const history = result.downloadHistory;
    const newHistory = history.filter(item => item.folder !== folderName);

    await api.storage.local.set({ downloadHistory: newHistory });
    widgetState.ignoredFolders = widgetState.ignoredFolders.filter(f => f !== folderName);
    localStorage.setItem("ignoredFolders", JSON.stringify(widgetState.ignoredFolders));
    widgetState.historyCache = newHistory;
    renderSmartGrid();
}

function toggleFolderVisibility(folderName) {
    if (widgetState.ignoredFolders.includes(folderName)) {
        widgetState.ignoredFolders = widgetState.ignoredFolders.filter(f => f !== folderName);
    } else {
        widgetState.ignoredFolders.push(folderName);
    }
    localStorage.setItem("ignoredFolders", JSON.stringify(widgetState.ignoredFolders));
    renderSmartGrid();
}

async function openResilientFolder(folderName) {
    const filesInFolder = widgetState.historyCache.filter(item => item.folder === folderName).reverse();

    if (filesInFolder.length === 0) {
        alert(api.i18n.getMessage("widgetAlertNoFiles"));
        return;
    }

    let opened = false;
    document.body.style.cursor = 'wait';

    for (const file of filesInFolder) {
        if (!file.id) continue;
        const exists = await checkFileExists(file.id);
        if (exists) {
            api.downloads.show(file.id);
            opened = true;
            break;
        }
    }

    document.body.style.cursor = 'default';

    if (!opened) {
        if (confirm(api.i18n.getMessage("widgetConfirmGhost", folderName))) {
            toggleFolderVisibility(folderName);
        }
    }
}

async function checkFileExists(downloadId) {
    try {
        const results = await api.downloads.search({ id: downloadId });
        if (!results || !results.length) return false;
        return results[0].exists;
    } catch (e) {
        return false;
    }
}

function initDraggableWidget() {
    const widget = document.getElementById("floating-widget");
    const handle = document.getElementById("widget-drag-handle");
    const collapseBtn = document.getElementById("widget-collapse-btn");

    if (!widget || !handle) return;

    const savedPos = JSON.parse(localStorage.getItem("widgetPosition"));
    if (savedPos) {
        const wRect = widget.getBoundingClientRect();
        const clampedLeft = Math.max(0, Math.min(parseInt(savedPos.left) || 0, window.innerWidth - wRect.width));
        const clampedTop = Math.max(0, Math.min(parseInt(savedPos.top) || 0, window.innerHeight - wRect.height));
        widget.style.top = `${clampedTop}px`;
        widget.style.left = `${clampedLeft}px`;
        widget.style.right = 'auto';
    }

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.addEventListener("mousedown", (e) => {
        if (e.target === collapseBtn) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = widget.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        e.preventDefault();
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const wRect = widget.getBoundingClientRect();
        const maxLeft = window.innerWidth - wRect.width;
        const maxTop = window.innerHeight - wRect.height;
        const newLeft = Math.max(0, Math.min(initialLeft + dx, maxLeft));
        const newTop = Math.max(0, Math.min(initialTop + dy, maxTop));
        widget.style.left = `${newLeft}px`;
        widget.style.top = `${newTop}px`;
        widget.style.right = "auto";
        widget.style.bottom = "auto";
    }

    function onMouseUp() {
        if (isDragging) {
            isDragging = false;
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            localStorage.setItem("widgetPosition", JSON.stringify({
                top: widget.style.top,
                left: widget.style.left
            }));
        }
    }
}
