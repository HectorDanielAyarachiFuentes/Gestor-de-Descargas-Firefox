import { initSmartWidget } from './widget.js';
import { applyI18n } from './utils.js';
import { initTheme } from './theme-manager.js';
import { setupTabs, loadThemeSelector, showStatus, initTearEffect } from './options-ui.js';
import { 
  updateHistory, filterHistory, clearHistory, setupOnDemandOrganizer 
} from './options-history.js';
import {
  loadCustomRules, addRule, updateRule, exitEditMode, setupDynamicPlaceholders,
  setupRenameBuilder, setupDateFormatModal, loadCustomExtCategories, addCustomExtCategory,
  updateCustomExtCategory, exitCustomExtEditMode, exportRules, importRules
} from './options-rules.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();

  // Inicializar UI
  setupTabs();
  initTheme();
  loadThemeSelector();
  setTimeout(initTearEffect, 200);

  // Inicializar Componentes de Reglas
  setupDynamicPlaceholders();
  setupRenameBuilder();
  setupDateFormatModal();

  // Inicializar Historial
  setupOnDemandOrganizer();

  // Carga inicial de datos
  loadSettings();
  updateHistory();
  loadCustomRules();
  loadCustomExtCategories();

  // Listeners de Ajustes Generales
  document.getElementById("autoOrganize").addEventListener("change", (e) => saveSingleSetting('autoOrganize', e.target.checked));
  document.getElementById("contextMenu").addEventListener("change", (e) => saveSingleSetting('contextMenu', e.target.checked));
  document.getElementById("notifications").addEventListener("change", (e) => saveSingleSetting('notifications', e.target.value));

  const catIds = ['cat_pdf', 'cat_images', 'cat_video', 'cat_audio', 'cat_compressed', 'cat_documents', 'cat_spreadsheets', 'cat_presentations', 'cat_programs'];
  catIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveDefaultCategories);
  });

  // Listeners de Botones Principales
  document.getElementById("clearHistory").addEventListener("click", clearHistory);
  document.getElementById("addRuleBtn").addEventListener("click", addRule);
  document.getElementById("updateRuleBtn").addEventListener("click", updateRule);
  document.getElementById("cancelEditBtn").addEventListener("click", exitEditMode);
  document.getElementById("addCustomExtBtn").addEventListener("click", addCustomExtCategory);
  document.getElementById("updateCustomExtBtn").addEventListener("click", updateCustomExtCategory);
  document.getElementById("cancelCustomExtEditBtn").addEventListener("click", exitCustomExtEditMode);
  document.getElementById("exportRulesBtn").addEventListener("click", exportRules);
  document.getElementById("importRulesBtn").addEventListener("click", () => document.getElementById("importFileInput").click());
  document.getElementById("importFileInput").addEventListener("change", importRules);
  document.getElementById("searchHistory").addEventListener("input", (e) => filterHistory(e.target.value.toLowerCase()));

  // Listeners del background
  api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "showFeedback") {
      showStatus(request.message, request.success ? 'success' : 'error');
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') {
      if (changes.customRules) loadCustomRules();
      if (changes.customCategories) loadCustomExtCategories();
      if (changes.autoOrganize || changes.contextMenu || changes.notifications) loadSettings();
    }
    if (changes.downloadHistory) {
      updateHistory();
    }
  });

  initSmartWidget();
});

function loadSettings() {
  api.storage.sync.get({
    autoOrganize: true, notifications: 'always', contextMenu: true,
    defaultCategories: { pdf: true, images: true, video: true, audio: true, compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true }
  }, (data) => {
    document.getElementById("autoOrganize").checked = data.autoOrganize;
    document.getElementById("notifications").value = data.notifications;
    document.getElementById("contextMenu").checked = data.contextMenu;
    const cats = data.defaultCategories || {};
    document.getElementById("cat_pdf").checked = cats.pdf !== false;
    document.getElementById("cat_images").checked = cats.images !== false;
    document.getElementById("cat_video").checked = cats.video !== false;
    document.getElementById("cat_audio").checked = cats.audio !== false;
    document.getElementById("cat_compressed").checked = cats.compressed !== false;
    document.getElementById("cat_documents").checked = cats.documents !== false;
    document.getElementById("cat_spreadsheets").checked = cats.spreadsheets !== false;
    document.getElementById("cat_presentations").checked = cats.presentations !== false;
    document.getElementById("cat_programs").checked = cats.programs !== false;
  });
}

function saveSingleSetting(key, value) {
  api.storage.sync.set({ [key]: value }, () => showStatus(api.i18n.getMessage("statusSettingsSaved"), "success"));
}

function saveDefaultCategories() {
  const defaultCategories = {
    pdf: document.getElementById("cat_pdf").checked, images: document.getElementById("cat_images").checked, video: document.getElementById("cat_video").checked,
    audio: document.getElementById("cat_audio").checked, compressed: document.getElementById("cat_compressed").checked, documents: document.getElementById("cat_documents").checked,
    spreadsheets: document.getElementById("cat_spreadsheets").checked, presentations: document.getElementById("cat_presentations").checked, programs: document.getElementById("cat_programs").checked
  };
  api.storage.sync.set({ defaultCategories });
}
