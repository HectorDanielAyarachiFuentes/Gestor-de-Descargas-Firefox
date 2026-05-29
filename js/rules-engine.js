// rules-engine.js

const api = typeof browser !== 'undefined' ? browser : chrome;

/**
 * Obtiene el nombre de la carpeta según la extensión,
 * respetando si el usuario ha desactivado esa categoría.
 */
export function getFolderNameByExtension(ext, enabledCats = {}) {
    const cats = {
        pdf: true, images: true, video: true, audio: true,
        compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true,
        design: true, code: true, books: true, threed: true, fonts: true,
        ...enabledCats
    };

    const lowerExt = ext.toLowerCase();

    switch (lowerExt) {
        case 'pdf':
            return cats.pdf ? api.i18n.getMessage("folder_pdfs") : null;
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': case 'tiff': case 'heic': case 'raw': case 'bmp': case 'ico':
            return cats.images ? api.i18n.getMessage("folder_images") : null;
        case 'mp4': case 'mkv': case 'avi': case 'webm': case 'mov': case 'flv': case 'ts': case 'm3u8':
            return cats.video ? api.i18n.getMessage("folder_videos") : null;
        case 'mp3': case 'wav': case 'ogg': case 'flac': case 'm4a': case 'aac':
            return cats.audio ? api.i18n.getMessage("folder_audio") : null;
        case 'zip': case 'rar': case '7z': case 'tar': case 'gz': case 'bz2': case 'xz':
            return cats.compressed ? api.i18n.getMessage("folder_compressed") : null;
        case 'docx': case 'doc': case 'odt': case 'txt': case 'md': case 'rtf':
            return cats.documents ? api.i18n.getMessage("folder_documents") : null;
        case 'csv': case 'xlsx': case 'xls': case 'ods':
            return cats.spreadsheets ? api.i18n.getMessage("folder_spreadsheets") : null;
        case 'ppt': case 'pptx': case 'odp':
            return cats.presentations ? api.i18n.getMessage("folder_presentations") : null;
        case 'exe': case 'msi': case 'apk': case 'appx': case 'bat': case 'cmd': case 'sh': case 'dmg': case 'pkg': case 'iso': case 'img':
            return cats.programs ? api.i18n.getMessage("folder_programs") : null;
        case 'psd': case 'ai': case 'indd': case 'blend': case 'fig': case 'cdr':
            return cats.design ? api.i18n.getMessage("folder_design") : null;
        case 'html': case 'css': case 'js': case 'ts': case 'json': case 'xml': case 'py': case 'java': case 'cpp': case 'php': case 'sql':
            return cats.code ? api.i18n.getMessage("folder_code") : null;
        case 'epub': case 'mobi': case 'azw3': case 'cbz': case 'cbr':
            return cats.books ? api.i18n.getMessage("folder_books") : null;
        case 'stl': case 'obj': case 'fbx': case 'gcode':
            return cats.threed ? api.i18n.getMessage("folder_3d") : null;
        case 'ttf': case 'otf': case 'woff': case 'woff2':
            return cats.fonts ? api.i18n.getMessage("folder_fonts") : null;
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
    
    let site = api.i18n.getMessage("unknownSite");
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
