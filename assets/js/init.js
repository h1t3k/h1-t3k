(function () {
  "use strict";

  const allowedEvents = new Set([
    "contact_click",
    "case_study_open",
    "profile_visit",
    "resume_open",
    "typeface_inquiry"
  ]);

  async function loadSiteConfig() {
    const response = await fetch("site.json", {
      cache: "force-cache",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`site.json ${response.status}`);
    return response.json();
  }

  function setupNavigation() {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const toggle = nav?.querySelector(".nav-toggle");
    const links = nav?.querySelector(".nav-links");
    const label = toggle?.querySelector("[data-menu-label]");
    if (!nav || !toggle || !links || !label) return;

    const compact = window.matchMedia("(max-width: 900px)");
    document.body.classList.add("nav-enhanced");

    function placeMenu() {
      if (compact.matches) {
        links.setAttribute("data-mobile-menu", "");
        links.setAttribute("role", "navigation");
        links.setAttribute("aria-label", "Portfolio navigation");
        if (links.parentElement !== document.body) document.body.appendChild(links);
      } else {
        links.removeAttribute("data-mobile-menu");
        links.removeAttribute("role");
        links.removeAttribute("aria-label");
        if (links.parentElement !== nav) nav.appendChild(links);
      }
    }

    function setOpen(open) {
      const next = compact.matches && open;
      toggle.setAttribute("aria-expanded", String(next));
      label.textContent = next ? "Close" : "Menu";
      document.body.classList.toggle("menu-open", next);
      document.documentElement.classList.toggle("menu-open", next);

      if (compact.matches) {
        links.toggleAttribute("inert", !next);
        links.setAttribute("aria-hidden", String(!next));
      } else {
        links.removeAttribute("inert");
        links.removeAttribute("aria-hidden");
      }
    }

    function syncViewport() {
      setOpen(false);
      placeMenu();
    }

    placeMenu();
    setOpen(false);

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    links.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (!document.body.classList.contains("menu-open")) return;
      if (event.key === "Escape") {
        setOpen(false);
        toggle.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [toggle, ...links.querySelectorAll("a")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    if (typeof compact.addEventListener === "function") {
      compact.addEventListener("change", syncViewport);
    } else {
      compact.addListener(syncViewport);
    }
  }

  function setupProjectFlow() {
    const records = [...document.querySelectorAll(".project-record")];
    if (!records.length) return;

    records.forEach(function (record) {
      record.setAttribute("data-scroll-project", "");
    });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      records.forEach(function (record) { record.classList.add("is-in-view"); });
      return;
    }

    document.body.classList.add("motion-ready");
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -8% 0px" });

    records.forEach(function (record) { observer.observe(record); });
  }

  function setupSpecimens() {
    const input = document.getElementById("specimen-input");
    const reset = document.querySelector("[data-specimen-reset]");
    const outputs = [...document.querySelectorAll("[data-specimen-output]")];
    if (!input || !reset || !outputs.length) return;

    const pangram = "Sphinx of black quartz, judge my vow.";
    function render() {
      const value = input.value.slice(0, 120);
      outputs.forEach(function (output) {
        output.textContent = value || "\u00A0";
      });
    }

    input.addEventListener("input", render);
    reset.addEventListener("click", function () {
      input.value = pangram;
      render();
      input.focus();
    });
    render();
  }

  function setupCoarseEvents() {
    document.addEventListener("click", function (event) {
      const target = event.target.closest("[data-event]");
      if (!target) return;
      const name = target.getAttribute("data-event");
      if (!allowedEvents.has(name)) return;

      /*
        Local signal only. No endpoint, storage, visitor identifier, link URL,
        free-form text, or specimen content is attached or transmitted.
      */
      document.dispatchEvent(new CustomEvent("h1t3k:conversion", {
        detail: { name }
      }));
    });
  }

  async function loadVisitorCount(config) {
    const counter = document.getElementById("visitor-counter");
    if (!counter) return;

    const analytics = config?.analytics;
    if (!analytics?.visitor_counter_enabled) {
      counter.hidden = true;
      return;
    }

    const endpoint = String(analytics.visits_endpoint || "").trim();
    if (!endpoint) {
      counter.textContent = "aggregate visits: —";
      counter.dataset.state = "offline";
      counter.title = "No visit-count endpoint is configured";
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(function () { controller.abort(); }, 3500);
    try {
      const url = new URL(endpoint, window.location.href);
      if (!/^https?:$/.test(url.protocol)) throw new Error("unsupported protocol");
      const response = await fetch(url.href, {
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`visit count ${response.status}`);
      const data = await response.json();
      const value = Number(data?.count);
      if (!Number.isFinite(value) || value < 0) throw new Error("invalid visit count");

      counter.textContent = `aggregate visits: ${Math.trunc(value).toLocaleString()}`;
      counter.dataset.state = "ready";
      counter.title = "Aggregate, unclassified site visits";
    } catch (error) {
      counter.textContent = "aggregate visits: —";
      counter.dataset.state = "offline";
      counter.title = "Aggregate visit count unavailable; human and bot traffic are not classified";
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function initialize() {
    setupNavigation();
    setupProjectFlow();
    setupSpecimens();
    setupCoarseEvents();

    try {
      const config = await loadSiteConfig();
      await loadVisitorCount(config);
    } catch (error) {
      const counter = document.getElementById("visitor-counter");
      if (counter) {
        counter.textContent = "aggregate visits: —";
        counter.dataset.state = "offline";
        counter.title = "Site configuration or visit count unavailable";
      }
    }
  }

  initialize();
})();
