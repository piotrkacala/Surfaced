(function initializeSurfacedPermissionHealth(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SurfacedPermissionHealth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const ALL_URLS_ORIGIN = "<all_urls>";
  const ACCESS_STATES = Object.freeze({
    granted: "granted",
    missing: "missing",
    partial: "partial",
    unavailable: "unavailable",
  });
  const REQUEST_OUTCOMES = Object.freeze({
    restored: "restored",
    denied: "denied",
    partial: "partial",
    exception: "exception",
    unverified: "unverified",
  });
  const FIREFOX_RESTRICTED_HOSTS = Object.freeze([
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
  ]);

  const RESTRICTED_STORE_HOSTS = new Set([
    "chromewebstore.google.com",
  ]);

  function normalizeOrigins(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return Array.from(new Set(value.filter((origin) => typeof origin === "string"))).sort();
  }

  function isRestrictedStoreUrl(url) {
    const hostname = url.hostname.toLowerCase();
    if (
      FIREFOX_RESTRICTED_HOSTS.includes(hostname)
      || RESTRICTED_STORE_HOSTS.has(hostname)
    ) {
      return true;
    }

    const pathname = url.pathname.toLowerCase();
    return (hostname === "chrome.google.com" && pathname.startsWith("/webstore"))
      || (hostname === "microsoftedge.microsoft.com" && pathname.startsWith("/addons"));
  }

  function getCurrentPageContext(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) {
      return { available: false, hostname: "", reason: "missing-url" };
    }

    let url;
    try {
      url = new URL(rawUrl);
    } catch (error) {
      return { available: false, hostname: "", reason: "invalid-url" };
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      return { available: false, hostname: "", reason: "special-url" };
    }

    if (!url.hostname || isRestrictedStoreUrl(url)) {
      return { available: false, hostname: "", reason: "restricted-url" };
    }

    return {
      available: true,
      hostname: url.hostname.toLowerCase(),
      reason: "available",
    };
  }

  async function checkHostAccess(permissionsApi) {
    if (
      !permissionsApi
      || typeof permissionsApi.contains !== "function"
      || typeof permissionsApi.getAll !== "function"
    ) {
      return {
        state: ACCESS_STATES.unavailable,
        contains: null,
        origins: [],
        containsError: true,
        getAllError: true,
      };
    }

    const [containsResult, getAllResult] = await Promise.allSettled([
      permissionsApi.contains({ origins: [ALL_URLS_ORIGIN] }),
      permissionsApi.getAll(),
    ]);
    const contains = containsResult.status === "fulfilled"
      ? containsResult.value === true
      : null;
    const origins = getAllResult.status === "fulfilled"
      ? normalizeOrigins(getAllResult.value?.origins)
      : [];

    let state = ACCESS_STATES.unavailable;
    if (contains === true) {
      state = ACCESS_STATES.granted;
    } else if (contains === false) {
      state = origins.some((origin) => origin !== ALL_URLS_ORIGIN)
        ? ACCESS_STATES.partial
        : ACCESS_STATES.missing;
    }

    return {
      state,
      contains,
      origins,
      containsError: containsResult.status === "rejected",
      getAllError: getAllResult.status === "rejected",
    };
  }

  async function requestHostAccess(permissionsApi) {
    let requestResult = null;
    let requestError = null;

    try {
      if (typeof permissionsApi?.request !== "function") {
        throw new TypeError("permissions.request is unavailable");
      }
      requestResult = await permissionsApi.request({ origins: [ALL_URLS_ORIGIN] });
    } catch (error) {
      requestError = error;
    }

    const health = await checkHostAccess(permissionsApi);
    let outcome;

    if (health.state === ACCESS_STATES.granted) {
      outcome = REQUEST_OUTCOMES.restored;
    } else if (requestError) {
      outcome = REQUEST_OUTCOMES.exception;
    } else if (health.state === ACCESS_STATES.partial) {
      outcome = REQUEST_OUTCOMES.partial;
    } else if (requestResult === false) {
      outcome = REQUEST_OUTCOMES.denied;
    } else {
      // A truthy request result is not proof of access. Only the fresh contains()
      // result above can establish restoration.
      outcome = REQUEST_OUTCOMES.unverified;
    }

    return {
      outcome,
      requestResult,
      requestError,
      health,
    };
  }

  return Object.freeze({
    ACCESS_STATES,
    ALL_URLS_ORIGIN,
    FIREFOX_RESTRICTED_HOSTS,
    REQUEST_OUTCOMES,
    checkHostAccess,
    getCurrentPageContext,
    requestHostAccess,
  });
});
