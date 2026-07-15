"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  KEYS,
  MESSAGE_TYPES,
  SETTINGS_EXPORT_FORMAT,
  SETTINGS_EXPORT_FORMAT_VERSION,
  SETTINGS_IMPORT_MAX_BYTES,
  createSettingsExport,
  createSettingsMessageHandler,
  createSettingsStore,
  parseSettingsImport,
  validateSettingsImport,
} = require("../shared/settings.js");
const {
  MESSAGE_TYPES: SESSION_MESSAGE_TYPES,
  SESSION_KEY,
  createSessionPauseController,
} = require("../shared/session-pause.js");

const DEFAULT_TEXT = "You've drifted pretty far. Come up for air.";
const COMPLETE_SETTINGS = {
  [KEYS.threshold]: 20.125,
  [KEYS.text]: "Take a breath before the next page.",
  [KEYS.enabled]: false,
  [KEYS.disabledDomains]: ["News.Example.", "social.example"],
  [KEYS.siteOverrides]: {
    "Quiet.Example.": 5.5,
    "long.example": 100,
  },
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createStorage(initial = {}, { setFailures = 0, setDelay = 0 } = {}) {
  const data = clone(initial);
  const setCalls = [];

  return {
    data,
    setCalls,
    async get(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        list
          .filter((key) => Object.prototype.hasOwnProperty.call(data, key))
          .map((key) => [key, clone(data[key])])
      );
    },
    async set(values) {
      setCalls.push(clone(values));
      if (setDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, setDelay));
      }
      if (setFailures > 0) {
        setFailures -= 1;
        throw new Error("storage.set failed");
      }
      Object.assign(data, clone(values));
    },
  };
}

function exported(settings = COMPLETE_SETTINGS, overrides = {}) {
  return {
    format: SETTINGS_EXPORT_FORMAT,
    formatVersion: SETTINGS_EXPORT_FORMAT_VERSION,
    exportedAt: "2026-07-15T12:00:00.000Z",
    settings,
    ...overrides,
  };
}

function expectImportError(value, code) {
  assert.throws(
    () => typeof value === "string"
      ? parseSettingsImport(value)
      : validateSettingsImport(value),
    (error) => error?.code === code
  );
}

test("all five persistent settings round-trip through the versioned export format", () => {
  const envelope = createSettingsExport(COMPLETE_SETTINGS, {
    exportedAt: new Date("2026-07-15T12:00:00.000Z"),
    defaultText: DEFAULT_TEXT,
  });
  const parsed = parseSettingsImport(JSON.stringify(envelope));

  assert.deepEqual(envelope, {
    format: "surfaced-settings",
    formatVersion: 1,
    exportedAt: "2026-07-15T12:00:00.000Z",
    settings: {
      ...COMPLETE_SETTINGS,
      [KEYS.disabledDomains]: ["news.example", "social.example"],
      [KEYS.siteOverrides]: {
        "long.example": 100,
        "quiet.example": 5.5,
      },
    },
  });
  assert.deepEqual(parsed, envelope);
  assert.deepEqual(Object.keys(envelope.settings), Object.values(KEYS));
  assert.equal(Object.prototype.hasOwnProperty.call(envelope, SESSION_KEY), false);
  assert.equal(Object.prototype.hasOwnProperty.call(envelope.settings, SESSION_KEY), false);
});

test("Unicode reminder text and internationalized hostnames round-trip without data loss", () => {
  const unicodeSettings = {
    ...COMPLETE_SETTINGS,
    [KEYS.text]: "Wynurz się 🌊 — zażółć gęślą jaźń — こんにちは",
    [KEYS.disabledDomains]: ["BÜCHER.de"],
    [KEYS.siteOverrides]: { "ŻÓŁW.example": 8.5 },
  };

  const envelope = createSettingsExport(unicodeSettings, {
    exportedAt: new Date("2026-07-15T12:00:00.000Z"),
    defaultText: DEFAULT_TEXT,
  });
  const parsed = parseSettingsImport(JSON.stringify(envelope));

  assert.equal(parsed.settings[KEYS.text], unicodeSettings[KEYS.text]);
  assert.deepEqual(parsed.settings[KEYS.disabledDomains], ["xn--bcher-kva.de"]);
  assert.deepEqual(parsed.settings[KEYS.siteOverrides], { "xn--w-uga1v8h.example": 8.5 });
});

test("malformed JSON and invalid envelope fields are rejected", () => {
  expectImportError("{ definitely not json", "IMPORT_JSON_INVALID");
  expectImportError([], "IMPORT_ENVELOPE_INVALID");
  expectImportError(exported(COMPLETE_SETTINGS, { format: "some-other-product" }), "IMPORT_FORMAT_INVALID");
  expectImportError(exported(COMPLETE_SETTINGS, { formatVersion: "1" }), "IMPORT_VERSION_INVALID");
  expectImportError(exported(COMPLETE_SETTINGS, { formatVersion: 2 }), "IMPORT_VERSION_UNSUPPORTED");
  expectImportError(exported(COMPLETE_SETTINGS, { exportedAt: "yesterday" }), "IMPORT_DATE_INVALID");
  expectImportError({
    format: SETTINGS_EXPORT_FORMAT,
    formatVersion: SETTINGS_EXPORT_FORMAT_VERSION,
    exportedAt: "2026-07-15T12:00:00.000Z",
  }, "IMPORT_SETTINGS_MISSING");
});

test("unknown envelope fields are ignored but settings require exactly all five known fields", () => {
  const withEnvelopeMetadata = validateSettingsImport(exported(COMPLETE_SETTINGS, {
    deviceLabel: "local backup",
  }));
  assert.equal(Object.prototype.hasOwnProperty.call(withEnvelopeMetadata, "deviceLabel"), false);

  const missing = clone(COMPLETE_SETTINGS);
  delete missing[KEYS.text];
  expectImportError(exported(missing), "IMPORT_SETTINGS_MISSING_FIELDS");

  expectImportError(exported({ ...COMPLETE_SETTINGS, extraPersistentSetting: true }), "IMPORT_SETTINGS_UNKNOWN_FIELDS");
});

test("wrong types for every persistent setting are rejected before writing", () => {
  const cases = [
    [KEYS.threshold, "20", "IMPORT_THRESHOLD_INVALID"],
    [KEYS.threshold, 0, "IMPORT_THRESHOLD_INVALID"],
    [KEYS.text, ["not text"], "IMPORT_TEXT_INVALID"],
    [KEYS.text, "   ", "IMPORT_TEXT_INVALID"],
    [KEYS.enabled, "false", "IMPORT_ENABLED_INVALID"],
    [KEYS.disabledDomains, "example.com", "IMPORT_DISABLED_DOMAINS_INVALID"],
    [KEYS.disabledDomains, ["example.com", 42], "IMPORT_DISABLED_DOMAINS_INVALID"],
    [KEYS.siteOverrides, [], "IMPORT_OVERRIDES_INVALID"],
  ];

  cases.forEach(([key, value, code]) => {
    expectImportError(exported({ ...COMPLETE_SETTINGS, [key]: value }), code);
  });
});

test("duplicate and unsafe hostnames are rejected while safe hostnames are normalized", () => {
  expectImportError(exported({
    ...COMPLETE_SETTINGS,
    [KEYS.disabledDomains]: ["Example.COM.", "example.com"],
  }), "IMPORT_HOSTNAME_DUPLICATE");

  expectImportError(exported({
    ...COMPLETE_SETTINGS,
    [KEYS.disabledDomains]: ["example.com/path"],
  }), "IMPORT_HOSTNAME_INVALID");

  expectImportError(exported({
    ...COMPLETE_SETTINGS,
    [KEYS.siteOverrides]: JSON.parse('{"__proto__":12}'),
  }), "IMPORT_HOSTNAME_INVALID");

  expectImportError(exported({
    ...COMPLETE_SETTINGS,
    [KEYS.siteOverrides]: { "Example.COM.": 12, "example.com": 14 },
  }), "IMPORT_HOSTNAME_DUPLICATE");

  const normalized = validateSettingsImport(exported({
    ...COMPLETE_SETTINGS,
    [KEYS.disabledDomains]: ["BÜCHER.de"],
    [KEYS.siteOverrides]: { "Quiet.Example.": 5.5 },
  }));
  assert.deepEqual(normalized.settings[KEYS.disabledDomains], ["xn--bcher-kva.de"]);
  assert.deepEqual(normalized.settings[KEYS.siteOverrides], { "quiet.example": 5.5 });
});

test("invalid site overrides are rejected without applying ADR-003 defaults", () => {
  for (const threshold of ["12", 0, -1, null, Infinity]) {
    expectImportError(exported({
      ...COMPLETE_SETTINGS,
      [KEYS.siteOverrides]: { "example.com": threshold },
    }), "IMPORT_OVERRIDE_INVALID");
  }

  const valid = validateSettingsImport(exported({
    ...COMPLETE_SETTINGS,
    [KEYS.threshold]: 0.001,
    [KEYS.siteOverrides]: { "example.com": Number.MAX_VALUE },
  }));
  assert.equal(valid.settings[KEYS.threshold], 0.001);
  assert.equal(valid.settings[KEYS.siteOverrides]["example.com"], Number.MAX_VALUE);
});

test("oversized files are rejected before JSON parsing", () => {
  expectImportError(
    "x".repeat(SETTINGS_IMPORT_MAX_BYTES + 1),
    "IMPORT_FILE_TOO_LARGE"
  );
});

test("confirmed import performs one complete background-owned write", async () => {
  const initial = createSettingsExport({
    ...COMPLETE_SETTINGS,
    [KEYS.threshold]: 7,
  }, { defaultText: DEFAULT_TEXT }).settings;
  const storage = createStorage(initial);
  const store = createSettingsStore(storage, { defaultText: DEFAULT_TEXT });
  const handle = createSettingsMessageHandler(store);
  await handle({ type: MESSAGE_TYPES.get });

  const imported = parseSettingsImport(JSON.stringify(createSettingsExport(COMPLETE_SETTINGS, {
    defaultText: DEFAULT_TEXT,
  })));
  const response = await handle({ type: MESSAGE_TYPES.replace, settings: imported.settings });

  assert.equal(response.ok, true);
  assert.equal(storage.setCalls.length, 1);
  assert.deepEqual(storage.setCalls[0], imported.settings);
  assert.deepEqual(storage.data, imported.settings);
});

test("failed import write rolls the background store back and leaves session pause untouched", async () => {
  const initial = createSettingsExport({
    ...COMPLETE_SETTINGS,
    [KEYS.threshold]: 7,
    [KEYS.text]: DEFAULT_TEXT,
  }, { defaultText: DEFAULT_TEXT }).settings;
  const storage = createStorage(initial, { setFailures: 1 });
  const store = createSettingsStore(storage, { defaultText: DEFAULT_TEXT });
  const handle = createSettingsMessageHandler(store);
  await handle({ type: MESSAGE_TYPES.get });

  const sessionStorage = createStorage({ [SESSION_KEY]: true });
  const sessionController = createSessionPauseController({ storageArea: sessionStorage });
  assert.deepEqual(await sessionController.handleMessage({ type: SESSION_MESSAGE_TYPES.get }), {
    ok: true,
    paused: true,
  });

  const failed = await handle({ type: MESSAGE_TYPES.replace, settings: createSettingsExport(COMPLETE_SETTINGS, {
    defaultText: DEFAULT_TEXT,
  }).settings });

  assert.equal(failed.ok, false);
  assert.equal(failed.phase, "write");
  assert.equal(storage.setCalls.length, 1);
  assert.deepEqual(storage.data, initial);
  assert.deepEqual(store.getState(), initial);
  assert.deepEqual(failed.settings, initial);
  assert.equal((await sessionController.getState()).paused, true);
  assert.deepEqual(sessionStorage.setCalls, []);
});

test("size limit accepts the boundary and rejects the first byte over it", () => {
  const text = JSON.stringify(exported(COMPLETE_SETTINGS));
  assert.doesNotThrow(() => parseSettingsImport(text, { byteLength: SETTINGS_IMPORT_MAX_BYTES }));
  assert.throws(
    () => parseSettingsImport(text, { byteLength: SETTINGS_IMPORT_MAX_BYTES + 1 }),
    (error) => error?.code === "IMPORT_FILE_TOO_LARGE"
  );
});

for (const closeAfterMs of [0, 50, 100]) {
  test(`full import continues in the background when popup closes after ${closeAfterMs} ms`, async () => {
    const initial = createSettingsExport({
      ...COMPLETE_SETTINGS,
      [KEYS.threshold]: 7,
      [KEYS.text]: DEFAULT_TEXT,
    }, { defaultText: DEFAULT_TEXT }).settings;
    const storage = createStorage(initial, { setDelay: 25 });
    const store = createSettingsStore(storage, { defaultText: DEFAULT_TEXT });
    const handle = createSettingsMessageHandler(store);
    await handle({ type: MESSAGE_TYPES.get });

    const imported = createSettingsExport({
      ...COMPLETE_SETTINGS,
      [KEYS.threshold]: 30 + closeAfterMs,
      [KEYS.text]: `Imported after ${closeAfterMs} ms 🌊`,
    }, { defaultText: DEFAULT_TEXT }).settings;
    const backgroundResponse = handle({ type: MESSAGE_TYPES.replace, settings: imported });

    assert.equal(storage.setCalls.length, 1, "import storage.set starts in the confirmation turn");
    await new Promise((resolve) => setTimeout(resolve, closeAfterMs));
    const response = await backgroundResponse;

    assert.equal(response.ok, true);
    assert.deepEqual(storage.data, imported);
  });
}
