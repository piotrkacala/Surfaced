(() => {
  if (globalThis.browser || !globalThis.chrome) {
    return;
  }

  const chromeApi = globalThis.chrome;

  function promisify(namespace, methodName) {
    const method = namespace?.[methodName];
    if (typeof method !== "function") {
      return undefined;
    }

    return (...args) => new Promise((resolve, reject) => {
      try {
        method.call(namespace, ...args, (result) => {
          const lastError = chromeApi.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }

          resolve(result);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  globalThis.browser = {
    action: {
      setBadgeText: promisify(chromeApi.action, "setBadgeText"),
      setBadgeBackgroundColor: promisify(chromeApi.action, "setBadgeBackgroundColor"),
    },
    i18n: chromeApi.i18n,
    runtime: {
      getURL: chromeApi.runtime.getURL.bind(chromeApi.runtime),
      getPlatformInfo: promisify(chromeApi.runtime, "getPlatformInfo"),
      onMessage: chromeApi.runtime.onMessage,
      sendMessage: promisify(chromeApi.runtime, "sendMessage"),
    },
    storage: {
      local: {
        get: promisify(chromeApi.storage?.local, "get"),
        set: promisify(chromeApi.storage?.local, "set"),
      },
      onChanged: chromeApi.storage?.onChanged,
    },
    tabs: {
      query: promisify(chromeApi.tabs, "query"),
      sendMessage: promisify(chromeApi.tabs, "sendMessage"),
    },
  };
})();
