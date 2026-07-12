/* ════════════════════════════════════════════════════════════
   COLD BOOT — deterministic timeline (index.html only)
   Companions: the inline gate script in index.html <head> and
   the "BOOT" section in styles/main.css.
   Spec: intro-cold-boot-spec.md v2026.1.
   Every event fires at an absolute millisecond offset computed
   from the BOOT config below. Same input → same output, always.
   ════════════════════════════════════════════════════════════ */
const BOOT = {
  storageKey: 'ht_boot_v1',

  /* THE MONOGRAM — real 'Monogram' face (fonts/monogram.woff2,
     ported from the retired matrix gate).
     \u00F8 = site-theme variant (in use); \uE000 = literal form. */
  monogramChar: '\u00F8',

  /* Login-line text, decoupled from monogramChar so the manifest
     copy stays exact per spec §5 (`login: ht ▊`). */
  loginText: 'ht',

  /* BOOT MANIFEST — the copy IS the site map. Rule: one `mount`
     line per nav section, in site.json nav order. Add a page →
     add a mount line. Contact is `link`, not `mount`. */
  lines: [
    { l: 'ht/os v2026.1 — cold boot', ok: false, head: true },
    { l: 'palette ......... grass/sands', ok: true },
    { l: 'type ....... din2014/basenine', ok: true },
    { l: 'mount /projects .............', ok: true },
    { l: 'mount /security-lab .........', ok: true },
    { l: 'mount /field-notes ..........', ok: true },
    { l: 'mount /design-archive .......', ok: true },
    { l: 'link /contact ...............', ok: true }
  ],

  /* TIMINGS (ms) — accelerating gaps: caches warm as a system
     boots. Spec-locked values; do not tune. */
  cursorHold: 380,                          /* lone cursor before line 1  */
  gaps: [150, 130, 112, 96, 84, 74, 66, 60],/* line n appears gap[n] after line n-1 */
  okDelay: 70,                              /* [ok] stamps after its line */
  loginHold: 300,                           /* login: ht ▊ rest           */
  wipe: 120,                                /* log fade                   */
  warmSteps: [80, 80, 80],                  /* phosphor: .12→.42→.74→1    */
  glowDelay: 60,                            /* bloom after full opacity   */
  sweepDur: 400,                            /* raster pass                */
  hold: 260,                                /* monogram rest              */
  exitFade: 240                             /* overlay out                */
};

(function () {
  const html = document.documentElement;
  const isBoot   = html.classList.contains('booting');
  const isBootRM = html.classList.contains('booting-rm');
  if (!isBoot && !isBootRM) return;         /* repeat visit: nothing runs */

  const boot  = document.getElementById('boot');
  const log   = document.getElementById('bootLog');
  const stage = document.getElementById('monoStage');
  const mono  = document.getElementById('monogram');
  const sweep = document.getElementById('sweep');
  const timers = [];
  let finished = false;

  /* Monogram: the markup ships the DIN 'ht' stand-in; swap to the
     real glyph the moment the face is ready. The clock-driven
     timeline never waits on this (spec §3.2) — if the font 404s,
     the stand-in simply remains (spec QA: no empty stage). */
  if (document.fonts && document.fonts.load) {
    document.fonts.load("1em 'Monogram'")
      .then(function (faces) {
        if (faces && faces.length) mono.childNodes[0].nodeValue = BOOT.monogramChar;
      })
      .catch(function () {});
  }

  function at(t, fn) { timers.push(setTimeout(fn, t)); }

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    boot.classList.add('exit');
    html.classList.add('boot-done', 'did-boot');
    setTimeout(() => { boot.remove(); }, BOOT.exitFade + 20);
    window.removeEventListener('pointerdown', finish);
    window.removeEventListener('keydown', finish);
  }
  window.addEventListener('pointerdown', finish);
  window.addEventListener('keydown', finish);

  /* ── REDUCED MOTION: static monogram, opacity only, 650ms total ── */
  if (isBootRM) {
    mono.classList.add('w3', 'glow');
    stage.style.transition = 'opacity 150ms linear';
    stage.classList.add('on');
    at(500, finish);
    return;
  }

  /* ── FULL SEQUENCE — build absolute schedule from config ── */
  let t = BOOT.cursorHold;

  /* lone cursor on an empty log line */
  const cur = document.createElement('div');
  cur.className = 'bl on';
  cur.innerHTML = '<span><span class="cursor"></span></span>';
  log.appendChild(cur);

  /* boot lines */
  BOOT.lines.forEach((line, i) => {
    t += BOOT.gaps[i] || 60;
    const el = document.createElement('div');
    el.className = 'bl' + (line.head ? ' bl-head' : '');
    el.innerHTML = '<span>' + line.l + '</span>' +
                   (line.ok ? '<span class="ok">ok</span>' : '');
    log.appendChild(el);
    const tt = t;
    at(tt, () => { cur.remove(); el.classList.add('on'); });
    if (line.ok) at(tt + BOOT.okDelay,
      () => el.querySelector('.ok').classList.add('on'));
  });

  /* login line — loginText, NOT monogramChar (manifest copy is exact) */
  t += 70;
  const login = document.createElement('div');
  login.className = 'bl';
  login.innerHTML = '<span>login: ' + BOOT.loginText +
                    '<span class="cursor"></span></span>';
  log.appendChild(login);
  at(t, () => login.classList.add('on'));
  t += BOOT.loginHold;

  /* wipe log → monogram warm-up → bloom → sweep → hold → exit */
  at(t, () => log.classList.add('wipe'));
  t += BOOT.wipe;
  at(t, () => stage.classList.add('on'));
  t += BOOT.warmSteps[0]; at(t, () => mono.classList.add('w1'));
  t += BOOT.warmSteps[1]; at(t, () => mono.classList.add('w2'));
  t += BOOT.warmSteps[2]; at(t, () => mono.classList.add('w3'));
  t += BOOT.glowDelay;
  at(t, () => { mono.classList.add('glow'); sweep.classList.add('run'); });
  t += BOOT.sweepDur + BOOT.hold;
  at(t, finish);
  /* hard-capped by construction — clock-driven, no network dependency */
})();
