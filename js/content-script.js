// content-script.js - Interceptación 100% nativa en Firefox para descargas organizadas directas
(() => {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // Lista de extensiones descargables comunes
    const DOWNLOAD_EXTENSIONS = new Set([
        // Documentos y Libros
        'pdf', 'epub', 'mobi', 'azw3', 'doc', 'docx', 'odt', 'rtf', 'txt', 'pages',
        // Hojas de cálculo y presentaciones
        'xls', 'xlsx', 'ods', 'csv', 'tsv', 'ppt', 'pptx', 'odp', 'key',
        // Comprimidos
        'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'iso', 'dmg',
        // Audio
        'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus',
        // Video
        'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v',
        // Imágenes
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'heic', 'avif',
        // Programas y ejecutables
        'exe', 'msi', 'apk', 'deb', 'rpm', 'bin', 'jar', 'appimage',
        // Código y datos
        'json', 'xml', 'sql', 'sqlite', 'db', 'yaml', 'yml',
        // Diseño y 3D
        'psd', 'ai', 'sketch', 'fig', 'xd', 'blend', 'obj', 'stl', 'fbx', 'cad', 'dwg', 'dxf',
        // Torrents
        'torrent'
    ]);

    function extractExtension(urlStr, downloadAttr) {
        if (downloadAttr) {
            const parts = downloadAttr.trim().split('.');
            if (parts.length > 1) {
                const ext = parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '');
                if (ext) return ext;
            }
        }
        try {
            const parsed = new URL(urlStr, window.location.href);
            const pathname = parsed.pathname;
            const filename = pathname.split('/').pop() || '';
            const parts = filename.split('.');
            if (parts.length > 1) {
                return parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '');
            }
        } catch (e) {}
        return null;
    }

    function isDownloadable(url, downloadAttr) {
        if (!url) return false;
        const u = url.trim();
        if (u.startsWith('javascript:') || u.startsWith('mailto:') || u.startsWith('tel:') || u.startsWith('#')) {
            return false;
        }
        if (downloadAttr && downloadAttr.trim() !== '') {
            return true;
        }
        const ext = extractExtension(u, downloadAttr);
        if (ext && DOWNLOAD_EXTENSIONS.has(ext)) {
            return true;
        }
        return false;
    }

    function handleDownload(url, suggestedFilename, e) {
        if (!isDownloadable(url, suggestedFilename)) return false;

        const originUrl = window.location.href;

        api.runtime.sendMessage({
            type: 'DIRECT_DOWNLOAD_INTERCEPT',
            url: url,
            suggestedFilename: suggestedFilename || '',
            originUrl: originUrl
        }, (response) => {
            if (api.runtime.lastError) return;
            if (response && response.handled) {
                console.log("[Gestor de Descargas] Descarga organizada directamente en 1 paso.");
            }
        });

        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
        return true;
    }

    // 1. Interceptar clics de usuario en enlaces descargables
    ['click', 'auxclick'].forEach(eventType => {
        window.addEventListener(eventType, (e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || (e.button !== 0 && e.button !== 1)) {
                return;
            }
            const link = e.target && e.target.closest ? e.target.closest('a') : null;
            if (!link) return;

            const href = link.href || link.getAttribute('href') || '';
            const downloadAttr = link.getAttribute('download') || link.download || '';

            if (isDownloadable(href, downloadAttr)) {
                handleDownload(href, downloadAttr, e);
            }
        }, true);
    });

    // 2. Interceptar descargas dinámicas creadas por JavaScript (Google Docs, Google Sheets, Canva, Mega, etc.)
    try {
        const script = document.createElement('script');
        script.textContent = `
        (() => {
            const origClick = HTMLAnchorElement.prototype.click;
            HTMLAnchorElement.prototype.click = function() {
                try {
                    const href = this.href || this.getAttribute('href') || '';
                    const downloadAttr = this.getAttribute('download') || this.download || '';
                    if (href && (downloadAttr || /\\.(pdf|epub|docx|xlsx|pptx|zip|rar|png|jpg|mp4|txt)/i.test(href) || /\\.(pdf|epub|docx|xlsx|pptx|zip|rar|png|jpg|mp4|txt)/i.test(downloadAttr))) {
                        window.postMessage({
                            __gestorDownload: true,
                            url: href,
                            download: downloadAttr
                        }, '*');
                    }
                } catch(e) {}
                return origClick.apply(this, arguments);
            };
        })();
        `;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    } catch(e) {}

    window.addEventListener('message', (event) => {
        if (event.source !== window || !event.data || !event.data.__gestorDownload) return;
        const { url, download } = event.data;
        if (url && isDownloadable(url, download)) {
            api.runtime.sendMessage({
                type: 'DIRECT_DOWNLOAD_INTERCEPT',
                url: url,
                suggestedFilename: download || '',
                originUrl: window.location.href
            });
        }
    });
})();
