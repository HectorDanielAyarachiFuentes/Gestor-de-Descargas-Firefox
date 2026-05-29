const fs = require('fs');
const code = `

function updateBadgeText() {
    api.storage.local.get("downloadHistory", (data) => {
        const history = data.downloadHistory || [];
        const recentCount = history.filter(h => {
            const hDate = new Date(h.date);
            const now = new Date();
            return (now - hDate) < 24 * 60 * 60 * 1000;
        }).length;
        
        if (recentCount > 0) {
            api.action.setBadgeText({ text: recentCount.toString() });
            api.action.setBadgeBackgroundColor({ color: "#ec4899" });
        } else {
            api.action.setBadgeText({ text: "" });
        }
    });
}

api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.downloadHistory) {
        updateBadgeText();
    }
});

updateBadgeText();
`;
fs.appendFileSync('js/background.js', code);
