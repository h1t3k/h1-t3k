import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowlistPath = resolve(root, "release-files.txt");
const paths = readFileSync(allowlistPath, "utf8")
  .split("\n")
  .filter(Boolean);

function asciiSort(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

if (paths.some((path) => !/^[\x20-\x7e]+$/.test(path))) {
  throw new Error("release-files.txt contains a non-ASCII path");
}
if (paths.some((path) => path.startsWith("/") || path.split("/").includes(".."))) {
  throw new Error("release-files.txt contains an unsafe path");
}
if (new Set(paths).size !== paths.length) {
  throw new Error("release-files.txt contains duplicate paths");
}
if (paths.join("\n") !== [...paths].sort(asciiSort).join("\n")) {
  throw new Error("release-files.txt is not in ASCII path order");
}

let totalBytes = 0;
const rows = paths.map((path) => {
  const bytes = readFileSync(resolve(root, path));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  totalBytes += bytes.length;
  return `${path}\t${bytes.length}\t${sha256}\n`;
});
const manifest = rows.join("");
const summary = {
  file_count: paths.length,
  content_bytes: totalBytes,
  manifest_bytes: Buffer.byteLength(manifest),
  manifest_sha256: createHash("sha256").update(manifest).digest("hex")
};

const verifyFlag = process.argv.indexOf("--verify");
if (verifyFlag !== -1) {
  const candidate = process.argv[verifyFlag + 1];
  if (!candidate) throw new Error("--verify requires a manifest path");
  const expected = readFileSync(resolve(root, candidate), "utf8");
  if (expected !== manifest) throw new Error(`${candidate} does not match release bytes`);
}

if (process.argv.includes("--json")) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  process.stdout.write(manifest);
  process.stderr.write(`${JSON.stringify(summary)}\n`);
}
