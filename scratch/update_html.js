const fs = require('fs');
let html = fs.readFileSync('c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/pages/options.html', 'utf8');

const extsMap = {
    'cat_pdf': 'pdf',
    'cat_images': 'png, jpg, svg, webp, heic...',
    'cat_video': 'mp4, mkv, mov, webm, avi...',
    'cat_audio': 'mp3, wav, flac, ogg, m4a...',
    'cat_compressed': 'zip, rar, 7z, tar, gz...',
    'cat_documents': 'docx, pdf, epub, txt...',
    'cat_spreadsheets': 'xlsx, csv, ods...',
    'cat_presentations': 'pptx, ppt, odp...',
    'cat_programs': 'exe, apk, dmg, iso...',
    'cat_design': 'psd, ai, fig, blend...',
    'cat_code': 'html, css, js, py, json...',
    'cat_books': 'epub, mobi, cbz, azw3...',
    'cat_3d': 'stl, obj, fbx...',
    'cat_fonts': 'ttf, otf, woff...'
};

for (const [id, exts] of Object.entries(extsMap)) {
    const regex = new RegExp('<label class="checkbox-pill" data-i18n-title="[^"]+">\\s*<input type="checkbox" id="' + id + '"> <span data-i18n="[^"]+"></span>\\s*</label>');
    const match = html.match(regex);
    if (match) {
        let replacement = match[0].replace(/<span data-i18n="([^"]+)"><\/span>/, '<div class="pill-text"><span data-i18n="$1"></span><span class="pill-exts">' + exts + '</span></div>');
        html = html.replace(match[0], replacement);
    } else {
        console.log("No match for " + id);
    }
}

fs.writeFileSync('c:/Users/Ramoncito/.antigravity-ide/Gestor-de-Descargas-Firefox/pages/options.html', html);
console.log('HTML Updated');
