// Assemble a self-contained local Next.js runtime for the desktop installer.
// Next.js standalone excludes /public and /.next/static by design.
import fs from "node:fs";
import path from "node:path";

const desktopDir = path.resolve(import.meta.dirname, "..");
const webDir = path.resolve(desktopDir, "../web");
const standaloneDir = path.join(webDir, ".next", "standalone");
const staticDir = path.join(webDir, ".next", "static");
const publicDir = path.join(webDir, "public");
const outputDir = path.join(desktopDir, "runtime");

if (!fs.existsSync(standaloneDir)) {
  throw new Error("Missing Next.js standalone build. Run bun run build:web first.");
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.cpSync(standaloneDir, outputDir, { recursive: true, dereference: true });

// Next may emit server.js at the standalone root or nested beneath apps/web.
const candidates = [
  path.join(outputDir, "apps", "web", "server.js"),
  path.join(outputDir, "server.js"),
];
const serverScript = candidates.find((candidate) => fs.existsSync(candidate));
if (!serverScript) {
  throw new Error("Could not find Next.js standalone server.js in the build output.");
}

const serverDir = path.dirname(serverScript);
if (fs.existsSync(staticDir)) {
  fs.cpSync(staticDir, path.join(serverDir, ".next", "static"), {
    recursive: true,
    dereference: true,
  });
}
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(serverDir, "public"), {
    recursive: true,
    dereference: true,
  });
}

const relativeServerPath = path.relative(outputDir, serverScript).replaceAll(path.sep, "/");
fs.writeFileSync(
  path.join(outputDir, "server-path.json"),
  JSON.stringify({ serverRelativePath: relativeServerPath }, null, 2) + "\n",
);
console.log("Prepared desktop server:", relativeServerPath);
