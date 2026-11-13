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

// Bun's workspace layout can make a Next.js standalone server resolve "next"
// from the original repository instead of from its published output. Copy its
// exact installed runtime dependency tree into the standalone output so an
// installed desktop app has no dependency on the build machine.
const repositoryRoot = path.resolve(desktopDir, "../..");
const dependencyRoots = [
  path.join(webDir, "node_modules"),
  path.join(repositoryRoot, "node_modules"),
];
const staged = new Set();

function findInstalledPackage(name, requesterDir) {
  const roots = [];
  if (requesterDir) {
    let directory = requesterDir;
    while (directory && directory !== path.dirname(directory)) {
      roots.push(path.join(directory, "node_modules"));
      directory = path.dirname(directory);
    }
  }
  roots.push(...dependencyRoots);
  for (const root of roots) {
    const candidate = path.join(root, name);
    if (fs.existsSync(path.join(candidate, "package.json"))) {
      return fs.realpathSync(candidate);
    }
  }
  return null;
}

function stageRuntimePackage(name, required = true, requesterDir = null) {
  if (staged.has(name)) return;
  const source = findInstalledPackage(name, requesterDir);
  if (!source) {
    if (required) throw new Error("Missing installed runtime dependency: " + name);
    return;
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8"));
  staged.add(name);
  const destination = path.join(outputDir, "node_modules", name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, dereference: true });
  for (const dependency of Object.keys(packageJson.dependencies || {})) {
    stageRuntimePackage(dependency, true, source);
  }
  for (const dependency of Object.keys(packageJson.optionalDependencies || {})) {
    stageRuntimePackage(dependency, false, source);
  }
}
for (const name of ["next", "react", "react-dom"]) {
  stageRuntimePackage(name);
}
console.log("Staged self-contained server dependencies:", staged.size);


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
