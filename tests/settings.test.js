"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  DEFAULT_THRESHOLD,
  KEYS,
  MESSAGE_TYPES,
  STORAGE_KEYS,
  applySiteSettingsIntent,
  createSettingsMessageHandler,
  createSettingsStore,
  formatThresholdForDisplay,
  getManagedSiteEntries,
  normalizeSettings,
  serializeSettings,
} = require("../shared/settings.js");

const DEFAULT_TEXT = "You've drifted pretty far. Come up for air.";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createFakeStorage(initial = {}, { getFailures = 0, setFailures = 0, setDelay = 0 } = {}) {
  const data = clone(initial);
  const getCalls = [];
  const setCalls = [];
  let activeSets = 0;
  let maxConcurrentSets = 0;

  return {
    data,
    getCalls,
    setCalls,
    get maxConcurrentSets() {
      return maxConcurrentSets;
    },
    async get(keys) {
      getCalls.push(keys);
      if (getFailures > 0) {
        getFailures -= 1;
        throw new Error("storage.get failed");
      }

      return Object.fromEntries(
        keys
          .filter((key) => Object.prototype.hasOwnProperty.call(data, key))
          .map((key) => [key, clone(data[key])])
      );
    },
    async set(values) {
      const snapshot = clone(values);
      setCalls.push(snapshot);
      activeSets += 1;
      maxConcurrentSets = Math.max(maxConcurrentSets, activeSets);

      try {
        if (setDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, setDelay));
        }
        if (setFailures > 0) {
          setFailures -= 1;
          throw new Error("storage.set failed");
        }
        Object.assign(data, snapshot);
      } finally {
        activeSets -= 1;
      }
    },
  };
}

function defaults() {
  return {
    [KEYS.threshold]: DEFAULT_THRESHOLD,
    [KEYS.text]: DEFAULT_TEXT,
    [KEYS.enabled]: true,
    [KEYS.disabledDomains]: [],
    [KEYS.siteOverrides]: {},
  };
}

function makeHandler(storage) {
  const store = createSettingsStore(storage, { defaultText: DEFAULT_TEXT });
  return {
    store,
    handle: createSettingsMessageHandler(store),
  };
}

test("empty storage is a successful read of defaults and is not written implicitly", async () => {
  const storage = createFakeStorage();
  const { handle, store } = makeHandler(storage);

  const response = await handle({ type: MESSAGE_TYPES.get });

  assert.equal(response.ok, true);
  assert.deepEqual(response.settings, defaults());
  assert.equal(store.status, "ready");
  assert.deepEqual(storage.getCalls, [STORAGE_KEYS]);
  assert.equal(storage.setCalls.length, 0);
});

test("storage.get failure has no editable default state and succeeds only after retry", async () => {
  const storage = createFakeStorage({}, { getFailures: 1 });
  const { handle, store } = makeHandler(storage);

  const failed = await handle({ type: MESSAGE_TYPES.get });
  assert.deepEqual(failed, {
    ok: false,
    phase: "read",
    error: "STORAGE_READ_FAILED",
    schemaVersion: 1,
  });
  assert.equal(store.getState(), null);
  assert.equal(store.status, "read-error");
  assert.equal(storage.setCalls.length, 0);

  const retried = await handle({ type: MESSAGE_TYPES.get, retry: true });
  assert.equal(retried.ok, true);
  assert.deepEqual(retried.settings, defaults());
  assert.equal(store.status, "ready");
});

test("wrong stored types and invalid threshold values normalize to the schema defaults", () => {
  const invalidThresholds = ["20", NaN, Infinity, -1, 0, null, {}, []];

  invalidThresholds.forEach((threshold) => {
    const normalized = normalizeSettings({
      [KEYS.threshold]: threshold,
      [KEYS.text]: ["not", "text"],
      [KEYS.enabled]: "false",
      [KEYS.disabledDomains]: "example.com",
      [KEYS.siteOverrides]: [],
    }, { defaultText: DEFAULT_TEXT });

    assert.deepEqual(normalized, defaults());
  });
});

test("valid thresholds are finite positive numbers and are never clamped to the UI range", () => {
  [0.001, 5.5, 7, 20, 100, Number.MAX_VALUE].forEach((threshold) => {
    const normalized = normalizeSettings({
      ...defaults(),
      [KEYS.threshold]: threshold,
    }, { defaultText: DEFAULT_TEXT });

    assert.equal(normalized[KEYS.threshold], threshold);
  });
});

test("threshold display preserves the exact accepted number and only localizes its decimal separator", () => {
  for (const value of [0.004, 5.254, 7.999, 20.125, Number.MAX_VALUE]) {
    assert.equal(formatThresholdForDisplay(value, "en-US"), String(value));
    assert.equal(formatThresholdForDisplay(value, "fr-FR"), String(value).replace(".", ","));
  }

  assert.equal(formatThresholdForDisplay(20, "pl-PL"), "20");
});

test("domains and overrides are canonicalized, deduplicated, sorted, and made safe", () => {
  const overrides = Object.create(null);
  overrides[" Example.COM. "] = 20;
  overrides["example.com"] = 5.5;
  overrides["BÜCHER.de"] = 50;
  overrides["zero.example"] = 0;
  overrides["bad.example/path"] = 12;
  overrides.__proto__ = 99;

  const normalized = normalizeSettings({
    ...defaults(),
    [KEYS.disabledDomains]: [
      " Example.COM. ",
      "example.com",
      "BÜCHER.de",
      "bad.example/path",
      "__proto__",
      42,
    ],
    [KEYS.siteOverrides]: overrides,
  }, { defaultText: DEFAULT_TEXT });

  assert.deepEqual(normalized[KEYS.disabledDomains], ["example.com", "xn--bcher-kva.de"]);
  assert.deepEqual(normalized[KEYS.siteOverrides], {
    "example.com": 5.5,
    "xn--bcher-kva.de": 50,
    "zero.example": 7,
  });
  assert.equal(Object.prototype.polluted, undefined);
});

test("all five values written by 1.1.4 survive normalization and serialization", () => {
  const settings114 = {
    scrollNotifierThreshold: 20.125,
    scrollNotifierText: "Take a breath before the next page.",
    scrollNotifierEnabled: false,
    scrollNotifierDisabledDomains: ["news.example", "social.example"],
    scrollNotifierSiteOverrides: {
      "long.example": 100,
      "quiet.example": 5.5,
    },
  };

  assert.deepEqual(
    serializeSettings(settings114, { defaultText: DEFAULT_TEXT }),
    settings114
  );
});

test("site manager entries are the stable union of disabled domains and overrides", () => {
  const settings = {
    ...defaults(),
    [KEYS.threshold]: 9,
    [KEYS.disabledDomains]: ["disabled-only.example", "both.example"],
    [KEYS.siteOverrides]: {
      "override-only.example": 12,
      "both.example": 5.5,
    },
  };

  assert.deepEqual(getManagedSiteEntries(settings, { defaultText: DEFAULT_TEXT }), [
    { hostname: "both.example", enabled: false, hasOverride: true, threshold: 5.5 },
    { hostname: "disabled-only.example", enabled: false, hasOverride: false, threshold: 9 },
    { hostname: "override-only.example", enabled: true, hasOverride: true, threshold: 12 },
  ]);
});

test("site intents independently update enabled state, overrides, and complete configuration", () => {
  const initial = {
    ...defaults(),
    [KEYS.disabledDomains]: ["both.example", "disabled-only.example"],
    [KEYS.siteOverrides]: { "both.example": 10, "override-only.example": 14 },
  };

  const enabled = applySiteSettingsIntent(initial, {
    hostname: "disabled-only.example",
    enabled: true,
  }, { defaultText: DEFAULT_TEXT });
  assert.deepEqual(enabled[KEYS.disabledDomains], ["both.example"]);
  assert.deepEqual(enabled[KEYS.siteOverrides], initial[KEYS.siteOverrides]);

  const overrideRemoved = applySiteSettingsIntent(enabled, {
    hostname: "both.example",
    override: null,
  }, { defaultText: DEFAULT_TEXT });
  assert.deepEqual(overrideRemoved[KEYS.disabledDomains], ["both.example"]);
  assert.deepEqual(overrideRemoved[KEYS.siteOverrides], { "override-only.example": 14 });

  const removed = applySiteSettingsIntent(overrideRemoved, {
    hostname: "override-only.example",
    remove: true,
  }, { defaultText: DEFAULT_TEXT });
  assert.deepEqual(removed[KEYS.disabledDomains], ["both.example"]);
  assert.deepEqual(removed[KEYS.siteOverrides], {});
});

test("site updates are applied by the background store and serialized with other writes", async () => {
  const storage = createFakeStorage(defaults(), { setDelay: 8 });
  const { handle } = makeHandler(storage);
  await handle({ type: MESSAGE_TYPES.get });

  const operations = [
    handle({
      type: MESSAGE_TYPES.updateSite,
      intent: { hostname: "example.com", enabled: false },
    }),
    handle({
      type: MESSAGE_TYPES.updateSite,
      intent: { hostname: "example.com", override: 11 },
    }),
    handle({
      type: MESSAGE_TYPES.update,
      patch: { [KEYS.threshold]: 8 },
    }),
  ];

  assert.equal((await Promise.all(operations)).every((response) => response.ok), true);
  assert.equal(storage.maxConcurrentSets, 1);
  assert.deepEqual(storage.data, {
    ...defaults(),
    [KEYS.threshold]: 8,
    [KEYS.disabledDomains]: ["example.com"],
    [KEYS.siteOverrides]: { "example.com": 11 },
  });
});

test("storage.set failure exposes write error and retry persists the same desired state", async () => {
  const storage = createFakeStorage(defaults(), { setFailures: 1 });
  const { handle, store } = makeHandler(storage);
  await handle({ type: MESSAGE_TYPES.get });

  const failed = await handle({
    type: MESSAGE_TYPES.update,
    patch: { [KEYS.text]: "Latest unsaved text" },
  });

  assert.equal(failed.ok, false);
  assert.equal(failed.phase, "write");
  assert.equal(failed.error, "STORAGE_WRITE_FAILED");
  assert.equal(failed.settings[KEYS.text], "Latest unsaved text");
  assert.equal(store.status, "write-error");
  assert.equal(storage.data[KEYS.text], DEFAULT_TEXT);

  const retried = await handle({ type: MESSAGE_TYPES.retry, phase: "write" });
  assert.equal(retried.ok, true);
  assert.equal(retried.settings[KEYS.text], "Latest unsaved text");
  assert.equal(storage.data[KEYS.text], "Latest unsaved text");
  assert.equal(store.status, "ready");
});

test("authoritative write retry cannot restore state superseded by a newer import", async () => {
  const storage = createFakeStorage(defaults(), { setFailures: 1 });
  const { handle } = makeHandler(storage);
  await handle({ type: MESSAGE_TYPES.get });

  const failed = await handle({
    type: MESSAGE_TYPES.update,
    patch: { [KEYS.text]: "Stale unsaved text" },
  });
  assert.equal(failed.ok, false);

  const imported = {
    ...defaults(),
    [KEYS.threshold]: 17.25,
    [KEYS.text]: "Newer imported text",
    [KEYS.disabledDomains]: ["imported.example"],
  };
  assert.equal((await handle({ type: MESSAGE_TYPES.replace, settings: imported })).ok, true);

  const retried = await handle({ type: MESSAGE_TYPES.retry, phase: "write" });
  assert.equal(retried.ok, true);
  assert.deepEqual(retried.settings, imported);
  assert.deepEqual(storage.data, imported);
});

test("write retry is rejected while an import is pending and cannot persist a rolled-back snapshot", async () => {
  const storage = createFakeStorage(defaults(), { setFailures: 1 });
  const { handle, store } = makeHandler(storage);
  await handle({ type: MESSAGE_TYPES.get });
  const failed = await handle({
    type: MESSAGE_TYPES.update,
    patch: { [KEYS.text]: "Unsaved popup text" },
  });
  assert.equal(failed.ok, false);
  const previousState = store.getState();

  let rejectImport;
  const importGate = new Promise((resolve, reject) => { rejectImport = reject; });
  const originalSet = storage.set.bind(storage);
  let importStarted;
  const started = new Promise((resolve) => { importStarted = resolve; });
  storage.set = async () => {
    importStarted();
    await importGate;
  };
  const imported = { ...defaults(), [KEYS.threshold]: 17.25, [KEYS.text]: "Imported text" };
  const replacement = handle({ type: MESSAGE_TYPES.replace, settings: imported });
  await started;
  const retry = handle({ type: MESSAGE_TYPES.retry, phase: "write" });
  storage.set = originalSet;
  rejectImport(new Error("Import write failed"));

  const [replacementResponse, retryResponse] = await Promise.all([replacement, retry]);
  await store.whenIdle();
  assert.equal(replacementResponse.ok, false);
  assert.equal(retryResponse.ok, false);
  assert.equal(retryResponse.error, "SETTINGS_REPLACE_PENDING");
  assert.deepEqual(store.getState(), previousState);
  assert.deepEqual(storage.data, defaults());
  assert.equal(storage.setCalls.length, 1, "retry must not enqueue the provisional import snapshot");
  assert.equal(store.status, "write-error");

  const recovered = await handle({ type: MESSAGE_TYPES.retry, phase: "write" });
  assert.equal(recovered.ok, true);
  assert.deepEqual(recovered.settings, previousState);
  assert.deepEqual(storage.data, previousState);
  assert.equal(store.status, "ready");
  await handle({ type: MESSAGE_TYPES.update, patch: { [KEYS.enabled]: false } });
  assert.deepEqual(storage.data, { ...previousState, [KEYS.enabled]: false });
  assert.deepEqual(store.getState(), storage.data);
});

for (const readFails of [false, true]) {
  test(`a pending forced read ${readFails ? "failure" : "result"} cannot overwrite a newer update`, async () => {
    const storage = createFakeStorage(defaults());
    const { handle, store } = makeHandler(storage);
    await handle({ type: MESSAGE_TYPES.get });

    let releaseRead;
    const readGate = new Promise((resolve) => { releaseRead = resolve; });
    let readStarted;
    const started = new Promise((resolve) => { readStarted = resolve; });
    storage.get = async () => {
      const snapshot = clone(storage.data);
      readStarted();
      await readGate;
      if (readFails) throw new Error("Late read failure");
      return snapshot;
    };
    const forcedRead = handle({ type: MESSAGE_TYPES.get, retry: true });
    await started;

    const writeResponse = await handle({
      type: MESSAGE_TYPES.update,
      patch: { [KEYS.threshold]: 19.125 },
    });
    assert.equal(writeResponse.ok, true);
    releaseRead();
    const readResponse = await forcedRead;
    const expected = { ...defaults(), [KEYS.threshold]: 19.125 };
    assert.equal(readResponse.ok, true);
    assert.deepEqual(readResponse.settings, expected);
    assert.deepEqual(store.getState(), expected);
    assert.deepEqual(storage.data, expected);
    assert.equal(store.status, "ready");

    await handle({ type: MESSAGE_TYPES.update, patch: { [KEYS.enabled]: false } });
    assert.deepEqual(storage.data, { ...expected, [KEYS.enabled]: false });
    assert.deepEqual(store.getState(), storage.data);
  });
}

test("a forced read waits for an active write and cannot replace the cache with older data", async () => {
  let releaseSet;
  const setGate = new Promise((resolve) => { releaseSet = resolve; });
  const data = defaults();
  let getCalls = 0;
  const storage = {
    async get(keys) {
      getCalls += 1;
      return Object.fromEntries(keys.map((key) => [key, clone(data[key])]));
    },
    async set(values) {
      await setGate;
      Object.assign(data, clone(values));
    },
  };
  const { handle, store } = makeHandler(storage);
  await handle({ type: MESSAGE_TYPES.get });

  const write = handle({
    type: MESSAGE_TYPES.update,
    patch: { [KEYS.threshold]: 19.125 },
  });
  const forcedRead = handle({ type: MESSAGE_TYPES.get, retry: true });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(getCalls, 1, "the forced storage read must wait for the active write");

  releaseSet();
  assert.equal((await write).ok, true);
  const readResponse = await forcedRead;
  assert.equal(readResponse.ok, true);
  assert.equal(readResponse.settings[KEYS.threshold], 19.125);
  assert.equal(store.getState()[KEYS.threshold], 19.125);
  assert.equal(data[KEYS.threshold], 19.125);
});

test("an update interrupted by a read failure can be resent without losing its intent", async () => {
  const storage = createFakeStorage(defaults(), { getFailures: 1 });
  const { handle } = makeHandler(storage);
  const patch = { [KEYS.threshold]: 33 };

  const failed = await handle({ type: MESSAGE_TYPES.update, patch });
  assert.equal(failed.ok, false);
  assert.equal(failed.phase, "read");
  assert.equal(storage.setCalls.length, 0);

  const retried = await handle({ type: MESSAGE_TYPES.update, patch });
  assert.equal(retried.ok, true);
  assert.equal(retried.settings[KEYS.threshold], 33);
  assert.equal(storage.data[KEYS.threshold], 33);
});

test("rapid writes are serialized as full snapshots and finish in intent order", async () => {
  const storage = createFakeStorage(defaults(), { setDelay: 8 });
  const { handle } = makeHandler(storage);
  await handle({ type: MESSAGE_TYPES.get });

  const writes = [
    handle({ type: MESSAGE_TYPES.update, patch: { [KEYS.text]: "H" } }),
    handle({ type: MESSAGE_TYPES.update, patch: { [KEYS.text]: "He" } }),
    handle({ type: MESSAGE_TYPES.update, patch: { [KEYS.text]: "Hel" } }),
    handle({
      type: MESSAGE_TYPES.update,
      patch: { [KEYS.disabledDomains]: ["Example.COM", "news.example"] },
    }),
    handle({
      type: MESSAGE_TYPES.update,
      patch: { [KEYS.siteOverrides]: { "example.com": 20 } },
    }),
  ];

  const responses = await Promise.all(writes);
  assert.equal(responses.every((response) => response.ok), true);
  assert.equal(storage.maxConcurrentSets, 1);
  assert.deepEqual(
    storage.setCalls.map((snapshot) => snapshot[KEYS.text]),
    ["H", "He", "Hel", "Hel", "Hel"]
  );
  assert.deepEqual(storage.data, {
    ...defaults(),
    [KEYS.text]: "Hel",
    [KEYS.disabledDomains]: ["example.com", "news.example"],
    [KEYS.siteOverrides]: { "example.com": 20 },
  });
  storage.setCalls.forEach((snapshot) => {
    assert.deepEqual(Object.keys(snapshot), STORAGE_KEYS);
  });
});

for (const closeAfterMs of [0, 50, 100]) {
  test(`write continues in the background when popup closes after ${closeAfterMs} ms`, async () => {
    const storage = createFakeStorage(defaults(), { setDelay: 25 });
    const { handle } = makeHandler(storage);
    await handle({ type: MESSAGE_TYPES.get });

    const writeStartedAt = Date.now();
    const backgroundResponse = handle({
      type: MESSAGE_TYPES.update,
      patch: { [KEYS.threshold]: 42 + closeAfterMs },
    });

    assert.equal(storage.setCalls.length, 1, "storage.set starts in the input/change turn");
    assert.ok(Date.now() - writeStartedAt < 20);

    // Dropping the popup-side result models teardown; the background owns the promise.
    await new Promise((resolve) => setTimeout(resolve, closeAfterMs));
    const response = await backgroundResponse;

    assert.equal(response.ok, true);
    assert.equal(storage.data[KEYS.threshold], 42 + closeAfterMs);
  });

  test(`site-manager intent continues in the background when popup closes after ${closeAfterMs} ms`, async () => {
    const storage = createFakeStorage(defaults(), { setDelay: 25 });
    const { handle } = makeHandler(storage);
    await handle({ type: MESSAGE_TYPES.get });

    const backgroundResponse = handle({
      type: MESSAGE_TYPES.updateSite,
      intent: {
        hostname: `close-${closeAfterMs}.example`,
        enabled: false,
        override: 8 + closeAfterMs,
      },
    });

    assert.equal(storage.setCalls.length, 1, "site storage.set starts in the input/change turn");
    await new Promise((resolve) => setTimeout(resolve, closeAfterMs));
    const response = await backgroundResponse;

    assert.equal(response.ok, true);
    assert.deepEqual(storage.data[KEYS.disabledDomains], [`close-${closeAfterMs}.example`]);
    assert.deepEqual(storage.data[KEYS.siteOverrides], {
      [`close-${closeAfterMs}.example`]: 8 + closeAfterMs,
    });
  });
}
