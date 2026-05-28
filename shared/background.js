// ── Background Script ───────────────────────────────────────────────────────
// Receives scroll depth updates from content scripts and updates the toolbar badge.

if (typeof browser === "undefined" && typeof importScripts === "function") {
    importScripts("extension-api.js");
}

browser.runtime.onMessage.addListener((message, sender) => {
    if (message.type === "SCROLL_DEPTH" && sender.tab?.id) {
        // The content script sends an integer depth, or 0 to clear the badge.
        const depth = message.value;
        const text = depth >= 1 ? Math.floor(depth).toString() : "";

        browser.action.setBadgeText({
            text: text,
            tabId: sender.tab.id
        }).catch(() => { });

        // Match the cyan theme of the extension (#00d4ff)
        browser.action.setBadgeBackgroundColor({
            color: "#00d4ff",
            tabId: sender.tab.id
        }).catch(() => { }); // Catch in case of older browser version
    }
});
