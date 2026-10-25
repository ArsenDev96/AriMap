#!/usr/bin/env node
// Checks what EAS Build would upload, without uploading it (docs/MOBILE.md, "What EAS uploads").
//
//   node scripts/check-eas-archive.mjs              inspect the archive (eas build:inspect --stage archive), then check it
//   node scripts/check-eas-archive.mjs --dir <dir>  check an archive already inspected into <dir>
//
// Fails (exit code 1) on any file outside what the app builds from, any forbidden file (Git data, env files,
// credentials, website build output and caches, logs), a missing file the build needs, a secret-shaped string in a
// text file, or the value of any local env file's variable anywhere in the archive. Secret values are compared, never
// printed: findings name the rule or the variable and the file.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "../..");

/**
 * The landmark pictures the app bundles (src/components/landmarkImages.ts): each must be uploaded (/.easignore lets
 * them in one by one), and no other of the website's pictures may be.
 */
const LANDMARK_IMAGES = [
  ...readFileSync(path.join(appDir, "src/components/landmarkImages.ts"), "utf8").matchAll(/require\("@\/(assets\/landmarks\/[a-z0-9-]+\.webp)"\)/g),
].map((m) => `src/${m[1]}`);

/**
 * The website's public pictures the app bundles (required as "@/../public/…": the Quick Challenge's share card
 * template, src/challenge/ShareCard.tsx): each must be uploaded (/.easignore names it), and no other public file may be.
 */
const PUBLIC_IMAGES = [...readFileSync(path.join(appDir, "src/challenge/ShareCard.tsx"), "utf8").matchAll(/require\("@\/\.\.\/(public\/[a-z0-9/-]+\.png)"\)/g)].map(
  (m) => m[1],
);

/** Where the archive may have files: the app, the shared code it imports, and the pictures it bundles. */
const ALLOWED = [
  /^\.easignore$/,
  /^apps\/mobile\//,
  /^src\/(core|geo|data)\//,
  ...[...LANDMARK_IMAGES, ...PUBLIC_IMAGES].map((file) => new RegExp(`^${file.replace(/[.]/g, "\\.")}$`)),
];

/** Never in the archive, wherever they are. */
const FORBIDDEN = [
  ["Git data", /(^|\/)\.git(\/|$)/],
  ["env file", /(^|\/)(\.env(\..+)?|[^/]+\.env)$/],
  ["website build output or cache", /(^|\/)(\.next[^/]*|\.vercel|\.turbo|out|coverage)\//],
  ["installed packages", /(^|\/)node_modules\//],
  ["generated native project", /^apps\/mobile\/(android|ios)\//],
  ["Expo or Metro cache", /(^|\/)(\.expo|dist|web-build|\.kotlin)\/|\.metro-health-check/],
  ["credentials", /(^|\/)(credentials\.json|google-services\.json|GoogleService-Info\.plist|[^/]*service-account[^/]*\.json)$/],
  ["key or certificate", /\.(keystore|jks|p8|p12|pem|key|mobileprovision|cer)$/],
  ["log or temporary file", /\.(log|tmp|tsbuildinfo)$|(^|\/)(npm-debug|yarn-debug|yarn-error)\.|\.orig\.|(^|\/)\.DS_Store$/],
  ["test file", /\.test\.ts$/],
];

/** What the build needs: missing any of these means the allowlist is too strict. */
const REQUIRED = [
  "apps/mobile/package.json",
  "apps/mobile/package-lock.json",
  "apps/mobile/app.json",
  "apps/mobile/eas.json",
  "apps/mobile/metro.config.js",
  "apps/mobile/index.ts",
  "apps/mobile/src/app/_layout.tsx",
  "src/core/progress/storage.ts",
  "src/core/i18n/messages.hy.ts",
  "src/core/lessons/levels.ts",
  "src/geo/regionMap.ts",
  "src/data/geo/world-map.ts",
  "src/data/geo/europe-west.topo.json",
  "src/data/geo/europe-north.topo.json",
  "src/data/geo/europe-channel.topo.json",
  "src/data/geo/europe-east.topo.json",
  "src/data/geo/europe-challenge.topo.json",
  ...LANDMARK_IMAGES,
  ...PUBLIC_IMAGES,
];

/** Secret-shaped strings in text files. */
const SECRET_PATTERNS = [
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{8,}/],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["JSON Web Token", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["secret assignment", /\b[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|TOKEN)[A-Z0-9_]*\s*[=:]\s*["']?[A-Za-z0-9_\-./+]{12,}/],
];
const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|json|md|txt|yml|yaml|xml|gradle|properties|plist|env|sh|toml|ini)$|(^|\/)\.[a-z]+$/i;

function inspectArchive() {
  const out = mkdtempSync(path.join(tmpdir(), "arimap-eas-archive-"));
  const run = spawnSync("npx", ["--yes", "eas-cli@latest", "build:inspect", "--platform", "android", "--profile", "preview", "--stage", "archive", "--output", out, "--force"], {
    cwd: appDir,
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  if (run.status !== 0) {
    rmSync(out, { recursive: true, force: true });
    fail(["eas build:inspect failed (commit first: eas.json sets requireCommit)."]);
  }
  return out;
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return [...listFiles(full, base), path.relative(base, full).split(path.sep).join("/") + "/"];
    return [path.relative(base, full).split(path.sep).join("/")];
  });
}

/** Values of the local env files' variables (12+ characters), by name: compared only, never printed. */
function localSecretValues() {
  const files = [repoRoot, appDir].flatMap((dir) =>
    existsSync(dir) ? readdirSync(dir).filter((f) => /^\.env(\..+)?$/.test(f) && f !== ".env.example").map((f) => path.join(dir, f)) : [],
  );
  const values = new Map();
  for (const file of files) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
      if (value.length >= 12) values.set(`${match[1]} (${path.basename(file)})`, value);
    }
  }
  return values;
}

function fail(problems) {
  console.error(`\nEAS archive check FAILED:\n${problems.map((p) => `  - ${p}`).join("\n")}\n`);
  process.exit(1);
}

const dirFlag = process.argv.indexOf("--dir");
const archive = dirFlag !== -1 ? path.resolve(process.argv[dirFlag + 1]) : inspectArchive();
const ownTemp = dirFlag === -1;

try {
  const entries = listFiles(archive);
  const files = entries.filter((f) => !f.endsWith("/"));
  const problems = [];

  for (const entry of entries) {
    const [rule] = FORBIDDEN.find(([, re]) => re.test(entry)) ?? [];
    if (rule) problems.push(`${rule}: ${entry}`);
  }
  for (const file of files) if (!ALLOWED.some((re) => re.test(file))) problems.push(`outside the allowlist: ${file}`);
  for (const file of REQUIRED) if (!files.includes(file)) problems.push(`missing, but the build needs it: ${file}`);

  const secrets = localSecretValues();
  let bytes = 0;
  for (const file of files) {
    const buffer = readFileSync(path.join(archive, file));
    bytes += buffer.length;
    if (TEXT_FILE.test(file)) {
      const text = buffer.toString("utf8");
      for (const [rule, re] of SECRET_PATTERNS) if (re.test(text)) problems.push(`${rule} pattern in ${file}`);
    }
    for (const [name, value] of secrets) if (buffer.includes(value)) problems.push(`value of ${name} found in ${file}`);
  }

  if (problems.length) fail(problems);

  const byArea = new Map();
  for (const file of files) {
    const area = file.startsWith("apps/mobile/") ? "apps/mobile" : file.split("/").slice(0, 2).join("/");
    byArea.set(area, (byArea.get(area) ?? 0) + statSync(path.join(archive, file)).size);
  }
  console.log(`\nEAS archive check passed: ${files.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  for (const [area, size] of [...byArea].sort()) console.log(`  ${area.padEnd(14)} ${(size / 1024).toFixed(0).padStart(7)} KB`);
  console.log(`  local env values compared: ${secrets.size} (none found)`);
} finally {
  if (ownTemp) rmSync(archive, { recursive: true, force: true });
}
