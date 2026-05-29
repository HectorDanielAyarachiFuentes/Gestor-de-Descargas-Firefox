import { applyI18n } from './utils.js';

const api = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
    // Aplicar i18n desde utils
    applyI18n();

    // Detectar tema (reutilizando variable del sistema de Opciones si es posible)
    const data = await api.storage.sync.get({ theme: 'auto' });
    let shouldUseDark = false;
    if (data.theme === 'auto') {
        shouldUseDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
        shouldUseDark = data.theme === 'dark';
    }
    if (shouldUseDark) document.documentElement.classList.add('dark-mode');

    document.getElementById('open-options-btn').addEventListener('click', () => {
        api.runtime.openOptionsPage();
    });
});
