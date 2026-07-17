(async () => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  let runtimeCfg = null;

  // ---- Utilities ----
  function escapeHTML(str) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function sanitizeURL(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url, location.href);
      if (!["https:", "http:", "web3:"].includes(parsed.protocol)) return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return await res.json();
  }

  async function loadText(path) {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return await res.text();
  }

  async function loadVisitorCount(cfg) {
    const footer = document.querySelector("footer");
    if (!footer) return;

    let row = document.querySelector("#visitor-counter");
    if (!row) {
      row = document.createElement("span");
      row.id = "visitor-counter";
      footer.appendChild(row);
    }

    row.setAttribute("role", "status");
    row.setAttribute("aria-live", "polite");
    row.setAttribute("aria-atomic", "true");

    const endpoint = String(cfg?.analytics?.visits_endpoint || "/api/visits").trim();
    const cacheKey = "h1t3k.visitor-count";
    let cachedCount = null;

    try {
      const cached = Number.parseInt(localStorage.getItem(cacheKey) || "", 10);
      if (Number.isFinite(cached) && cached >= 0) cachedCount = cached;
    } catch {}

    row.hidden = false;
    row.dataset.state = cachedCount === null ? "loading" : "cached";
    row.textContent = cachedCount === null
      ? "visits: …"
      : `visits: ${cachedCount.toLocaleString()}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const endpointURL = new URL(endpoint, window.location.href);
      if (!/^https?:$/.test(endpointURL.protocol)) throw new Error("unsupported counter endpoint");

      const res = await fetch(endpointURL.href, {
        cache: "no-store",
        credentials: "omit",
        headers: { Accept: "application/json" },
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`${endpointURL.pathname} ${res.status}`);
      const data = await res.json();
      const parsed = Number(data?.count);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error("invalid visit count");
      const count = Math.trunc(parsed);
      row.textContent = `visits: ${count.toLocaleString()}`;
      row.dataset.state = "ready";
      row.title = "Aggregate site visits";
      try { localStorage.setItem(cacheKey, String(count)); } catch {}
    } catch (e) {
      row.dataset.state = cachedCount === null ? "offline" : "cached";
      row.textContent = cachedCount === null
        ? "visits: —"
        : `visits: ${cachedCount.toLocaleString()}`;
      row.title = cachedCount === null
        ? "Visit count temporarily unavailable"
        : "Last available aggregate visit count";
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Responsive navigation (progressive enhancement) ----
  function setupNavigation() {
    const nav = document.querySelector('nav[aria-label="Primary"]');
    const toggle = nav?.querySelector('.nav-toggle');
    const links = nav?.querySelector('.nav-links');
    const label = toggle?.querySelector('[data-menu-label]');
    if (!nav || !toggle || !links || !label) return;

    document.body.classList.add('nav-enhanced');

    const mobile = window.matchMedia('(max-width: 1080px)');

    // A fixed descendant can be clipped to a transformed/sticky ancestor in
    // mobile Safari. Portal the real link panel to <body> on compact screens
    // so inset:0 always resolves against the viewport; restore it on desktop.
    const syncMenuPlacement = () => {
      if (mobile.matches) {
        links.setAttribute('data-mobile-menu', '');
        links.setAttribute('role', 'navigation');
        links.setAttribute('aria-label', 'Portfolio navigation');
        if (links.parentElement !== document.body) document.body.appendChild(links);
      } else {
        links.removeAttribute('data-mobile-menu');
        links.removeAttribute('role');
        links.removeAttribute('aria-label');
        if (links.parentElement !== nav) nav.appendChild(links);
      }
    };

    const setOpen = (open) => {
      const compact = mobile.matches;
      const nextOpen = compact && open;

      nav.toggleAttribute('data-menu-open', nextOpen);
      toggle.setAttribute('aria-expanded', String(nextOpen));
      label.textContent = nextOpen ? 'Close' : 'Menu';
      document.body.classList.toggle('menu-open', nextOpen);
      document.documentElement.classList.toggle('menu-open', nextOpen);

      if (compact) {
        links.toggleAttribute('inert', !nextOpen);
        if (nextOpen) links.removeAttribute('aria-hidden');
        else links.setAttribute('aria-hidden', 'true');
      } else {
        links.removeAttribute('inert');
        links.removeAttribute('aria-hidden');
      }
    };

    syncMenuPlacement();
    setOpen(false);

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', (event) => {
      if (!nav.hasAttribute('data-menu-open')) return;
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.focus();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [toggle, ...links.querySelectorAll('a')];
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

    const handleViewportChange = () => {
      setOpen(false);
      syncMenuPlacement();
    };

    if (typeof mobile.addEventListener === 'function') {
      mobile.addEventListener('change', handleViewportChange);
    } else {
      mobile.addListener?.(handleViewportChange);
    }
  }

  // ---- Project flow reveal (native scrolling; optional motion) ----
  function setupProjectFlow() {
    const items = [...document.querySelectorAll('.project-flow .post-item')];
    if (!items.length) return;

    const summary = document.querySelector('[data-project-summary]');
    if (summary) {
      const n = items.length;
      const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
      const word = words[n] || String(n);
      const label = word.charAt(0).toUpperCase() + word.slice(1);
      const noun = n === 1 ? 'track' : 'tracks';
      summary.textContent = `${label} connected ${noun}. Scroll for scope, current state, and the next layer of evidence.`;
    }

    items.forEach((item) => item.setAttribute('data-scroll-project', ''));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-in-view'));
      return;
    }

    document.body.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });

    items.forEach((item) => observer.observe(item));
  }

  function setupTipAddress(cfg) {
    const nodes = document.querySelectorAll("[data-tip-address]");
    if (!nodes.length) return;
    const addr = (cfg?.wallet?.tip_address || "").trim();
    const valid = /^0x[a-fA-F0-9]{40}$/.test(addr);
    nodes.forEach((node) => {
      node.textContent = valid ? addr : "not configured";
    });
  }

  // ---- SHA256 for deterministic seeding ----
  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
  }

  // ---- PRNG ----
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- Entropy gathering ----
  function gatherEntropyStr() {
    const parts = [];
    try { parts.push(navigator.userAgent || ""); } catch {}
    try { parts.push(navigator.language || ""); } catch {}
    try { parts.push((Intl.DateTimeFormat().resolvedOptions().timeZone) || ""); } catch {}
    try { parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`); } catch {}
    let devSalt = localStorage.getItem("iconDevSalt");
    if (!devSalt) {
      devSalt = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("iconDevSalt", devSalt);
    }
    parts.push(devSalt);
    return parts.join("|");
  }

  // ---- Randomart SVG generation (configurable grid + scale) ----
  function makeRandomartSVG(seed32, N=12, cellSize=6) {
    const rnd = mulberry32(seed32);
    const padding = 2;
    const W = N * cellSize + padding * 2;
    const H = W;

    const cells = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (rnd() > 0.5) {
          cells.push(
            `<rect x="${padding + x * cellSize}" y="${padding + y * cellSize}" ` +
            `width="${cellSize}" height="${cellSize}" />`
          );
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <rect width="100%" height="100%" fill="#0d0f0b"/>
      <g fill="#39d353" shape-rendering="crispEdges">${cells.join("")}</g>
      <rect x="0.5" y="0.5" width="${W-1}" height="${H-1}" fill="none" stroke="#39d353" stroke-width="1"/>
    </svg>`;
    return svg;
  }

  // ---- Generate gallery randomart + image thumbnails ----
  async function generateGallery() {
    const figures = $$("figure[id^='work-']");
    if (figures.length === 0) return;

    // Try to load gallery metadata
    let galleryData = null;
    let profileData = null;
    try {
      galleryData = await loadJSON("gallery.json");
    } catch { /* on-chain: no gallery.json, use randomart only */ }
    try {
      profileData = await loadJSON("gallery-profiles.json");
    } catch { /* optional metadata baseline */ }

    const worksMap = new Map();
    const profilesMap = new Map();
    if (profileData?.profiles) {
      for (const p of profileData.profiles) {
        if (p.tags?.includes('placeholder') || p.status === 'pending-assets') continue;
        profilesMap.set(p.id, p);
      }
    }
    if (galleryData?.works) {
      for (const w of galleryData.works) {
        worksMap.set(w.id, { ...w, profile: profilesMap.get(w.id) || null });
      }
    }

    // Sort and redistribute figures when gallery.json is available
    const galleryNew = document.getElementById("gallery-new");
    const galleryOld = document.getElementById("gallery-old");
    if (galleryData?.works && galleryNew && galleryOld) {
      // Stable sort: year descending, then original array index within same year
      const sorted = galleryData.works
        .map((w, i) => ({ ...w, _idx: i }))
        .sort((a, b) => b.year - a.year || a._idx - b._idx);

      // Only include works that have an actual image
      const withImages = sorted.filter(w => {
        const src = w.images?.thumb || w.images?.popup || w.images?.full || w.image;
        return src != null && src !== "";
      });

      // Clear containers
      galleryNew.innerHTML = "";
      galleryOld.innerHTML = "";

      // Re-number and distribute (only works with images)
      let num = 0;
      withImages.forEach((w) => {
        num++;
        const label = String(num).padStart(2, "0");
        const fig = document.createElement("figure");
        fig.id = w.id;
        const cap = document.createElement("figcaption");
        cap.textContent = label;
        fig.appendChild(cap);
        if (w.year >= 2021) {
          galleryNew.appendChild(fig);
        } else {
          galleryOld.appendChild(fig);
        }
      });

      // Hide section header + gallery when empty
      const newNotice = galleryNew.previousElementSibling;
      if (galleryNew.children.length === 0) {
        galleryNew.style.display = "none";
        if (newNotice && newNotice.classList.contains("notice")) newNotice.style.display = "none";
      }
      const oldNotice = galleryOld.previousElementSibling;
      if (galleryOld.children.length === 0) {
        galleryOld.style.display = "none";
        if (oldNotice && oldNotice.classList.contains("notice")) oldNotice.style.display = "none";
      }
    }

    // Re-query figures after potential redistribution
    const allFigures = $$("figure[id^='work-']");

    // Create singleton popup container
    let popup = document.getElementById("gallery-popup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "gallery-popup";
      popup.className = "gallery-popup";
      popup.innerHTML = '<img class="gallery-popup-img" alt=""><div class="gallery-popup-details"></div>';
      document.body.appendChild(popup);
    }
    const popupImg = popup.querySelector(".gallery-popup-img");
    const popupDetails = popup.querySelector(".gallery-popup-details");

    let hideTimer = null;

    function showPopup(fig, work) {
      const pSrc = work?.images?.popup || work?.image;
      if (!pSrc) return;
      clearTimeout(hideTimer);
      popupImg.src = pSrc;
      popupImg.alt = work.title;

      popupDetails.textContent = "";
      const titleEl = document.createElement("strong");
      titleEl.textContent = work.title;
      const metaEl = document.createElement("span");
      metaEl.textContent = `${work.year} · ${work.medium}`;
      const descEl = document.createElement("span");
      descEl.className = "gallery-popup-desc";
      descEl.textContent = work.description;
      popupDetails.append(titleEl, metaEl, descEl);
      if (work.profile?.creation_date || work.profile?.status) {
        const profileMetaEl = document.createElement("span");
        const creation = work.profile?.creation_date || "date pending";
        const status = work.profile?.status || "status pending";
        profileMetaEl.textContent = `${creation} · ${status}`;
        popupDetails.appendChild(profileMetaEl);
      }
      if (work.note) {
        const noteEl = document.createElement("span");
        noteEl.className = "gallery-popup-note";
        noteEl.textContent = work.note;
        popupDetails.appendChild(noteEl);
      }

      // Position relative to figure
      const rect = fig.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      popup.style.display = "flex";

      // Measure popup to keep on-screen
      const pw = popup.offsetWidth;
      const ph = popup.offsetHeight;
      let left = rect.left + scrollX + (rect.width / 2) - (pw / 2);
      let top = rect.top + scrollY - ph - 8;

      // Clamp to viewport
      const vw = document.documentElement.clientWidth;
      if (left < 8) left = 8;
      if (left + pw > vw - 8) left = vw - pw - 8;
      if (top < scrollY + 8) top = rect.bottom + scrollY + 8;

      popup.style.left = left + "px";
      popup.style.top = top + "px";
    }

    function hidePopup() {
      hideTimer = setTimeout(() => { popup.style.display = "none"; }, 120);
    }

    // Keep popup alive when hovering over it
    popup.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    popup.addEventListener("mouseleave", hidePopup);

    for (const fig of allFigures) {
      const workId = fig.id;
      const num = workId.replace("work-", "");
      const work = worksMap.get(workId) || null;

      const hex = await sha256Hex(`work-${num}`);
      const seed32 = parseInt(hex.slice(0, 8), 16) >>> 0;

      // Always generate randomart as base/fallback
      const svg = makeRandomartSVG(seed32, 12, 6);
      const svgEl = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;

      const caption = fig.querySelector("figcaption");

      // If image available, create green monochrome thumbnail
      // Resolve sized image paths: images.X → image fallback
      const thumbSrc = work?.images?.thumb || work?.image;
      const popupSrc = work?.images?.popup || work?.image;
      const fullSrc  = work?.images?.full  || work?.image;

      if (thumbSrc) {
        const thumb = document.createElement("img");
        thumb.src = thumbSrc;
        thumb.alt = work.title;
        thumb.className = "gallery-thumb";
        thumb.loading = "lazy";
        thumb.draggable = false;
        // On load success: show thumb, hide SVG
        thumb.addEventListener("load", () => {
          svgEl.style.display = "none";
          thumb.style.display = "block";
        });
        // On error: keep SVG visible
        thumb.addEventListener("error", () => {
          thumb.style.display = "none";
          svgEl.style.display = "block";
        });
        thumb.style.display = "none"; // hidden until loaded
        if (caption) {
          fig.insertBefore(thumb, caption);
          fig.insertBefore(svgEl, caption);
        } else {
          fig.appendChild(thumb);
          fig.appendChild(svgEl);
        }

        // Click → open full image in new tab
        fig.style.cursor = "pointer";
        fig.addEventListener("click", (e) => {
          e.preventDefault();
          window.open(fullSrc, "_blank", "noopener");
        });

        // Hover → show popup (desktop only, handled via CSS media query)
        fig.addEventListener("mouseenter", () => showPopup(fig, work));
        fig.addEventListener("mouseleave", hidePopup);
        fig.addEventListener("focus", () => showPopup(fig, work));
        fig.addEventListener("blur", hidePopup);
        fig.tabIndex = 0;
      } else {
        // No image — just randomart
        if (caption) {
          fig.insertBefore(svgEl, caption);
        } else {
          fig.appendChild(svgEl);
        }
      }
    }
  }

  // ---- Icon setup (nav icon: 6px cells = baseline) ----
  async function setupIcon(cfg) {
    const icon = $("#site-icon");
    if (!icon) return;
    try {
      const N = (+cfg?.icon_grid === 4) ? 4 : 8;
      const salt = (cfg?.site?.title || "").toString().trim();
      const seedMaterial = [salt, gatherEntropyStr()].join("|");
      const hex = await sha256Hex(seedMaterial);
      const seed32 = (parseInt(hex.slice(0,8), 16) >>> 0);
      const svg = makeRandomartSVG(seed32, N, 6);
      const dataUrl = "data:image/svg+xml;utf8," + encodeURIComponent(svg);
      icon.src = dataUrl;
      icon.alt = `icon ${N}x${N}`;
      icon.title = `randomart ${N}×${N}`;
    } catch (e) {
      // fallback
    }
  }

  // ---- Simple markdown → HTML parser (with sanitization) ----
  function parseMarkdown(md) {
    let html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((https?:\/\/[^)]*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .split('\n\n')
      .map(p => p.trim() ? `<p>${p}</p>` : '')
      .join('\n');
    return html;
  }

  // ---- News loader (home page + news page) ----
  async function loadNews() {
    const newsEl = $("#home-news") || $("#news-list");
    if (!newsEl) return;

    const contentEl = newsEl.querySelector("[data-news-content]") || newsEl;
    const hasStaticSeed = !!contentEl.querySelector("[data-news-static]");

    function renderPosts(posts) {
      return posts.map(post => {
        const safeDate = escapeHTML(post.date || "");
        const safeTitle = escapeHTML(post.title || "");
        const web3Url = (runtimeCfg?.web3?.url || "web3://0xE7Deb835Ac84Cd241cda7121A75Abcc3deFA6470:42170/").trim();
        const safeWeb3Url = sanitizeURL(web3Url) || "web3://0xE7Deb835Ac84Cd241cda7121A75Abcc3deFA6470:42170/";
        const w3rx = /\bweb3\b/i;
        const match = (post.title || "").match(w3rx);
        let titleHtml;
        if (match) {
          const idx = match.index;
          const before = escapeHTML(post.title.slice(0, idx));
          const after = escapeHTML(post.title.slice(idx + match[0].length));
          titleHtml = `${before}<span class="web3-hint"><a href="${escapeHTML(safeWeb3Url)}" class="web3-trigger">web3</a><span class="web3-popup"><a href="${escapeHTML(safeWeb3Url)}" class="web3-popup-link">${escapeHTML(safeWeb3Url)}</a></span></span>${after}`;
        } else {
          const safeUrl = sanitizeURL(post.url);
          titleHtml = safeUrl
            ? `<a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener">${safeTitle}</a>`
            : safeTitle;
        }
        return `<p><strong>${safeDate}</strong> — ${titleHtml}</p>`;
      }).join("");
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("feeds.json", { cache: "force-cache", signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`feeds.json ${res.status}`);
      const feeds = await res.json();

      if (!feeds.posts || feeds.posts.length === 0) {
        contentEl.innerHTML = '<p class="placeholder"><em>No updates yet.</em></p>';
        return;
      }

      localStorage.setItem("openweb.news.cache", JSON.stringify(feeds.posts));
      contentEl.innerHTML = renderPosts(feeds.posts);
    } catch (e) {
      try {
        const cached = JSON.parse(localStorage.getItem("openweb.news.cache") || "[]");
        if (Array.isArray(cached) && cached.length > 0) {
          contentEl.innerHTML = `${renderPosts(cached)}<p class="small"><em>cached feed</em></p>`;
          return;
        }
      } catch {}

      if (!hasStaticSeed) {
        contentEl.innerHTML = '<p class="placeholder"><em>News unavailable.</em></p>';
      }
    }
  }

  // ---- Load bio ----
  async function loadBio() {
    const bioEl = $("#bio-content");
    if (!bioEl) return;

    try {
      const cfg = await loadJSON("site.json");
      const bioUrl = cfg?.feeds?.bio_source;
      
      if (!bioUrl) {
        bioEl.innerHTML = '<p class="placeholder"><em>No bio configured.</em></p>';
        return;
      }

      const bioMd = await loadText(bioUrl);
      const html = parseMarkdown(bioMd);
      bioEl.innerHTML = html;
    } catch (e) {
      bioEl.innerHTML = '<p class="placeholder"><em>Bio unavailable.</em></p>';
    }
  }

  // ---- Load DevSecOps markdown ----
  async function loadDevSecOpsMarkdown() {
    const contentEl = $("#analysis-content");
    if (!contentEl) return;
    const hasStaticSeed = contentEl.hasAttribute('data-static-analysis');
    try {
      const cfg = await loadJSON("site.json");
      const markdownUrl = cfg?.feeds?.devsecops_source;
      if (!markdownUrl) {
        if (!hasStaticSeed) contentEl.innerHTML = '<p class="placeholder"><em>Research in progress.</em></p>';
        return;
      }
      const md = await loadText(markdownUrl);
      const html = parseMarkdown(md);
      contentEl.innerHTML = html;
    } catch (e) {
      if (!hasStaticSeed) contentEl.innerHTML = '<p class="placeholder"><em>Research in progress — notes are being prepared.</em></p>';
    }
  }

  // ---- Main initialization ----
  try {
    setupNavigation();
    setupProjectFlow();

    const cfg = await loadJSON("site.json");
    runtimeCfg = cfg;

    const visitorCounter = $("#visitor-counter");
    if (cfg?.analytics?.visitor_counter_enabled) {
      visitorCounter?.removeAttribute("hidden");
      void loadVisitorCount(cfg);
    } else {
      visitorCounter?.setAttribute("hidden", "");
    }
    
    // Setup icon
    await setupIcon(cfg);

    // Inject tip/donation address from config
    setupTipAddress(cfg);

    // Generate gallery (design page)
    await generateGallery();

    // Load bio (about page)
    if ($("#bio-content")) {
      await loadBio();
    }

    // Load DevSecOps content
    if ($("#analysis-content")) {
      await loadDevSecOpsMarkdown();
    }

    // Load news feed (about page + news page)
    await loadNews();

  } catch (e) {
    console.debug("init.js:", e.message);
  }
})();
