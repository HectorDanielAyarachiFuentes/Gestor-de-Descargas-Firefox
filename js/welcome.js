import { applyI18n } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // Aplicar i18n desde utils
    applyI18n();

    // Detectar tema (reutilizando variable del sistema de Opciones si es posible)
    chrome.storage.sync.get({ theme: 'auto' }, (data) => {
        let shouldUseDark = false;
        if (data.theme === 'auto') {
            shouldUseDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
            shouldUseDark = data.theme === 'dark';
        }
        if (shouldUseDark) document.documentElement.classList.add('dark-mode');
    });

    document.getElementById('open-options-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
