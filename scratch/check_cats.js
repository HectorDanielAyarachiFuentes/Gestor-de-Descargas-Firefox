const fs = require('fs');
const html = fs.readFileSync('pages/options.html', 'utf8');
const catIds = ['cat_pdf', 'cat_images', 'cat_video', 'cat_audio', 'cat_compressed', 'cat_documents', 'cat_spreadsheets', 'cat_presentations', 'cat_programs'];
catIds.forEach(id => {
    if (!html.includes('id="' + id + '"')) {
        console.log('Missing ID:', id);
    }
});
