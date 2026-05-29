const fs = require('fs');
let html = fs.readFileSync('c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/pages/options.html', 'utf8');

const extsMap = {
    'cat_pdf': 'pdf',
    'cat_images': 'jpg, jpeg, png, gif, webp, svg, tiff, heic, raw, bmp, ico',
    'cat_video': 'mp4, mkv, avi, webm, mov, flv, ts, m3u8',
    'cat_audio': 'mp3, wav, ogg, flac, m4a, aac',
    'cat_compressed': 'zip, rar, 7z, tar, gz, bz2, xz',
    'cat_documents': 'docx, doc, odt, txt, md, rtf',
    'cat_spreadsheets': 'csv, xlsx, xls, ods',
    'cat_presentations': 'ppt, pptx, odp',
    'cat_programs': 'exe, msi, apk, appx, bat, cmd, sh, dmg, pkg, iso, img',
    'cat_design': 'psd, ai, indd, blend, fig, cdr',
    'cat_code': 'html, css, js, ts, json, xml, py, java, cpp, php, sql',
    'cat_books': 'epub, mobi, azw3, cbz, cbr',
    'cat_3d': 'stl, obj, fbx, gcode',
    'cat_fonts': 'ttf, otf, woff, woff2'
};

for (const [id, exts] of Object.entries(extsMap)) {
    // Find <span class="pill-exts">...</span> within the corresponding block
    const regex = new RegExp('<input type="checkbox" id="' + id + '">\\s*<div class="pill-text"><span data-i18n="[^"]+"><\\/span><span class="pill-exts">.*?<\\/span><\\/div>');
    const match = html.match(regex);
    if (match) {
        let replacement = match[0].replace(/<span class="pill-exts">.*?<\/span>/, '<span class="pill-exts">' + exts + '</span>');
        html = html.replace(match[0], replacement);
    } else {
        console.log("No match for " + id);
    }
}

fs.writeFileSync('c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/pages/options.html', html);
console.log('HTML Updated with full extensions');
