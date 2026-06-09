/* Growthhive — Main Script
   growthhive.js
   Work. Play. Grow. 🐝
   Depends on: three.js r128, gsap 3.12.5, ScrollTrigger
*/

// ═══════════════════════════════════════════════════════════════════
// THREE.JS — Honeycomb + Bees + Pollen + Honey-elastic mouse
// ═══════════════════════════════════════════════════════════════════

// This page drives its own intro loader (hero bee flight).
// Tell shared.js to skip its generic loader.
window.GH_CUSTOM_LOADER = true;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 9);

const clock = new THREE.Clock();

// ── Mouse ─────────────────────────────────────────────────────
const rawMouse    = new THREE.Vector2(0, 0);
const smMouse     = new THREE.Vector2(0, 0);
const worldMouse  = new THREE.Vector3(0, 0, 0);
const targetWorld = new THREE.Vector3(0, 0, 0);
const raycaster   = new THREE.Raycaster();
const zPlane      = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

document.addEventListener('mousemove', e => {
  rawMouse.x =  (e.clientX / window.innerWidth  - 0.5) * 2;
  rawMouse.y = -(e.clientY / window.innerHeight - 0.5) * 2;
});

// ── Colours ───────────────────────────────────────────────────
const CH    = new THREE.Color(0xD4F53C);
const AMBER = new THREE.Color(0xf0a020);
const GOLD  = new THREE.Color(0xffe066);
const HONEY = new THREE.Color(0xe8820a);

// ── Pseudo-noise: sum of incommensurable sines ────────────────
// Gives smooth but non-repeating organic motion — no Perlin needed
function noise1(t, seed) {
  const s = seed * 127.1;
  return (
    Math.sin(t * 0.317 + s * 1.0) * 0.40 +
    Math.sin(t * 0.618 + s * 2.3) * 0.30 +
    Math.sin(t * 1.414 + s * 0.7) * 0.20 +
    Math.sin(t * 2.718 + s * 3.1) * 0.10
  );
}

// ── Hex geometry ──────────────────────────────────────────────
function makeHexRing(outer, inner) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    i === 0 ? shape.moveTo(outer * Math.cos(a), outer * Math.sin(a))
            : shape.lineTo(outer * Math.cos(a), outer * Math.sin(a));
  }
  shape.closePath();
  const hole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    i === 0 ? hole.moveTo(inner * Math.cos(a), inner * Math.sin(a))
            : hole.lineTo(inner * Math.cos(a), inner * Math.sin(a));
  }
  hole.closePath();
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape, 1);
}

function makeSolidHex(r) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    i === 0 ? shape.moveTo(r * Math.cos(a), r * Math.sin(a))
            : shape.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 1);
}

const hexRingGeo  = makeHexRing(0.46, 0.36);
const hexRingThin = makeHexRing(0.46, 0.42); // thinner ring for "under construction" cells
const hexSolidGeo = makeSolidHex(0.07);

// ── HONEYCOMB GRID ────────────────────────────────────────────
const COLS = 11, ROWS = 8;
const HS = 0.5;
const HW = HS * Math.sqrt(3);
const HH = HS * 2;
const TW = COLS * HW;
const TH = ROWS * HH * 0.75;

const masterGroup = new THREE.Group();
scene.add(masterGroup);
const zones = [0,1,2,3].map(() => new THREE.Group());
zones.forEach(z => masterGroup.add(z));

const zonePhase = zones.map((_, i) => (Math.PI / 2) * i);
const zoneAmpX  = [0.16, 0.10, 0.20, 0.12];
const zoneAmpY  = [0.08, 0.18, 0.06, 0.16];
const zoneSpd   = [0.25, 0.20, 0.32, 0.17];

const hexData = [];

// Separate built vs under-construction cells
// We'll animate a build queue over time
const BUILD_QUEUE_SIZE = 8; // number of cells animating construction at any time
const buildQueue = [];      // cells currently being constructed

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const bx   = col * HW + (row % 2) * HW * 0.5 - TW / 2;
    const by   = row * HH * 0.75 - TH / 2;
    const zone = (Math.floor(col / 3) + Math.floor(row / 2)) % 4;
    const phase = Math.random() * Math.PI * 2;
    const seed  = Math.random();

    // Most cells start built (visible). Edge cells start as construction sites.
    const isEdge = col === 0 || col === COLS-1 || row === 0 || row === ROWS-1;
    const startBuilt = !isEdge || Math.random() > 0.5;

    const mat = new THREE.MeshBasicMaterial({
      color: CH.clone(),
      transparent: true,
      opacity: startBuilt ? 0.0 : 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const geo  = startBuilt ? hexRingGeo : hexRingThin;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(bx, by, 0);
    zones[zone].add(mesh);

    const hd = {
      mesh, bx, by, zone, phase, seed,
      baseOp: startBuilt ? (0.13 + Math.random() * 0.09) : 0.0,
      dx: 0, dy: 0, vx: 0, vy: 0,
      built: startBuilt,
      buildProgress: startBuilt ? 1.0 : 0.0, // 0=nothing, 1=complete
      buildStartTime: null,
      buildDuration: 4.0 + Math.random() * 3.0, // seconds to build
      workerBeeIdx: -1, // which bee is working here
    };
    hexData.push(hd);

    // Queue unbuilt cells for construction
    if (!startBuilt) buildQueue.push(hd);
  }
}

// Shuffle the build queue so construction starts in random order
buildQueue.sort(() => Math.random() - 0.5);

// Active construction slots
const activeBuilds = [];

// ── POLLEN — 22 grains, Lissajous paths ───────────────────────
const pollenGroup = new THREE.Group();
scene.add(pollenGroup);
const pollenData  = [];
const NUM_POLLEN  = 22;

for (let i = 0; i < NUM_POLLEN; i++) {
  const isSolid = Math.random() > 0.55;
  const geo = isSolid ? hexSolidGeo : makeHexRing(0.06, 0.042);
  const col = Math.random();
  const matColor = col < 0.5 ? GOLD.clone() : col < 0.8 ? AMBER.clone() : HONEY.clone();
  const mat = new THREE.MeshBasicMaterial({
    color: matColor, transparent: true, opacity: 0.0,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);

  // Each pollen grain gets unique Lissajous parameters
  // Using irrational frequency ratios — no two grains share a pattern
  const freqX  = 0.11 + Math.random() * 0.19;            // x oscillation freq
  const freqY  = freqX * (1.3 + Math.random() * 0.8);    // incommensurable y freq
  const ampX   = 1.8 + Math.random() * 3.5;
  const ampY   = 1.2 + Math.random() * 2.8;
  const phaseX = Math.random() * Math.PI * 2;
  const phaseY = Math.random() * Math.PI * 2;
  const zBase  = -1.2 + Math.random() * 2.4;
  const zFreq  = 0.07 + Math.random() * 0.12;
  const zAmp   = 0.15 + Math.random() * 0.4;
  const seed   = Math.random() * 20;

  // Additional slow wander layered on top
  const wanderAmpX = 0.3 + Math.random() * 0.5;
  const wanderAmpY = 0.2 + Math.random() * 0.4;
  const wanderFreq = 0.04 + Math.random() * 0.06;

  mesh.position.set(
    Math.sin(phaseX) * ampX,
    Math.sin(phaseY) * ampY,
    zBase
  );
  mesh.rotation.z = Math.random() * Math.PI * 2;
  pollenGroup.add(mesh);

  pollenData.push({
    mesh, freqX, freqY, ampX, ampY, phaseX, phaseY,
    zBase, zFreq, zAmp, seed,
    wanderAmpX, wanderAmpY, wanderFreq,
    baseOp:  0.35 + Math.random() * 0.45,
    rotSpd:  (Math.random() - 0.5) * 0.022,
    glowFreq: 0.8 + Math.random() * 1.4,
  });
}

// ── BEES — 20, four movement archetypes ───────────────────────
function makeBee() {
  const g = new THREE.Group();

  // Body — scaled sphere
  const bodyGeo = new THREE.SphereGeometry(0.08, 10, 6);
  bodyGeo.scale(1.1, 0.58, 0.58);
  const body = new THREE.Mesh(bodyGeo,
    new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0 }));
  g.add(body);

  // Stripes
  const stripeGeo = new THREE.TorusGeometry(0.052, 0.013, 4, 12);
  [-0.032, 0.012, 0.038].forEach((xOff, i) => {
    const col = i % 2 === 0 ? 0x111111 : AMBER;
    const m = new THREE.Mesh(stripeGeo,
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0 }));
    m.position.x = xOff;
    m.rotation.y = Math.PI / 2;
    m.scale.set(0.65, 1, 0.52);
    g.add(m);
  });

  // Wings — two on each side, slightly different sizes
  const wShape = new THREE.Shape();
  wShape.ellipse(0, 0, 0.105, 0.058, 0, Math.PI * 2, false, 0);
  const wGeoL = new THREE.ShapeGeometry(wShape, 10);

  const wShape2 = new THREE.Shape();
  wShape2.ellipse(0, 0, 0.08, 0.044, 0, Math.PI * 2, false, 0);
  const wGeoS = new THREE.ShapeGeometry(wShape2, 10);

  const wMat = () => new THREE.MeshBasicMaterial({
    color: 0xD4F53C, transparent: true, opacity: 0,
    side: THREE.DoubleSide
  });

  // Forewings
  const wFL = new THREE.Mesh(wGeoL, wMat());
  const wFR = new THREE.Mesh(wGeoL, wMat());
  wFL.position.set(-0.01,  0.09, 0.03);
  wFR.position.set(-0.01, -0.09, 0.03);
  wFL.rotation.x =  0.25; wFR.rotation.x = -0.25;

  // Hindwings (smaller, offset back)
  const wHL = new THREE.Mesh(wGeoS, wMat());
  const wHR = new THREE.Mesh(wGeoS, wMat());
  wHL.position.set( 0.04,  0.075, 0.02);
  wHR.position.set( 0.04, -0.075, 0.02);
  wHL.rotation.x =  0.2; wHR.rotation.x = -0.2;

  g.add(wFL, wFR, wHL, wHR);

  // Head — small sphere
  const headGeo = new THREE.SphereGeometry(0.042, 8, 6);
  const head = new THREE.Mesh(headGeo,
    new THREE.MeshBasicMaterial({ color: 0x1a1000, transparent: true, opacity: 0 }));
  head.position.set(-0.12, 0, 0);
  g.add(head);

  return { group: g, body, wFL, wFR, wHL, wHR, head,
           allMats: [body, ...g.children.filter(c => c !== body)] };
}

const beeGroup = new THREE.Group();
scene.add(beeGroup);
const beeData  = [];
const NUM_BEES = 20;

// Archetypes:
// 'orbiter'  — loose elliptical orbit, drifting in/out
// 'wanderer' — fully noise-driven free flight across the scene
// 'worker'   — hovers near a hex cell, assigned dynamically
// 'forager'  — moves toward pollen, carries it back

const ARCHETYPES = ['orbiter','orbiter','orbiter','orbiter','orbiter',
                    'wanderer','wanderer','wanderer','wanderer','wanderer',
                    'worker','worker','worker','worker','worker',
                    'forager','forager','forager','forager','forager'];

for (let i = 0; i < NUM_BEES; i++) {
  const bee = makeBee();
  beeGroup.add(bee.group);

  const archetype = ARCHETYPES[i];
  const seed = i * 0.37 + Math.random();

  // Starting position
  const startAngle = (Math.PI * 2 / NUM_BEES) * i + Math.random() * 0.5;
  const startR = 2.5 + Math.random() * 3.5;
  bee.group.position.set(
    Math.cos(startAngle) * startR,
    Math.sin(startAngle) * startR * 0.65,
    -0.8 + Math.random() * 1.6
  );

  const bd = {
    ...bee,
    archetype,
    seed,
    angle: startAngle,
    // Orbiter params
    orbitR:      2.5 + Math.random() * 3.0,
    orbitEllX:   1.0 + Math.random() * 0.4,   // ellipse x stretch
    orbitEllY:   0.55 + Math.random() * 0.3,  // ellipse y stretch
    orbitSpd:    (0.06 + Math.random() * 0.08) * (Math.random() > 0.5 ? 1 : -1),
    orbitDriftF: 0.03 + Math.random() * 0.04, // drift in/out freq
    orbitDriftA: 0.4 + Math.random() * 0.6,  // drift in/out amplitude
    // Wanderer params — lissajous free flight
    wandFreqX:   0.08 + Math.random() * 0.14,
    wandFreqY:   0.11 + Math.random() * 0.17,
    wandFreqZ:   0.05 + Math.random() * 0.09,
    wandAmpX:    2.0 + Math.random() * 2.5,
    wandAmpY:    1.2 + Math.random() * 1.8,
    wandAmpZ:    0.3 + Math.random() * 0.5,
    wandPhaseX:  Math.random() * Math.PI * 2,
    wandPhaseY:  Math.random() * Math.PI * 2,
    wandPhaseZ:  Math.random() * Math.PI * 2,
    // Worker params
    workerHexIdx:   -1,   // assigned hex
    workerOffset:   new THREE.Vector3((Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, 0.15+Math.random()*0.2),
    workerHoverT:   Math.random() * Math.PI * 2, // hover cycle offset
    // Forager params
    foragerTarget:  Math.floor(Math.random() * NUM_POLLEN),
    foragerPhase:   'fly', // 'fly' | 'collect' | 'return'
    foragerT:       0,
    // Shared
    bobPhase:    Math.random() * Math.PI * 2,
    bobAmp:      0.04 + Math.random() * 0.08,
    bobSpd:      2.5 + Math.random() * 2.5,
    wingPhase:   Math.random() * Math.PI * 2,
    wingSpd:     14 + Math.random() * 8,  // varies bee to bee
    baseOp:      0.55 + Math.random() * 0.4,
    px: bee.group.position.x,  // current pos (for facing)
    py: bee.group.position.y,
    prevX: bee.group.position.x,
    prevY: bee.group.position.y,
  };
  beeData.push(bd);
}

// Assign worker bees to built hex cells
function assignWorkerBees() {
  const builtCells = hexData.filter(h => h.built);
  beeData.filter(b => b.archetype === 'worker').forEach((b, i) => {
    const cell = builtCells[Math.floor(Math.random() * builtCells.length)];
    if (cell) b.workerHexIdx = hexData.indexOf(cell);
  });
}
assignWorkerBees();

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// THE COMB — hexagonal honeycomb loader
// 19 SVG hexagonal cells fill with chartreuse as loading advances.
// Pure SVG/GSAP — independent of Three.js.
// Colony renders beneath but stays hidden until handoff.
// ═══════════════════════════════════════════════════════════════

// Colony visibility — 0 during loading, animates to 1 after handoff
let sceneIntroFading  = false;
let sceneIntroFadeStart = null;

(function initComb() {
  const NS      = 'http://www.w3.org/2000/svg';
  const CH      = '#D4F53C';
  const OUTLINE = 'rgba(212,245,60,0.16)';

  // 19 positions: center + ring1(6) + ring2(12)
  // Pointy-top hex grid, size=30 (centre-to-centre pitch = 51.96)
  const POS = [
    [   0,    0],  // 0  centre
    [ 52,     0],  // 1  ring1 E
    [ 26,    45],  // 2        SE
    [-26,    45],  // 3        SW
    [-52,     0],  // 4        W
    [-26,   -45],  // 5        NW
    [ 26,   -45],  // 6        NE
    [104,     0],  // 7  ring2 E
    [ 78,    45],  // 8        E-SE
    [ 52,    90],  // 9        SE
    [  0,    90],  // 10       S
    [-52,    90],  // 11       SW
    [-78,    45],  // 12       W-SW
    [-104,    0],  // 13       W
    [-78,   -45],  // 14       W-NW
    [-52,   -90],  // 15       NW
    [  0,   -90],  // 16       N
    [ 52,   -90],  // 17       NE
    [ 78,   -45],  // 18       E-NE
  ];

  // Pointy-top hex, circumradius 26px (leaves ~6px gap between cells)
  const HEX = 'M 22.5 -13 L 22.5 13 L 0 26 L -22.5 13 L -22.5 -13 L 0 -26 Z';

  const wrap = document.getElementById('combWrap');
  if (!wrap) return;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-131 -116 262 232');
  svg.setAttribute('width',  '262');
  svg.setAttribute('height', '232');
  svg.style.display = 'block';
  wrap.insertBefore(svg, wrap.firstChild);

  const outlinePaths = [];
  const fillPaths    = [];

  POS.forEach(([cx, cy]) => {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${cx},${cy})`);

    const outline = document.createElementNS(NS, 'path');
    outline.setAttribute('d', HEX);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', OUTLINE);
    outline.setAttribute('stroke-width', '1.5');
    g.appendChild(outline);
    outlinePaths.push(outline);

    const fill = document.createElementNS(NS, 'path');
    fill.setAttribute('d', HEX);
    fill.setAttribute('fill', CH);
    fill.style.opacity = '0';
    gsap.set(fill, { scale: 0, transformOrigin: '0px 0px' });
    g.appendChild(fill);
    fillPaths.push(fill);

    svg.appendChild(g);
  });

  // Gentle breathing pulse on unfilled outlines
  outlinePaths.forEach((el, i) => {
    gsap.to(el, {
      attr: { 'stroke-opacity': 0.55 },
      duration: 1.1 + Math.random() * 0.9,
      repeat: -1, yoyo: true, ease: 'sine.inOut',
      delay: i * 0.07,
    });
  });

  const pctEl = document.getElementById('combPct');
  const tagEl = document.getElementById('combTag');
  const N     = POS.length;   // 19
  let pct      = 0;
  let nextCell = 0;

  const tick = setInterval(() => {
    pct = Math.min(pct + (Math.random() * 6 + 2.5), 100);
    if (pctEl) pctEl.textContent = Math.floor(pct) + '%';

    const target = pct >= 100 ? N : Math.floor((pct / 100) * (N - 1)) + 1;
    while (nextCell < target && nextCell < N) {
      const fill    = fillPaths[nextCell];
      const outline = outlinePaths[nextCell];
      gsap.killTweensOf(outline);
      gsap.to(outline, {
        attr: { stroke: CH, 'stroke-opacity': 0.8 }, duration: 0.15,
      });
      gsap.to(fill, {
        scale: 1, opacity: 1, duration: 0.38,
        ease: 'back.out(1.8)', transformOrigin: '0px 0px',
      });
      nextCell++;
    }

    if (pct >= 100) {
      clearInterval(tick);
      while (nextCell < N) {
        gsap.to(fillPaths[nextCell], {
          scale: 1, opacity: 1, duration: 0.2,
          ease: 'power2.out', transformOrigin: '0px 0px',
        });
        nextCell++;
      }
      if (tagEl) gsap.to(tagEl, { opacity: 1, duration: 0.35, delay: 0.1 });
      setTimeout(beginHandoff, 560);
    }
  }, 125);
})();

function render() {
  requestAnimationFrame(render);
  const t = clock.getElapsedTime();

  smMouse.x += (rawMouse.x - smMouse.x) * 0.04;
  smMouse.y += (rawMouse.y - smMouse.y) * 0.04;

  raycaster.setFromCamera(rawMouse, camera);
  raycaster.ray.intersectPlane(zPlane, targetWorld);
  worldMouse.x += (targetWorld.x - worldMouse.x) * 0.03;
  worldMouse.y += (targetWorld.y - worldMouse.y) * 0.03;

  // ── Colony intro: fades in after comb loader calls beginHandoff ──
  if (sceneIntroFading && sceneIntroFadeStart === null) {
    sceneIntroFadeStart = t; // capture render-clock start time
  }
  const sceneIntroMult = sceneIntroFadeStart !== null
    ? Math.min((t - sceneIntroFadeStart) / 1.5, 1.0)
    : 0.0;


  curS = lerpS(curS, tgtS, 0.02);

  // Master group
  masterGroup.rotation.x = curS.hexRot[0] + smMouse.y * 0.1;
  masterGroup.rotation.y = curS.hexRot[1] + smMouse.x * 0.1;
  masterGroup.rotation.z = curS.hexRot[2];
  masterGroup.position.z = curS.gz;
  masterGroup.scale.setScalar(curS.hexSc);

  // Zone organic drift
  zones.forEach((zone, zi) => {
    const ph = zonePhase[zi] + t * zoneSpd[zi];
    zone.position.x = Math.sin(ph) * zoneAmpX[zi];
    zone.position.y = Math.cos(ph * 0.7) * zoneAmpY[zi];
    zone.rotation.z = Math.sin(ph * 0.4) * 0.035;
  });

  // Construction tick
  tickConstruction(t);

  // ── Hex cells ─────────────────────────────────────────────
  hexData.forEach(h => {
    const wx = h.bx * curS.hexSc;
    const wy = h.by * curS.hexSc;
    const mdx = worldMouse.x - wx;
    const mdy = worldMouse.y - wy;
    const dist = Math.sqrt(mdx * mdx + mdy * mdy);

    let tdx = 0, tdy = 0;
    if (dist < REPEL_DIST && dist > 0.001) {
      const strength = REPEL_STR * (1 - dist / REPEL_DIST);
      tdx = -(mdx / dist) * strength;
      tdy = -(mdy / dist) * strength;
    } else if (dist < ATTRACT_DIST && dist > REPEL_DIST) {
      const t2 = (dist - REPEL_DIST) / (ATTRACT_DIST - REPEL_DIST);
      const strength = ATTRACT_STR * (1 - t2) * Math.sin(t2 * Math.PI);
      tdx = (mdx / dist) * strength;
      tdy = (mdy / dist) * strength;
    }

    const fx = SPRING_K * (tdx - h.dx) - (1 - SPRING_DAMP) * h.vx;
    const fy = SPRING_K * (tdy - h.dy) - (1 - SPRING_DAMP) * h.vy;
    h.vx = (h.vx + fx) * SPRING_DAMP;
    h.vy = (h.vy + fy) * SPRING_DAMP;
    h.dx += h.vx;
    h.dy += h.vy;

    h.mesh.position.x = h.bx + h.dx;
    h.mesh.position.y = h.by + h.dy;
    h.mesh.position.z = Math.sin(t * 0.85 + h.phase) * 0.055;

    // Under-construction cells: opacity tied to build progress + flicker
    let targetOp;
    if (!h.built && h.buildProgress < 1.0 && h.buildStartTime !== null) {
      // Flicker as bee builds — opacity stutters upward
      const flicker = 0.5 + 0.5 * Math.sin(t * 8.3 + h.phase);
      targetOp = curS.hexOp * h.buildProgress * flicker * 0.7;
    } else if (h.built) {
      const wave = 0.5 + 0.5 * Math.sin(t * 0.65 + h.phase);
      targetOp = curS.hexOp * (0.52 + 0.48 * wave);
    } else {
      targetOp = 0.0;
    }
    // Smooth opacity transition
    h.mesh.material.opacity += (targetOp * sceneIntroMult - h.mesh.material.opacity) * 0.08;

    const sc = 1 + 0.032 * Math.sin(t * 1.05 + h.phase);
    h.mesh.scale.setScalar(sc);
  });

  // ── Pollen — Lissajous paths ──────────────────────────────
  pollenData.forEach(p => {
    const pSpr = curS.pSpr;
    // Core Lissajous position
    const lx = Math.sin(t * p.freqX + p.phaseX) * p.ampX * pSpr;
    const ly = Math.sin(t * p.freqY + p.phaseY) * p.ampY * pSpr;
    // Layered slow wander offset
    const wx = noise1(t * p.wanderFreq, p.seed)       * p.wanderAmpX;
    const wy = noise1(t * p.wanderFreq, p.seed + 10)  * p.wanderAmpY;

    p.mesh.position.x = lx + wx;
    p.mesh.position.y = ly + wy;
    p.mesh.position.z = p.zBase + Math.sin(t * p.zFreq + p.phaseZ || 0) * p.zAmp;
    p.mesh.rotation.z += p.rotSpd;

    const glow = 0.55 + 0.45 * Math.sin(t * p.glowFreq + p.seed);
    p.mesh.material.opacity = curS.pollenOp * p.baseOp * glow * sceneIntroMult;
  });

  // ── Bees ─────────────────────────────────────────────────
  beeData.forEach((b, bi) => {
    const bR = curS.bR;
    let nx = b.px, ny = b.py; // new position target

    if (b.archetype === 'orbiter') {
      // Elliptical orbit with noise-driven radius drift
      b.angle += b.orbitSpd * 0.016;
      const rDrift = b.orbitR * bR + noise1(t * b.orbitDriftF, b.seed) * b.orbitDriftA;
      nx = Math.cos(b.angle) * rDrift * b.orbitEllX + smMouse.x * 0.06;
      ny = Math.sin(b.angle) * rDrift * b.orbitEllY + smMouse.y * 0.04;
      // Noise offset on top so it's never a clean ellipse
      nx += noise1(t * 0.19, b.seed + 5) * 0.4;
      ny += noise1(t * 0.23, b.seed + 8) * 0.3;

    } else if (b.archetype === 'wanderer') {
      // Pure Lissajous free flight — no orbit at all
      nx = Math.sin(t * b.wandFreqX + b.wandPhaseX) * b.wandAmpX * bR + smMouse.x * 0.05;
      ny = Math.sin(t * b.wandFreqY + b.wandPhaseY) * b.wandAmpY * bR + smMouse.y * 0.04;
      b.group.position.z = Math.sin(t * b.wandFreqZ + b.wandPhaseZ) * b.wandAmpZ;

    } else if (b.archetype === 'worker') {
      // Hovers near assigned hex cell, tiny movements like it's working
      if (b.workerHexIdx >= 0 && b.workerHexIdx < hexData.length) {
        const cell = hexData[b.workerHexIdx];
        const wx = cell.bx * curS.hexSc;
        const wy = cell.by * curS.hexSc;
        // Hover in tight circles around the cell + micro-jitter
        const hoverAngle = t * 1.8 + b.workerHoverT;
        const hoverR = 0.18 + 0.06 * Math.sin(t * 3.1 + b.workerHoverT);
        nx = wx + Math.cos(hoverAngle) * hoverR + noise1(t * 0.9, b.seed) * 0.08;
        ny = wy + Math.sin(hoverAngle) * hoverR + noise1(t * 1.1, b.seed + 3) * 0.06;
        b.group.position.z = 0.2 + Math.sin(t * 2.4 + b.workerHoverT) * 0.08;
      } else {
        // No cell assigned — wander until one comes
        nx = noise1(t * 0.12, b.seed) * 3.0 * bR;
        ny = noise1(t * 0.15, b.seed + 7) * 2.0 * bR;
      }

    } else if (b.archetype === 'forager') {
      // Moves toward pollen target, dwell, return — fully noise-shaped path
      const ptgt = pollenData[b.foragerTarget % NUM_POLLEN];
      const tx = ptgt.mesh.position.x;
      const ty = ptgt.mesh.position.y;

      b.foragerT += 0.004;
      if (b.foragerT > 1.0) {
        b.foragerT = 0;
        b.foragerPhase = b.foragerPhase === 'fly' ? 'collect'
                       : b.foragerPhase === 'collect' ? 'return' : 'fly';
        if (b.foragerPhase === 'fly') {
          b.foragerTarget = Math.floor(Math.random() * NUM_POLLEN);
        }
      }

      if (b.foragerPhase === 'fly') {
        // Arc toward target with noise wobble — not a straight line
        const ease = b.foragerT * b.foragerT * (3 - 2 * b.foragerT); // smoothstep
        nx = b.px + (tx - b.px) * ease * 0.02 + noise1(t * 0.4, b.seed) * 0.25;
        ny = b.py + (ty - b.py) * ease * 0.02 + noise1(t * 0.5, b.seed+2) * 0.2;
      } else if (b.foragerPhase === 'collect') {
        // Tight hover near pollen
        nx = tx + noise1(t * 1.4, b.seed) * 0.12;
        ny = ty + noise1(t * 1.6, b.seed+4) * 0.10;
      } else {
        // Return toward hive centre
        nx = b.px * (1 - b.foragerT * 0.015) + noise1(t * 0.3, b.seed+1) * 0.3;
        ny = b.py * (1 - b.foragerT * 0.015) + noise1(t * 0.4, b.seed+5) * 0.25;
      }
    }

    // Bob
    ny += Math.sin(t * b.bobSpd + b.bobPhase) * b.bobAmp;

    // Smooth position (honey feel — slight lag)
    const LAG = b.archetype === 'worker' ? 0.12 : 0.07;
    b.px += (nx - b.px) * LAG;
    b.py += (ny - b.py) * LAG;
    b.group.position.x = b.px;
    b.group.position.y = b.py;

    // Face direction of travel
    const ddx = b.px - b.prevX;
    const ddy = b.py - b.prevY;
    if (Math.abs(ddx) + Math.abs(ddy) > 0.0001) {
      const targetAngle = Math.atan2(ddy, ddx);
      b.group.rotation.z += (targetAngle - b.group.rotation.z) * 0.12;
    }
    b.prevX = b.px;
    b.prevY = b.py;

    // Wing flap — each bee has its own speed
    const flap = Math.sin(t * b.wingSpd + b.wingPhase) * 0.38;
    b.wFL.rotation.x =  0.25 + flap;
    b.wFR.rotation.x = -0.25 - flap;
    b.wHL.rotation.x =  0.20 + flap * 0.7;
    b.wHR.rotation.x = -0.20 - flap * 0.7;

    // Opacity — worker bees near construction sites glow slightly brighter
    let opMult = 1.0;
    if (b.archetype === 'worker' && b.workerHexIdx >= 0) {
      const cell = hexData[b.workerHexIdx];
      if (!cell.built) opMult = 1.3; // working harder — slightly more visible
    }
    // Colony visibility multiplier from comb loader
    const introMult = sceneIntroMult;
    const op = curS.beeOp * b.baseOp * opMult * introMult;

    b.group.children.forEach((child, ci) => {
      if (child.material) {
        const baseOp = ci === 0 ? 1.0          // body
                     : ci <= 3 ? 0.85          // stripes
                     : ci <= 5 ? 0.70          // forewings
                     : ci <= 7 ? 0.55          // hindwings
                     : 0.80;                   // head
        child.material.opacity = op * baseOp;
      }
    });
  });

  // Camera float
  camera.position.x = smMouse.x * 0.12;
  camera.position.y = smMouse.y * 0.08;
  camera.lookAt(scene.position);

  renderer.render(scene, camera);
}
// ── Handoff: fade veil, reveal site, fire page animations ─────
function beginHandoff() {
  sceneIntroFading = true; // signal render loop to fade colony in
  const veil = document.getElementById('ldr');
  if (veil) {
    gsap.to(veil, {
      opacity: 0, duration: 1.4, ease: 'power2.inOut',
      onComplete: () => { veil.style.display = 'none'; }
    });
  }
  if (typeof window.onLoaderComplete === 'function') {
    window.onLoaderComplete();
  }
}


render();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ═══════════════════════════════════════════════════════════════
// PAGE ANIMATIONS — called by shared.js loader via onLoaderComplete
// ═══════════════════════════════════════════════════════════════
window.onLoaderComplete = function initPage() {
gsap.registerPlugin(ScrollTrigger);

  gsap.to('.h-eye span',    { y: 0, duration: 1,   ease: 'power4.out', delay: 0.1 });
  gsap.to('.h-title .word', { y: 0, duration: 1.3, ease: 'power4.out', stagger: 0.08, delay: 0.2 });
  gsap.to('.h-desc span',   { y: 0, duration: 1,   ease: 'power4.out', delay: 0.48 });
  gsap.to('.h-scr',         { opacity: 1, duration: 1, delay: 1.1 });
  gsap.to('.scr-line',      { scaleX: 1, duration: 1.5, ease: 'power4.out', delay: 1.1 });

  [['#s0',0],['#s1',1],['#s2',2],['#s3',3],['#s4',4]].forEach(([id, si]) => {
    ScrollTrigger.create({
      trigger: id, start: 'top 58%',
      onEnter: () => setScene(si), onEnterBack: () => setScene(si)
    });
  });

  ScrollTrigger.create({ trigger: '.intro', start: 'top 76%', once: true, onEnter: () => {
    gsap.to('.i-label span', { y: 0, duration: 0.9, ease: 'power4.out' });
    gsap.to('.i-txt .inner', { y: 0, duration: 1,   ease: 'power4.out', stagger: 0.09 });
    gsap.to('.stat',         { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out' });
  }});

  ScrollTrigger.create({ trigger: '.svc-grid', start: 'top 80%', once: true, onEnter: () => {
    gsap.to('.svc-item', { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out' });
  }});

  ScrollTrigger.create({ trigger: '.foot', start: 'top 76%', once: true, onEnter: () => {
    gsap.to('.f-hl .inner', { y: 0, duration: 1.1, ease: 'power4.out', stagger: 0.1 });
    gsap.to('.f-btns',      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.2 });
  }});
}