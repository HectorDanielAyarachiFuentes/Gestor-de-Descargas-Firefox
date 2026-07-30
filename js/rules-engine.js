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
        emails: true, diagrams: true, databases: true, certificates: true, templates: true, cad: true,
        ...enabledCats
    };

    const lowerExt = (ext || "").toLowerCase().replace(/^\./, '');

    switch (lowerExt) {
        case 'pdf':
            return cats.pdf !== false ? (api.i18n.getMessage("folder_pdfs") || "PDFs") : null;
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'webp': case 'svg': case 'tiff': case 'heic': case 'raw': case 'bmp': case 'ico':
            return cats.images !== false ? (api.i18n.getMessage("folder_images") || "Imágenes") : null;
        case 'mp4': case 'mkv': case 'avi': case 'webm': case 'mov': case 'flv': case 'ts': case 'm3u8':
            return cats.video !== false ? (api.i18n.getMessage("folder_videos") || "Videos") : null;
        case 'mp3': case 'wav': case 'ogg': case 'flac': case 'm4a': case 'aac':
            return cats.audio !== false ? (api.i18n.getMessage("folder_audio") || "Audio") : null;
        case 'zip': case 'rar': case '7z': case 'tar': case 'gz': case 'bz2': case 'xz':
            return cats.compressed !== false ? (api.i18n.getMessage("folder_compressed") || "Comprimidos") : null;
        case 'docx': case 'doc': case 'odt': case 'txt': case 'md': case 'rtf': case 'pages':
            return cats.documents !== false ? (api.i18n.getMessage("folder_documents") || "Documentos") : null;
        case 'csv': case 'xlsx': case 'xls': case 'ods': case 'tsv': case 'numbers':
            return cats.spreadsheets !== false ? (api.i18n.getMessage("folder_spreadsheets") || "Hojas de Cálculo") : null;
        case 'ppt': case 'pptx': case 'odp':
            return cats.presentations !== false ? (api.i18n.getMessage("folder_presentations") || "Presentaciones") : null;
        case 'exe': case 'msi': case 'apk': case 'appx': case 'bat': case 'cmd': case 'sh': case 'dmg': case 'pkg': case 'iso': case 'img':
            return cats.programs !== false ? (api.i18n.getMessage("folder_programs") || "Programas") : null;
        case 'psd': case 'ai': case 'indd': case 'blend': case 'fig': case 'cdr':
            return cats.design !== false ? (api.i18n.getMessage("folder_design") || "Diseño") : null;
        case 'html': case 'css': case 'js': case 'ts': case 'json': case 'xml': case 'py': case 'java': case 'cpp': case 'php': case 'sql':
            return cats.code !== false ? (api.i18n.getMessage("folder_code") || "Código") : null;
        case 'epub': case 'mobi': case 'azw3': case 'cbz': case 'cbr':
            return cats.books !== false ? (api.i18n.getMessage("folder_books") || "Libros") : null;
        case 'stl': case 'obj': case 'fbx': case 'gcode':
            return cats.threed !== false ? (api.i18n.getMessage("folder_3d") || "Modelos 3D") : null;
        case 'ttf': case 'otf': case 'woff': case 'woff2':
            return cats.fonts !== false ? (api.i18n.getMessage("folder_fonts") || "Fuentes") : null;
        case 'eml': case 'msg': case 'pst': case 'ost': case 'vcf':
            return cats.emails !== false ? (api.i18n.getMessage("folder_emails") || "Correos") : null;
        case 'vsd': case 'vsdx': case 'drawio': case 'xmind': case 'mm':
            return cats.diagrams !== false ? (api.i18n.getMessage("folder_diagrams") || "Diagramas") : null;
        case 'sqlite': case 'db': case 'accdb': case 'mdb': case 'bak':
            return cats.databases !== false ? (api.i18n.getMessage("folder_databases") || "Bases de Datos") : null;
        case 'crt': case 'pem': case 'pfx': case 'p12': case 'cer': case 'key': case 'ovpn':
            return cats.certificates !== false ? (api.i18n.getMessage("folder_certificates") || "Certificados") : null;
        case 'dotx': case 'xltx': case 'potx': case 'ott': case 'ots': case 'otp':
            return cats.templates !== false ? (api.i18n.getMessage("folder_templates") || "Plantillas") : null;
        case 'dwg': case 'dxf':
            return cats.cad !== false ? (api.i18n.getMessage("folder_cad") || "CAD") : null;
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
