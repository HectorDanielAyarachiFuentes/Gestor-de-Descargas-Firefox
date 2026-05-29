// utils.js

/**
 * Retrasa la ejecución de una función (Debounce).
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Trunca un string a una longitud máxima.
 */
export function truncateName(str, max) {
    if (str.length > max) return str.substring(0, max - 2) + "..";
    return str;
}

/**
 * Sanea el nombre de un archivo para remover caracteres inválidos.
 */
export function sanitize(name) {
    return name.replace(/[<>:"/\\|?*]+/g, '_');
}

/**
 * Aplica las traducciones a la página actual buscando elementos con atributos `data-i18n`.
 */
export function applyI18n() {
    const title = document.querySelector('title');
    if (title && title.dataset.i18n) {
        document.title = chrome.i18n.getMessage(title.dataset.i18n);
    }

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const message = chrome.i18n.getMessage(element.dataset.i18n);
        if (element.dataset.i18n === "footerText") {
            const currentYear = new Date().getFullYear();
            element.innerHTML = message.replace('2025', currentYear);
        } else if (message.includes('<') && message.includes('>')) {
            element.innerHTML = message;
        } else {
            element.textContent = message;
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        element.placeholder = chrome.i18n.getMessage(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        element.title = chrome.i18n.getMessage(element.dataset.i18nTitle);
    });
}
