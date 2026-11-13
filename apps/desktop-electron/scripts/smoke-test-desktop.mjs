// Launch the *actual packaged Electron app* in test mode, not just server.js.
// Any startup failure must fail CI and display the saved startup.log contents.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const desktopRoot = path.resolve(import.meta.dirname, "..");
const executable = path.join(desktopRoot, "dist", "win-unpacked", "OpenCut Desktop.exe");
if (!fs.existsSync(executable)) {
  throw new Error("Packaged executable missing: " + executable);
}
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencut-desktop-smoke-"));
let stdout = "";
let stderr = "";
const child = spawn(executable, [], {
  windowsHide: true,
  env: {
    ...process.env,
    OPENCUT_DESKTOP_SMOKE_TEST: "1",
    // Test in a separate app data directory to protect preexisting projects.
    APPDATA: path.join(tempDir, "Roaming"),
    LOCALAPPDATA: path.join(tempDir, "Local"),
    ELECTRON_RUN_AS_NODE: "",
  },
});
child.stdout?.on("data", (part) => { stdout = (stdout + String(part)).slice(-12000); });
child.stderr?.on("data", (part) => { stderr = (stderr + String(part)).slice(-12000); });

const exit = await Promise.race([
  new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal }));
  }),
  new Promise((_, reject) => setTimeout(() => reject(new Error("Desktop self-test timed out")), 50000)),
]).catch((error) => {
  child.kill();
  throw error;
});

console.log("Desktop app stdout:\n" + stdout);
console.log("Desktop app stderr:\n" + stderr);
const logDir = path.join(tempDir, "Roaming", "opencut-desktop");
if (fs.existsSync(logDir)) {
  for (const name of fs.readdirSync(logDir)) {
    if (name === "startup.log") console.log("Desktop startup.log:\n" + fs.readFileSync(path.join(logDir, name), "utf8").slice(-12000));
  }
}
if (exit.code !== 0) {
  throw new Error("Installed desktop application exited " + exit.code + " (signal " + exit.signal + ").");
}
console.log("Desktop application self-test passed.");
