"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

const source = fs.readFileSync(require.resolve("../shared/extension-api.js"), "utf8");

function createChromeApi() {
  const calls = [];
  const runtime = {
    lastError: null,
    getURL(path) { return `chrome-extension://test/${path}`; },
    getPlatformInfo(callback) { callback({ os: "linux" }); },
    sendMessage(message, callback) { callback(message); },
    onMessage: {},
  };
  const callbackMethod = (method, value) => (details, callback) => {
    calls.push({ method, details });
    callback(value);
  };

  return {
    calls,
    api: {
      runtime,
      action: {},
      i18n: {},
      storage: { local: {}, session: {}, onChanged: {} },
      tabs: {
        create: callbackMethod("create", { id: 7 }),
        getCurrent(callback) {
          calls.push({ method: "getCurrent" });
          callback({ id: 6 });
        },
        remove: callbackMethod("remove", undefined),
      },
      permissions: {
        contains: callbackMethod("contains", true),
        getAll(callback) {
          calls.push({ method: "getAll" });
          callback({ permissions: ["storage"], origins: ["<all_urls>"] });
        },
        request: callbackMethod("request", false),
      },
    },
  };
}

test("Chromium adapter exposes promise-based permissions contains/getAll/request", async () => {
  const { api: chrome, calls } = createChromeApi();
  const context = vm.createContext({ chrome, console });
  vm.runInContext(source, context);

  assert.equal(await context.browser.permissions.contains({ origins: ["<all_urls>"] }), true);
  assert.deepEqual(
    JSON.parse(JSON.stringify(await context.browser.permissions.getAll())),
    { permissions: ["storage"], origins: ["<all_urls>"] }
  );
  assert.equal(await context.browser.permissions.request({ origins: ["<all_urls>"] }), false);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { method: "contains", details: { origins: ["<all_urls>"] } },
    { method: "getAll" },
    { method: "request", details: { origins: ["<all_urls>"] } },
  ]);
});

test("Chromium adapter rejects a permission promise when runtime.lastError is set", async () => {
  const { api: chrome } = createChromeApi();
  chrome.permissions.request = (details, callback) => {
    chrome.runtime.lastError = { message: "Permission request failed" };
    callback(false);
    chrome.runtime.lastError = null;
  };
  const context = vm.createContext({ chrome, console });
  vm.runInContext(source, context);

  await assert.rejects(
    context.browser.permissions.request({ origins: ["<all_urls>"] }),
    /Permission request failed/
  );
});

test("Chromium adapter exposes promise-based tabs create/getCurrent/remove", async () => {
  const { api: chrome, calls } = createChromeApi();
  const context = vm.createContext({ chrome, console });
  vm.runInContext(source, context);

  assert.equal((await context.browser.tabs.create({ url: "chrome-extension://test/import", active: true })).id, 7);
  assert.equal((await context.browser.tabs.getCurrent()).id, 6);
  await context.browser.tabs.remove(6);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { method: "create", details: { url: "chrome-extension://test/import", active: true } },
    { method: "getCurrent" },
    { method: "remove", details: 6 },
  ]);
});
