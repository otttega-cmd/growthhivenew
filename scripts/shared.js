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

  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
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
// LOADER — Artistic bee flight
// ═══════════════════════════════════════════════════════════════
// A single bee meanders across the center of the screen along a
// natural flight path. A dashed trail draws behind it, tracking
// load progress. At completion the bee fades and the page's
// colony scene materializes (via window.onLoaderComplete).
//
// Exposes window.onLoaderComplete — set by each page before this runs.
// ═══════════════════════════════════════════════════════════════
(function() {
  const ldr = document.getElementById('ldr');
  if (!ldr) return;

  const svg     = document.getElementById('beeFlightSvg');
  const beeG    = document.getElementById('flightBee');
  const trail   = document.getElementById('beeTrail');
  const trailGlow = document.getElementById('beeTrailGlow');
  if (!svg || !beeG || !trail) {
    // Fallback: if loader markup missing, just fire completion
    if (typeof window.onLoaderComplete === 'function') window.onLoaderComplete();
    return;
  }

  // ── Viewport-sized coordinate system ─────────────────────────
  const VW = 1000, VH = 600; // SVG viewBox units
  svg.setAttribute('viewBox', `0 0 ${VW} ${VH}`);

  // ── The meandering flight path ───────────────────────────────
  // A hand-tuned bezier that wanders across the center band.
  // It dips, rises, loops gently — never a straight line.
  // Built from cubic bezier segments for organic curvature.
  const pathD = [
    `M 60 ${VH*0.52}`,                                   // start, left edge
    `C 160 ${VH*0.30}, 240 ${VH*0.34}, 320 ${VH*0.50}`,  // rise then settle
    `S 440 ${VH*0.74}, 520 ${VH*0.56}`,                  // dip and recover
    `S 660 ${VH*0.28}, 740 ${VH*0.46}`,                  // climb and level
    `S 880 ${VH*0.62}, 950 ${VH*0.48}`,                  // final gentle drift to center-right
  ].join(' ');

  // Build the trail path element
  trail.setAttribute('d', pathD);
  if (trailGlow) trailGlow.setAttribute('d', pathD);

  // Measure the path for progress tracking
  const pathLen = trail.getTotalLength();

  // Dash pattern: irregular dashes like ----- -- -- ---- ------- --
  // Defined as [dash, gap, dash, gap, ...] — varied lengths
  const dashPattern = [38, 14, 12, 16, 10, 14, 30, 12, 52, 16, 14, 18, 26, 12];
  trail.style.strokeDasharray = dashPattern.join(' ');
  // Start fully hidden — we reveal via a mask that follows the bee
  // Instead of dashoffset (which would shift the dashes), we use a
  // second clip approach: trail is drawn progressively by clipping.

  // Simpler + more elegant: animate strokeDashoffset of a SOLID
  // reveal mask over the dashed trail. We do this by setting the
  // dashed trail's total visible length via a clip path that grows.
  // We'll use a companion "reveal" path with a single long dash.

  // ── Progress reveal via dashoffset on a cloned solid path ────
  // The visible dashed trail uses the irregular pattern.
  // We reveal it left-to-right by animating a clipping length.
  // Technique: set pathLength attr so we can use 0..1 math cleanly.
  trail.setAttribute('pathLength', '1');
  if (trailGlow) trailGlow.setAttribute('pathLength', '1');

  // Re-express dash pattern in normalized (0..1) units
  const dashTotal = dashPattern.reduce((a,b)=>a+b,0);
  const normDash = dashPattern.map(d => d / dashTotal * 1); // sums to ~1; repeats
  // Use the real pattern but in user units is fine; for reveal we
  // overlay a mask. Keep dashes in user units:
  trail.style.strokeDasharray = dashPattern.join(' ');
  if (trailGlow) trailGlow.style.strokeDasharray = dashPattern.join(' ');

  // Reveal mask: a rect that grows to expose the trail + bee.
  // We animate it with the bee position so the trail appears to be
  // drawn by the bee in real time.
  const revealMask = document.getElementById('trailRevealRect');

  // ── Position helpers ─────────────────────────────────────────
  function pointAt(progress) {
    const l = pathLen * Math.max(0, Math.min(1, progress));
    const p = trail.getPointAtLength(l);
    return p;
  }
  function tangentAt(progress) {
    const eps = 0.002;
    const a = pointAt(progress - eps);
    const b = pointAt(progress + eps);
    return Math.atan2(b.y - a.y, b.x - a.x); // radians
  }

  // ── Loading state ────────────────────────────────────────────
  let prog = 0;            // 0..100 logical load progress
  let displayProg = 0;     // smoothed progress the bee actually follows
  let done = false;
  const startTime = performance.now();
  const MIN_DURATION = 3800; // ms — slowed for artistry

  // Drive logical progress (with natural variation, but never finishes
  // before MIN_DURATION so the artistry can breathe)
  const iv = setInterval(() => {
    prog += Math.random() * 9;
    if (prog >= 100) prog = 100;
  }, 110);

  // ── Bee micro-motion state ───────────────────────────────────
  let wingPhase = 0;

  // ── Main animation loop ──────────────────────────────────────
  function frame(now) {
    const elapsed = now - startTime;

    // Gate completion behind MIN_DURATION
    const timeProgress = Math.min(elapsed / MIN_DURATION, 1);
    // The bee follows the SLOWER of load-progress and time-progress,
    // so it always takes at least MIN_DURATION to cross.
    const targetProg = Math.min(prog / 100, timeProgress);

    // Smooth the displayed progress (honey-like ease toward target)
    displayProg += (targetProg - displayProg) * 0.06;

    // ── Position the bee along the path ───────────────────────
    const p = pointAt(displayProg);

    // Layered natural wobble on top of the path — bee never sits
    // perfectly on the line; it hovers and corrects.
    const t = now * 0.001;
    const wobbleX = Math.sin(t * 2.3) * 7 + Math.sin(t * 5.1) * 3;
    const wobbleY = Math.cos(t * 1.9) * 8 + Math.sin(t * 4.3) * 3.5;

    const bx = p.x + wobbleX;
    const by = p.y + wobbleY;

    // Heading: blend path tangent with wobble-induced drift
    const tangent = tangentAt(displayProg);
    const headingDeg = tangent * 180 / Math.PI;

    // Bee tilts into its motion + slight bob rotation
    const tilt = headingDeg + Math.sin(t * 3) * 4;

    beeG.setAttribute('transform',
      `translate(${bx} ${by}) rotate(${tilt}) scale(1)`);

    // ── Reveal the trail up to the bee ────────────────────────
    if (revealMask) {
      // Grow a rect from left to the bee's x position (+a little)
      const revealW = bx + 30;
      revealMask.setAttribute('width', Math.max(0, revealW));
    }

    // ── Wing flap (fast) ──────────────────────────────────────
    wingPhase += 0.9;
    const flap = Math.sin(wingPhase) * 22; // degrees
    const wL = document.getElementById('fbWingL');
    const wR = document.getElementById('fbWingR');
    if (wL) wL.setAttribute('transform', `rotate(${-18 - flap} 0 -8)`);
    if (wR) wR.setAttribute('transform', `rotate(${18 + flap} 0 8)`);

    // ── Completion ────────────────────────────────────────────
    if (!done && displayProg >= 0.992 && prog >= 100) {
      done = true;
      clearInterval(iv);
      resolveLoader(bx, by);
      return;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ── Resolve: bee dissolves, colony materializes ──────────────
  function resolveLoader(bx, by) {
    // 1. Bee pulses brightly, then the trail + bee fade
    const tl = gsap.timeline();

    // Brief hover-glow on the bee at journey's end
    tl.to('#flightBee', { duration: 0.5, scale: 1.15, transformOrigin: 'center', ease: 'power2.out' }, 0);

    // Fade the trail out gently
    tl.to(['#beeTrail', '#beeTrailGlow'], {
      duration: 0.8, opacity: 0, ease: 'power2.inOut'
    }, 0.3);

    // Bee scatters into the hive: fade the loader bee as the real
    // colony scene comes alive behind it.
    tl.to('#flightBee', {
      duration: 0.7, opacity: 0, scale: 1.6,
      transformOrigin: 'center', ease: 'power2.in'
    }, 0.6);

    // Reveal the page (colony scene fires here)
    tl.add(() => {
      if (typeof window.onLoaderComplete === 'function') {
        window.onLoaderComplete();
      }
    }, 0.7);

    // Lift the loader veil to expose the live colony
    tl.to('#ldr', {
      duration: 1.0, opacity: 0, ease: 'power2.inOut',
      onComplete: () => { ldr.style.display = 'none'; }
    }, 0.9);
  }
})();