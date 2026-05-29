const fs = require('fs');
const code = `
api.runtime.onInstalled.addListener(() => {
    api.storage.sync.remove("defaultCategories");
});
`;
fs.appendFileSync('js/background.js', code);
