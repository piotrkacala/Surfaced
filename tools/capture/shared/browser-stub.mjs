import { getCaptureState } from "./capture-state.mjs";
import { EN_MESSAGES } from "./en-messages.mjs";

function formatMessage(template, substitutions) {
  if (!template) {
    return "";
  }

  const values = Array.isArray(substitutions)
    ? substitutions
    : substitutions === undefined
      ? []
      : [substitutions];

  return template.replace(/\$([A-Z0-9_]+)\$/gi, (match, token) => {
    if (["HOST", "VALUE"].includes(token.toUpperCase()) && values[0] !== undefined) {
      return String(values[0]);
    }

    const numericIndex = Number(token);
    if (Number.isInteger(numericIndex) && values[numericIndex - 1] !== undefined) {
      return String(values[numericIndex - 1]);
    }

    return match;
  });
}

function createStorageArea(initialStore, changeListeners, failureState) {
  const store = { ...initialStore };

  function notify(changes) {
    if (Object.keys(changes).length === 0) {
      return;
    }

    changeListeners.forEach((listener) => listener(changes, "local"));
  }

  return {
    async get(keys) {
      if (failureState.get > 0) {
        failureState.get -= 1;
        throw new Error("Injected storage.get failure");
      }

      if (keys === null || keys === undefined) {
        return { ...store };
      }

      if (Array.isArray(keys)) {
        return keys.reduce((result, key) => {
          if (Object.prototype.hasOwnProperty.call(store, key)) {
            result[key] = store[key];
          }
          return result;
        }, {});
      }

      if (typeof keys === "string") {
        return Object.prototype.hasOwnProperty.call(store, keys) ? { [keys]: store[keys] } : {};
      }

      if (typeof keys === "object") {
        return Object.keys(keys).reduce((result, key) => {
          result[key] = Object.prototype.hasOwnProperty.call(store, key) ? store[key] : keys[key];
          return result;
        }, {});
      }

      return {};
    },

    async set(values) {
      if (failureState.set > 0) {
        failureState.set -= 1;
        throw new Error("Injected storage.set failure");
      }

      const changes = {};
      Object.entries(values).forEach(([key, value]) => {
        const oldValue = store[key];
        store[key] = value;
        changes[key] = { oldValue, newValue: value };
      });

      notify(changes);
    },

    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes = {};

      list.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(store, key)) {
          changes[key] = {
            oldValue: store[key],
            newValue: undefined,
          };
          delete store[key];
        }
      });

      notify(changes);
    },
  };
}

export function installBrowserStub() {
  const state = getCaptureState();
  if (window.browser) {
    return state;
  }

  const storageChangeListeners = [];
  const runtimeListeners = [];
  const runtimeMessages = [];
  const permissionCalls = [];
  const tabCalls = [];
  const failureState = {
    get: state.storageGetFailures,
    set: state.storageSetFailures,
  };
  const sessionFailureState = {
    get: state.sessionGetFailures,
    set: state.sessionSetFailures,
  };
  let sessionPaused = state.sessionPaused;
  let permissionState = state.permissionState;
  const badgeValues = [];
  const storageArea = createStorageArea(state.storage, storageChangeListeners, failureState);
  const settingsStore = window.SurfacedSettings.createSettingsStore(storageArea, {
    defaultText: EN_MESSAGES.defaultNotificationText,
  });
  const handleSettingsMessage = window.SurfacedSettings.createSettingsMessageHandler(settingsStore);
  const sessionMessageTypes = window.SurfacedSessionPause.MESSAGE_TYPES;

  async function handleSessionMessage(message) {
    if (message?.type === sessionMessageTypes.get) {
      if (sessionFailureState.get > 0) {
        sessionFailureState.get -= 1;
        return { ok: false, error: "SESSION_STORAGE_READ_FAILED" };
      }
      return { ok: true, paused: sessionPaused };
    }

    if (message?.type === sessionMessageTypes.set) {
      if (sessionFailureState.set > 0) {
        sessionFailureState.set -= 1;
        return { ok: false, error: "SESSION_STORAGE_WRITE_FAILED" };
      }

      sessionPaused = message.paused === true;
      const changedMessage = {
        type: sessionMessageTypes.changed,
        paused: sessionPaused,
      };
      runtimeListeners.forEach((listener) => listener(changedMessage, {}));
      return { ok: true, paused: sessionPaused };
    }

    return null;
  }
  const platformOs = state.platform === "android" ? "android" : "linux";

  window.browser = {
    i18n: {
      getMessage(key, substitutions) {
        return formatMessage(EN_MESSAGES[key], substitutions);
      },
      getUILanguage() {
        return state.language;
      },
    },
    storage: {
      local: storageArea,
      onChanged: {
        addListener(listener) {
          storageChangeListeners.push(listener);
        },
      },
    },
    tabs: {
      async create(details) {
        tabCalls.push({ method: "create", details });
        if (state.tabCreateFailures > 0) {
          state.tabCreateFailures -= 1;
          throw new Error("Injected tabs.create failure");
        }
        return { id: 2, ...details };
      },
      async getCurrent() {
        tabCalls.push({ method: "getCurrent" });
        return { id: 1 };
      },
      async query() {
        return [state.tabUrl === null ? { id: 1 } : { id: 1, url: state.tabUrl }];
      },
      async remove(tabId) {
        tabCalls.push({ method: "remove", tabId });
        if (state.tabCloseFailures > 0) {
          state.tabCloseFailures -= 1;
          throw new Error("Injected tabs.remove failure");
        }
      },
      sendMessage() {
        return Promise.resolve();
      },
    },
    permissions: {
      async contains(details) {
        permissionCalls.push({ method: "contains", details });
        if (permissionState === "exception") {
          throw new Error("Injected permissions.contains failure");
        }
        return permissionState === "full";
      },
      async getAll() {
        permissionCalls.push({ method: "getAll" });
        if (permissionState === "getall-exception") {
          throw new Error("Injected permissions.getAll failure");
        }
        return {
          permissions: ["storage"],
          origins: permissionState === "full"
            ? ["<all_urls>"]
            : permissionState === "partial"
              ? ["https://quiet.example/*"]
              : [],
        };
      },
      async request(details) {
        permissionCalls.push({ method: "request", details });
        if (state.permissionRequestOutcome === "exception") {
          throw new Error("Injected permissions.request failure");
        }
        if (state.permissionRequestOutcome === "deny") {
          return false;
        }
        if (state.permissionRequestOutcome === "grant") {
          permissionState = "full";
          return true;
        }
        if (state.permissionRequestOutcome === "partial") {
          permissionState = "partial";
          return true;
        }
        // "true-unverified" deliberately leaves contains() false.
        return true;
      },
    },
    runtime: {
      getURL(path) {
        return new URL(path, `${window.location.origin}/`).toString();
      },
      sendMessage(message) {
        runtimeMessages.push(message);
        const settingsResponse = handleSettingsMessage(message);
        return settingsResponse || handleSessionMessage(message) || Promise.resolve();
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        },
      },
      getPlatformInfo() {
        return Promise.resolve({ os: platformOs });
      },
    },
    action: {
      setBadgeText(details) {
        badgeValues.push(details);
        return Promise.resolve();
      },
      setBadgeBackgroundColor() {
        return Promise.resolve();
      },
    },
  };

  window.__SURFACED_CAPTURE__ = {
    state,
    runtimeListeners,
    runtimeMessages,
    permissionCalls,
    tabCalls,
    failureState,
    sessionFailureState,
    get sessionPaused() {
      return sessionPaused;
    },
    badgeValues,
    storageArea,
    settingsStore,
  };

  return state;
}
