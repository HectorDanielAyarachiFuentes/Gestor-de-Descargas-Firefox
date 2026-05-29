// options.js

import { initSmartWidget } from './widget.js';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from './constants.js';
import { applyI18n } from './utils.js';
import { initTheme, setThemePreference } from './theme-manager.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

// Nota: Sortable se carga como script clásico en options.html (window.Sortable)

function applyTranslations() {
    applyI18n();
}
// =====================
// Variables globales
// =====================
let fullHistory = [];
let renamePatternComponents = [];
let editingRuleId = null; // Para saber qué regla estamos editando
let customExtCategories = [];
let editingCustomExtId = null;

// Estado local
let rulesSortable = null;
let extSortable = null;


// =====================
// DOMContentLoaded
// =====================
document.addEventListener("DOMContentLoaded", () => {
  applyI18n(); // <-- Llama a la función de traducción

  // Carga inicial
  loadSettings();
  updateHistory();
  loadCustomRules();
  loadCustomExtCategories();

  // --- NUEVA LÓGICA: Pestañas de la Opciones ---
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Remover active de todos
      tabLinks.forEach(item => item.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Activar el clickeado
      link.classList.add('active');
      const targetId = link.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Listeners para autoguardado de ajustes generales
  document.getElementById("autoOrganize").addEventListener("change", (e) => saveSingleSetting('autoOrganize', e.target.checked));
  document.getElementById("contextMenu").addEventListener("change", (e) => saveSingleSetting('contextMenu', e.target.checked));
  document.getElementById("notifications").addEventListener("change", (e) => saveSingleSetting('notifications', e.target.value));

  // --- NUEVO: Listeners para categorías por defecto ---
  const catIds = ['cat_pdf', 'cat_images', 'cat_video', 'cat_audio', 'cat_compressed', 'cat_documents', 'cat_spreadsheets', 'cat_presentations', 'cat_programs'];
  catIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveDefaultCategories);
  });

  // Listeners Generales
  document.getElementById("clearHistory").addEventListener("click", clearHistory);
  document.getElementById("addRuleBtn").addEventListener("click", addRule);
  document.getElementById("updateRuleBtn").addEventListener("click", updateRule);
  document.getElementById("cancelEditBtn").addEventListener("click", exitEditMode);

  // Custom Extension Categories Listeners
  document.getElementById("addCustomExtBtn").addEventListener("click", addCustomExtCategory);
  document.getElementById("updateCustomExtBtn").addEventListener("click", updateCustomExtCategory);
  document.getElementById("cancelCustomExtEditBtn").addEventListener("click", exitCustomExtEditMode);
  document.getElementById("exportRulesBtn").addEventListener("click", exportRules);
  document.getElementById("importRulesBtn").addEventListener("click", () => document.getElementById("importFileInput").click());
  document.getElementById("importFileInput").addEventListener("change", importRules);
  document.getElementById("searchHistory").addEventListener("input", (e) => filterHistory(e.target.value.toLowerCase()));

  // Listener para mostrar feedback desde otros scripts (como popup.js)
  api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "showFeedback") {
      showStatus(request.message, request.success ? 'success' : 'error');
    }
  });

  // Listeners para constructores y elementos dinámicos
  setupDateFormatModal();
  setupRenameBuilder();
  setupDynamicPlaceholders();
  setupOnDemandOrganizer();

  renderPatternPreview();

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
  initTheme();
  loadThemeSelector();
  setTimeout(initTearEffect, 200);
});

// Widget logic has been moved to widget.js

function truncateName(str, max) {
  if (str.length > max) return str.substring(0, max - 2) + "..";
  return str;
}

// Configurar el selector de tema
async function loadThemeSelector() {
  const themeButtons = document.querySelectorAll('.theme-btn');

  const data = await api.storage.sync.get({ theme: 'auto' });
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === data.theme);
  });

  themeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const newTheme = btn.dataset.theme;
      await setThemePreference(newTheme);

      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      showStatus(api.i18n.getMessage("statusThemeChanged"), "success");
    });
  });
}

function setupDynamicPlaceholders() {
  const ruleTypeSelect = document.getElementById("ruleType");
  const ruleValueInput = document.getElementById("ruleValue");

  if (!ruleTypeSelect || !ruleValueInput) return;

  ruleTypeSelect.addEventListener("change", () => {
    const selectedType = ruleTypeSelect.value;
    if (selectedType === "keyword") {
      ruleValueInput.placeholder = api.i18n.getMessage("ruleValuePlaceholder");
    } else if (selectedType === "url") {
      ruleValueInput.placeholder = api.i18n.getMessage("placeholder_urlExample");
    }
  });
}

// ===============================================
// LÓGICA DEL MODO DE EDICIÓN
// ===============================================

async function enterEditMode(ruleId) {
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

  renamePatternComponents = parseRenamePattern(ruleToEdit.renamePattern || "");
  renderPatternPreview();

  document.getElementById("rule-form-title").textContent = api.i18n.getMessage("title_editingRule");
  document.getElementById("addRuleBtn").style.display = "none";
  document.getElementById("updateRuleBtn").style.display = "inline-block";
  document.getElementById("cancelEditBtn").style.display = "inline-block";

  document.getElementById("rule-form-section").scrollIntoView({ behavior: 'smooth' });
}

function exitEditMode() {
  editingRuleId = null;

  document.getElementById("ruleType").value = "keyword";
  document.getElementById("ruleValue").value = "";
  document.getElementById("ruleFolder").value = "";
  clearRenameBuilder();

  document.getElementById("rule-form-title").textContent = api.i18n.getMessage("newCustomRuleTitle");
  document.getElementById("addRuleBtn").style.display = "inline-block";
  document.getElementById("updateRuleBtn").style.display = "none";
  document.getElementById("cancelEditBtn").style.display = "none";
}

// ===============================================
// LÓGICA PARA EL CONSTRUCTOR DE RENOMBRADO
// ===============================================

function parseRenamePattern(pattern) {
  if (!pattern) return [];

  const components = [];
  const regex = /(\[sitio\]|\[nombre_original\]|\[fecha:[^\]]+\])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(pattern)) !== null) {
    if (match.index > lastIndex) {
      const text = pattern.substring(lastIndex, match.index);
      components.push(createComponent('text', text));
    }

    const token = match[0];
    if (token.startsWith('[fecha:')) {
      const format = token.substring(7, token.length - 1);
      components.push(createComponent('fecha', format));
    } else if (token === '[sitio]') {
      components.push(createComponent('sitio', '[sitio]'));
    } else if (token === '[nombre_original]') {
      components.push(createComponent('nombre_original', '[nombre_original]'));
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < pattern.length) {
    const text = pattern.substring(lastIndex);
    components.push(createComponent('text', text));
  }

  return components;
}

function setupRenameBuilder() {
  const previewContainer = document.getElementById("rename-pattern-preview");
  const pillsContainer = document.getElementById("rename-pills-container");

  if (!previewContainer || !pillsContainer) return;

  new Sortable(previewContainer, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: () => {
      const newOrder = [];
      previewContainer.querySelectorAll('.pattern-component').forEach(el => {
        newOrder.push(renamePatternComponents.find(c => c.id === el.id));
      });
      renamePatternComponents = newOrder;
    }
  });

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
      case 'sitio':
        component = createComponent('sitio', '[sitio]');
        break;
      case 'nombre_original':
        component = createComponent('nombre_original', '[nombre_original]');
        break;
    }
    if (component) addComponentToBuilder(component);
  });

  previewContainer.addEventListener("click", (event) => {
    if (event.target.classList.contains("remove-component-btn")) {
      const componentElement = event.target.parentElement;
      const componentId = componentElement.id;
      renamePatternComponents = renamePatternComponents.filter(c => c.id !== componentId);
      renderPatternPreview();
    }
  });
}

function createComponent(type, value) {
  return { id: `comp_${Date.now()}_${Math.random()}`, type, value };
}

function addComponentToBuilder(component) {
  renamePatternComponents.push(component);
  renderPatternPreview();
}

// options.js (RECOMENDADO)

/**
 * Renderiza la vista previa del patrón de renombrado.
 * Muestra un texto de marcador de posición si no hay componentes,
 * o la lista de componentes si existen.
 */
function renderPatternPreview() {
  // 1. Obtener el contenedor de la vista previa del DOM.
  const previewContainer = document.getElementById("rename-pattern-preview");

  // 2. Limpiar CUALQUIER contenido previo (componentes o el texto de marcador de posición).
  previewContainer.innerHTML = "";

  // 3. Resetear el estado visual eliminando la clase de marcador de posición.
  previewContainer.classList.remove('is-empty');

  // 4. Comprobar si hay componentes para mostrar.
  if (renamePatternComponents.length === 0) {
    // --- CASO: NO HAY COMPONENTES ---
    // a. Obtener el texto traducido desde los archivos messages.json.
    const placeholderText = api.i18n.getMessage("renamePreviewPlaceholder");

    // b. Insertar el texto en el contenedor.
    previewContainer.textContent = placeholderText;

    // c. Añadir la clase CSS para aplicar los estilos de texto (cursiva, color, centrado, etc.).
    previewContainer.classList.add('is-empty');

  } else {
    // --- CASO: SÍ HAY COMPONENTES ---
    // a. Recorrer el array de componentes y crear un elemento para cada uno.
    renamePatternComponents.forEach(component => {
      const el = document.createElement("div");
      el.className = "pattern-component";
      el.id = component.id;
      el.dataset.type = component.type;

      // b. Determinar el texto a mostrar para cada tipo de componente.
      let displayValue = component.value;
      if (component.type === 'fecha') {
        displayValue = api.i18n.getMessage("label_dateComponent", component.value);
      } else if (component.type === 'sitio') {
        displayValue = api.i18n.getMessage("addSiteComponent").replace('+', '').trim();
      } else if (component.type === 'nombre_original') {
        displayValue = api.i18n.getMessage("addOriginalNameComponent").replace('+', '').trim();
      }

      // c. Crear el HTML interno del componente, incluyendo el botón de eliminar.
      const removeButtonTitle = api.i18n.getMessage("tooltip_removeComponent");
      el.innerHTML = `<span>${displayValue}</span><button type="button" class="remove-component-btn" title="${removeButtonTitle}">✖</button>`;

      // d. Añadir el componente recién creado al contenedor de la vista previa.
      previewContainer.appendChild(el);
    });
  }
}

function getRenamePatternString() {
  return renamePatternComponents.map(c => {
    if (c.type === 'fecha') return `[fecha:${c.value}]`;
    if (c.type === 'sitio' || c.type === 'nombre_original') return c.value;
    return c.value;
  }).join('');
}

function clearRenameBuilder() {
  renamePatternComponents = [];
  renderPatternPreview();
}

function setupDateFormatModal() {
  const modal = document.getElementById("date-format-modal");
  const openBtn = document.getElementById("add-date-format-btn");
  const cancelBtn = document.getElementById("cancel-format-btn");
  const insertBtn = document.getElementById("insert-format-btn");
  const customFormatInput = document.getElementById("custom-format-input");
  const previewText = document.getElementById("format-preview-text");
  const formatBuilder = document.querySelector(".format-builder");

  const updatePreview = () => {
    const format = customFormatInput.value;
    if (!format) {
      previewText.textContent = "";
      return;
    }
    previewText.textContent = formatDate(new Date(), format);
  };

  if (!openBtn) return;

  openBtn.addEventListener("click", () => {
    customFormatInput.value = "YYYY-MM-DD";
    updatePreview();
    modal.style.display = "flex";
  });

  const closeModal = () => {
    modal.style.display = "none";
  };
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  formatBuilder.addEventListener("click", (event) => {
    const target = event.target;
    if (target.classList.contains("preset-pill")) {
      customFormatInput.value = target.dataset.format;
    } else if (target.classList.contains("format-code-pill")) {
      insertTextAtCursor(customFormatInput, target.dataset.code);
    }
    updatePreview();
  });

  customFormatInput.addEventListener("input", updatePreview);

  insertBtn.addEventListener("click", () => {
    const format = customFormatInput.value;
    if (format) {
      addComponentToBuilder(createComponent('fecha', format));
    }
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
    YYYY: date.getFullYear(),
    YY: String(date.getFullYear()).slice(-2),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    hh: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
    ss: String(date.getSeconds()).padStart(2, '0'),
  };
  return format.replace(/YYYY|YY|MM|DD|hh|mm|ss/g, match => map[match]);
}

// ===================================================
// FUNCIONES CRUD PARA REGLAS Y OTROS
// ===================================================

function loadSettings() {
  api.storage.sync.get({
    autoOrganize: true,
    notifications: 'always',
    contextMenu: true,
    // Defaults: Todos activos
    defaultCategories: {
      pdf: true, images: true, video: true, audio: true,
      compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true
    }
  }, (data) => {
    document.getElementById("autoOrganize").checked = data.autoOrganize;
    document.getElementById("notifications").value = data.notifications;
    document.getElementById("contextMenu").checked = data.contextMenu;

    // Cargar estado de los checkboxes de categorías
    const cats = data.defaultCategories;
    if (cats) {
      document.getElementById("cat_pdf").checked = cats.pdf !== false;
      document.getElementById("cat_images").checked = cats.images !== false;
      document.getElementById("cat_video").checked = cats.video !== false;
      document.getElementById("cat_audio").checked = cats.audio !== false;
      document.getElementById("cat_compressed").checked = cats.compressed !== false;
      document.getElementById("cat_documents").checked = cats.documents !== false;
      document.getElementById("cat_spreadsheets").checked = cats.spreadsheets !== false;
      document.getElementById("cat_presentations").checked = cats.presentations !== false;
      document.getElementById("cat_programs").checked = cats.programs !== false;
    }
  });
}

function saveSingleSetting(key, value) {
  api.storage.sync.set({ [key]: value }, () => {
    showStatus(api.i18n.getMessage("statusSettingsSaved"), "success");
  });
}

// --- FUNCIÓN CORREGIDA ---
function loadCustomRules() {
  api.storage.sync.get({ customRules: [] }, (data) => {
    let rules = data.customRules;
    let migrationNeeded = false;

    // 1. Revisa si hay reglas viejas sin ID
    rules.forEach(rule => {
      if (!rule.id) {
        rule.id = `rule_${Date.now()}_${Math.random()}`;
        migrationNeeded = true;
      }
    });

    // 2. Si se hizo algún cambio, guarda la lista actualizada
    if (migrationNeeded) {
      api.storage.sync.set({ customRules: rules }, () => {
        console.log("Migración de reglas completada: Se añadieron IDs a reglas antiguas.");
        renderRulesList(rules);
      });
    } else {
      // 3. Si no, simplemente renderiza la lista
      renderRulesList(rules);
    }
  });
}


function renderRulesList(rulesArray) {
  const rulesList = document.getElementById("rulesList");
  rulesList.innerHTML = "";
  if (!rulesArray || !rulesArray.length) {
    rulesList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <h4>No hay Reglas Avanzadas</h4>
        <p>Crea reglas complejas basadas en nombes de archivo o URL de origen arriba.</p>
      </div>
    `;
    return;
  }
  rulesArray.forEach((rule) => {
    const li = document.createElement("li");
    li.dataset.id = rule.id;

    const typeStr = rule.type === 'url' ? api.i18n.getMessage('ruleDesc_url') : api.i18n.getMessage('ruleDesc_name');
    let ruleText = `${api.i18n.getMessage('ruleDesc_if')} <b>${typeStr}</b> ${api.i18n.getMessage('ruleDesc_contains')} "<b>${rule.value}</b>", ${api.i18n.getMessage('ruleDesc_saveIn')} "<b>${rule.folder}</b>"`;
    if (rule.renamePattern) {
      ruleText += ` ${api.i18n.getMessage('ruleDesc_andRenameAs')} "<b>${rule.renamePattern}</b>"`;
    }
    li.innerHTML = `<span class="history-item-text">${ruleText}</span>`;

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

  if (rulesSortable) {
    rulesSortable.destroy();
  }
  rulesSortable = new Sortable(rulesList, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: (e) => saveRulesOrder(e.target)
  });
}

function addRule() {
  const type = document.getElementById("ruleType").value;
  const value = document.getElementById("ruleValue").value.trim();
  const folder = document.getElementById("ruleFolder").value.trim();
  const renamePattern = getRenamePatternString();

  if (!value || !folder) {
    showStatus(api.i18n.getMessage("feedback_errorCompleteFields"), "error");
    return;
  }

  api.storage.sync.get({ customRules: [] }, (data) => {
    const newRule = {
      id: `rule_${Date.now()}`,
      type, value, folder, renamePattern
    };
    const newRules = [...data.customRules, newRule];
    api.storage.sync.set({ customRules: newRules }, () => {
      showStatus(api.i18n.getMessage("statusRuleAdded"), "success");
      exitEditMode();
    });
  });
}

function updateRule() {
  if (!editingRuleId) return;

  const type = document.getElementById("ruleType").value;
  const value = document.getElementById("ruleValue").value.trim();
  const folder = document.getElementById("ruleFolder").value.trim();
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

    rules[ruleIndex] = { id: editingRuleId, type, value, folder, renamePattern };

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
    api.storage.sync.set({ customRules: newRules }, () => {
      showStatus(api.i18n.getMessage("statusRuleDeleted"), "success");
    });
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

// ===================================================
// FUNCIONES PARA CATEGORÍAS PERSONALIZADAS POR EXTENSIÓN
// ===================================================

function loadCustomExtCategories() {
  api.storage.sync.get({ customCategories: [] }, (data) => {
    customExtCategories = data.customCategories;
    renderCustomExtList(customExtCategories);
  });
}

function processExtensionsString(extsStr) {
  return extsStr.split(',')
    .map(e => e.trim().toLowerCase().replace(/^\./, ''))
    .filter(e => e);
}

function renderCustomExtList(categoriesArray) {
  const listElement = document.getElementById("customExtList");
  listElement.innerHTML = "";
  if (!categoriesArray || !categoriesArray.length) {
    listElement.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        <h4>Aún no tienes reglas de extensión</h4>
        <p>Agrega extensiones arriba para empezar a organizar automáticamente.</p>
      </div>
    `;
    return;
  }

  categoriesArray.forEach((cat) => {
    const li = document.createElement("li");
    li.dataset.id = cat.id;

    const extString = cat.extensions.join(', ');
    li.innerHTML = `<span class="history-item-text">Si detecta <b>${extString}</b>, guardar en "<b>${cat.folder}</b>"</span>`;

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

  if (extSortable) {
    extSortable.destroy();
  }
  extSortable = new Sortable(listElement, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    onEnd: (e) => saveCustomExtOrder(e.target)
  });
}

function addCustomExtCategory() {
  const folder = document.getElementById("customExtFolder").value.trim();
  const extsStr = document.getElementById("customExtExts").value;
  const extensions = processExtensionsString(extsStr);

  if (!folder || extensions.length === 0) {
    showStatus(api.i18n.getMessage("feedback_errorCustomExtFields"), "error");
    return;
  }

  api.storage.sync.get({ customCategories: [] }, (data) => {
    const newCat = {
      id: `extcat_${Date.now()}`,
      folder,
      extensions
    };
    const newCategories = [...data.customCategories, newCat];
    api.storage.sync.set({ customCategories: newCategories }, () => {
      showStatus(api.i18n.getMessage("statusRuleAdded"), "success");
      exitCustomExtEditMode();
    });
  });
}

function updateCustomExtCategory() {
  if (!editingCustomExtId) return;

  const folder = document.getElementById("customExtFolder").value.trim();
  const extsStr = document.getElementById("customExtExts").value;
  const extensions = processExtensionsString(extsStr);

  if (!folder || extensions.length === 0) {
    showStatus(api.i18n.getMessage("feedback_errorCustomExtFields"), "error");
    return;
  }

  api.storage.sync.get({ customCategories: [] }, (data) => {
    const categories = data.customCategories;
    const index = categories.findIndex(c => c.id === editingCustomExtId);
    if (index === -1) {
      exitCustomExtEditMode();
      return;
    }

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
    api.storage.sync.set({ customCategories: newCategories }, () => {
      showStatus(api.i18n.getMessage("statusRuleDeleted"), "success");
    });
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

function exitCustomExtEditMode() {
  editingCustomExtId = null;
  document.getElementById("customExtFolder").value = "";
  document.getElementById("customExtExts").value = "";

  document.getElementById("addCustomExtBtn").style.display = "inline-block";
  document.getElementById("updateCustomExtBtn").style.display = "none";
  document.getElementById("cancelCustomExtEditBtn").style.display = "none";
}

function updateHistory() {
  api.storage.local.get({ downloadHistory: [] }, (result) => {
    fullHistory = result.downloadHistory;
    renderHistoryList(fullHistory);
  });
}

function filterHistory(query) {
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

function renderHistoryList(historyArray) {
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
      reDownloadBtn.addEventListener("click", () => api.downloads.download({ url: entry.url }));
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

function clearHistory() {
  if (confirm(api.i18n.getMessage("confirmClearHistory"))) {
    api.storage.local.set({ downloadHistory: [] }, () => {
      showStatus(api.i18n.getMessage("statusHistoryCleared"), "success");
    });
  }
}

// ===================================================
// FUNCIONES PARA EL ORGANIZADOR BAJO DEMANDA
// ===================================================

function setupOnDemandOrganizer() {
  const scanBtn = document.getElementById("scanHistoryBtn");
  const researchBtn = document.getElementById("researchBtn");
  const loadingSpinner = document.getElementById("scanner-loading");
  const resultsContainer = document.getElementById("scanResultsContainer");
  const resultsList = document.getElementById("scanResultsList");
  const organizeBtn = document.getElementById("organizeSelectedBtn");
  const cancelBtn = document.getElementById("cancelScanBtn");
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");

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
    if (event.target.type === 'checkbox') {
      updateSelectAllCheckboxState();
    }
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
    const selectAllCheckbox = document.getElementById("selectAllCheckbox");

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

    const query = {
      orderBy: ['-startTime']
    };

    if (startDate) {
      const localStartDate = new Date(startDate + 'T00:00:00');
      query.startedAfter = localStartDate.toISOString();
    }
    if (endDate) {
      const localEndDate = new Date(endDate + 'T23:59:59.999');
      query.startedBefore = localEndDate.toISOString();
    }

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

          if (rule.type === 'keyword' && baseFilename.toLowerCase().includes(ruleValue)) {
            suggestedFolder = rule.folder;
            break;
          }
          if (rule.type === 'url' && item.url.toLowerCase().includes(ruleValue)) {
            suggestedFolder = rule.folder;
            break;
          }
        }

        if (!suggestedFolder && customCategories.length > 0) {
          const ext = (baseFilename.split('.').pop() || "").toLowerCase();
          for (const cat of customCategories) {
            if (cat.extensions.includes(ext)) {
              suggestedFolder = cat.folder;
              break;
            }
          }
        }

        if (!suggestedFolder) {
          const ext = (baseFilename.split('.').pop() || "").toLowerCase();
          suggestedFolder = getFolderNameByI18n(ext, defaultCategories);
        }
        return { ...item, suggestedFolder };
      }).filter(item => item.suggestedFolder);

      loadingSpinner.style.display = "none";
      const title = api.i18n.getMessage("title_scanResults", String(suggestions.length));
      document.getElementById("scanResultsTitle").textContent = title;
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
        li.innerHTML = `
          <input type="checkbox" data-url="${file.url}" checked> 
          <span class="history-item-text">
            ${file.filename} → <strong>📂 ${file.suggestedFolder}</strong>
          </span>
        `;
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

    let organizedCount = 0;
    selectedCheckboxes.forEach(checkbox => {
      const url = checkbox.dataset.url;
      if (url) {
        api.downloads.download({ url: url, conflictAction: 'uniquify' });
        organizedCount++;
      }
    });

    const message = api.i18n.getMessage("feedback_organizationStarted", String(organizedCount));
    showStatus(message, "success");
    exitScanMode();
  }
}

/**
 * Obtiene el nombre de la carpeta traducida basándose en la extensión del archivo.
 * @param {string} ext - La extensión del archivo en minúsculas.
 * @returns {string} El nombre de la carpeta traducido.
 */
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
  if (i18nKey === undefined) {
    return null; // Si no hay regla, no hacer nada
  }

  return i18nKey ? api.i18n.getMessage(i18nKey) : null;
}

function exportRules() {
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

function importRules(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const newRules = JSON.parse(e.target.result);
      if (!Array.isArray(newRules)) {
        throw new Error(api.i18n.getMessage("error_importWrongFormat"));
      }
      if (confirm(api.i18n.getMessage("confirm_importOverwrite"))) {
        const rulesWithId = newRules.map(rule => ({ ...rule, id: rule.id || `rule_${Date.now()}_${Math.random()}` }));
        api.storage.sync.set({ customRules: rulesWithId }, () => {
          showStatus(api.i18n.getMessage("feedback_rulesImported"), "success");
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

function showStatus(message, type = 'info') {
  const statusElement = document.getElementById("status");

  // Set icons based on type
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else {
    // Info icon
    iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  statusElement.innerHTML = `${iconSvg} <span>${message}</span>`;
  statusElement.className = `status ${type} visible`;

  // Auto hide after 3 seconds
  if (statusElement.timeoutId) {
    clearTimeout(statusElement.timeoutId);
  }

  statusElement.timeoutId = setTimeout(() => {
    statusElement.classList.remove('visible');
  }, 3000);
}

function openFolderInExplorer(downloadId) {
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

function saveDefaultCategories() {
  const defaultCategories = {
    pdf: document.getElementById("cat_pdf").checked,
    images: document.getElementById("cat_images").checked,
    video: document.getElementById("cat_video").checked,
    audio: document.getElementById("cat_audio").checked,
    compressed: document.getElementById("cat_compressed").checked,
    documents: document.getElementById("cat_documents").checked,
    spreadsheets: document.getElementById("cat_spreadsheets").checked,
    presentations: document.getElementById("cat_presentations").checked,
    programs: document.getElementById("cat_programs").checked
  };
  api.storage.sync.set({ defaultCategories }, () => {
    // Feedback silencioso (opcional)
    console.log("Categorías guardadas");
  });
}

// =============================================
// EFECTO DE LÁGRIMAS (Audio Player)
// =============================================
function initTearEffect() {
  const audio = document.querySelector('.about-audio');
  if (!audio) return;

  // Overlay fijo de pantalla completa
  const overlay = document.createElement('div');
  overlay.id = 'tear-overlay';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9990;
    overflow: hidden;
  `;
  document.body.appendChild(overlay);

  let tears = [];
  let spawnInterval = null;
  let animFrameId = null;
  let mouseX = -9999;
  let mouseY = -9999;

  // Seguir el mouse para el efecto viento
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Crear una lágrima SVG en posición aleatoria horizontal
  function createTear() {
    const size = 15 + Math.random() * 18;
    const x = Math.random() * window.innerWidth;
    const opacity = 0.7 + Math.random() * 0.3;
    const hue = 195 + Math.random() * 30; // azules/celestes
    const dropId = Math.random().toString(36).substring(2, 9); // ID único para el gradiente

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 30 40');
    svg.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: -50px;
      width: ${size}px;
      height: ${size * 1.33}px;
      opacity: ${opacity};
      will-change: transform, left, top;
      filter: drop-shadow(0 4px 8px hsla(${hue}, 80%, 50%, 0.4));
      pointer-events: none;
    `;

    svg.innerHTML = `
      <defs>
        <radialGradient id="dropGrad-${dropId}" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="hsla(${hue}, 100%, 95%, 0.9)"/>
          <stop offset="40%" stop-color="hsla(${hue}, 85%, 65%, 0.5)"/>
          <stop offset="100%" stop-color="hsla(${hue}, 80%, 45%, 0.8)"/>
        </radialGradient>
      </defs>
      <!-- Cuerpo principal 3D -->
      <path d="M15 2 C15 2 3 18 3 26 C3 32.6 8.4 38 15 38 C21.6 38 27 32.6 27 26 C27 18 15 2 15 2Z" 
            fill="url(#dropGrad-${dropId})"/>
      
      <!-- Brillo curvo lateral (reflejo de luz principal) -->
      <path d="M8 25 C8 18 11 11 14 7 C10 13 6 20 8 25Z" 
            fill="rgba(255,255,255,0.7)"/>
            
      <!-- Reflejo secundario (abajo a la derecha) -->
      <path d="M19 34 C22 31 24 27 24 24 C24 28 22 33 19 34Z" 
            fill="rgba(255,255,255,0.4)"/>
            
      <!-- Punto de luz intenso -->
      <ellipse cx="10" cy="18" rx="2" ry="3" fill="rgba(255,255,255,0.9)" transform="rotate(-30 10 18)"/>
    `;

    overlay.appendChild(svg);

    const obj = {
      el: svg,
      x,
      y: -40,
      vx: (Math.random() - 0.5) * 0.4,
      vy: 1.2 + Math.random() * 1.8,
      wobble: Math.random() * Math.PI * 2,
      size,
    };

    tears.push(obj);
  }

  // Loop de animación con física
  function animate() {
    animFrameId = requestAnimationFrame(animate);

    tears.forEach((t, i) => {
      // Oscilación natural
      t.wobble += 0.025;
      t.vx += Math.sin(t.wobble) * 0.04;
      t.vx *= 0.96; // amortiguación

      // Efecto viento: repulsión desde el mouse
      const dx = t.x - mouseX;
      const dy = t.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 180) {
        const force = ((180 - dist) / 180) * 4;
        const nx = dx / dist;
        const ny = dy / dist;
        t.vx += nx * force;
        t.vy += ny * force * 0.6;
      }

      // Gravedad y aceleración real
      t.vy += 0.08;
      t.vy *= 1.01; // Caída exponencial leve
      t.x += t.vx;
      t.y += t.vy;

      // Inclinación en dirección de movimiento y deformación (squash and stretch)
      const angle = Math.atan2(t.vx, Math.max(t.vy, 0.5)) * (180 / Math.PI) * 0.5;
      const stretch = Math.min(1 + t.vy * 0.02, 1.8); 
      const squash = 1 / stretch;

      t.el.style.left = `${t.x}px`;
      t.el.style.top = `${t.y}px`;
      t.el.style.transform = `rotate(${angle}deg) scale(${squash}, ${stretch})`;

      // Fuera de pantalla → eliminar
      if (t.y > window.innerHeight + 60 || t.x < -60 || t.x > window.innerWidth + 60) {
        t.el.remove();
        tears.splice(i, 1);
      }
    });
  }

  // Arrancar al reproducir
  audio.addEventListener('play', () => {
    if (spawnInterval) return;
    spawnInterval = setInterval(createTear, 350);
    if (!animFrameId) animate();
  });

  // Pausar generación, pero dejar caer las que ya están
  audio.addEventListener('pause', () => {
    clearInterval(spawnInterval);
    spawnInterval = null;

    // Cuando no queden más lágrimas, parar el loop
    const checkEmpty = setInterval(() => {
      if (tears.length === 0) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
        clearInterval(checkEmpty);
      }
    }, 500);
  });

  audio.addEventListener('ended', () => {
    clearInterval(spawnInterval);
    spawnInterval = null;
  });
}
