import { EN_MESSAGES } from "./en-messages.mjs";

function asBoolean(value, fallback = false) {
  if (value === null) {
    return fallback;
  }

  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

export function asNumber(value, fallback) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value, fallback = "") {
  return value === null ? fallback : String(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseDomains(value) {
  return asString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOverrides(value) {
  return asString(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, item) => {
      const [host, rawValue] = item.split(":");
      const threshold = Number(rawValue);
      if (host && Number.isFinite(threshold) && threshold > 0) {
        accumulator[host.trim()] = threshold;
      }
      return accumulator;
    }, {});
}

export function getCaptureState() {
  const params = new URLSearchParams(window.location.search);
  const threshold = asNumber(params.get("threshold"), 7);
  const defaultText = EN_MESSAGES.defaultNotificationText;
  const tabUrl = asBoolean(params.get("tabUrlMissing"), false)
    ? null
    : asString(params.get("tab"), "https://quiet.example/articles/scroll-depth");

  return {
    stageEyebrow: asString(params.get("eyebrow"), "Surfaced"),
    stageTitle: asString(params.get("title"), ""),
    stageSubtitle: asString(params.get("subtitle"), ""),
    platform: asString(params.get("platform"), "desktop"),
    scene: asString(params.get("scene"), ""),
    motion: asString(params.get("motion"), ""),
    progress: clamp(asNumber(params.get("progress"), 1), 0, 1),
    threshold,
    text: asString(params.get("text"), defaultText),
    enabled: asBoolean(params.get("enabled"), true),
    helpExpanded: asBoolean(params.get("help"), false),
    overridesOpen: asBoolean(params.get("overridesOpen"), false),
    disabledDomains: parseDomains(params.get("disabledDomains")),
    siteOverrides: parseOverrides(params.get("siteOverrides")),
    tabUrl,
    zone: asString(params.get("zone"), ""),
    scrollScreens: params.has("scrollScreens") ? asNumber(params.get("scrollScreens"), threshold) : null,
    fixture: asString(params.get("fixture"), document.body.dataset.fixture || "article"),
    language: "en-US",
    storageGetFailures: params.has("storageGetFailures")
      ? Math.max(0, Number(params.get("storageGetFailures")) || 0)
      : 0,
    storageSetFailures: params.has("storageSetFailures")
      ? Math.max(0, Number(params.get("storageSetFailures")) || 0)
      : 0,
    sessionPaused: asBoolean(params.get("sessionPaused"), false),
    sessionGetFailures: params.has("sessionGetFailures")
      ? Math.max(0, Number(params.get("sessionGetFailures")) || 0)
      : 0,
    sessionSetFailures: params.has("sessionSetFailures")
      ? Math.max(0, Number(params.get("sessionSetFailures")) || 0)
      : 0,
    permissionState: asString(params.get("permission"), "full"),
    permissionRequestOutcome: asString(params.get("permissionRequest"), "grant"),
    storage: {
      scrollNotifierThreshold: threshold,
      scrollNotifierText: asString(params.get("text"), defaultText),
      scrollNotifierEnabled: asBoolean(params.get("enabled"), true),
      scrollNotifierDisabledDomains: parseDomains(params.get("disabledDomains")),
      scrollNotifierSiteOverrides: parseOverrides(params.get("siteOverrides")),
    },
  };
}

export function setCaptureReady() {
  document.documentElement.dataset.ready = "1";
}

export function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForAnimationFrames(count = 1) {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }
}
