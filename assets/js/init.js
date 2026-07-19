(function () {
  "use strict";

  const allowedEvents = new Set([
    "contact_click",
    "case_study_open",
    "profile_visit",
    "resume_open",
    "typeface_inquiry",
    "web3_direct_notice_shown",
    "web3_direct_open_attempted",
    "https_presentation_selected"
  ]);

  const manifest = window.H1_ROUTES;

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
    const row = nav?.querySelector(".nav-row") || nav;
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
        if (links.parentElement !== row) row.appendChild(links);
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

  function setupDepthFlow() {
    const route = manifest?.routeForUrl(window.location.href);
    const scope = document.querySelector("[data-depth-flow]");
    const items = scope ? [...scope.querySelectorAll("[data-depth-item]")] : [];
    if (!route?.parallax || !scope || !items.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.classList.add("is-in-view"); });
      return;
    }

    document.body.classList.add("motion-ready");
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });

    items.forEach(function (item) { observer.observe(item); });
    window.addEventListener("pagehide", function () {
      items.forEach(function (item) { item.classList.add("is-in-view"); });
      observer.disconnect();
    }, { once: true });
  }

  function writeTransitionToken(route) {
    const token = JSON.stringify({
      route: route.id,
      expiresAt: Date.now() + manifest.transitionTtl
    });
    try {
      sessionStorage.setItem(manifest.transitionKey, token);
      return;
    } catch (error) {
      window.name = "h1-transition:" + token;
    }
  }

  function eligibleInternalLink(event, anchor) {
    if (!manifest || event.defaultPrevented || event.button !== 0) return null;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
    if (anchor.hasAttribute("download") ||
        anchor.matches(".skip-link,[data-transition='skip']")) return null;
    const target = (anchor.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self") return null;

    let url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch (error) {
      return null;
    }
    if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin) return null;

    const current = new URL(window.location.href);
    if (url.pathname === current.pathname && url.search === current.search && url.hash) {
      return null;
    }
    const route = manifest.routeForUrl(url.href);
    const currentRoute = manifest.routeForUrl(current.href);
    if (!route?.compactTransition) return null;
    if (currentRoute && route.id === currentRoute.id && !url.hash) return null;
    return { route: route, url: url };
  }

  function setupPageTransitions() {
    if (!manifest || !window.H1Presentation) return;

    document.addEventListener("click", function (event) {
      const anchor = event.target.closest("a[href]");
      if (!anchor) return;
      if (anchor.hasAttribute("data-presentation-replay")) {
        emitCoarseEvent("https_presentation_selected");
      }
      const destination = eligibleInternalLink(event, anchor);
      if (!destination) return;

      event.preventDefault();
      writeTransitionToken(destination.route);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.H1Presentation.playCompact(
        destination.route,
        function () { window.location.assign(destination.url.href); },
        reduced
      );
    });

    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;
      window.H1Presentation.resetAfterPageShow();
    });
  }

  function emitCoarseEvent(name) {
    if (!allowedEvents.has(name)) return;
    document.dispatchEvent(new CustomEvent("h1t3k:conversion", {
      detail: { name: name }
    }));
  }

  function web3CapabilityState() {
    if (window.location.protocol === "web3:") return "CONFIRMED_WEB3_ROUTE";
    try {
      if (localStorage.getItem("h1_web3_notice_suppressed_v1") === "1") {
        return "NOTICE_SUPPRESSED_BY_USER";
      }
    } catch (error) {
      try {
        if (sessionStorage.getItem("h1_web3_notice_suppressed_v1") === "1") {
          return "NOTICE_SUPPRESSED_BY_USER";
        }
      } catch (nestedError) {
        /* The capability remains unknown. */
      }
    }
    return "UNKNOWN_WEB3_ROUTE";
  }

  function suppressWeb3Notice() {
    try {
      localStorage.setItem("h1_web3_notice_suppressed_v1", "1");
      return;
    } catch (error) {
      try {
        sessionStorage.setItem("h1_web3_notice_suppressed_v1", "1");
      } catch (nestedError) {
        /* Suppression is optional when browser storage is unavailable. */
      }
    }
  }

  function setupWeb3Guidance() {
    const triggers = [...document.querySelectorAll("a[href^='web3:']")];
    if (!triggers.length) return;

    let notice = null;
    let activeTrigger = null;

    function closeNotice(returnFocus) {
      if (!notice) return;
      const trigger = activeTrigger;
      notice.remove();
      notice = null;
      activeTrigger = null;
      triggers.forEach(function (item) {
        item.setAttribute("aria-expanded", "false");
      });
      if (returnFocus && trigger) trigger.focus();
    }

    function showNotice(trigger) {
      closeNotice(false);
      activeTrigger = trigger;
      const directUri = trigger.href;
      const id = "web3-route-notice";
      notice = document.createElement("aside");
      notice.className = "web3-notice";
      notice.id = id;
      notice.setAttribute("role", "region");
      notice.setAttribute("aria-labelledby", id + "-title");
      notice.innerHTML =
        "<h3 id=\"" + id + "-title\">Direct Web3 route</h3>" +
        "<p>This link uses the <code>web3://</code> protocol and requires a compatible browser or protocol handler. The HTTPS presentation remains available in ordinary browsers.</p>" +
        "<div class=\"web3-notice-actions\">" +
          "<a class=\"button button-primary\" data-web3-open-direct data-transition=\"skip\">Open direct Web3 route</a>" +
          "<a class=\"button\" href=\"index.html?presentation=full\" data-presentation-replay data-transition=\"skip\">Open HTTPS presentation</a>" +
        "</div>" +
        "<label class=\"web3-suppress\"><input type=\"checkbox\" data-web3-suppress> Do not show this notice again on this device</label>" +
        "<button class=\"text-button\" type=\"button\" data-web3-dismiss>Dismiss</button>";

      const direct = notice.querySelector("[data-web3-open-direct]");
      const suppress = notice.querySelector("[data-web3-suppress]");
      const dismiss = notice.querySelector("[data-web3-dismiss]");
      direct.href = directUri;

      direct.addEventListener("click", function () {
        emitCoarseEvent("web3_direct_open_attempted");
      });
      suppress.addEventListener("change", function () {
        if (suppress.checked) suppressWeb3Notice();
      });
      dismiss.addEventListener("click", function () {
        closeNotice(true);
      });
      notice.addEventListener("keydown", function (event) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        closeNotice(true);
      });

      const container = trigger.closest(".project-record,.architecture-panel") || trigger.parentElement;
      container.appendChild(notice);
      trigger.setAttribute("aria-controls", id);
      trigger.setAttribute("aria-expanded", "true");
      emitCoarseEvent("web3_direct_notice_shown");
      notice.querySelector("[data-web3-open-direct]").focus();
    }

    triggers.forEach(function (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", function (event) {
        if (trigger.hasAttribute("data-web3-open-direct")) return;
        const state = web3CapabilityState();
        if (state !== "UNKNOWN_WEB3_ROUTE") {
          emitCoarseEvent("web3_direct_open_attempted");
          return;
        }
        event.preventDefault();
        showNotice(trigger);
      });
    });

    window.H1Web3 = Object.freeze({
      capabilityState: web3CapabilityState,
      states: Object.freeze([
        "CONFIRMED_WEB3_ROUTE",
        "UNKNOWN_WEB3_ROUTE",
        "NOTICE_SUPPRESSED_BY_USER"
      ])
    });
  }

  function setupSpecimens() {
    const input = document.getElementById("specimen-input");
    const reset = document.querySelector("[data-specimen-reset]");
    const outputs = [...document.querySelectorAll("[data-specimen-output]")];
    const sizeLabels = [...document.querySelectorAll("[data-specimen-size]")];
    if (!input || !reset || !outputs.length) return;

    const pangram = "Sphinx of black quartz, judge my vow.";
    let sizeFrame = 0;

    function renderSizeLabels() {
      sizeFrame = 0;
      sizeLabels.forEach(function (label) {
        const sample = label.closest(".type-card")?.querySelector(".type-sample");
        const pixels = Number.parseFloat(sample ? getComputedStyle(sample).fontSize : "");
        if (!Number.isFinite(pixels)) {
          label.textContent = "—";
          return;
        }
        const rounded = Math.round(pixels * 10) / 10;
        label.textContent = rounded.toFixed(Number.isInteger(rounded) ? 0 : 1) + " px";
      });
    }

    function queueSizeLabels() {
      if (sizeFrame) return;
      sizeFrame = window.requestAnimationFrame(renderSizeLabels);
    }

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
    window.addEventListener("resize", queueSizeLabels, { passive: true });
    render();
    renderSizeLabels();
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
    setupDepthFlow();
    setupSpecimens();
    setupCoarseEvents();
    setupPageTransitions();
    setupWeb3Guidance();

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
