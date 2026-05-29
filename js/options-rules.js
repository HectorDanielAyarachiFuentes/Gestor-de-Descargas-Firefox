import { showStatus } from './options-ui.js';
import { setHTML } from './utils.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

let renamePatternComponents = [];
let editingRuleId = null;
let customExtCategories = [];
let editingCustomExtId = null;
let rulesSortable = null;
let extSortable = null;

// ===============================================
// LÓGICA DE EXPORTAR / IMPORTAR
// ===============================================
export function exportRules() {
  api.storage.sync.get({ customRules: [] }, (data) => {
    if (data.customRules.length === 0) {
      showStatus(api.i18n.getMessage("feedback_noRulesToExport"), "info");
      return;
    }
    const jsonString = JSON.stringify(data.customRules, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "descargas-en-orden-reglas.json";
    a.click();
    URL.revokeObjectURL(url);
    showStatus(api.i18n.getMessage("feedback_rulesExported"), "success");
  });
}

export function importRules(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const newRules = JSON.parse(e.target.result);
      if (!Array.isArray(newRules)) throw new Error(api.i18n.getMessage("error_importWrongFormat"));
      if (confirm(api.i18n.getMessage("confirm_importOverwrite"))) {
        const rulesWithId = newRules.map(rule => ({ ...rule, id: rule.id || `rule_${Date.now()}_${Math.random()}` }));
        api.storage.sync.set({ customRules: rulesWithId }, () => {
          showStatus(api.i18n.getMessage("feedback_rulesImported"), "success");
          loadCustomRules();
        });
      }
    } catch (error) {
      showStatus(api.i18n.getMessage("feedback_errorImport", error.message), "error");
    } finally {
      event.target.value = null;
    }
  };
  reader.readAsText(file);
}

// ===============================================
// LÓGICA DE REGLAS AVANZADAS
// ===============================================

export function setupDynamicPlaceholders() {
  const ruleTypeSelect = document.getElementById("ruleType");
  const ruleValueInput = document.getElementById("ruleValue");
  if (!ruleTypeSelect || !ruleValueInput) return;

  ruleTypeSelect.addEventListener("change", () => {
    const selectedType = ruleTypeSelect.value;
    if (selectedType === "keyword") ruleValueInput.placeholder = api.i18n.getMessage("ruleValuePlaceholder");
    else if (selectedType === "url") ruleValueInput.placeholder = api.i18n.getMessage("placeholder_urlExample");
  });
}

export async function enterEditMode(ruleId) {
  const { customRules = [] } = await api.storage.sync.get('customRules');
  const ruleToEdit = customRules.find(r => r.id === ruleId);
  if (!ruleToEdit) {
    showStatus(api.i18n.getMessage("feedback_errorRuleNotFound"), "error");
    return;
  }

  editingRuleId = ruleId;
  document.getElementById("ruleType").value = ruleToEdit.type;
  document.getElementById("ruleValue").value = ruleToEdit.value;
  document.getElementById("ruleFolder").value = ruleToEdit.folder;
  document.getElementById("ruleUseRegex").checked = !!ruleToEdit.useRegex;
  document.getElementById("ruleMinSize").value = ruleToEdit.minSize || "";
  document.getElementById("ruleMaxSize").value = ruleToEdit.maxSize || "";

  renamePatternComponents = parseRenamePattern(ruleToEdit.renamePattern || "");
  renderPatternPreview();

  document.getElementById("rule-form-title").textContent = api.i18n.getMessage("title_editingRule");
  document.getElementById("addRuleBtn").style.display = "none";
  document.getElementById("updateRuleBtn").style.display = "inline-block";
  document.getElementById("cancelEditBtn").style.display = "inline-block";
  document.getElementById("rule-form-section").scrollIntoView({ behavior: 'smooth' });
}

export function exitEditMode() {
  editingRuleId = null;
  document.getElementById("ruleType").value = "keyword";
  document.getElementById("ruleValue").value = "";
  document.getElementById("ruleFolder").value = "";
  document.getElementById("ruleUseRegex").checked = false;
  document.getElementById("ruleMinSize").value = "";
  document.getElementById("ruleMaxSize").value = "";
  clearRenameBuilder();

  document.getElementById("rule-form-title").textContent = api.i18n.getMessage("newCustomRuleTitle");
  document.getElementById("addRuleBtn").style.display = "inline-block";
  document.getElementById("updateRuleBtn").style.display = "none";
  document.getElementById("cancelEditBtn").style.display = "none";
}

export function loadCustomRules() {
  api.storage.sync.get({ customRules: [] }, (data) => {
    let rules = data.customRules;
    let migrationNeeded = false;
    rules.forEach(rule => {
      if (!rule.id) {
        rule.id = `rule_${Date.now()}_${Math.random()}`;
        migrationNeeded = true;
      }
    });

    if (migrationNeeded) {
      api.storage.sync.set({ customRules: rules }, () => renderRulesList(rules));
    } else {
      renderRulesList(rules);
    }
  });
}

export function renderRulesList(rulesArray) {
  const rulesList = document.getElementById("rulesList");
  if(!rulesList) return;
  rulesList.textContent = "";
  if (!rulesArray || !rulesArray.length) {
    setHTML(rulesList, `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <h4>No hay Reglas Avanzadas</h4>
        <p>Crea reglas complejas basadas en nombes de archivo o URL de origen arriba.</p>
      </div>
    `);
    return;
  }

  rulesArray.forEach((rule) => {
    const li = document.createElement("li");
    li.dataset.id = rule.id;

    const typeStr = rule.type === 'url' ? api.i18n.getMessage('ruleDesc_url') : api.i18n.getMessage('ruleDesc_name');
    let ruleText = `${api.i18n.getMessage('ruleDesc_if')} <b>${typeStr}</b> ${rule.useRegex ? 'cumple regex' : api.i18n.getMessage('ruleDesc_contains')} "<b>${rule.value}</b>", ${api.i18n.getMessage('ruleDesc_saveIn')} "<b>${rule.folder}</b>"`;
    if (rule.minSize) ruleText += ` (Mín: ${rule.minSize}MB)`;
    if (rule.maxSize) ruleText += ` (Máx: ${rule.maxSize}MB)`;
    if (rule.renamePattern) ruleText += ` ${api.i18n.getMessage('ruleDesc_andRenameAs')} "<b>${rule.renamePattern}</b>"`;
    setHTML(li, `<span class="history-item-text">${ruleText}</span>`);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "history-item-actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = api.i18n.getMessage("editButton");
    editBtn.addEventListener("click", () => enterEditMode(rule.id));
    actionsDiv.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = api.i18n.getMessage("deleteButton");
    deleteBtn.style.backgroundColor = "var(--error-bg-color)";
    deleteBtn.style.borderColor = "var(--error-border-color)";
    deleteBtn.style.color = "var(--error-text-color)";
    deleteBtn.addEventListener("click", () => removeRule(rule.id));
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(actionsDiv);
    rulesList.appendChild(li);
  });

  if (rulesSortable) rulesSortable.destroy();
  if (window.Sortable) {
    rulesSortable = new Sortable(rulesList, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: (e) => saveRulesOrder(e.target)
    });
  }
}

export function addRule() {
  const type = document.getElementById("ruleType").value;
  const value = document.getElementById("ruleValue").value.trim();
  const folder = document.getElementById("ruleFolder").value.trim();
  const useRegex = document.getElementById("ruleUseRegex").checked;
  const minSize = parseFloat(document.getElementById("ruleMinSize").value) || null;
  const maxSize = parseFloat(document.getElementById("ruleMaxSize").value) || null;
  const renamePattern = getRenamePatternString();

  if (!value || !folder) {
    showStatus(api.i18n.getMessage("feedback_errorCompleteFields"), "error");
    return;
  }

  api.storage.sync.get({ customRules: [] }, (data) => {
    const newRule = { id: `rule_${Date.now()}`, type, value, folder, useRegex, minSize, maxSize, renamePattern };
    const newRules = [...data.customRules, newRule];
    api.storage.sync.set({ customRules: newRules }, () => {
      showStatus(api.i18n.getMessage("statusRuleAdded"), "success");
      exitEditMode();
    });
  });
}

export function updateRule() {
  if (!editingRuleId) return;
  const type = document.getElementById("ruleType").value;
  const value = document.getElementById("ruleValue").value.trim();
  const folder = document.getElementById("ruleFolder").value.trim();
  const useRegex = document.getElementById("ruleUseRegex").checked;
  const minSize = parseFloat(document.getElementById("ruleMinSize").value) || null;
  const maxSize = parseFloat(document.getElementById("ruleMaxSize").value) || null;
  const renamePattern = getRenamePatternString();

  if (!value || !folder) {
    showStatus(api.i18n.getMessage("feedback_errorCompleteFields"), "error");
    return;
  }

  api.storage.sync.get({ customRules: [] }, (data) => {
    const rules = data.customRules;
    const ruleIndex = rules.findIndex(r => r.id === editingRuleId);
    if (ruleIndex === -1) {
      showStatus(api.i18n.getMessage("feedback_errorUpdateNotFound"), "error");
      exitEditMode();
      return;
    }

    rules[ruleIndex] = { id: editingRuleId, type, value, folder, useRegex, minSize, maxSize, renamePattern };
    api.storage.sync.set({ customRules: rules }, () => {
      showStatus(api.i18n.getMessage("statusRuleUpdated"), "success");
      exitEditMode();
    });
  });
}

function removeRule(ruleId) {
  if (!ruleId) {
    showStatus(api.i18n.getMessage("feedback_errorDeleteNoId"), "error");
    return;
  }
  api.storage.sync.get({ customRules: [] }, (data) => {
    const newRules = data.customRules.filter(rule => rule.id !== ruleId);
    api.storage.sync.set({ customRules: newRules }, () => showStatus(api.i18n.getMessage("statusRuleDeleted"), "success"));
  });
}

async function saveRulesOrder(rulesListElement) {
  const newRulesOrder = [];
  const listItems = rulesListElement.querySelectorAll("li");
  const { customRules = [] } = await api.storage.sync.get('customRules');

  listItems.forEach(item => {
    const ruleId = item.dataset.id;
    if (ruleId) {
      const foundRule = customRules.find(r => r.id === ruleId);
      if (foundRule) newRulesOrder.push(foundRule);
    }
  });

  if (newRulesOrder.length !== customRules.length) {
    const orderedIds = new Set(newRulesOrder.map(r => r.id));
    const unorderedRules = customRules.filter(r => !orderedIds.has(r.id));
    newRulesOrder.push(...unorderedRules);
  }

  api.storage.sync.set({ customRules: newRulesOrder });
}

// ===============================================
// LÓGICA DE RENAME BUILDER
// ===============================================

function parseRenamePattern(pattern) {
  if (!pattern) return [];
  const components = [];
  const regex = /(\[sitio\]|\[nombre_original\]|\[fecha:[^\]]+\])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(pattern)) !== null) {
    if (match.index > lastIndex) components.push(createComponent('text', pattern.substring(lastIndex, match.index)));
    const token = match[0];
    if (token.startsWith('[fecha:')) components.push(createComponent('fecha', token.substring(7, token.length - 1)));
    else if (token === '[sitio]') components.push(createComponent('sitio', '[sitio]'));
    else if (token === '[nombre_original]') components.push(createComponent('nombre_original', '[nombre_original]'));
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < pattern.length) components.push(createComponent('text', pattern.substring(lastIndex)));
  return components;
}

export function setupRenameBuilder() {
  const previewContainer = document.getElementById("rename-pattern-preview");
  const pillsContainer = document.getElementById("rename-pills-container");
  if (!previewContainer || !pillsContainer) return;

  if (window.Sortable) {
    new Sortable(previewContainer, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      onEnd: () => {
        const newOrder = [];
        previewContainer.querySelectorAll('.pattern-component').forEach(el => newOrder.push(renamePatternComponents.find(c => c.id === el.id)));
        renamePatternComponents = newOrder;
      }
    });
  }

  pillsContainer.addEventListener("click", (event) => {
    const button = event.target.closest(".variable-pill");
    if (!button || button.id === 'add-date-format-btn') return;
    const type = button.dataset.type;
    let component;
    switch (type) {
      case 'text':
        const text = prompt(api.i18n.getMessage("prompt_enterFreeText"), "_");
        if (text) component = createComponent('text', text);
        break;
      case 'sitio': component = createComponent('sitio', '[sitio]'); break;
      case 'nombre_original': component = createComponent('nombre_original', '[nombre_original]'); break;
    }
    if (component) addComponentToBuilder(component);
  });

  previewContainer.addEventListener("click", (event) => {
    if (event.target.classList.contains("remove-component-btn")) {
      const componentId = event.target.parentElement.id;
      renamePatternComponents = renamePatternComponents.filter(c => c.id !== componentId);
      renderPatternPreview();
    }
  });
}

function createComponent(type, value) { return { id: `comp_${Date.now()}_${Math.random()}`, type, value }; }

function addComponentToBuilder(component) {
  renamePatternComponents.push(component);
  renderPatternPreview();
}

function renderPatternPreview() {
  const previewContainer = document.getElementById("rename-pattern-preview");
  if(!previewContainer) return;
  previewContainer.textContent = "";
  previewContainer.classList.remove('is-empty');

  if (renamePatternComponents.length === 0) {
    previewContainer.textContent = api.i18n.getMessage("renamePreviewPlaceholder");
    previewContainer.classList.add('is-empty');
  } else {
    renamePatternComponents.forEach(component => {
      const el = document.createElement("div");
      el.className = "pattern-component";
      el.id = component.id;
      el.dataset.type = component.type;

      let displayValue = component.value;
      if (component.type === 'fecha') displayValue = api.i18n.getMessage("label_dateComponent", component.value);
      else if (component.type === 'sitio') displayValue = api.i18n.getMessage("addSiteComponent").replace('+', '').trim();
      else if (component.type === 'nombre_original') displayValue = api.i18n.getMessage("addOriginalNameComponent").replace('+', '').trim();

      setHTML(el, `<span>${displayValue}</span><button type="button" class="remove-component-btn" title="${api.i18n.getMessage("tooltip_removeComponent")}">✖</button>`);
      previewContainer.appendChild(el);
    });
  }
}

function getRenamePatternString() {
  return renamePatternComponents.map(c => {
    if (c.type === 'fecha') return `[fecha:${c.value}]`;
    return c.value;
  }).join('');
}

function clearRenameBuilder() {
  renamePatternComponents = [];
  renderPatternPreview();
}

export function setupDateFormatModal() {
  const modal = document.getElementById("date-format-modal");
  const openBtn = document.getElementById("add-date-format-btn");
  const cancelBtn = document.getElementById("cancel-format-btn");
  const insertBtn = document.getElementById("insert-format-btn");
  const customFormatInput = document.getElementById("custom-format-input");
  const previewText = document.getElementById("format-preview-text");
  const formatBuilder = document.querySelector(".format-builder");

  const updatePreview = () => {
    const format = customFormatInput.value;
    previewText.textContent = format ? formatDate(new Date(), format) : "";
  };

  if (!openBtn) return;
  openBtn.addEventListener("click", () => { customFormatInput.value = "YYYY-MM-DD"; updatePreview(); modal.style.display = "flex"; });

  const closeModal = () => modal.style.display = "none";
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

  formatBuilder.addEventListener("click", (event) => {
    const target = event.target;
    if (target.classList.contains("preset-pill")) customFormatInput.value = target.dataset.format;
    else if (target.classList.contains("format-code-pill")) insertTextAtCursor(customFormatInput, target.dataset.code);
    updatePreview();
  });

  customFormatInput.addEventListener("input", updatePreview);
  insertBtn.addEventListener("click", () => {
    if (customFormatInput.value) addComponentToBuilder(createComponent('fecha', customFormatInput.value));
    closeModal();
  });
}

function insertTextAtCursor(inputElement, text) {
  const startPos = inputElement.selectionStart;
  const endPos = inputElement.selectionEnd;
  const currentValue = inputElement.value;
  inputElement.value = currentValue.substring(0, startPos) + text + currentValue.substring(endPos);
  inputElement.focus();
  const newCursorPos = startPos + text.length;
  inputElement.setSelectionRange(newCursorPos, newCursorPos);
}

function formatDate(date, format) {
  const map = {
    YYYY: date.getFullYear(), YY: String(date.getFullYear()).slice(-2), MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'), hh: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'), ss: String(date.getSeconds()).padStart(2, '0'),
  };
  return format.replace(/YYYY|YY|MM|DD|hh|mm|ss/g, match => map[match]);
}

// ===============================================
// LÓGICA PARA CATEGORÍAS EXTENSIONES
// ===============================================

export function loadCustomExtCategories() {
  api.storage.sync.get({ customCategories: [] }, (data) => {
    customExtCategories = data.customCategories;
    renderCustomExtList(customExtCategories);
  });
}

function processExtensionsString(extsStr) {
  return extsStr.split(',').map(e => e.trim().toLowerCase().replace(/^\./, '')).filter(e => e);
}

function renderCustomExtList(categoriesArray) {
  const listElement = document.getElementById("customExtList");
  if(!listElement) return;
  listElement.textContent = "";
  if (!categoriesArray || !categoriesArray.length) {
    setHTML(listElement, `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        <h4>Aún no tienes reglas de extensión</h4>
        <p>Agrega extensiones arriba para empezar a organizar automáticamente.</p>
      </div>
    `);
    return;
  }

  categoriesArray.forEach((cat) => {
    const li = document.createElement("li");
    li.dataset.id = cat.id;
    setHTML(li, `<span class="history-item-text">Si detecta <b>${cat.extensions.join(', ')}</b>, guardar en "<b>${cat.folder}</b>"</span>`);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "history-item-actions";

    const editBtn = document.createElement("button");
    editBtn.textContent = api.i18n.getMessage("editButton");
    editBtn.addEventListener("click", () => enterCustomExtEditMode(cat.id));
    actionsDiv.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = api.i18n.getMessage("deleteButton");
    deleteBtn.style.backgroundColor = "var(--error-bg-color)";
    deleteBtn.style.borderColor = "var(--error-border-color)";
    deleteBtn.style.color = "var(--error-text-color)";
    deleteBtn.addEventListener("click", () => removeCustomExt(cat.id));
    actionsDiv.appendChild(deleteBtn);

    li.appendChild(actionsDiv);
    listElement.appendChild(li);
  });

  if (extSortable) extSortable.destroy();
  if (window.Sortable) {
    extSortable = new Sortable(listElement, { animation: 150, ghostClass: 'sortable-ghost', onEnd: (e) => saveCustomExtOrder(e.target) });
  }
}

export function addCustomExtCategory() {
  const folder = document.getElementById("customExtFolder").value.trim();
  const extensions = processExtensionsString(document.getElementById("customExtExts").value);

  if (!folder || extensions.length === 0) {
    showStatus(api.i18n.getMessage("feedback_errorCustomExtFields"), "error");
    return;
  }

  api.storage.sync.get({ customCategories: [] }, (data) => {
    const newCategories = [...data.customCategories, { id: `extcat_${Date.now()}`, folder, extensions }];
    api.storage.sync.set({ customCategories: newCategories }, () => {
      showStatus(api.i18n.getMessage("statusRuleAdded"), "success");
      exitCustomExtEditMode();
    });
  });
}

export function updateCustomExtCategory() {
  if (!editingCustomExtId) return;
  const folder = document.getElementById("customExtFolder").value.trim();
  const extensions = processExtensionsString(document.getElementById("customExtExts").value);

  if (!folder || extensions.length === 0) {
    showStatus(api.i18n.getMessage("feedback_errorCustomExtFields"), "error");
    return;
  }

  api.storage.sync.get({ customCategories: [] }, (data) => {
    const categories = data.customCategories;
    const index = categories.findIndex(c => c.id === editingCustomExtId);
    if (index === -1) { exitCustomExtEditMode(); return; }

    categories[index] = { id: editingCustomExtId, folder, extensions };
    api.storage.sync.set({ customCategories: categories }, () => {
      showStatus(api.i18n.getMessage("statusRuleUpdated"), "success");
      exitCustomExtEditMode();
    });
  });
}

function removeCustomExt(id) {
  api.storage.sync.get({ customCategories: [] }, (data) => {
    const newCategories = data.customCategories.filter(c => c.id !== id);
    api.storage.sync.set({ customCategories: newCategories }, () => showStatus(api.i18n.getMessage("statusRuleDeleted"), "success"));
  });
}

async function saveCustomExtOrder(listElement) {
  const newOrder = [];
  const listItems = listElement.querySelectorAll("li");
  const { customCategories = [] } = await api.storage.sync.get('customCategories');

  listItems.forEach(item => {
    const id = item.dataset.id;
    if (id) {
      const found = customCategories.find(c => c.id === id);
      if (found) newOrder.push(found);
    }
  });

  if (newOrder.length !== customCategories.length) {
    const orderedIds = new Set(newOrder.map(c => c.id));
    const unordered = customCategories.filter(c => !orderedIds.has(c.id));
    newOrder.push(...unordered);
  }
  api.storage.sync.set({ customCategories: newOrder });
}

function enterCustomExtEditMode(id) {
  api.storage.sync.get({ customCategories: [] }, (data) => {
    const cat = data.customCategories.find(c => c.id === id);
    if (!cat) return;
    editingCustomExtId = id;
    document.getElementById("customExtFolder").value = cat.folder;
    document.getElementById("customExtExts").value = cat.extensions.join(', ');
    document.getElementById("addCustomExtBtn").style.display = "none";
    document.getElementById("updateCustomExtBtn").style.display = "inline-block";
    document.getElementById("cancelCustomExtEditBtn").style.display = "inline-block";
    document.getElementById("custom-ext-categories-section").scrollIntoView({ behavior: 'smooth' });
  });
}

export function exitCustomExtEditMode() {
  editingCustomExtId = null;
  document.getElementById("customExtFolder").value = "";
  document.getElementById("customExtExts").value = "";
  document.getElementById("addCustomExtBtn").style.display = "inline-block";
  document.getElementById("updateCustomExtBtn").style.display = "none";
  document.getElementById("cancelCustomExtEditBtn").style.display = "none";
}
