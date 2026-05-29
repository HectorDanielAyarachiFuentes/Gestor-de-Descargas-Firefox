// rules-engine.js

/**
 * Obtiene el nombre de la carpeta según la extensión,
 * respetando si el usuario ha desactivado esa categoría.
 */
export function getFolderNameByExtension(ext, enabledCats = {}) {
    // Valores por defecto: todo activado si no se pasa configuración
    const cats = {
        pdf: true, images: true, video: true, audio: true,
        compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true,
        ...enabledCats
    };

    const lowerExt = ext.toLowerCase();

    switch (lowerExt) {
        case 'pdf':
            return cats.pdf ? chrome.i18n.getMessage("folder_pdfs") : null;
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp':
            return cats.images ? chrome.i18n.getMessage("folder_images") : null;
        case 'mp4': case 'mkv': case 'avi': case 'webm':
            return cats.video ? chrome.i18n.getMessage("folder_videos") : null;
        case 'mp3': case 'wav': case 'ogg':
            return cats.audio ? chrome.i18n.getMessage("folder_audio") : null;
        case 'zip': case 'rar': case '7z':
            return cats.compressed ? chrome.i18n.getMessage("folder_compressed") : null;
        case 'docx': case 'doc': case 'odt':
            return cats.documents ? chrome.i18n.getMessage("folder_documents") : null;
        case 'txt': case 'md':
            return cats.documents ? chrome.i18n.getMessage("folder_text") : null;
        case 'csv': case 'xlsx': case 'xls':
            return cats.spreadsheets ? chrome.i18n.getMessage("folder_spreadsheets") : null;
        case 'ppt': case 'pptx': case 'odp':
            return cats.presentations ? chrome.i18n.getMessage("folder_presentations") : null;
        case 'exe': case 'msi':
            return cats.programs ? chrome.i18n.getMessage("folder_programs") : null;
        case 'js': case 'html': case 'css': case 'py': case 'json':
            return null;
        default:
            return null;
    }
}

/**
 * Aplica el patrón de renombrado configurado en la regla a un archivo.
 */
export function applyRenamePattern(pattern, downloadItem, originUrl) {
    const now = new Date();
    const dateParts = {
        YYYY: now.getFullYear(),
        YY: String(now.getFullYear()).slice(-2),
        MM: String(now.getMonth() + 1).padStart(2, '0'),
        DD: String(now.getDate()).padStart(2, '0'),
        hh: String(now.getHours()).padStart(2, '0'),
        mm: String(now.getMinutes()).padStart(2, '0'),
        ss: String(now.getSeconds()).padStart(2, '0'),
    };
    const filenameParts = downloadItem.filename.split('.');
    const extension = (filenameParts.pop() || "").toLowerCase();
    const originalFilename = filenameParts.join('.');
    
    let site = chrome.i18n.getMessage("unknownSite");
    if (originUrl) {
        try {
            site = new URL(originUrl).hostname.replace(/^www\./, '').split('.')[0];
        } catch (e) { console.log("URL de origen no válida para extraer sitio:", e); }
    }
    
    let newName = pattern;
    newName = newName.replace(/\[sitio\]/g, site);
    newName = newName.replace(/\[nombre_original\]/g, originalFilename);
    newName = newName.replace(/\[fecha:([^\]]+)\]/g, (match, format) => {
        return format.replace(/YYYY|YY|MM|DD|hh|mm|ss/g, part => dateParts[part]);
    });
    
    return `${newName}.${extension}`;
}
