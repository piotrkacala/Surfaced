// ── Background Script ───────────────────────────────────────────────────────
// Owns serialized settings writes, session pause state, and toolbar badges.

if (typeof browser === "undefined" && typeof importScripts === "function") {
    importScripts("extension-api.js");
}

if (!globalThis.SurfacedSettings && typeof importScripts === "function") {
    importScripts("settings.js");
}

if (!globalThis.SurfacedSessionPause && typeof importScripts === "function") {
    importScripts("session-pause.js");
}

const settingsStore = SurfacedSettings.createSettingsStore(browser.storage.local, {
    defaultText: browser.i18n.getMessage("defaultNotificationText")
});
const handleSettingsMessage = SurfacedSettings.createSettingsMessageHandler(settingsStore);
const sessionPauseController = SurfacedSessionPause.createSessionPauseController({
    storageArea: browser.storage.session,
    tabsApi: browser.tabs,
    actionApi: browser.action,
    runtimeApi: browser.runtime
});

function setBadgeValue(tabId, value) {
    const text = value >= 1 ? Math.floor(value).toString() : "";

    return Promise.all([
        browser.action.setBadgeText({ text, tabId }).catch(() => { }),
        browser.action.setBadgeBackgroundColor({ color: "#00d4ff", tabId }).catch(() => { })
    ]);
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const settingsResponse = handleSettingsMessage(message);
    if (settingsResponse) {
        settingsResponse.then(sendResponse);
        // Keep the message channel and the MV3 background alive until storage settles.
        return true;
    }

    const sessionResponse = sessionPauseController.handleMessage(message);
    if (sessionResponse) {
        sessionResponse.then(sendResponse);
        return true;
    }

    if (message.type === "SCROLL_DEPTH" && Number.isInteger(sender.tab?.id)) {
        // The background guards badge updates too, so a newly loaded or stale
        // content script cannot repopulate a badge while the session is paused.
        sessionPauseController.getState()
            .then(({ paused }) => setBadgeValue(sender.tab.id, paused ? 0 : message.value))
            .catch(() => setBadgeValue(sender.tab.id, 0));
    }

    return undefined;
});
