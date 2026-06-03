/* ================================================================
   Growthhive — Shared Script
   shared.js
   Used by: index.html, work.html (and all future pages)
   Must be loaded AFTER vendor scripts (three.js, gsap, ScrollTrigger)
   Work. Play. Grow. 🐝
================================================================ */

// ═══════════════════════════════════════════════════════════════
// CURSOR
// ═══════════════════════════════════════════════════════════════
(function() {
  const curEl  = document.getElementById('cur');
  const curREl = document.getElementById('curR');
  if (!curEl || !curREl) return;

  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    gsap.to(curEl, { x: mx, y: my, duration: 0.07 });
  });

  (function rl() {
    rx += (mx - rx) * 0.09;
    ry += (my - ry) * 0.09;
    curREl.style.left = rx + 'px';
    curREl.style.top  = ry + 'px';
    requestAnimationFrame(rl);
  })();

  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => curEl.classList.add('big'));
    el.addEventListener('mouseleave', () => curEl.classList.remove('big'));
  });
})();

// ═══════════════════════════════════════════════════════════════
// LOADER
// ═══════════════════════════════════════════════════════════════
// Exposes window.onLoaderComplete — each page sets this before
// shared.js runs, or it defaults to a no-op.
(function() {
  const ldr   = document.getElementById('ldr');
  const lFill = document.getElementById('lFill');
  const lPct  = document.getElementById('lPct');
  if (!ldr || !lFill || !lPct) return;

  let prog = 0;
  const iv = setInterval(() => {
    prog += Math.random() * 14;
    if (prog >= 100) { prog = 100; clearInterval(iv); }
    lFill.style.width = Math.min(prog, 100) + '%';
    lPct.textContent  = Math.floor(Math.min(prog, 100)) + '%';
    if (prog >= 100) {
      setTimeout(() => {
        gsap.to(ldr, {
          yPercent: -100, duration: 1.1, ease: 'power4.inOut',
          onComplete: () => {
            ldr.style.display = 'none';
            if (typeof window.onLoaderComplete === 'function') {
              window.onLoaderComplete();
            }
          }
        });
      }, 300);
    }
  }, 85);
})();