// theme-manager.js
// Gestor centralizado de temas para la extensión

const api = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Inicializa el sistema de temas
 * Detecta preferencias del sistema y del usuario
 */
export async function initTheme() {
  const { theme = 'auto' } = await api.storage.sync.get('theme');
  applyTheme(theme);
}

/**
 * Aplica el tema según la preferencia
 * @param {string} preference - 'light', 'dark', o 'auto'
 */
export function applyTheme(preference) {
  let shouldUseDark = false;

  if (preference === 'auto') {
    shouldUseDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    shouldUseDark = preference === 'dark';
  }

  if (shouldUseDark) {
    document.documentElement.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
  }

  document.documentElement.setAttribute('data-theme', shouldUseDark ? 'dark' : 'light');
}

/**
 * Cambiar la preferencia de tema del usuario
 * @param {string} newTheme - 'light', 'dark', o 'auto'
 */
export async function setThemePreference(newTheme) {
  await api.storage.sync.set({ theme: newTheme });
  applyTheme(newTheme);
}

/**
 * Obtener la preferencia actual de tema
 * @returns {Promise<string>} - 'light', 'dark', o 'auto'
 */
export async function getThemePreference() {
  const { theme = 'auto' } = await api.storage.sync.get('theme');
  return theme;
}

// Escuchar cambios en la preferencia del sistema (solo para modo auto)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
  const { theme = 'auto' } = await api.storage.sync.get('theme');
  if (theme === 'auto') {
    applyTheme('auto');
  }
});

// Escuchar cambios en storage (sincronización entre páginas)
api.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.theme) {
    applyTheme(changes.theme.newValue);
  }
});