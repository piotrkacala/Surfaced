(function initializeSurfacedSettings(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SurfacedSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const SCHEMA_VERSION = 1;
  const DEFAULT_THRESHOLD = 7;
  const SETTINGS_EXPORT_FORMAT = "surfaced-settings";
  const SETTINGS_EXPORT_FORMAT_VERSION = 1;
  const SETTINGS_IMPORT_MAX_BYTES = 256 * 1024;

  const KEYS = Object.freeze({
    threshold: "scrollNotifierThreshold",
    text: "scrollNotifierText",
    enabled: "scrollNotifierEnabled",
    disabledDomains: "scrollNotifierDisabledDomains",
    siteOverrides: "scrollNotifierSiteOverrides",
  });

  const STORAGE_KEYS = Object.freeze(Object.values(KEYS));

  const MESSAGE_TYPES = Object.freeze({
    get: "SURFACED_SETTINGS_GET",
    update: "SURFACED_SETTINGS_UPDATE",
    updateSite: "SURFACED_SETTINGS_UPDATE_SITE",
    replace: "SURFACED_SETTINGS_REPLACE",
    retry: "SURFACED_SETTINGS_RETRY",
  });

  function isPlainObject(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function parseThresholdInput(value) {
    const normalized = String(value ?? "").trim().replace(",", ".");
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function normalizeThreshold(value, fallback = DEFAULT_THRESHOLD) {
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : fallback;
  }

  function normalizeText(value, defaultText) {
    if (typeof value !== "string") {
      return defaultText;
    }

    const normalized = value.trim();
    return normalized || defaultText;
  }

  function normalizeHostname(value) {
    if (typeof value !== "string") {
      return null;
    }

    let candidate = value.trim().toLowerCase();
    if (!candidate || /[\s\\/@?#]/.test(candidate)) {
      return null;
    }

    if (candidate.endsWith(".")) {
      candidate = candidate.slice(0, -1);
    }

    if (!candidate || candidate.startsWith(".") || candidate.endsWith(".") || candidate.includes("..")) {
      return null;
    }

    if (candidate.includes(":") && !(candidate.startsWith("[") && candidate.endsWith("]"))) {
      return null;
    }

    try {
      const parsed = new URL(`http://${candidate}/`);
      const hostname = parsed.hostname.toLowerCase();

      if (!hostname || parsed.port || parsed.username || parsed.password) {
        return null;
      }

      if (hostname.length > 253 || ["__proto__", "constructor", "prototype"].includes(hostname)) {
        return null;
      }

      if (!hostname.startsWith("[")) {
        const labels = hostname.split(".");
        const validLabels = labels.every((label) => (
          label.length > 0
          && label.length <= 63
          && /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?$/i.test(label)
        ));
        if (!validLabels) {
          return null;
        }
      }

      return hostname;
    } catch (error) {
      return null;
    }
  }

  function normalizeDisabledDomains(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    const domains = new Set();
    value.forEach((entry) => {
      const hostname = normalizeHostname(entry);
      if (hostname) {
        domains.add(hostname);
      }
    });

    return Array.from(domains).sort();
  }

  function normalizeSiteOverrides(value) {
    if (!isPlainObject(value)) {
      return {};
    }

    const normalizedEntries = new Map();
    Object.entries(value).forEach(([rawHostname, rawThreshold]) => {
      const hostname = normalizeHostname(rawHostname);
      if (!hostname) {
        return;
      }

      normalizedEntries.set(hostname, normalizeThreshold(rawThreshold));
    });

    return Array.from(normalizedEntries.entries())
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .reduce((result, [hostname, threshold]) => {
        result[hostname] = threshold;
        return result;
      }, {});
  }

  function createDefaults(defaultText) {
    const text = typeof defaultText === "string" && defaultText.trim()
      ? defaultText.trim()
      : "Surfaced";

    return {
      [KEYS.threshold]: DEFAULT_THRESHOLD,
      [KEYS.text]: text,
      [KEYS.enabled]: true,
      [KEYS.disabledDomains]: [],
      [KEYS.siteOverrides]: {},
    };
  }

  function normalizeSettings(value, { defaultText = "Surfaced" } = {}) {
    const source = isPlainObject(value) ? value : {};
    const defaults = createDefaults(defaultText);

    return {
      [KEYS.threshold]: normalizeThreshold(source[KEYS.threshold], defaults[KEYS.threshold]),
      [KEYS.text]: normalizeText(source[KEYS.text], defaults[KEYS.text]),
      [KEYS.enabled]: typeof source[KEYS.enabled] === "boolean"
        ? source[KEYS.enabled]
        : defaults[KEYS.enabled],
      [KEYS.disabledDomains]: normalizeDisabledDomains(source[KEYS.disabledDomains]),
      [KEYS.siteOverrides]: normalizeSiteOverrides(source[KEYS.siteOverrides]),
    };
  }

  function serializeSettings(value, options) {
    const normalized = normalizeSettings(value, options);
    return {
      [KEYS.threshold]: normalized[KEYS.threshold],
      [KEYS.text]: normalized[KEYS.text],
      [KEYS.enabled]: normalized[KEYS.enabled],
      [KEYS.disabledDomains]: [...normalized[KEYS.disabledDomains]],
      [KEYS.siteOverrides]: { ...normalized[KEYS.siteOverrides] },
    };
  }

  function validateSettingsSnapshot(value) {
    if (!isPlainObject(value)) {
      throw createSettingsError("IMPORT_SETTINGS_INVALID");
    }

    const keys = Object.keys(value);
    const missingKeys = STORAGE_KEYS.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
    if (missingKeys.length > 0) {
      throw createSettingsError("IMPORT_SETTINGS_MISSING_FIELDS");
    }

    if (keys.some((key) => !STORAGE_KEYS.includes(key))) {
      throw createSettingsError("IMPORT_SETTINGS_UNKNOWN_FIELDS");
    }

    if (
      typeof value[KEYS.threshold] !== "number"
      || !Number.isFinite(value[KEYS.threshold])
      || value[KEYS.threshold] <= 0
    ) {
      throw createSettingsError("IMPORT_THRESHOLD_INVALID");
    }

    if (typeof value[KEYS.text] !== "string" || !value[KEYS.text].trim()) {
      throw createSettingsError("IMPORT_TEXT_INVALID");
    }

    if (typeof value[KEYS.enabled] !== "boolean") {
      throw createSettingsError("IMPORT_ENABLED_INVALID");
    }

    if (!Array.isArray(value[KEYS.disabledDomains])) {
      throw createSettingsError("IMPORT_DISABLED_DOMAINS_INVALID");
    }

    const disabledDomains = [];
    const disabledDomainSet = new Set();
    value[KEYS.disabledDomains].forEach((rawHostname) => {
      if (typeof rawHostname !== "string") {
        throw createSettingsError("IMPORT_DISABLED_DOMAINS_INVALID");
      }

      const hostname = normalizeHostname(rawHostname);
      if (!hostname) {
        throw createSettingsError("IMPORT_HOSTNAME_INVALID");
      }
      if (disabledDomainSet.has(hostname)) {
        throw createSettingsError("IMPORT_HOSTNAME_DUPLICATE");
      }

      disabledDomainSet.add(hostname);
      disabledDomains.push(hostname);
    });

    if (!isPlainObject(value[KEYS.siteOverrides])) {
      throw createSettingsError("IMPORT_OVERRIDES_INVALID");
    }

    const siteOverrides = {};
    const overrideHostnameSet = new Set();
    Object.entries(value[KEYS.siteOverrides]).forEach(([rawHostname, threshold]) => {
      const hostname = normalizeHostname(rawHostname);
      if (!hostname) {
        throw createSettingsError("IMPORT_HOSTNAME_INVALID");
      }
      if (overrideHostnameSet.has(hostname)) {
        throw createSettingsError("IMPORT_HOSTNAME_DUPLICATE");
      }
      if (typeof threshold !== "number" || !Number.isFinite(threshold) || threshold <= 0) {
        throw createSettingsError("IMPORT_OVERRIDE_INVALID");
      }

      overrideHostnameSet.add(hostname);
      siteOverrides[hostname] = threshold;
    });

    return {
      [KEYS.threshold]: value[KEYS.threshold],
      [KEYS.text]: value[KEYS.text].trim(),
      [KEYS.enabled]: value[KEYS.enabled],
      [KEYS.disabledDomains]: disabledDomains.sort(),
      [KEYS.siteOverrides]: Object.fromEntries(
        Object.entries(siteOverrides).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      ),
    };
  }

  function utf8ByteLength(value) {
    if (typeof TextEncoder === "function") {
      return new TextEncoder().encode(value).byteLength;
    }

    return unescape(encodeURIComponent(value)).length;
  }

  function createSettingsExport(value, { exportedAt = new Date(), defaultText = "Surfaced" } = {}) {
    const settings = validateSettingsSnapshot(serializeSettings(value, { defaultText }));
    const timestamp = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
    if (!Number.isFinite(timestamp.getTime())) {
      throw createSettingsError("EXPORT_DATE_INVALID");
    }

    return {
      format: SETTINGS_EXPORT_FORMAT,
      formatVersion: SETTINGS_EXPORT_FORMAT_VERSION,
      exportedAt: timestamp.toISOString(),
      settings,
    };
  }

  function validateSettingsImport(value) {
    if (!isPlainObject(value)) {
      throw createSettingsError("IMPORT_ENVELOPE_INVALID");
    }
    if (value.format !== SETTINGS_EXPORT_FORMAT) {
      throw createSettingsError("IMPORT_FORMAT_INVALID");
    }
    if (!Number.isInteger(value.formatVersion)) {
      throw createSettingsError("IMPORT_VERSION_INVALID");
    }
    if (value.formatVersion !== SETTINGS_EXPORT_FORMAT_VERSION) {
      throw createSettingsError("IMPORT_VERSION_UNSUPPORTED");
    }
    if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
      throw createSettingsError("IMPORT_DATE_INVALID");
    }
    if (!Object.prototype.hasOwnProperty.call(value, "settings")) {
      throw createSettingsError("IMPORT_SETTINGS_MISSING");
    }

    return {
      format: SETTINGS_EXPORT_FORMAT,
      formatVersion: SETTINGS_EXPORT_FORMAT_VERSION,
      exportedAt: value.exportedAt,
      settings: validateSettingsSnapshot(value.settings),
    };
  }

  function parseSettingsImport(text, { byteLength = null } = {}) {
    if (typeof text !== "string") {
      throw createSettingsError("IMPORT_JSON_INVALID");
    }

    const size = byteLength === null ? utf8ByteLength(text) : byteLength;
    if (!Number.isFinite(size) || size < 0 || size > SETTINGS_IMPORT_MAX_BYTES) {
      throw createSettingsError("IMPORT_FILE_TOO_LARGE");
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw createSettingsError("IMPORT_JSON_INVALID", error);
    }

    return validateSettingsImport(parsed);
  }

  function applySiteSettingsIntent(value, intent, options) {
    const settings = normalizeSettings(value, options);
    const hostname = normalizeHostname(intent?.hostname);
    if (!hostname) {
      throw createSettingsError("INVALID_SITE_HOSTNAME");
    }

    const disabledDomains = new Set(settings[KEYS.disabledDomains]);
    const siteOverrides = { ...settings[KEYS.siteOverrides] };

    if (intent.remove === true) {
      disabledDomains.delete(hostname);
      delete siteOverrides[hostname];
    } else {
      if (Object.prototype.hasOwnProperty.call(intent, "enabled")) {
        if (intent.enabled === true) {
          disabledDomains.delete(hostname);
        } else if (intent.enabled === false) {
          disabledDomains.add(hostname);
        } else {
          throw createSettingsError("INVALID_SITE_ENABLED_STATE");
        }
      }

      if (Object.prototype.hasOwnProperty.call(intent, "override")) {
        if (intent.override === null) {
          delete siteOverrides[hostname];
        } else if (
          typeof intent.override === "number"
          && Number.isFinite(intent.override)
          && intent.override > 0
        ) {
          siteOverrides[hostname] = intent.override;
        } else {
          throw createSettingsError("INVALID_SITE_OVERRIDE");
        }
      }
    }

    return normalizeSettings({
      ...settings,
      [KEYS.disabledDomains]: Array.from(disabledDomains),
      [KEYS.siteOverrides]: siteOverrides,
    }, options);
  }

  function getManagedSiteEntries(value, options) {
    const settings = normalizeSettings(value, options);
    const disabledDomains = new Set(settings[KEYS.disabledDomains]);
    const siteOverrides = settings[KEYS.siteOverrides];
    const hostnames = new Set([
      ...disabledDomains,
      ...Object.keys(siteOverrides),
    ]);

    return Array.from(hostnames)
      .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
      .map((hostname) => {
        const hasOverride = Object.prototype.hasOwnProperty.call(siteOverrides, hostname);
        return {
          hostname,
          enabled: !disabledDomains.has(hostname),
          hasOverride,
          threshold: hasOverride ? siteOverrides[hostname] : settings[KEYS.threshold],
        };
      });
  }

  function createSettingsError(code, cause) {
    const error = new Error(code);
    error.code = code;
    error.cause = cause;
    return error;
  }

  function createSettingsStore(storageArea, { defaultText = "Surfaced" } = {}) {
    if (!storageArea || typeof storageArea.get !== "function" || typeof storageArea.set !== "function") {
      throw new TypeError("A storage area with get() and set() is required");
    }

    const normalizationOptions = { defaultText };
    let state = null;
    let status = "idle";
    let loadPromise = null;
    let writeActive = false;
    let activeWritePromise = Promise.resolve();
    const writeQueue = [];
    let replacementPending = false;

    function getState() {
      return state === null ? null : serializeSettings(state, normalizationOptions);
    }

    function load({ force = false } = {}) {
      if (loadPromise) {
        return loadPromise;
      }

      if (state !== null && !force) {
        return Promise.resolve(getState());
      }

      status = "loading";
      loadPromise = Promise.resolve()
        .then(() => storageArea.get(STORAGE_KEYS))
        .then((stored) => {
          state = normalizeSettings(stored, normalizationOptions);
          status = "ready";
          return getState();
        })
        .catch((error) => {
          state = null;
          status = "read-error";
          throw createSettingsError("STORAGE_READ_FAILED", error);
        })
        .finally(() => {
          loadPromise = null;
        });

      return loadPromise;
    }

    function drainWrites() {
      if (writeActive || writeQueue.length === 0) {
        return;
      }

      const job = writeQueue.shift();
      writeActive = true;
      status = "saving";

      let storagePromise;
      try {
        storagePromise = storageArea.set(job.snapshot);
      } catch (error) {
        storagePromise = Promise.reject(error);
      }

      activeWritePromise = Promise.resolve(storagePromise)
        .then(() => {
          job.onSuccess?.();
          status = writeQueue.length > 0 ? "saving" : "ready";
          job.resolve(serializeSettings(job.snapshot, normalizationOptions));
        })
        .catch((error) => {
          job.onFailure?.();
          status = writeQueue.length > 0 ? "saving" : "write-error";
          job.reject(createSettingsError("STORAGE_WRITE_FAILED", error));
        })
        .finally(() => {
          writeActive = false;
          drainWrites();
        });
    }

    function enqueueWrite(snapshot, { onSuccess = null, onFailure = null } = {}) {
      return new Promise((resolve, reject) => {
        writeQueue.push({ snapshot, resolve, reject, onSuccess, onFailure });
        drainWrites();
      });
    }

    function update(patch) {
      if (replacementPending) {
        return Promise.reject(createSettingsError("SETTINGS_REPLACE_PENDING"));
      }
      if (state === null) {
        return load().then(() => update(patch));
      }

      const safePatch = isPlainObject(patch) ? patch : {};
      state = normalizeSettings({ ...state, ...safePatch }, normalizationOptions);
      return enqueueWrite(serializeSettings(state, normalizationOptions));
    }

    function updateSite(intent) {
      if (replacementPending) {
        return Promise.reject(createSettingsError("SETTINGS_REPLACE_PENDING"));
      }
      if (state === null) {
        return load().then(() => updateSite(intent));
      }

      try {
        state = applySiteSettingsIntent(state, intent, normalizationOptions);
      } catch (error) {
        return Promise.reject(error);
      }
      return enqueueWrite(serializeSettings(state, normalizationOptions));
    }

    function replace(settings) {
      if (replacementPending) {
        return Promise.reject(createSettingsError("SETTINGS_REPLACE_PENDING"));
      }
      if (state === null) {
        return load().then(() => replace(settings));
      }

      let nextState;
      try {
        nextState = validateSettingsSnapshot(settings);
      } catch (error) {
        return Promise.reject(error);
      }

      const previousState = getState();
      replacementPending = true;
      state = nextState;

      return enqueueWrite(serializeSettings(nextState, normalizationOptions), {
        onSuccess() {
          replacementPending = false;
        },
        onFailure() {
          state = previousState;
          replacementPending = false;
        },
      });
    }

    function retryWrite() {
      if (state === null) {
        return Promise.reject(createSettingsError("SETTINGS_NOT_LOADED"));
      }

      return enqueueWrite(serializeSettings(state, normalizationOptions));
    }

    async function whenIdle() {
      while (writeActive || writeQueue.length > 0) {
        try {
          await activeWritePromise;
        } catch (error) {
          // The caller inspects the final store status below.
        }
        await Promise.resolve();
      }

      return getState();
    }

    return {
      get schemaVersion() {
        return SCHEMA_VERSION;
      },
      get status() {
        return status;
      },
      getState,
      load,
      retryWrite,
      replace,
      update,
      updateSite,
      whenIdle,
    };
  }

  function errorResponse(phase, error, settings = null) {
    const response = {
      ok: false,
      phase,
      error: error?.code || (phase === "read" ? "STORAGE_READ_FAILED" : "STORAGE_WRITE_FAILED"),
      schemaVersion: SCHEMA_VERSION,
    };

    if (settings) {
      response.settings = settings;
    }

    return response;
  }

  function createSettingsMessageHandler(store) {
    return function handleSettingsMessage(message) {
      if (!message || !Object.values(MESSAGE_TYPES).includes(message.type)) {
        return null;
      }

      if (message.type === MESSAGE_TYPES.get) {
        return (async () => {
          try {
            if (store.status === "write-error" && !message.retry) {
              return errorResponse("write", null, store.getState());
            }

            await store.load({ force: Boolean(message.retry) });
            await store.whenIdle();

            if (store.status === "write-error") {
              return errorResponse("write", null, store.getState());
            }

            return { ok: true, schemaVersion: SCHEMA_VERSION, settings: store.getState() };
          } catch (error) {
            return errorResponse("read", error);
          }
        })();
      }

      if (message.type === MESSAGE_TYPES.retry) {
        const operation = message.phase === "read"
          ? store.load({ force: true })
          : store.retryWrite();

        return operation
          .then((settings) => ({ ok: true, schemaVersion: SCHEMA_VERSION, settings }))
          .catch((error) => errorResponse(message.phase === "read" ? "read" : "write", error, store.getState()));
      }

      const operation = message.type === MESSAGE_TYPES.updateSite
        ? store.updateSite(message.intent)
        : message.type === MESSAGE_TYPES.replace
          ? store.replace(message.settings)
          : store.update(message.patch);

      return operation
        .then((settings) => ({ ok: true, schemaVersion: SCHEMA_VERSION, settings }))
        .catch((error) => errorResponse(error.code === "STORAGE_READ_FAILED" ? "read" : "write", error, store.getState()));
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_THRESHOLD,
    SETTINGS_EXPORT_FORMAT,
    SETTINGS_EXPORT_FORMAT_VERSION,
    SETTINGS_IMPORT_MAX_BYTES,
    KEYS,
    STORAGE_KEYS,
    MESSAGE_TYPES,
    applySiteSettingsIntent,
    createDefaults,
    createSettingsExport,
    createSettingsMessageHandler,
    createSettingsStore,
    getManagedSiteEntries,
    normalizeDisabledDomains,
    normalizeHostname,
    normalizeSettings,
    normalizeSiteOverrides,
    normalizeThreshold,
    parseSettingsImport,
    parseThresholdInput,
    serializeSettings,
    validateSettingsImport,
    validateSettingsSnapshot,
  });
});
