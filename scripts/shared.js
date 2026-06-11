/* ================================================================
   Growthhive — Shared Script
   shared.js
   Used by: all pages
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

  // Hide both cursor elements until the first mousemove fires,
  // so they never appear stuck at 0,0 (top-left) during loading.
  curEl.style.opacity  = '0';
  curREl.style.opacity = '0';

  let mx = 0, my = 0, rx = 0, ry = 0;
  let seenFirstMove = false;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;

    if (!seenFirstMove) {
      // Seed the ring at the real position so it doesn't chase from 0,0
      rx = mx; ry = my;
      // Snap the dot instantly to the real position, then reveal both
      gsap.set(curEl, { x: mx, y: my });
      curEl.style.opacity  = '1';
      curREl.style.opacity = '1';
      seenFirstMove = true;
    }

    gsap.to(curEl, { x: mx, y: my, duration: 0.07 });
  });
  (function rl() {
    rx += (mx - rx) * 0.09; ry += (my - ry) * 0.09;
    curREl.style.left = rx + 'px'; curREl.style.top = ry + 'px';
    requestAnimationFrame(rl);
  })();
  document.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('mouseenter', () => curEl.classList.add('big'));
    el.addEventListener('mouseleave', () => curEl.classList.remove('big'));
  });
})();

// ═══════════════════════════════════════════════════════════════
// LOADER (shared fallback)
// ═══════════════════════════════════════════════════════════════
// Pages with their own intro animation set window.GH_CUSTOM_LOADER
// = true and drive the loader + onLoaderComplete themselves.
// For any page WITHOUT a custom loader, this provides a simple
// fade-out fallback so the site still reveals correctly.
(function() {
  if (window.GH_CUSTOM_LOADER) return; // custom loader owns the sequence

  const ldr = document.getElementById('ldr');
  if (!ldr) {
    if (typeof window.onLoaderComplete === 'function') window.onLoaderComplete();
    return;
  }

  // Simple timed fade, then reveal
  setTimeout(() => {
    gsap.to(ldr, {
      opacity: 0, duration: 1.0, ease: 'power2.inOut',
      onComplete: () => {
        ldr.style.display = 'none';
        if (typeof window.onLoaderComplete === 'function') window.onLoaderComplete();
      }
    });
  }, 1400);
})();