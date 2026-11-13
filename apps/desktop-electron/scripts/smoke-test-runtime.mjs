// Smoke-test the packaged Next.js server. Do not publish a build which cannot open.
// Run first on the standalone output, then with the packaged Electron executable.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const desktopDir = path.resolve(import.meta.dirname, "..");
const packaged = process.argv.includes("--packaged");
const runtimeDir = packaged
  ? path.resolve(desktopDir, "dist", "win-unpacked", "resources", "opencut-server")
  : path.resolve(desktopDir, "runtime");

function fileExists(p) {
  if (!fs.existsSync(p)) throw new Error("Bundled runtime missing: " + p);
  return p;
}
const manifest = JSON.parse(fs.readFileSync(fileExists(path.join(runtimeDir, "server-path.json")), "utf8"));
const serverFile = fileExists(path.resolve(runtimeDir, manifest.serverRelativePath));
if (!serverFile.startsWith(runtimeDir + path.sep)) {
  throw new Error("Unsafe bundled server manifest path");
}
const dependencyDirectory = path.join(runtimeDir, "runtime-deps");
fileExists(path.join(dependencyDirectory, "next", "package.json"));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function probe({ command, extraEnvironment = {}, label }) {
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  let tail = "";
  const child = spawn(command, [serverFile], {
    cwd: path.dirname(serverFile),
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NEXT_PUBLIC_SITE_URL: baseUrl,
      NEXT_PUBLIC_MARBLE_API_URL: process.env.NEXT_PUBLIC_MARBLE_API_URL || "https://api.marblecms.com",
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://opencut:opencut@127.0.0.1:5432/opencut",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "test-only-desktop-secret",
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "http://127.0.0.1:8079",
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "unavailable",
      MARBLE_WORKSPACE_KEY: process.env.MARBLE_WORKSPACE_KEY || "unavailable",
      FREESOUND_CLIENT_ID: process.env.FREESOUND_CLIENT_ID || "unavailable",
      FREESOUND_API_KEY: process.env.FREESOUND_API_KEY || "unavailable",
      NODE_PATH: [dependencyDirectory, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
      ...extraEnvironment,
    },
  });
  let childError = null;
  const collect = (chunk) => { tail = (tail + String(chunk)).slice(-8000); };
  child.stdout?.on("data", collect);
  child.stderr?.on("data", collect);
  child.on("error", (error) => { childError = error; });

  try {
    for (let i = 0; i < 60; i += 1) {
      if (childError) throw childError;
      if (child.exitCode !== null) {
        throw new Error(label + " exited " + child.exitCode + "\n" + tail);
      }
      try {
        const r = await fetch(baseUrl + "/api/health", {
          signal: AbortSignal.timeout(750),
        });
        if (r.ok) {
          const projects = await fetch(baseUrl + "/projects", {
            signal: AbortSignal.timeout(5000),
          });
          if (!projects.ok) {
            throw new Error(label + " projects page returned " + projects.status + "\n" + tail);
          }
          console.log(label + " passed. Health OK, project page HTTP " + projects.status + ".");
          return;
        }
      } catch (error) {
        if (error instanceof Error && /projects page returned/.test(error.message)) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(label + " did not become ready.\n" + tail);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise(resolve => child.once("exit", resolve)),
        new Promise(resolve => setTimeout(resolve, 2500)),
      ]);
    }
  }
}

try {
  await probe({ command: process.execPath, label: packaged ? "Packaged runtime with system Node" : "Standalone Next runtime" });
  if (packaged) {
    const exe = fileExists(path.resolve(desktopDir, "dist", "win-unpacked", "OpenCut Desktop.exe"));
    await probe({
      command: exe,
      extraEnvironment: { ELECTRON_RUN_AS_NODE: "1" },
      label: "Bundled server started through installed Electron exe",
    });
  }
} catch (error) {
  console.error("RUNTIME SMOKE TEST FAILED:\n" + (error?.stack || error));
  process.exitCode = 1;
}
