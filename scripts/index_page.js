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
// INTRO FLIGHT — hero bee loader
// A single large bee flies left→right with organic noise motion,
// drawing a dot-dash trail + percentage. At completion it shrinks
// to normal size and joins the colony as a wanderer.
// ═══════════════════════════════════════════════════════════════
const intro = {
  active: true,
  progress: 0,        // 0..1 logical load progress
  display: 0,         // smoothed progress the bee follows
  done: false,
  startTime: null,    // set on first frame
  minDuration: 2.4,   // seconds
  heroScale: 7.0,     // hero bee size multiplier (big, central hero)
  handoffStart: null, // when shrink-to-colony begins (seconds)
};

// Build the hero bee (same geometry as colony, standalone, large)
const heroBeeObj = makeBee();
heroBeeObj.group.scale.setScalar(intro.heroScale);
// Start it ON SCREEN, slightly left of center, so it's present from frame 1
heroBeeObj.group.position.set(-1.5, 0.3, 0.5);
scene.add(heroBeeObj.group);

// Hero bee flight params — the bee is the centerpiece the WHOLE time.
// It hovers and wanders the center band with personality, drifting
// gently left→right overall, then flies to its colony spot at the end.
const heroFlight = {
  // Gentle overall drift across the center band (not edge-to-edge)
  xDriftStart: -1.5, xDriftEnd: 1.8,
  yCenter: 0.3, yWander: 1.6,
  xWander: 1.4,            // horizontal wander amplitude (meander)
  seedX: Math.random() * 10,
  seedY: Math.random() * 10 + 20,
  wingPhase: 0,
  bobPhase: Math.random() * Math.PI * 2,
  px: -1.5, py: 0.3,
  prevX: -1.6, prevY: 0.3,
  // Colony handoff target (where it settles among the hive)
  targetX: 0, targetY: 0,
  handoffFromX: 0, handoffFromY: 0, // captured at handoff start
};

// Logical progress driver — never completes before minDuration
const introInterval = setInterval(() => {
  intro.progress += Math.random() * 0.13;
  if (intro.progress >= 1) intro.progress = 1;
}, 80);

// Overlay elements
const introPctEl     = document.getElementById('introPct');
const introTrail     = document.getElementById('introTrail');
const introTrailGlow = document.getElementById('introTrailGlow');

// Trail point history (screen-space)
const trailPoints = [];

// Project a 3D world point to screen pixels
function projectToScreen(vec3) {
  const v = vec3.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * window.innerWidth,
    y: (-v.y * 0.5 + 0.5) * window.innerHeight,
  };
}

// Build an irregular dot-dash SVG path string from screen points,
// rendered as a polyline; the dash pattern creates morse dot-dash.
function buildTrailPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`;
  }
  return d;
}

// ── Scene states ──────────────────────────────────────────────
const STATES = [
  { hexOp:0.14, pollenOp:0.7,  beeOp:0.82, hexSc:1.0,  hexRot:[0,0,0],         gz:0,    pSpr:1,    bR:1.0 },
  { hexOp:0.07, pollenOp:0.3,  beeOp:0.42, hexSc:1.15, hexRot:[0.25,-0.18,0],  gz:-0.8, pSpr:1.25, bR:1.25},
  { hexOp:0.20, pollenOp:0.75, beeOp:0.88, hexSc:0.88, hexRot:[-0.18,0.25,0],  gz:0.4,  pSpr:0.85, bR:0.85},
  { hexOp:0.05, pollenOp:0.18, beeOp:0.24, hexSc:1.3,  hexRot:[0.12,0.12,0],   gz:-1.2, pSpr:1.5,  bR:1.5 },
  { hexOp:0.27, pollenOp:0.92, beeOp:1.0,  hexSc:0.92, hexRot:[-0.08,-0.08,0], gz:0.6,  pSpr:0.8,  bR:0.8 },
];
let curS = { ...STATES[0] };
let tgtS = { ...STATES[0] };

function setScene(i) { tgtS = { ...STATES[i] }; }

function lerpS(a, b, t) {
  return {
    hexOp:    a.hexOp    + (b.hexOp    - a.hexOp)    * t,
    pollenOp: a.pollenOp + (b.pollenOp - a.pollenOp) * t,
    beeOp:    a.beeOp    + (b.beeOp    - a.beeOp)    * t,
    hexSc:    a.hexSc    + (b.hexSc    - a.hexSc)    * t,
    gz:       a.gz       + (b.gz       - a.gz)       * t,
    pSpr:     a.pSpr     + (b.pSpr     - a.pSpr)     * t,
    bR:       a.bR       + (b.bR       - a.bR)       * t,
    hexRot: [
      a.hexRot[0] + (b.hexRot[0] - a.hexRot[0]) * t,
      a.hexRot[1] + (b.hexRot[1] - a.hexRot[1]) * t,
      a.hexRot[2] + (b.hexRot[2] - a.hexRot[2]) * t,
    ],
  };
}

// ── Spring constants ──────────────────────────────────────────
const SPRING_K    = 0.018;
const SPRING_DAMP = 0.72;
const REPEL_DIST  = 1.8;
const ATTRACT_DIST= 3.8;
const REPEL_STR   = 0.55;
const ATTRACT_STR = 0.18;

// ── Construction system ───────────────────────────────────────
// Drip-feeds cells from the build queue into active construction
const BUILD_INTERVAL = 6.0; // seconds between starting new cells
let lastBuildStart   = 0;
const MAX_ACTIVE     = 3;   // max simultaneously under construction

function tickConstruction(t) {
  // Start new builds
  if (buildQueue.length > 0 &&
      activeBuilds.length < MAX_ACTIVE &&
      t - lastBuildStart > BUILD_INTERVAL) {

    const cell = buildQueue.shift();
    cell.buildStartTime = t;
    cell.buildProgress  = 0;
    cell.built          = false;
    // Assign a nearby worker bee
    const workerBees = beeData.filter(b => b.archetype === 'worker');
    const freeWorker = workerBees.find(b => b.workerHexIdx === -1) || workerBees[0];
    if (freeWorker) {
      freeWorker.workerHexIdx = hexData.indexOf(cell);
      cell.workerBeeIdx = beeData.indexOf(freeWorker);
    }
    activeBuilds.push(cell);
    lastBuildStart = t;
    // Swap to thin ring geometry to show "in progress"
    cell.mesh.geometry = hexRingThin;
  }

  // Progress active builds
  for (let i = activeBuilds.length - 1; i >= 0; i--) {
    const cell = activeBuilds[i];
    const elapsed = t - cell.buildStartTime;
    cell.buildProgress = Math.min(elapsed / cell.buildDuration, 1.0);

    if (cell.buildProgress >= 1.0) {
      // Cell complete — swap to full ring, release worker
      cell.built = true;
      cell.mesh.geometry = hexRingGeo;
      cell.baseOp = 0.13 + Math.random() * 0.09;
      if (cell.workerBeeIdx >= 0) {
        beeData[cell.workerBeeIdx].workerHexIdx = -1;
        cell.workerBeeIdx = -1;
      }
      // Re-queue so it can "need repair" later — adds to end of queue
      setTimeout(() => {
        cell.built = false;
        cell.buildProgress = 0;
        cell.baseOp = 0.0;
        cell.mesh.geometry = hexRingThin;
        buildQueue.push(cell);
      }, (25000 + Math.random() * 20000)); // comes back after 25-45s
      activeBuilds.splice(i, 1);
    }
  }
}

// ── Render loop ───────────────────────────────────────────────
function render() {
  requestAnimationFrame(render);
  const t = clock.getElapsedTime();

  smMouse.x += (rawMouse.x - smMouse.x) * 0.04;
  smMouse.y += (rawMouse.y - smMouse.y) * 0.04;

  raycaster.setFromCamera(rawMouse, camera);
  raycaster.ray.intersectPlane(zPlane, targetWorld);
  worldMouse.x += (targetWorld.x - worldMouse.x) * 0.03;
  worldMouse.y += (targetWorld.y - worldMouse.y) * 0.03;

  // ── INTRO FLIGHT ─────────────────────────────────────────
  if (intro.active) {
    if (intro.startTime === null) intro.startTime = t;
    const elapsed = t - intro.startTime;
    const timeProgress = Math.min(elapsed / intro.minDuration, 1);
    // Bee follows slower of load-progress and time-progress
    const target = Math.min(intro.progress, timeProgress);
    intro.display += (target - intro.display) * 0.05;

    // The bee is the CENTERPIECE — it hovers and wanders the center
    // band the entire time, with only a gentle overall left→right drift.
    // Motion is the same summed-sine noise the colony wanderers use.
    const ease = intro.display * intro.display * (3 - 2 * intro.display); // smoothstep
    const driftX = heroFlight.xDriftStart + (heroFlight.xDriftEnd - heroFlight.xDriftStart) * ease;

    const wanderX = noise1(t * 0.5,  heroFlight.seedX) * heroFlight.xWander;
    const wanderY = noise1(t * 0.55, heroFlight.seedY) * heroFlight.yWander;
    const tx = driftX + wanderX;
    const ty = heroFlight.yCenter + wanderY
             + Math.sin(t * 2.6 + heroFlight.bobPhase) * 0.22; // lively bob

    // Smooth toward target (honey lag)
    heroFlight.px += (tx - heroFlight.px) * 0.07;
    heroFlight.py += (ty - heroFlight.py) * 0.07;
    heroBeeObj.group.position.set(heroFlight.px, heroFlight.py, 0.5);

    // Face direction of travel
    const ddx = heroFlight.px - heroFlight.prevX;
    const ddy = heroFlight.py - heroFlight.prevY;
    if (Math.abs(ddx) + Math.abs(ddy) > 0.0001) {
      const ta = Math.atan2(ddy, ddx);
      heroBeeObj.group.rotation.z += (ta - heroBeeObj.group.rotation.z) * 0.1;
    }
    heroFlight.prevX = heroFlight.px;
    heroFlight.prevY = heroFlight.py;

    // Wing flap — fast and lively (this is the hero)
    heroFlight.wingPhase += 0.95;
    const hflap = Math.sin(heroFlight.wingPhase) * 0.48;
    heroBeeObj.wFL.rotation.x =  0.25 + hflap;
    heroBeeObj.wFR.rotation.x = -0.25 - hflap;
    heroBeeObj.wHL.rotation.x =  0.20 + hflap * 0.7;
    heroBeeObj.wHR.rotation.x = -0.20 - hflap * 0.7;

    // Hero bee opacity — full while flying
    heroBeeObj.group.children.forEach((child, ci) => {
      if (child.material) {
        const baseOp = ci === 0 ? 1.0 : ci <= 3 ? 0.9 : ci <= 5 ? 0.78 : ci <= 7 ? 0.6 : 0.85;
        child.material.opacity = baseOp;
      }
    });

    // ── Trail + percentage overlay (screen space) ──────────
    const screen = projectToScreen(heroBeeObj.group.position);
    const last = trailPoints[trailPoints.length - 1];
    if (!last || Math.hypot(screen.x - last.x, screen.y - last.y) > 6) {
      trailPoints.push({ x: screen.x, y: screen.y });
      // Cap trail length so it reads as a recent wake, not the full history
      if (trailPoints.length > 90) trailPoints.shift();
    }
    if (introTrail) {
      const d = buildTrailPath(trailPoints);
      introTrail.setAttribute('d', d);
      if (introTrailGlow) introTrailGlow.setAttribute('d', d);
    }
    if (introPctEl) {
      const pct = Math.floor(intro.display * 100);
      introPctEl.textContent = pct + '%';
      introPctEl.style.left = (screen.x - 64) + 'px';
      introPctEl.style.top  = (screen.y - 42) + 'px';
      introPctEl.style.opacity = '1';
    }

    // ── Completion → handoff ───────────────────────────────
    if (!intro.done && intro.display >= 0.985 && intro.progress >= 1) {
      intro.done = true;
      intro.handoffStart = t;
      // Capture where the bee is now, and pick a colony target spot
      heroFlight.handoffFromX = heroFlight.px;
      heroFlight.handoffFromY = heroFlight.py;
      // Target: a wanderer bee's current position (it joins the hive there)
      const wanderer = beeData.find(b => b.archetype === 'wanderer') || beeData[0];
      heroFlight.targetX = wanderer ? wanderer.px : 0;
      heroFlight.targetY = wanderer ? wanderer.py : 0;
      clearInterval(introInterval);
      beginHandoff();
    }
  }

  // ── HANDOFF — bee flies to colony spot AND shrinks ───────
  if (intro.handoffStart !== null) {
    const ht = t - intro.handoffStart;
    const hd = 1.1; // handoff duration (seconds)
    const k = Math.min(ht / hd, 1);
    const ke = 1 - Math.pow(1 - k, 3); // ease-out cubic

    // Fly from where it was to the colony target as it shrinks
    const hx = heroFlight.handoffFromX + (heroFlight.targetX - heroFlight.handoffFromX) * ke;
    const hy = heroFlight.handoffFromY + (heroFlight.targetY - heroFlight.handoffFromY) * ke;
    heroBeeObj.group.position.set(hx, hy, 0.5 * (1 - ke));

    // Keep wings flapping through the handoff
    heroFlight.wingPhase += 0.95;
    const hflap = Math.sin(heroFlight.wingPhase) * 0.48;
    heroBeeObj.wFL.rotation.x =  0.25 + hflap;
    heroBeeObj.wFR.rotation.x = -0.25 - hflap;
    heroBeeObj.wHL.rotation.x =  0.20 + hflap * 0.7;
    heroBeeObj.wHR.rotation.x = -0.20 - hflap * 0.7;

    // Shrink hero bee from heroScale → 1.0
    const sc = intro.heroScale + (1.0 - intro.heroScale) * ke;
    heroBeeObj.group.scale.setScalar(sc);

    // Fade the percentage + trail out
    if (introPctEl)     introPctEl.style.opacity = String(1 - k);
    if (introTrail)     introTrail.style.opacity = String(0.9 * (1 - k));
    if (introTrailGlow) introTrailGlow.style.opacity = String(0.12 * (1 - k));

    if (k >= 1) {
      scene.remove(heroBeeObj.group);
      intro.handoffStart = null;
      intro.active = false;
    }
  }

  // ── Scene-wide intro visibility multiplier ───────────────
  // Hex + pollen hidden while hero bee flies, fade in at handoff
  let sceneIntroMult = 1.0;
  if (intro.active) {
    if (intro.handoffStart !== null) {
      const ht = t - intro.handoffStart;
      sceneIntroMult = Math.min(ht / 1.5, 1);
    } else {
      sceneIntroMult = 0;
    }
  }

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
    // During intro: colony fades in only as the handoff progresses
    let introMult = 1.0;
    if (intro.active) {
      if (intro.handoffStart !== null) {
        const ht = clock.getElapsedTime() - intro.handoffStart;
        introMult = Math.min(ht / 1.5, 1); // fade in over handoff
      } else {
        introMult = 0; // hidden while hero bee flies
      }
    }
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
  // Fade the navy veil to expose the live colony scene
  const veil = document.getElementById('ldr');
  if (veil) {
    gsap.to(veil, {
      opacity: 0, duration: 1.4, ease: 'power2.inOut',
      onComplete: () => { veil.style.display = 'none'; }
    });
  }
  // Fire the page's scroll/reveal animations
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