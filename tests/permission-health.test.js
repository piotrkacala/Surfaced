"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  ACCESS_STATES,
  ALL_URLS_ORIGIN,
  FIREFOX_RESTRICTED_HOSTS,
  REQUEST_OUTCOMES,
  checkHostAccess,
  getCurrentPageContext,
  requestHostAccess,
} = require("../shared/permission-health.js");

function createPermissions({
  contains = false,
  origins = [],
  requestResult = false,
  requestError = null,
  afterRequestContains = contains,
  afterRequestOrigins = origins,
} = {}) {
  let requested = false;
  const calls = [];

  return {
    calls,
    async contains(details) {
      calls.push({ method: "contains", details });
      return requested ? afterRequestContains : contains;
    },
    async getAll() {
      calls.push({ method: "getAll" });
      return { permissions: ["storage"], origins: requested ? afterRequestOrigins : origins };
    },
    async request(details) {
      calls.push({ method: "request", details });
      requested = true;
      if (requestError) throw requestError;
      return requestResult;
    },
  };
}

test("full grant requires permissions.contains for <all_urls>", async () => {
  const permissions = createPermissions({
    contains: true,
    origins: [ALL_URLS_ORIGIN],
  });
  const health = await checkHostAccess(permissions);

  assert.equal(health.state, ACCESS_STATES.granted);
  assert.equal(health.contains, true);
  assert.deepEqual(permissions.calls[0], {
    method: "contains",
    details: { origins: [ALL_URLS_ORIGIN] },
  });
});

test("revoke and partial grant remain distinct from storage health", async () => {
  const revoked = await checkHostAccess(createPermissions());
  assert.equal(revoked.state, ACCESS_STATES.missing);

  const partial = await checkHostAccess(createPermissions({
    origins: ["https://quiet.example/*"],
  }));
  assert.equal(partial.state, ACCESS_STATES.partial);
  assert.deepEqual(partial.origins, ["https://quiet.example/*"]);
});

test("permission API failures stay in permission health and never become a storage error", async () => {
  const unavailable = await checkHostAccess({
    async contains() { throw new Error("contains failed"); },
    async getAll() { return { origins: [] }; },
  });
  assert.equal(unavailable.state, ACCESS_STATES.unavailable);
  assert.equal(unavailable.containsError, true);

  const granted = await checkHostAccess({
    async contains() { return true; },
    async getAll() { throw new Error("getAll failed"); },
  });
  assert.equal(granted.state, ACCESS_STATES.granted);
  assert.equal(granted.getAllError, true);
});

test("request denial is rechecked and never reported as restored", async () => {
  const result = await requestHostAccess(createPermissions({ requestResult: false }));
  assert.equal(result.outcome, REQUEST_OUTCOMES.denied);
  assert.equal(result.health.state, ACCESS_STATES.missing);
});

test("request exception is handled and followed by a fresh health check", async () => {
  const permissions = createPermissions({ requestError: new Error("browser rejected request") });
  const result = await requestHostAccess(permissions);
  assert.equal(result.outcome, REQUEST_OUTCOMES.exception);
  assert.equal(result.health.state, ACCESS_STATES.missing);
  assert.deepEqual(permissions.calls.map(({ method }) => method), ["request", "contains", "getAll"]);
});

test("partial grant after request is not reported as restored", async () => {
  const result = await requestHostAccess(createPermissions({
    requestResult: true,
    afterRequestContains: false,
    afterRequestOrigins: ["https://quiet.example/*"],
  }));
  assert.equal(result.outcome, REQUEST_OUTCOMES.partial);
  assert.equal(result.health.state, ACCESS_STATES.partial);
});

test("request true with contains still false is explicitly unverified", async () => {
  const result = await requestHostAccess(createPermissions({
    requestResult: true,
    afterRequestContains: false,
  }));
  assert.equal(result.requestResult, true);
  assert.equal(result.outcome, REQUEST_OUTCOMES.unverified);
  assert.equal(result.health.state, ACCESS_STATES.missing);
});

test("restoration is reported only after the post-request contains check succeeds", async () => {
  const result = await requestHostAccess(createPermissions({
    requestResult: true,
    afterRequestContains: true,
    afterRequestOrigins: [ALL_URLS_ORIGIN],
  }));
  assert.equal(result.outcome, REQUEST_OUTCOMES.restored);
  assert.equal(result.health.state, ACCESS_STATES.granted);
});

test("missing, special, and browser-store tab URLs are neutral current-page states", () => {
  for (const url of [
    undefined,
    "about:config",
    "chrome://extensions",
    "file:///tmp/local-page.html",
    "moz-extension://example/popup.html",
    "https://addons.mozilla.org/firefox/addon/surfaced/",
    "https://chromewebstore.google.com/detail/surfaced/id",
    "https://chrome.google.com/webstore/detail/surfaced/id",
  ]) {
    assert.deepEqual(getCurrentPageContext(url).available, false, String(url));
  }

  assert.deepEqual(getCurrentPageContext("https://Quiet.Example/article"), {
    available: true,
    hostname: "quiet.example",
    reason: "available",
  });
});

test("the complete static Firefox restricted-host list is a neutral current-page state", () => {
  const expectedHosts = [
    "accounts-static.cdn.mozilla.net",
    "accounts.firefox.com",
    "addons.cdn.mozilla.net",
    "addons.mozilla.org",
    "api.accounts.firefox.com",
    "content.cdn.mozilla.net",
    "discovery.addons.mozilla.org",
    "install.mozilla.org",
    "oauth.accounts.firefox.com",
    "profile.accounts.firefox.com",
    "support.mozilla.org",
    "sync.services.mozilla.com",
  ];

  assert.equal(Object.isFrozen(FIREFOX_RESTRICTED_HOSTS), true);
  assert.deepEqual(FIREFOX_RESTRICTED_HOSTS, expectedHosts);
  for (const hostname of FIREFOX_RESTRICTED_HOSTS) {
    assert.deepEqual(getCurrentPageContext(`https://${hostname}/path`), {
      available: false,
      hostname: "",
      reason: "restricted-url",
    }, hostname);
  }
});
