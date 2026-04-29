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
    if (token === "HOST" && values[0] !== undefined) {
      return String(values[0]);
    }

    const numericIndex = Number(token);
    if (Number.isInteger(numericIndex) && values[numericIndex - 1] !== undefined) {
      return String(values[numericIndex - 1]);
    }

    return match;
  });
}

function createStorageArea(initialStore, changeListeners) {
  const store = { ...initialStore };

  function notify(changes) {
    if (Object.keys(changes).length === 0) {
      return;
    }

    changeListeners.forEach((listener) => listener(changes, "local"));
  }

  return {
    async get(keys) {
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
  const storageArea = createStorageArea(state.storage, storageChangeListeners);
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
      async query() {
        return [{ id: 1, url: state.tabUrl }];
      },
      sendMessage() {
        return Promise.resolve();
      },
    },
    runtime: {
      getURL(path) {
        return new URL(path, `${window.location.origin}/`).toString();
      },
      sendMessage() {
        return Promise.resolve();
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
      setBadgeText() {
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
  };

  return state;
}
