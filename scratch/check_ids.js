const fs = require('fs');
const js = fs.readFileSync('js/options.js', 'utf8');
const html = fs.readFileSync('pages/options.html', 'utf8');
const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
let match;
while ((match = regex.exec(js)) !== null) {
    const id = match[1];
    if (!html.includes('id="' + id + '"')) {
        console.log('Missing ID:', id);
    }
}
