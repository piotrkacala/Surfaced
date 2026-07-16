"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const repoRoot = path.resolve(__dirname, "..");
const VERSION = "1.2.1";
const ARTIFACTS = Object.freeze({
  unified: `surfaced-${VERSION}.zip`,
  desktop: `surfaced-desktop-${VERSION}.zip`,
  android: `surfaced-android-${VERSION}.zip`,
  chrome: `surfaced-chrome-${VERSION}.zip`,
});
const REQUIRED_SHARED_MODULES = Object.freeze([
  "settings.js",
  "session-pause.js",
  "scroll-tracker.js",
  "permission-health.js",
  "settings-import/index.html",
  "settings-import/settings-import.js",
  "settings-import/settings-import.css",
]);

function run(command, args, cwd, { expectFailure = false, env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: env ? { ...process.env, ...env } : process.env,
  });

  if (expectFailure) {
    assert.notEqual(result.status, 0, `${command} ${args.join(" ")} unexpectedly succeeded`);
  } else {
    assert.equal(
      result.status,
      0,
      `${command} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
    );
  }

  return result;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function zipEntries(filePath) {
  return run("unzip", ["-Z1", filePath], repoRoot).stdout.trim().split("\n").filter(Boolean);
}

function zipJson(filePath, entry) {
  return JSON.parse(run("unzip", ["-p", filePath, entry], repoRoot).stdout);
}

function createIsolatedRepo() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "surfaced-build-contract-"));
  for (const entry of ["shared", "desktop", "android", "chrome", "build.sh"]) {
    fs.cpSync(path.join(repoRoot, entry), path.join(directory, entry), { recursive: true });
  }
  return directory;
}

function setManifestVersions(directory, version) {
  for (const target of ["android", "desktop", "chrome"]) {
    const manifestPath = path.join(directory, target, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    fs.writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, version }, null, 2)}\n`);
  }
}

function assertPlatformOverlay(entries, target) {
  assert.equal(entries.includes("popup/dispatcher.js"), false, `${target} must not contain dispatcher.js`);
  assert.equal(entries.some((entry) => entry.startsWith("popup/desktop/")), false, `${target} must not contain nested desktop popup`);
  assert.equal(entries.some((entry) => entry.startsWith("popup/android/")), false, `${target} must not contain nested Android popup`);
  for (const popupFile of ["popup/popup.html", "popup/popup.js", "popup/popup.css", "popup/popup-core.mjs"]) {
    assert.ok(entries.includes(popupFile), `${target} is missing ${popupFile}`);
  }
}

test("build contract, fail-fast gates, artifact preservation, and reproducible ZIPs", { timeout: 120000 }, () => {
  const isolated = createIsolatedRepo();

  try {
    assert.deepEqual(
      ["android", "desktop", "chrome"].map((target) => (
        JSON.parse(fs.readFileSync(path.join(isolated, target, "manifest.json"), "utf8")).version
      )),
      [VERSION, VERSION, VERSION],
      `the repository release contract must remain exactly ${VERSION}`
    );

    const dist = path.join(isolated, "dist");
    fs.mkdirSync(dist);
    const oldArtifact = path.join(dist, "surfaced-1.1.4.zip");
    const foreignSentinel = path.join(dist, "keep-this-foreign-file.txt");
    fs.writeFileSync(oldArtifact, "historical artifact sentinel\n");
    fs.writeFileSync(foreignSentinel, "foreign sentinel\n");
    const oldHash = sha256(oldArtifact);
    const foreignHash = sha256(foreignSentinel);

    const firstBuild = run("bash", ["build.sh", "all"], isolated);
    assert.match(firstBuild.stderr, /Preserved older Surfaced artifacts/);
    assert.equal(sha256(oldArtifact), oldHash, "old Surfaced artifact must be preserved");
    assert.equal(sha256(foreignSentinel), foreignHash, "foreign dist sentinel must be preserved");

    const releaseMarker = `Current release ${VERSION} artifacts and SHA-256:`;
    const releaseOutput = firstBuild.stdout.slice(firstBuild.stdout.indexOf(releaseMarker));
    assert.ok(releaseOutput.startsWith(releaseMarker), "all build must print a current-release checksum section");
    for (const artifact of Object.values(ARTIFACTS)) {
      assert.match(releaseOutput, new RegExp(`[a-f0-9]{64}  dist/${artifact.replaceAll(".", "\\.")}`));
    }
    assert.doesNotMatch(releaseOutput, /1\.1\.4|keep-this-foreign-file/);

    const firstHashes = Object.fromEntries(Object.entries(ARTIFACTS).map(([target, name]) => (
      [target, sha256(path.join(dist, name))]
    )));

    for (const [target, name] of Object.entries(ARTIFACTS)) {
      const archive = path.join(dist, name);
      const entries = zipEntries(archive);
      assert.deepEqual(entries, [...entries].sort(), `${target} ZIP entries must be sorted`);
      for (const moduleName of REQUIRED_SHARED_MODULES) {
        assert.ok(entries.includes(moduleName), `${target} is missing ${moduleName}`);
      }

      const manifest = zipJson(archive, "manifest.json");
      assert.equal(manifest.version, VERSION);
      assert.equal(manifest.action.default_popup, "popup/popup.html");
      assert.deepEqual(manifest.content_scripts[0].js, [
        "extension-api.js",
        "settings.js",
        "session-pause.js",
        "scroll-tracker.js",
        "content.js",
      ]);

      if (target === "chrome") {
        assert.equal(manifest.minimum_chrome_version, "102");
        assert.deepEqual(manifest.background, { service_worker: "background.js" });
        assert.equal(Object.hasOwn(manifest, "browser_specific_settings"), false);
      } else {
        assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
        assert.deepEqual(manifest.background.scripts, [
          "extension-api.js",
          "settings.js",
          "session-pause.js",
          "background.js",
        ]);
      }

      if (target === "unified" || target === "android") {
        assert.equal(manifest.browser_specific_settings.gecko_android.strict_min_version, "142.0");
      }

      if (target === "unified") {
        for (const required of [
          "popup/dispatcher.js",
          "popup/desktop/popup.html",
          "popup/desktop/popup.js",
          "popup/android/popup.html",
          "popup/android/popup.js",
        ]) {
          assert.ok(entries.includes(required), `unified is missing ${required}`);
        }
      } else {
        assertPlatformOverlay(entries, target);
      }
    }

    run("bash", ["build.sh", "all"], isolated);
    for (const [target, name] of Object.entries(ARTIFACTS)) {
      assert.equal(
        sha256(path.join(dist, name)),
        firstHashes[target],
        `${target} ZIP must be bit-for-bit reproducible`
      );
    }

    const desktopManifestPath = path.join(isolated, "desktop/manifest.json");
    const desktopManifest = JSON.parse(fs.readFileSync(desktopManifestPath, "utf8"));
    const unifiedPath = path.join(dist, ARTIFACTS.unified);
    const unifiedHash = sha256(unifiedPath);
    fs.writeFileSync(desktopManifestPath, `${JSON.stringify({ ...desktopManifest, version: "1.2.2" }, null, 2)}\n`);
    const mismatch = run("bash", ["build.sh"], isolated, { expectFailure: true });
    assert.match(`${mismatch.stdout}\n${mismatch.stderr}`, /manifest version mismatch/);
    assert.equal(sha256(unifiedPath), unifiedHash, "version gate failure must not replace an existing artifact");
    fs.writeFileSync(desktopManifestPath, `${JSON.stringify(desktopManifest, null, 2)}\n`);

    const androidManifestPath = path.join(isolated, "android/manifest.json");
    const androidManifestSource = fs.readFileSync(androidManifestPath, "utf8");
    const chromePath = path.join(dist, ARTIFACTS.chrome);
    const chromeHash = sha256(chromePath);
    fs.writeFileSync(androidManifestPath, "{ broken JSON\n");
    const malformed = run("bash", ["build.sh", "chrome"], isolated, { expectFailure: true });
    assert.match(`${malformed.stdout}\n${malformed.stderr}`, /missing or invalid JSON/);
    assert.equal(sha256(chromePath), chromeHash, "JSON gate failure must not replace an existing artifact");
    assert.deepEqual(
      fs.readdirSync(dist).filter((name) => name.startsWith(".") && name.includes(".tmp.")),
      [],
      "failed builds must not leave temporary ZIPs"
    );
    fs.writeFileSync(androidManifestPath, androidManifestSource);

    const chromeManifestPath = path.join(isolated, "chrome/manifest.json");
    const chromeManifest = JSON.parse(fs.readFileSync(chromeManifestPath, "utf8"));
    const androidPath = path.join(dist, ARTIFACTS.android);
    const androidHash = sha256(androidPath);
    const { version: omittedVersion, ...chromeWithoutVersion } = chromeManifest;
    assert.equal(omittedVersion, VERSION);
    fs.writeFileSync(chromeManifestPath, `${JSON.stringify(chromeWithoutVersion, null, 2)}\n`);
    const missing = run("bash", ["build.sh", "android"], isolated, { expectFailure: true });
    assert.match(`${missing.stdout}\n${missing.stderr}`, /manifest version is missing/);
    assert.equal(sha256(androidPath), androidHash, "missing version gate must not replace an existing artifact");
  } finally {
    fs.rmSync(isolated, { recursive: true, force: true });
  }
});

test("a synchronized manifest bump changes the artifact version without editing build.sh", () => {
  const isolated = createIsolatedRepo();
  const futureVersion = "1.2.2";

  try {
    const buildScriptHash = sha256(path.join(isolated, "build.sh"));
    setManifestVersions(isolated, futureVersion);

    const build = run("bash", ["build.sh", "chrome"], isolated);
    const artifact = path.join(isolated, "dist", `surfaced-chrome-${futureVersion}.zip`);

    assert.match(build.stdout, new RegExp(`Built current ${futureVersion} artifact`));
    assert.ok(fs.existsSync(artifact), "the synchronized bump must select the future artifact name");
    assert.equal(zipJson(artifact, "manifest.json").version, futureVersion);
    assert.equal(
      sha256(path.join(isolated, "build.sh")),
      buildScriptHash,
      "a synchronized version bump must not require a build.sh change"
    );
  } finally {
    fs.rmSync(isolated, { recursive: true, force: true });
  }
});

test("a zip failure preserves the final artifact and cleans temporary outputs", () => {
  const isolated = createIsolatedRepo();

  try {
    const dist = path.join(isolated, "dist");
    const controlledTmp = path.join(isolated, "controlled-tmp");
    const shimDirectory = path.join(isolated, "shims");
    fs.mkdirSync(dist);
    fs.mkdirSync(controlledTmp);
    fs.mkdirSync(shimDirectory);

    const finalArtifact = path.join(dist, ARTIFACTS.unified);
    fs.writeFileSync(finalArtifact, "existing final artifact sentinel\n");
    const finalHash = sha256(finalArtifact);

    const zipShim = path.join(shimDirectory, "zip");
    fs.writeFileSync(zipShim, "#!/usr/bin/env bash\nprintf 'partial zip output\\n' > \"$3\"\nexit 71\n");
    fs.chmodSync(zipShim, 0o755);

    const failedBuild = run("bash", ["build.sh"], isolated, {
      expectFailure: true,
      env: {
        PATH: `${shimDirectory}${path.delimiter}${process.env.PATH}`,
        TMPDIR: controlledTmp,
      },
    });

    assert.equal(failedBuild.status, 71, "the controlled zip shim must be the failing command");
    assert.equal(
      sha256(finalArtifact),
      finalHash,
      "a failed zip command must not replace the existing final artifact"
    );
    assert.deepEqual(
      fs.readdirSync(dist).filter((name) => name.startsWith(".") && name.includes(".tmp.")),
      [],
      "a failed zip command must not leave a temporary output"
    );
    assert.deepEqual(
      fs.readdirSync(controlledTmp),
      [],
      "a failed zip command must remove its source directory from TMPDIR"
    );
  } finally {
    fs.rmSync(isolated, { recursive: true, force: true });
  }
});
