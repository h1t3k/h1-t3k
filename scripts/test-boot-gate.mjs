import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const inlineGate = html.match(/<script>\n([\s\S]*?)\n<\/script>/)?.[1];
if (!inlineGate) throw new Error("inline boot gate not found");

function classList() {
  const values = new Set();
  return {
    add(...names) { names.forEach((name) => values.add(name)); },
    remove(...names) { names.forEach((name) => values.delete(name)); },
    contains(name) { return values.has(name); },
    values
  };
}

function runScenario({
  url = "https://h1-t3k.design/",
  reduced = false,
  seen = false,
  storageThrows = false
} = {}) {
  const classes = classList();
  const timers = [];
  const events = [];
  const historyCalls = [];
  const storage = {
    getItem() {
      if (storageThrows) throw new Error("storage denied");
      return seen ? "1" : null;
    }
  };
  const windowObject = {
    location: { href: url },
    matchMedia: () => ({ matches: reduced }),
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    dispatchEvent(event) { events.push(event); }
  };
  const context = {
    URL,
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    document: { documentElement: { classList: classes } },
    history: {
      replaceState(...args) { historyCalls.push(args); }
    },
    sessionStorage: storage,
    window: windowObject
  };
  vm.runInNewContext(inlineGate, context);
  return { classes, timers, events, historyCalls, window: windowObject };
}

const failures = [];
function expect(condition, message) {
  if (!condition) failures.push(message);
}

const direct = runScenario();
expect(direct.window.__H1_BOOT__.state === "INELIGIBLE", "direct visit is INELIGIBLE");
expect(direct.classes.contains("boot-done"), "direct visit shows content");
expect(!direct.classes.contains("booting"), "direct visit does not boot");

const eligible = runScenario({
  url: "https://h1-t3k.design/?entry=redirect"
});
expect(eligible.window.__H1_BOOT__.state === "ELIGIBLE", "redirect marker creates ELIGIBLE state");
expect(eligible.classes.contains("booting"), "eligible visit enters full boot");
expect(eligible.historyCalls.length === 1, "redirect marker is removed once");

const reduced = runScenario({
  url: "https://h1-t3k.design/?entry=redirect",
  reduced: true
});
expect(reduced.classes.contains("booting-rm"), "eligible reduced-motion visit uses reduced path");

const repeat = runScenario({
  url: "https://h1-t3k.design/?entry=redirect",
  seen: true
});
expect(repeat.window.__H1_BOOT__.state === "INELIGIBLE", "seen redirect is INELIGIBLE");
expect(repeat.classes.contains("boot-done"), "seen redirect shows content");
expect(repeat.historyCalls.length === 1, "seen redirect marker is still removed");

const denied = runScenario({
  url: "https://h1-t3k.design/?entry=redirect",
  storageThrows: true
});
expect(denied.classes.contains("boot-done"), "storage denial fails open");
expect(denied.window.__H1_BOOT__.state === "INELIGIBLE", "storage denial stays INELIGIBLE");

eligible.timers.at(-1)();
expect(eligible.window.__H1_BOOT__.state === "FAILED_SAFE", "watchdog enters FAILED_SAFE");
expect(eligible.classes.contains("boot-done"), "watchdog restores content");
expect(!eligible.classes.contains("booting"), "watchdog removes booting class");
expect(
  eligible.events.some((event) =>
    event.type === "h1t3k:boot" &&
    event.detail.name === "boot_failed_safe"
  ),
  "watchdog emits coarse FAILED_SAFE event"
);

if (failures.length) {
  console.error(`Boot gate tests failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log("Boot gate tests passed: 17 checks");
}
