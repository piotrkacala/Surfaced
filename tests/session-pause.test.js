"use strict";

const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const {
  MESSAGE_TYPES,
  SESSION_KEY,
  createSessionPauseController,
} = require("../shared/session-pause.js");
const { STORAGE_KEYS } = require("../shared/settings.js");

function createSessionStorage(initial = {}, { getFailures = 0, setFailures = 0 } = {}) {
  const data = { ...initial };
  const getCalls = [];
  const setCalls = [];

  return {
    data,
    getCalls,
    setCalls,
    async get(key) {
      getCalls.push(key);
      if (getFailures > 0) {
        getFailures -= 1;
        throw new Error("session get failed");
      }
      return Object.prototype.hasOwnProperty.call(data, key) ? { [key]: data[key] } : {};
    },
    async set(values) {
      setCalls.push({ ...values });
      if (setFailures > 0) {
        setFailures -= 1;
        throw new Error("session set failed");
      }
      Object.assign(data, values);
    },
  };
}

function createHarness(storage, { rejectingTabId = null, queryFailure = false } = {}) {
  const tabMessages = [];
  const badgeCalls = [];
  const runtimeMessages = [];
  const tabs = [{ id: 1 }, { id: 2 }, { id: 3 }, { url: "about:config" }];

  const controller = createSessionPauseController({
    storageArea: storage,
    tabsApi: {
      async query() {
        if (queryFailure) throw new Error("tabs unavailable");
        return tabs;
      },
      async sendMessage(tabId, message) {
        tabMessages.push({ tabId, message });
        if (tabId === rejectingTabId) throw new Error("no receiver");
      },
    },
    actionApi: {
      async setBadgeText(details) {
        badgeCalls.push(details);
      },
    },
    runtimeApi: {
      async sendMessage(message) {
        runtimeMessages.push(message);
      },
    },
  });

  return { badgeCalls, controller, runtimeMessages, tabMessages };
}

describe("session pause background controller", () => {
  test("empty session storage starts unpaused without writing persistent state", async () => {
    const storage = createSessionStorage();
    const { controller } = createHarness(storage);

    assert.deepEqual(await controller.handleMessage({ type: MESSAGE_TYPES.get }), {
      ok: true,
      paused: false,
    });
    assert.deepEqual(storage.getCalls, [SESSION_KEY]);
    assert.deepEqual(storage.setCalls, []);
    assert.equal(STORAGE_KEYS.includes(SESSION_KEY), false);
  });

  test("pause reaches every existing tab, clears badges, and tolerates a missing receiver", async () => {
    const storage = createSessionStorage();
    const { badgeCalls, controller, runtimeMessages, tabMessages } = createHarness(storage, {
      rejectingTabId: 2,
    });

    const response = await controller.handleMessage({
      type: MESSAGE_TYPES.set,
      paused: true,
    });

    assert.deepEqual(response, { ok: true, paused: true });
    assert.equal(storage.data[SESSION_KEY], true);
    assert.deepEqual(tabMessages.map(({ tabId }) => tabId), [1, 2, 3]);
    assert.deepEqual(badgeCalls, [
      { text: "", tabId: 1 },
      { text: "", tabId: 2 },
      { text: "", tabId: 3 },
    ]);
    tabMessages.forEach(({ message }) => {
      assert.deepEqual(message, { type: MESSAGE_TYPES.changed, paused: true });
    });
    assert.deepEqual(runtimeMessages, [{ type: MESSAGE_TYPES.changed, paused: true }]);
  });

  test("a new content script queries the same paused state and manual resume broadcasts false", async () => {
    const storage = createSessionStorage({ [SESSION_KEY]: true });
    const { controller, tabMessages } = createHarness(storage);

    assert.deepEqual(await controller.handleMessage({ type: MESSAGE_TYPES.get }), {
      ok: true,
      paused: true,
    });

    assert.deepEqual(await controller.handleMessage({
      type: MESSAGE_TYPES.set,
      paused: false,
    }), { ok: true, paused: false });
    assert.equal(storage.data[SESSION_KEY], false);
    assert.equal(tabMessages.every(({ message }) => message.paused === false), true);
  });

  test("a tab-query failure cannot roll back a successful session state change", async () => {
    const storage = createSessionStorage();
    const { controller, runtimeMessages } = createHarness(storage, { queryFailure: true });

    assert.deepEqual(await controller.handleMessage({
      type: MESSAGE_TYPES.set,
      paused: true,
    }), { ok: true, paused: true });
    assert.equal(storage.data[SESSION_KEY], true);
    assert.deepEqual(runtimeMessages, [{ type: MESSAGE_TYPES.changed, paused: true }]);
  });

  test("storage.session read and write failures are explicit and have no local fallback", async () => {
    const readStorage = createSessionStorage({}, { getFailures: 1 });
    const readHarness = createHarness(readStorage);
    assert.deepEqual(await readHarness.controller.handleMessage({ type: MESSAGE_TYPES.get }), {
      ok: false,
      error: "SESSION_STORAGE_READ_FAILED",
    });
    assert.deepEqual(readStorage.setCalls, []);

    const writeStorage = createSessionStorage({}, { setFailures: 1 });
    const writeHarness = createHarness(writeStorage);
    assert.deepEqual(await writeHarness.controller.handleMessage({
      type: MESSAGE_TYPES.set,
      paused: true,
    }), {
      ok: false,
      error: "SESSION_STORAGE_WRITE_FAILED",
    });
    assert.equal(Object.prototype.hasOwnProperty.call(writeStorage.data, SESSION_KEY), false);
    assert.deepEqual(writeHarness.tabMessages, []);
  });

  for (const lifecycle of ["browser restart", "extension reload", "extension update"]) {
    test(`${lifecycle} starts with a fresh unpaused session area`, async () => {
      const oldArea = createSessionStorage({ [SESSION_KEY]: true });
      const oldController = createHarness(oldArea).controller;
      assert.equal((await oldController.getState()).paused, true);

      // The browser owns the lifecycle of storage.session. Each lifecycle event
      // provides a new empty area; the controller never copies from storage.local.
      const freshArea = createSessionStorage();
      const freshController = createHarness(freshArea).controller;
      assert.equal((await freshController.getState()).paused, false);
      assert.deepEqual(freshArea.setCalls, []);
    });
  }
});
