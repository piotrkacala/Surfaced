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
