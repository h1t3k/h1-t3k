import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const checks = [];

function check(condition, message) {
  if (condition) checks.push(message);
  else failures.push(message);
}
function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}
function occurrences(text, expression) {
  return [...text.matchAll(expression)].length;
}
function decodeText(text) {
  return text
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();
}
function metaContent(html, attribute, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta ${attribute}="${escaped}" content="([^"]*)">`))?.[1] || "";
}
function linkHref(html, relation) {
  const escaped = relation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<link rel="${escaped}" href="([^"]+)">`))?.[1] || "";
}

const site = JSON.parse(read("site.json"));
const gallery = JSON.parse(read("gallery.json"));
const fontManifest = JSON.parse(read("manifests/font-assets.json"));
const metadataMatrix = JSON.parse(read("manifests/metadata-matrix.json"));
const htmlFiles = [
  "index.html",
  "projects.html",
  "field-notes.html",
  "security-lab.html",
  "design-archive.html",
  "contact.html"
];
const expectedNav = site.nav.map(({ label, href }) => ({ label, href }));
const canonicalSet = new Set();
const pageMetadata = [];

for (const path of htmlFiles) {
  const html = read(path);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1] || "";
  const canonical = linkHref(html, "canonical");
  const navBlock = html.match(/<div class="nav-links"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const navLinks = [...navBlock.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((match) => ({ href: match[1], label: decodeText(match[2]) }));

  check(occurrences(html, /<h1(?:\s|>)/g) === 1, `${path}: exactly one H1`);
  check(occurrences(html, /<main(?:\s|>)/g) === 1, `${path}: exactly one main landmark`);
  check(new Set(ids).size === ids.length, `${path}: no duplicate IDs`);
  check(occurrences(html, /<link rel="canonical"/g) === 1, `${path}: exactly one canonical`);
  check(Boolean(metaContent(html, "name", "description")), `${path}: description present`);
  check(Boolean(metaContent(html, "property", "og:title")), `${path}: Open Graph title present`);
  check(Boolean(metaContent(html, "property", "og:description")), `${path}: Open Graph description present`);
  check(metaContent(html, "property", "og:url") === canonical, `${path}: og:url matches canonical`);
  check(metaContent(html, "name", "twitter:card") === "summary", `${path}: Twitter summary card present`);
  check(metaContent(html, "name", "bingbot") === "nocache", `${path}: Bing content-use policy present`);
  check(title.endsWith(" — Keaton Raser"), `${path}: shared title shell`);
  check(canonical.startsWith("https://h1-t3k.design/"), `${path}: canonical host`);
  check(
    navLinks.length === expectedNav.length &&
      navLinks.every((link, index) =>
        link.href === expectedNav[index].href &&
        link.label === expectedNav[index].label
      ),
    `${path}: navigation matches site.json`
  );
  check(!/<meta name="keywords"/i.test(html), `${path}: no obsolete keyword metadata`);
  check(!/\beyebrow\b/i.test(html), `${path}: decorative eyebrow removed`);
  for (const asset of [
    "assets/js/routes.js?v=3.2",
    "assets/js/boot-gate.js?v=3.2",
    "styles/main.css?v=3.6",
    "assets/js/boot.js?v=3.4",
    "assets/js/init.js?v=3.3"
  ]) {
    check(html.includes(asset), `${path}: release asset version is coherent (${asset})`);
  }

  canonicalSet.add(canonical);
  pageMetadata.push({
    path,
    title: decodeText(title),
    description: metaContent(html, "name", "description"),
    canonical
  });

  const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const reference of references) {
    if (
      reference === "/" ||
      reference.startsWith("#") ||
      /^(?:https?:|web3:|mailto:|data:)/.test(reference)
    ) continue;
    const local = reference.split("#")[0].split("?")[0];
    check(existsSync(resolve(root, local)), `${path}: local reference exists (${local})`);
  }
}

check(metadataMatrix.generated_timestamps === false, "metadata matrix has no generated timestamps");
check(metadataMatrix.pages.length === htmlFiles.length, "metadata matrix covers every public page");
for (const page of pageMetadata) {
  const row = metadataMatrix.pages.find((candidate) => candidate.path === page.path);
  check(Boolean(row), `metadata matrix includes ${page.path}`);
  if (!row) continue;
  check(row.title === page.title, `metadata title matches (${page.path})`);
  check(row.description === page.description, `metadata description matches (${page.path})`);
  check(row.canonical === page.canonical, `metadata canonical matches (${page.path})`);
  check(row.indexing === "index, follow", `metadata indexing is explicit (${page.path})`);
}

const sitemapLocations = [...read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1]);
check(
  JSON.stringify([...canonicalSet].sort()) === JSON.stringify([...sitemapLocations].sort()),
  "sitemap and canonical URL sets match"
);
check(!/<lastmod>/i.test(read("sitemap.xml")), "sitemap has no generated timestamps");

const indexJsonLd = read("index.html").match(
  /<script type="application\/ld\+json">([\s\S]*?)<\/script>/
)?.[1];
check(Boolean(indexJsonLd), "homepage JSON-LD present");
if (indexJsonLd) {
  try {
    const data = JSON.parse(indexJsonLd);
    check(data["@type"] === "Person" && data.name === "Keaton Raser", "homepage JSON-LD is factual Person data");
  } catch {
    failures.push("homepage JSON-LD parses");
  }
}

const archiveHtml = read("design-archive.html");
check(gallery.works.length === 12, "gallery metadata contains 12 works");
for (const work of gallery.works) {
  check(archiveHtml.includes(`id="${work.id}"`), `archive includes ${work.id}`);
  check(archiveHtml.includes(work.thumb), `archive thumbnail matches ${work.id}`);
  check(archiveHtml.includes(work.full), `archive full image matches ${work.id}`);
}
check(!/(?:grayscale|sepia|hue-rotate)\(/i.test(read("styles/main.css")), "artwork has no color-altering filters");
check(archiveHtml.includes("never stored") && archiveHtml.includes("never included in analytics"), "specimen noncollection is visible");

const initJs = read("assets/js/init.js");
const bootJs = read("assets/js/boot.js");
const bootGateJs = read("assets/js/boot-gate.js");
const routesJs = read("assets/js/routes.js");
const mainCss = read("styles/main.css");
const compactBoot = bootJs.match(
  /function showCompact\([\s\S]*?(?=\n  function resetAfterPageShow)/
)?.[0] || "";
for (const [name, source] of [
  ["init.js", initJs],
  ["boot.js", bootJs],
  ["boot-gate.js", bootGateJs],
  ["routes.js", routesJs]
]) {
  try {
    new Function(source);
    checks.push(`${name} parses`);
  } catch {
    failures.push(`${name} parses`);
  }
}
check(!/(visitor|user|fingerprint).*(?:localStorage|sessionStorage)/i.test(initJs), "init.js creates no persistent visitor identifier");
check(initJs.includes("local_custom_event_only") === false, "runtime does not imply a network analytics transport");
for (const eventName of site.analytics.allowed_conversion_events) {
  check(initJs.includes(`"${eventName}"`), `conversion event is implemented (${eventName})`);
}
check(bootJs.includes("FAILED_SAFE") && bootJs.includes("SKIPPED") && bootJs.includes("COMPLETE"), "boot terminal states implemented");
check(compactBoot.includes('skip.textContent = "tap anywhere to continue"'), "compact boot restores the unboxed tap-anywhere prompt");
check(!compactBoot.includes("$ route ........"), "compact boot removes the duplicate route header");
check(compactBoot.includes('boot.addEventListener("pointerdown", continueNow)'), "compact boot accepts a pointer anywhere");
check(mainCss.includes(".is-compact .boot-route-name{display:none}"), "compact destination header is visually removed");
for (const eventName of site.analytics.allowed_boot_events) {
  check(
    bootGateJs.includes(`"${eventName}"`) || bootJs.includes(`"${eventName}"`),
    `boot event is implemented (${eventName})`
  );
}
check(routesJs.includes('"h1_full_boot_v3"') && routesJs.includes("24 * 60 * 60 * 1000"), "boot has versioned 24-hour eligibility");
check(
  bootGateJs.includes("manifest.replayParameter") &&
    bootGateJs.includes("manifest.replayValue"),
  "boot requires exact presentation replay marker"
);
check(bootGateJs.includes("history.replaceState"), "presentation replay marker is removed");
for (const routeName of ["Home", "Projects & Systems", "Notes", "Type & Archive", "Contact", "Security Lab"]) {
  check(routesJs.includes(`name: "${routeName}"`), `route manifest includes ${routeName}`);
}
check(
  occurrences(routesJs, /parallax: true/g) === 2 &&
    occurrences(routesJs, /parallax: false/g) === 4,
  "route manifest scopes parallax to Home and Projects"
);
check(initJs.includes("CONFIRMED_WEB3_ROUTE"), "confirmed Web3 capability state implemented");
check(initJs.includes("UNKNOWN_WEB3_ROUTE"), "unknown Web3 capability state implemented");
check(initJs.includes("NOTICE_SUPPRESSED_BY_USER"), "suppressed Web3 notice state implemented");
check(
  read("projects.html").includes(site.web3.direct_uri),
  "direct Web3 URI is preserved"
);
check(
  !read("field-notes.html").includes("data-depth-flow") &&
    !read("design-archive.html").includes("data-depth-flow"),
  "Notes and Type & Archive remain free of parallax"
);
check(
  !htmlFiles.some((path) => /class="sys-line"|class="prompt"/.test(read(path))) &&
    !/\.prompt::before/.test(read("styles/main.css")),
  "dollar-prefixed page eyebrows are removed"
);
check(occurrences(read("projects.html"), /<dt>Contribution boundary<\/dt>/g) === 4, "selected projects state contribution boundaries");
check(
  htmlFiles.reduce((count, path) =>
    count + occurrences(read(path), /class="(?:hero-lede )?responsive-intro"/g), 0
  ) === 5,
  "responsive intro cap is scoped to the five owner-named pages"
);
check(
  mainCss.includes("--bounded-copy:clamp(16px,calc(12px + .833333vw),18px)") &&
    mainCss.includes("--bounded-card-heading:clamp(24px,calc(18px + 1.25vw),27px)") &&
    mainCss.includes("--bounded-heading:clamp(32px,calc(24px + 1.666667vw),36px)"),
  "requested content type uses a uniform 9:8 bounded scale"
);
check(
  mainCss.includes(".practice-card h3{font-size:var(--bounded-card-heading)}") &&
    mainCss.includes(".supporting-grid p{color:var(--muted);font-size:var(--bounded-copy)}"),
  "selected work, working range, and supporting-note cells share the bounded type scale"
);
check(
  mainCss.includes("grid-template-columns:repeat(auto-fill,138px)"),
  "visual archive keeps compact deterministic thumbnail tracks"
);
check(
  occurrences(archiveHtml, /data-specimen-size/g) === 3 &&
    initJs.includes("renderSizeLabels") &&
    initJs.includes("getComputedStyle(sample).fontSize"),
  "all live specimen cards expose deterministic font-size readouts"
);

const robots = read("robots.txt");
for (const agent of [
  "GPTBot",
  "ClaudeBot",
  "Amazonbot",
  "Applebot-Extended",
  "Google-Extended",
  "meta-externalagent",
  "CCBot"
]) {
  check(robots.includes(`User-agent: ${agent}`), `robots policy names ${agent}`);
}
check(robots.includes("advisory, not authentication or access control"), "robots enforcement limit is explicit");
check(robots.includes("direct web3://"), "robots direct-Web3 limit is explicit");

const releasePaths = read("release-files.txt").split("\n").filter(Boolean);
const sortedPaths = [...releasePaths].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
const releaseSummary = JSON.parse(read("manifests/release-summary.json"));
check(new Set(releasePaths).size === releasePaths.length, "release allowlist has no duplicates");
check(releasePaths.join("\n") === sortedPaths.join("\n"), "release allowlist is ASCII sorted");
for (const path of releasePaths) {
  check(existsSync(resolve(root, path)), `release file exists (${path})`);
  const bytes = readFileSync(resolve(root, path));
  if ([".html", ".css", ".js", ".json", ".xml", ".txt"].includes(extname(path))) {
    check(!bytes.includes(13), `release text file uses LF line endings (${path})`);
  }
  check((statSync(resolve(root, path)).mode & 0o777) === 0o644, `release file mode is 0644 (${path})`);
}
const releaseManifestText = releasePaths.map((path) => {
  const bytes = readFileSync(resolve(root, path));
  return `${path}\t${bytes.length}\t${createHash("sha256").update(bytes).digest("hex")}\n`;
}).join("");
check(
  releaseSummary.candidate.file_count === releasePaths.length,
  "release summary file count matches"
);
check(
  releaseSummary.candidate.content_bytes === releasePaths
    .map((path) => statSync(resolve(root, path)).size)
    .reduce((total, size) => total + size, 0),
  "release summary byte count matches"
);
check(
  releaseSummary.candidate.manifest_bytes === Buffer.byteLength(releaseManifestText),
  "release summary manifest byte count matches"
);
check(
  releaseSummary.candidate.manifest_sha256 ===
    createHash("sha256").update(releaseManifestText).digest("hex"),
  "release summary manifest checksum matches"
);

for (const asset of fontManifest.assets) {
  const bytes = readFileSync(resolve(root, asset.path));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  check(bytes.length === asset.bytes, `font byte count matches (${asset.path})`);
  check(sha256 === asset.sha256, `font checksum matches (${asset.path})`);
}
check(fontManifest.status.source_files === "unavailable", "font source gap is explicit");
check(fontManifest.status.distribution_rights === "owner_confirmation_required", "font rights gate is explicit");

const releaseText = releasePaths
  .filter((path) => [".html", ".css", ".js", ".json", ".xml", ".txt"].includes(extname(path)))
  .map((path) => read(path))
  .join("\n");
check(
  !/(?:BioLife|Octapharma|plasma|affiliate|skip-the-interview|Principal Security Researcher)/i.test(releaseText),
  "portfolio-misaligned and unsupported copy is absent"
);
check(!/(?:web3url-gateway|web3-url-gateway)/i.test(releaseText), "gateway wrapper code is absent");
check(!/(?:styleguide\.md|intro-cold-boot-spec)/i.test(releaseText), "reference prompts are not treated as source instructions");

if (failures.length) {
  console.error(`Verification failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Verification passed: ${checks.length} checks`);
}
