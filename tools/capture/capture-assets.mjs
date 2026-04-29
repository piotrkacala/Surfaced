import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MOTION_SCENES, PRIMARY_STATIC_SCENE_IDS, STATIC_SCENES } from "./scene-definitions.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const outputRoot = path.join(repoRoot, "output", "playwright");

function printUsage() {
  console.log(`Usage:
  node tools/capture/capture-assets.mjs list
  node tools/capture/capture-assets.mjs shots [scene...]
  node tools/capture/capture-assets.mjs shot <scene>
  node tools/capture/capture-assets.mjs shots-primary
  node tools/capture/capture-assets.mjs frames <motion-scene> [frame-count]

Static scenes:
  ${Object.keys(STATIC_SCENES).join("\n  ")}

Motion scenes:
  ${Object.keys(MOTION_SCENES).join("\n  ")}`);
}

function serializeParams(params) {
  return new URLSearchParams(
    Object.entries(params).reduce((result, [key, value]) => {
      result[key] = String(value);
      return result;
    }, {})
  ).toString();
}

function getContentType(filePath) {
  switch (path.extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

async function startStaticServer(rootDir) {
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, "http://127.0.0.1");
      const pathname = decodeURIComponent(requestUrl.pathname);
      const requestedPath = path.normalize(path.join(rootDir, pathname));

      if (!requestedPath.startsWith(rootDir)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const stats = await fs.stat(requestedPath);
      const filePath = stats.isDirectory() ? path.join(requestedPath, "index.html") : requestedPath;
      const file = await fs.readFile(filePath);
      response.writeHead(200, { "Content-Type": getContentType(filePath) });
      response.end(file);
    } catch (error) {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    origin: `http://127.0.0.1:${address.port}`,
  };
}

async function loadPlaywright() {
  const explicitModulePath = process.env.PLAYWRIGHT_MODULE_PATH;

  try {
    return await import("playwright");
  }
  catch (error) {}

  if (explicitModulePath) {
    try {
      return await import(pathToFileURL(explicitModulePath).href);
    } catch (error) {}
  }

  try {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    const globalEntry = path.join(globalRoot, "playwright", "index.mjs");
    return await import(pathToFileURL(globalEntry).href);
  } catch (error) {}

  console.error("Playwright is not available in the current Node environment.");
  console.error("Use a Node environment that resolves the `playwright` module, or install it globally.");
  console.error("Global install path:");
  console.error("  npm install -g playwright");
  console.error("Then run:");
  console.error("  PLAYWRIGHT_MODULE_PATH=\"$(npm root -g)/playwright/index.mjs\" node tools/capture/capture-assets.mjs shot desktop-threshold-control");
  process.exitCode = 1;
  return null;
}

function buildSceneUrl(origin, definition) {
  const query = serializeParams(definition.params);
  return `${origin}${definition.page}?${query}`;
}

async function ensureOutputDir(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

async function capturePage(browserType, url, destinationPath) {
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.documentElement.dataset.ready === "1");
  await page.screenshot({ path: destinationPath });
  await browser.close();
}

async function captureStaticScenes(sceneNames) {
  const playwright = await loadPlaywright();
  if (!playwright) {
    return;
  }

  const server = await startStaticServer(repoRoot);
  const browserType = playwright.firefox;

  try {
    await ensureOutputDir(outputRoot);
    for (const sceneName of sceneNames) {
      const definition = STATIC_SCENES[sceneName];
      if (!definition) {
        throw new Error(`Unknown static scene: ${sceneName}`);
      }

      const url = buildSceneUrl(server.origin, definition);
      const destination = path.join(outputRoot, definition.output || `${sceneName}.png`);
      console.log(`Capturing ${sceneName} -> ${destination}`);
      await capturePage(browserType, url, destination);
    }
  } finally {
    await server.close();
  }
}

async function captureMotionFrames(sceneName, frameCountOverride) {
  const motionScene = MOTION_SCENES[sceneName];
  if (!motionScene) {
    throw new Error(`Unknown motion scene: ${sceneName}`);
  }

  const playwright = await loadPlaywright();
  if (!playwright) {
    return;
  }

  const frameCount = Number.isFinite(frameCountOverride) ? frameCountOverride : motionScene.frames;
  const frameDir = path.join(outputRoot, motionScene.outputDir || sceneName);
  const server = await startStaticServer(repoRoot);
  const browserType = playwright.firefox;

  try {
    await ensureOutputDir(frameDir);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const progress = frameCount === 1 ? 1 : frameIndex / (frameCount - 1);
      const definition = motionScene.build(progress);
      const url = buildSceneUrl(server.origin, definition);
      const destination = path.join(frameDir, `frame-${String(frameIndex).padStart(3, "0")}.png`);
      console.log(`Capturing ${sceneName} frame ${frameIndex + 1}/${frameCount}`);
      await capturePage(browserType, url, destination);
    }
  } finally {
    await server.close();
  }
}

async function main() {
  const [, , command, ...args] = process.argv;

  switch (command) {
    case "list":
      printUsage();
      break;
    case "shots":
      await captureStaticScenes(args.length ? args : Object.keys(STATIC_SCENES));
      break;
    case "shots-primary":
      await captureStaticScenes(PRIMARY_STATIC_SCENE_IDS);
      break;
    case "shot":
      if (!args[0]) {
        throw new Error("Missing scene name for shot command.");
      }
      await captureStaticScenes([args[0]]);
      break;
    case "frames":
      if (!args[0]) {
        throw new Error("Missing motion scene name for frames command.");
      }
      await captureMotionFrames(args[0], args[1] ? Number(args[1]) : undefined);
      break;
    default:
      printUsage();
      if (command) {
        process.exitCode = 1;
      }
      break;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
