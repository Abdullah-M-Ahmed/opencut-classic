"use strict";

// Electron shell around the existing, functioning OpenCut Classic editor.
// The editor and its projects run in a local Next.js process, not at a
// third-party hosted URL. The renderer has no Node.js API access.
const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

let nextProcess = null;
let exiting = false;
let recentServerOutput = "";
const STARTUP_LOG_NAME = "startup.log";

function startupLogPath() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, STARTUP_LOG_NAME);
}

function logStartup(label, value) {
  const text = String(value).trim();
  if (!text) return;
  const entry = new Date().toISOString() + " [" + label + "] " + text + "\n";
  recentServerOutput = (recentServerOutput + entry).slice(-6000);
  try {
    // Local-only log for diagnosing packaged startup, capped to avoid huge files.
    const file = startupLogPath();
    if (fs.existsSync(file) && fs.statSync(file).size > 1024 * 1024) {
      fs.renameSync(file, file + ".old");
    }
    fs.appendFileSync(file, entry, "utf8");
  } catch (error) {
    console.error("Could not write OpenCut startup log:", error);
  }
}

function isLoopback(url) {
  try {
    const target = new URL(url);
    return target.protocol === "http:" &&
      (target.hostname === "127.0.0.1" || target.hostname === "localhost");
  } catch {
    return false;
  }
}

function desktopSecret() {
  const secretPath = path.join(app.getPath("userData"), "desktop-auth-secret");
  if (fs.existsSync(secretPath)) return fs.readFileSync(secretPath, "utf8").trim();
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  const secret = randomBytes(32).toString("hex");
  fs.writeFileSync(secretPath, secret, { mode: 0o600, flag: "wx" });
  return secret;
}

function nextEnvironment(port) {
  return {
    ...process.env,
    NODE_ENV: app.isPackaged ? "production" : "development",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    OPENCUT_DESKTOP: "1",
    // These values satisfy OpenCut Classic's web schema. Cloud-dependent
    // features still require proper services, and are not silently simulated.
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    NEXT_PUBLIC_MARBLE_API_URL: "https://api.marblecms.com",
    DATABASE_URL: process.env.DATABASE_URL ||
      "postgresql://opencut:opencut@127.0.0.1:5432/opencut",
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || desktopSecret(),
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ||
      "http://127.0.0.1:8079",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "not-configured",
    MARBLE_WORKSPACE_KEY: process.env.MARBLE_WORKSPACE_KEY || "not-configured",
    FREESOUND_CLIENT_ID: process.env.FREESOUND_CLIENT_ID || "not-configured",
    FREESOUND_API_KEY: process.env.FREESOUND_API_KEY || "not-configured",
  };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to acquire an available port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function awaitHealth(baseUrl, child, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child && child.exitCode !== null) {
      throw new Error("OpenCut server exited with code " + child.exitCode + ".\n" + recentServerOutput.slice(-2500) + "\nLog: " + startupLogPath());
    }
    try {
      const response = await fetch(baseUrl + "/api/health", {
        signal: AbortSignal.timeout(1800),
        cache: "no-store",
      });
      if (response.ok) return;
    } catch {
      // The local server is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  throw new Error("OpenCut local editor did not become ready.");
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  child.on("error", (error) => {
    logStartup("PROCESS ERROR", error.stack || error.message);
    console.error("OpenCut server error:", error);
  });
  child.on("exit", (code, signal) => logStartup("PROCESS EXIT", "code=" + code + " signal=" + signal));
  child.stdout?.on("data", (chunk) => {
    logStartup("SERVER STDOUT", chunk);
    console.info("[OpenCut]", String(chunk).trim());
  });
  child.stderr?.on("data", (chunk) => {
    logStartup("SERVER STDERR", chunk);
    console.error("[OpenCut]", String(chunk).trim());
  });
  nextProcess = child;
  return child;
}

async function launchServer() {
  const devUrl = process.env.OPENCUT_WEB_URL;
  if (devUrl) {
    if (!isLoopback(devUrl)) {
      throw new Error("OPENCUT_WEB_URL must use local HTTP on localhost.");
    }
    await awaitHealth(devUrl, null);
    return devUrl.replace(/\/$/, "");
  }

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;

  if (app.isPackaged) {
    const runtimeDirectory = path.join(process.resourcesPath, "opencut-server");
    const manifest = JSON.parse(
      fs.readFileSync(path.join(runtimeDirectory, "server-path.json"), "utf8"),
    );
    const serverScript = path.resolve(runtimeDirectory, manifest.serverRelativePath);
    if (!serverScript.startsWith(runtimeDirectory + path.sep)) {
      throw new Error("Invalid bundled server location");
    }
    if (!fs.existsSync(serverScript)) {
      throw new Error("Bundled Next.js server was not found.");
    }
    logStartup("LAUNCH", "Using packaged runtime at " + serverScript);
    const dependencyDirectory = path.join(runtimeDirectory, "runtime-deps");
    if (!fs.existsSync(path.join(dependencyDirectory, "next", "package.json"))) {
      throw new Error("Bundled Next.js dependencies are missing at " + dependencyDirectory);
    }
    startProcess(process.execPath, [serverScript], {
      cwd: path.dirname(serverScript),
      env: {
        ...nextEnvironment(port),
        NODE_PATH: [dependencyDirectory, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
        ELECTRON_RUN_AS_NODE: "1",
      },
    });
  } else {
    const repoRoot = path.resolve(__dirname, "../..");
    startProcess(process.platform === "win32" ? "bun.exe" : "bun", ["run", "dev:web"], {
      cwd: repoRoot,
      env: nextEnvironment(port),
    });
  }

  await awaitHealth(url, nextProcess);
  return url;
}

function createWindow(baseUrl) {
  const window = new BrowserWindow({
    title: "OpenCut Desktop",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#101115",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  const origin = new URL(baseUrl).origin;
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(origin + "/")) return { action: "allow" };
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin + "/") && url !== origin) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  window.once("ready-to-show", () => window.show());
  window.loadURL(baseUrl + "/projects");
  return window;
}

function stopServer() {
  if (exiting) return;
  exiting = true;
  if (nextProcess && nextProcess.exitCode === null) {
    try { nextProcess.kill(); } catch {}
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    try {
      const baseUrl = await launchServer();
      if (process.env.OPENCUT_DESKTOP_SMOKE_TEST === "1") {
        const response = await fetch(baseUrl + "/projects", {
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          throw new Error("Desktop projects page failed smoke test with HTTP " + response.status);
        }
        logStartup("SMOKE TEST", "Desktop launch and projects page OK");
        stopServer();
        app.exit(0);
        return;
      }
      createWindow(baseUrl);
    } catch (error) {
      console.error(error);
      logStartup("STARTUP FAILED", error?.stack || String(error));
      if (process.env.OPENCUT_DESKTOP_SMOKE_TEST === "1") {
        stopServer();
        app.exit(1);
        return;
      }
      dialog.showErrorBox(
        "OpenCut Desktop could not start",
        (error instanceof Error ? error.message : String(error)) +
          "\n\nStartup log: " + startupLogPath() +
          "\n\nSend the startup.log file when reporting this error.",
      );
      app.quit();
    }
  });
  app.on("before-quit", stopServer);
  app.on("window-all-closed", () => app.quit());
}
