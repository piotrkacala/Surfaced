(function initializeSurfacedSessionPause(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SurfacedSessionPause = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const SESSION_KEY = "scrollNotifierSessionPaused";

  const MESSAGE_TYPES = Object.freeze({
    get: "GET_SESSION_STATE",
    set: "SET_SESSION_PAUSED",
    changed: "SESSION_PAUSED_CHANGED",
  });

  function createSessionError(code, cause) {
    const error = new Error(code);
    error.code = code;
    error.cause = cause;
    return error;
  }

  function normalizeStoredState(value) {
    return value?.[SESSION_KEY] === true;
  }

  function createSessionPauseController({
    storageArea,
    tabsApi,
    actionApi,
    runtimeApi,
  } = {}) {
    if (!storageArea || typeof storageArea.get !== "function" || typeof storageArea.set !== "function") {
      throw new TypeError("A session storage area with get() and set() is required");
    }

    let paused = null;
    let operationQueue = Promise.resolve();

    function enqueue(operation) {
      const result = operationQueue
        .catch(() => undefined)
        .then(operation);

      operationQueue = result.then(
        () => undefined,
        () => undefined
      );

      return result;
    }

    async function broadcast(nextPaused) {
      const message = {
        type: MESSAGE_TYPES.changed,
        paused: nextPaused,
      };

      let tabs = [];
      try {
        tabs = typeof tabsApi?.query === "function"
          ? await tabsApi.query({})
          : [];
      } catch (error) {
        tabs = [];
      }

      const tabOperations = tabs
        .filter((tab) => Number.isInteger(tab?.id))
        .flatMap((tab) => {
          const operations = [];

          if (typeof actionApi?.setBadgeText === "function") {
            operations.push(
              Promise.resolve()
                .then(() => actionApi.setBadgeText({ text: "", tabId: tab.id }))
                .catch(() => undefined)
            );
          }

          if (typeof tabsApi?.sendMessage === "function") {
            operations.push(
              Promise.resolve()
                .then(() => tabsApi.sendMessage(tab.id, message))
                .catch(() => undefined)
            );
          }

          return operations;
        });

      await Promise.all(tabOperations);

      // Content scripts receive the tab broadcast above. Extension pages such as
      // simultaneously open popups receive the runtime copy.
      if (typeof runtimeApi?.sendMessage === "function") {
        await Promise.resolve()
          .then(() => runtimeApi.sendMessage(message))
          .catch(() => undefined);
      }
    }

    function getState() {
      return enqueue(async () => {
        if (paused === null) {
          let stored;
          try {
            stored = await storageArea.get(SESSION_KEY);
          } catch (error) {
            throw createSessionError("SESSION_STORAGE_READ_FAILED", error);
          }
          paused = normalizeStoredState(stored);
        }

        return { paused };
      });
    }

    function setPaused(nextPaused) {
      const normalizedPaused = nextPaused === true;

      return enqueue(async () => {
        try {
          await storageArea.set({ [SESSION_KEY]: normalizedPaused });
        } catch (error) {
          throw createSessionError("SESSION_STORAGE_WRITE_FAILED", error);
        }

        paused = normalizedPaused;
        await broadcast(paused);
        return { paused };
      });
    }

    function handleMessage(message) {
      if (!message || ![MESSAGE_TYPES.get, MESSAGE_TYPES.set].includes(message.type)) {
        return null;
      }

      const operation = message.type === MESSAGE_TYPES.get
        ? getState()
        : setPaused(message.paused);

      return operation
        .then((state) => ({ ok: true, ...state }))
        .catch((error) => ({
          ok: false,
          error: error?.code || "SESSION_STATE_FAILED",
        }));
    }

    return Object.freeze({
      broadcast,
      getState,
      handleMessage,
      setPaused,
    });
  }

  return Object.freeze({
    SESSION_KEY,
    MESSAGE_TYPES,
    createSessionPauseController,
    normalizeStoredState,
  });
});
