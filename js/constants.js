// constants.js

export const STORAGE_KEYS = {
    AUTO_ORGANIZE: "autoOrganize",
    CUSTOM_RULES: "customRules",
    CUSTOM_CATEGORIES: "customCategories",
    DEFAULT_CATEGORIES: "defaultCategories",
    CONTEXT_MENU: "contextMenu",
    NOTIFICATIONS: "notifications",
    DOWNLOAD_HISTORY: "downloadHistory",
    IGNORED_SUGGESTIONS: "ignoredSuggestions",
    SUGGESTION_TRACKER: "suggestionTracker",
    FORCE_NEXT_DOWNLOAD: "forceNextDownload",
    DETERMINED_DESTINATIONS: "determinedDestinations"
};

export const DEFAULT_SETTINGS = {
    autoOrganize: true,
    customRules: [],
    customCategories: [],
    defaultCategories: {
        pdf: true, images: true, video: true, audio: true,
        compressed: true, documents: true, spreadsheets: true, presentations: true, programs: true,
        design: true, code: true, books: true, threed: true, fonts: true,
        emails: true, diagrams: true, databases: true, certificates: true, templates: true, cad: true
    }
};

export const NOTIFICATION_PRIORITY = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2
};
