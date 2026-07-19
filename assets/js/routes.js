(function () {
  "use strict";

  const routes = [
    {
      id: "home",
      canonicalPath: "index.html",
      aliases: ["/", "/index.html", "index.html"],
      name: "Home",
      details: [
        "identity ........ h1-t3k",
        "focus .... design + technical systems",
        "state ........ presentation ready"
      ],
      parallax: true,
      compactTransition: true
    },
    {
      id: "projects",
      canonicalPath: "projects.html",
      aliases: ["/projects", "/projects/", "/projects.html", "projects.html"],
      name: "Projects & Systems",
      details: [
        "records ........ four selected projects",
        "scope .... publishing / linux / monitoring",
        "evidence ........ source-linked"
      ],
      parallax: true,
      compactTransition: true
    },
    {
      id: "notes",
      canonicalPath: "field-notes.html",
      aliases: ["/notes", "/notes/", "/field-notes.html", "field-notes.html"],
      name: "Notes",
      details: [
        "notes ........ repository-backed",
        "topics .... linux / monitoring / workflows",
        "flow ........ static reading layout"
      ],
      parallax: false,
      compactTransition: true
    },
    {
      id: "archive",
      canonicalPath: "design-archive.html",
      aliases: ["/archive", "/archive/", "/design-archive.html", "design-archive.html"],
      name: "Type & Archive",
      details: [
        "type ........ bundled browser specimens",
        "archive ........ ipfs-backed images",
        "flow ........ static gallery"
      ],
      parallax: false,
      compactTransition: true
    },
    {
      id: "contact",
      canonicalPath: "contact.html",
      aliases: ["/contact", "/contact/", "/contact.html", "contact.html"],
      name: "Contact",
      details: [
        "channel ........ h1t3k@proton.me",
        "scope .... employment / contract / collaboration",
        "forms ........ none"
      ],
      parallax: false,
      compactTransition: true
    },
    {
      id: "security",
      canonicalPath: "security-lab.html",
      aliases: ["/security", "/security/", "/security-lab.html", "security-lab.html"],
      name: "Security Lab",
      details: [
        "map ........ public security evidence",
        "themes .... visibility / privilege / recovery",
        "boundaries ........ explicit"
      ],
      parallax: false,
      compactTransition: true
    }
  ];

  function cleanPath(value) {
    const path = String(value || "/").replace(/\/{2,}/g, "/");
    if (path === "/") return "/";
    return path.replace(/\/$/, "");
  }

  function routeForPath(pathname) {
    const raw = String(pathname || "/");
    const clean = cleanPath(raw);
    const leaf = clean.split("/").pop() || "";

    const match = routes.find(function (route) {
      return route.aliases.some(function (alias) {
        const cleanAlias = cleanPath(alias);
        return cleanAlias === clean ||
          cleanAlias.replace(/^\//, "") === leaf ||
          route.canonicalPath === leaf;
      });
    });
    if (match) return match;
    if (raw.endsWith("/")) return routes[0];
    return null;
  }

  function routeForUrl(value, base) {
    try {
      const url = new URL(value, base || window.location.href);
      return routeForPath(url.pathname);
    } catch (error) {
      return null;
    }
  }

  function eligibility(input) {
    const now = Number(input.now);
    const lastAt = Number(input.lastAt);
    const age = now - lastAt;
    const expired = !Number.isFinite(lastAt) || lastAt <= 0 ||
      !Number.isFinite(age) || age >= input.ttl;

    if (input.replay) return { eligible: true, reason: "replay" };
    if (input.transitionMatched) return { eligible: false, reason: "compact-transition" };
    if (input.storedVersion !== input.version) {
      return { eligible: true, reason: "version" };
    }
    if (expired) return { eligible: true, reason: "age" };
    return { eligible: false, reason: "recent" };
  }

  const manifest = {
    bootVersionKey: "h1_full_boot_v3",
    bootVersion: "3",
    bootLastAtKey: "h1_full_boot_last_at",
    bootTtl: 24 * 60 * 60 * 1000,
    transitionKey: "h1_compact_transition_v1",
    transitionTtl: 15 * 1000,
    replayParameter: "presentation",
    replayValue: "full",
    globalLine: "system ........ h1-t3k portfolio",
    routes: routes,
    routeForPath: routeForPath,
    routeForUrl: routeForUrl,
    eligibility: eligibility
  };

  window.H1_ROUTES = Object.freeze(manifest);
})();
