import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const routesSource = readFileSync(resolve(root, "assets/js/routes.js"), "utf8");
const gateSource = readFileSync(resolve(root, "assets/js/boot-gate.js"), "utf8");
const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function classList() {
  const values = new Set();
  return {
    add(...names) { names.forEach((name) => values.add(name)); },
    remove(...names) { names.forEach((name) => values.delete(name)); },
    contains(name) { return values.has(name); },
    values
  };
}

function storage(initial = {}, throws = false) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      if (throws) throw new Error("storage denied");
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (throws) throw new Error("storage denied");
      values.set(key, String(value));
    },
    removeItem(key) {
      if (throws) throw new Error("storage denied");
      values.delete(key);
    },
    values
  };
}

function runScenario({
  url = "https://h1-t3k.design/",
  reduced = false,
  version = null,
  lastAt = null,
  transition = null,
  storageThrows = false,
  now = NOW
} = {}) {
  const classes = classList();
  const timers = [];
  const events = [];
  const historyCalls = [];
  const focusCalls = [];
  const local = storage({
    ...(version === null ? {} : { h1_full_boot_v3: String(version) }),
    ...(lastAt === null ? {} : { h1_full_boot_last_at: String(lastAt) })
  }, storageThrows);
  const session = storage({
    ...(transition === null ? {} : {
      h1_compact_transition_v1: JSON.stringify(transition)
    })
  }, storageThrows);
  const FakeDate = class extends Date {};
  FakeDate.now = () => now;
  const location = new URL(url);
  const windowObject = {
    location,
    localStorage: local,
    sessionStorage: session,
    name: "",
    matchMedia: () => ({ matches: reduced }),
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    dispatchEvent(event) { events.push(event); },
    performance: { now: () => 0 }
  };
  const context = {
    URL,
    Date: FakeDate,
    Number,
    Object,
    String,
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    document: {
      documentElement: { classList: classes },
      getElementById(id) {
        if (id !== "main-content") return null;
        return {
          focus(options) { focusCalls.push(options); }
        };
      }
    },
    history: {
      state: null,
      replaceState(...args) { historyCalls.push(args); }
    },
    performance: windowObject.performance,
    window: windowObject
  };

  vm.runInNewContext(routesSource, context);
  vm.runInNewContext(gateSource, context);
  return {
    classes,
    events,
    focusCalls,
    historyCalls,
    local,
    session,
    timers,
    window: windowObject
  };
}

const failures = [];
let checks = 0;
function expect(condition, message) {
  if (condition) checks += 1;
  else failures.push(message);
}

const freshHome = runScenario();
expect(freshHome.window.__H1_BOOT__.state === "ELIGIBLE", "fresh Home is ELIGIBLE");
expect(freshHome.window.__H1_BOOT__.route.id === "home", "fresh Home resolves Home route");
expect(freshHome.classes.contains("booting"), "fresh Home enters full boot");
expect(freshHome.window.__H1_BOOT__.reason === "version", "missing version explains fresh eligibility");

const freshProjects = runScenario({ url: "https://h1-t3k.design/projects.html" });
expect(freshProjects.window.__H1_BOOT__.route.id === "projects", "direct Projects resolves route");
expect(freshProjects.classes.contains("booting"), "direct Projects enters full boot");

const freshNotes = runScenario({ url: "https://h1-t3k.design/field-notes.html" });
expect(freshNotes.window.__H1_BOOT__.route.id === "notes", "direct Notes resolves route");

const freshArchive = runScenario({ url: "https://h1-t3k.design/design-archive.html" });
expect(freshArchive.window.__H1_BOOT__.route.id === "archive", "direct archive resolves route");

const pagesHome = runScenario({ url: "https://h1t3k.github.io/h1-t3k/" });
expect(pagesHome.window.__H1_BOOT__.route.id === "home", "GitHub Pages project root resolves Home");

const recent = runScenario({ version: "3", lastAt: NOW - 1000 });
expect(recent.window.__H1_BOOT__.state === "INELIGIBLE", "recent return is INELIGIBLE");
expect(recent.window.__H1_BOOT__.reason === "recent", "recent return has recent reason");
expect(recent.classes.contains("boot-done"), "recent return shows content");

const expired = runScenario({ version: "3", lastAt: NOW - DAY });
expect(expired.window.__H1_BOOT__.state === "ELIGIBLE", "24-hour return is ELIGIBLE");
expect(expired.window.__H1_BOOT__.reason === "age", "24-hour return has age reason");

const versionChanged = runScenario({ version: "2", lastAt: NOW - 1000 });
expect(versionChanged.window.__H1_BOOT__.state === "ELIGIBLE", "version change is ELIGIBLE");
expect(versionChanged.window.__H1_BOOT__.reason === "version", "version change has version reason");

const replay = runScenario({
  url: "https://h1-t3k.design/projects.html?presentation=full#web3-portfolio",
  version: "3",
  lastAt: NOW - 1000
});
expect(replay.window.__H1_BOOT__.state === "ELIGIBLE", "presentation replay is ELIGIBLE");
expect(replay.window.__H1_BOOT__.reason === "replay", "presentation replay has replay reason");
expect(replay.historyCalls.length === 1, "presentation replay parameter is cleaned once");
expect(
  replay.historyCalls[0][2] === "/projects.html#web3-portfolio",
  "cleaned replay URL preserves path and hash"
);

const transition = runScenario({
  url: "https://h1-t3k.design/field-notes.html",
  version: "2",
  lastAt: NOW - DAY,
  transition: { route: "notes", expiresAt: NOW + 1000 }
});
expect(transition.window.__H1_BOOT__.state === "INELIGIBLE", "matching compact token suppresses full boot");
expect(transition.window.__H1_BOOT__.reason === "compact-transition", "matching compact token has transition reason");
expect(transition.classes.contains("transition-arrival"), "matching compact token marks arrival");
expect(!transition.session.values.has("h1_compact_transition_v1"), "matching compact token is consumed");

const staleTransition = runScenario({
  url: "https://h1-t3k.design/field-notes.html",
  version: "3",
  lastAt: NOW - 1000,
  transition: { route: "notes", expiresAt: NOW - 1 }
});
expect(staleTransition.window.__H1_BOOT__.reason === "recent", "stale token is ignored");
expect(!staleTransition.session.values.has("h1_compact_transition_v1"), "stale token is cleared");

const mismatchedTransition = runScenario({
  url: "https://h1-t3k.design/projects.html",
  version: "3",
  lastAt: NOW - 1000,
  transition: { route: "notes", expiresAt: NOW + 1000 }
});
expect(mismatchedTransition.window.__H1_BOOT__.reason === "recent", "mismatched token is ignored");

const reduced = runScenario({ reduced: true });
expect(reduced.classes.contains("booting-rm"), "reduced-motion entry uses static boot path");

const denied = runScenario({ storageThrows: true });
expect(denied.window.__H1_BOOT__.state === "ELIGIBLE", "storage denial falls back to an eligible in-memory boot");
expect(denied.classes.contains("booting"), "storage denial never leaves a blank unclassified state");
expect(denied.window.__H1_BOOT__.commitCompletion(NOW) === "memory", "completion falls back to memory");
expect(denied.window.__H1_BOOT_MEMORY__.lastAt === NOW, "memory fallback records completion");

const watchdog = freshHome.timers.find((timer) => timer.delay === 2800);
expect(Boolean(watchdog), "full boot fail-safe is scheduled at 2800 ms");
watchdog.callback();
expect(freshHome.window.__H1_BOOT__.state === "FAILED_SAFE", "watchdog enters FAILED_SAFE");
expect(freshHome.classes.contains("boot-done"), "watchdog restores content");
expect(!freshHome.classes.contains("booting"), "watchdog removes booting class");
const focusTimer = freshHome.timers.find((timer) => timer.delay === 0);
expect(Boolean(focusTimer), "watchdog schedules visible focus recovery");
focusTimer.callback();
expect(freshHome.focusCalls.length === 1, "watchdog moves focus to visible main content");
expect(
  freshHome.events.some((event) =>
    event.type === "h1t3k:boot" && event.detail.name === "boot_failed_safe"
  ),
  "watchdog emits a coarse fail-safe event"
);

if (failures.length) {
  console.error(`Boot gate tests failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Boot gate tests passed: ${checks} checks`);
}
