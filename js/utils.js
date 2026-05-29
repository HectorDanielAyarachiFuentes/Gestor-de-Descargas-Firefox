// utils.js

const api = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Asigna HTML de forma segura a un elemento para cumplir con las políticas de AMO.
 */
export function setHTML(element, htmlString) {
    if (!htmlString) {
        element.textContent = '';
        return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    element.textContent = '';
    while (doc.body.firstChild) {
        element.appendChild(doc.body.firstChild);
    }
}

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
        document.title = api.i18n.getMessage(title.dataset.i18n);
    }

    document.querySelectorAll('[data-i18n]').forEach(element => {
        const message = api.i18n.getMessage(element.dataset.i18n);
        if (element.dataset.i18n === "footerText") {
            const currentYear = new Date().getFullYear();
            element.textContent = message.replace('2025', currentYear);
        } else if (message.includes('<') && message.includes('>')) {
            setHTML(element, message);
        } else {
            element.textContent = message;
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        element.placeholder = api.i18n.getMessage(element.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        element.title = api.i18n.getMessage(element.dataset.i18nTitle);
    });
}
