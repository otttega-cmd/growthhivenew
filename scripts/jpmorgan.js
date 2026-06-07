/* ================================================================
   Growthhive — J.P. Morgan Asset Management Case Study Script
   jpmorgan.js
   Depends on: shared.css, shared.js, three.js, gsap, ScrollTrigger
   Work. Play. Grow. 🐝
================================================================ */

// ═══════════════════════════════════════════════════════════════
// THREE.JS — Full colony scene, consistent with all pages
// ═══════════════════════════════════════════════════════════════
// This page drives its own intro loader (hero bee flight).
// Tell shared.js to skip its generic loader.
window.GH_CUSTOM_LOADER = true;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 0, 9);

const clock = new THREE.Clock();
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

const CH    = new THREE.Color(0xD4F53C);
const AMBER = new THREE.Color(0xf0a020);
const GOLD  = new THREE.Color(0xffe066);
const HONEY = new THREE.Color(0xe8820a);

function noise1(t, seed) {
  const s = seed * 127.1;
  return Math.sin(t*.317+s)*0.40 + Math.sin(t*.618+s*2.3)*0.30 + Math.sin(t*1.414+s*.7)*0.20 + Math.sin(t*2.718+s*3.1)*0.10;
}

function makeHexRing(o, i) {
  const shape = new THREE.Shape();
  for (let j=0;j<6;j++){const a=(Math.PI/3)*j-Math.PI/6; j===0?shape.moveTo(o*Math.cos(a),o*Math.sin(a)):shape.lineTo(o*Math.cos(a),o*Math.sin(a));}
  shape.closePath();
  const hole = new THREE.Path();
  for (let j=0;j<6;j++){const a=(Math.PI/3)*j-Math.PI/6; j===0?hole.moveTo(i*Math.cos(a),i*Math.sin(a)):hole.lineTo(i*Math.cos(a),i*Math.sin(a));}
  hole.closePath(); shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape,1);
}
function makeSolidHex(r) {
  const s=new THREE.Shape();
  for(let i=0;i<6;i++){const a=(Math.PI/3)*i-Math.PI/6; i===0?s.moveTo(r*Math.cos(a),r*Math.sin(a)):s.lineTo(r*Math.cos(a),r*Math.sin(a));}
  s.closePath(); return new THREE.ShapeGeometry(s,1);
}

const hexRingGeo=makeHexRing(0.46,0.36), hexRingThin=makeHexRing(0.46,0.42), hexSolidGeo=makeSolidHex(0.07);

const COLS=11,ROWS=8,HS=0.5,HW=HS*Math.sqrt(3),HH=HS*2,TW=COLS*HW,TH=ROWS*HH*0.75;
const masterGroup=new THREE.Group(); scene.add(masterGroup);
const zones=[0,1,2,3].map(()=>new THREE.Group()); zones.forEach(z=>masterGroup.add(z));
const zonePhase=zones.map((_,i)=>(Math.PI/2)*i);
const zoneAmpX=[0.16,0.10,0.20,0.12], zoneAmpY=[0.08,0.18,0.06,0.16], zoneSpd=[0.25,0.20,0.32,0.17];
const hexData=[], buildQueue=[];

for(let row=0;row<ROWS;row++) for(let col=0;col<COLS;col++){
  const bx=col*HW+(row%2)*HW*.5-TW/2, by=row*HH*.75-TH/2;
  const zone=(Math.floor(col/3)+Math.floor(row/2))%4, phase=Math.random()*Math.PI*2, seed=Math.random();
  const isEdge=col===0||col===COLS-1||row===0||row===ROWS-1, startBuilt=!isEdge||Math.random()>.5;
  const mat=new THREE.MeshBasicMaterial({color:CH.clone(),transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(startBuilt?hexRingGeo:hexRingThin,mat); mesh.position.set(bx,by,0);
  zones[zone].add(mesh);
  const hd={mesh,bx,by,zone,phase,seed,baseOp:startBuilt?(0.13+Math.random()*0.09):0,dx:0,dy:0,vx:0,vy:0,built:startBuilt,buildProgress:startBuilt?1:0,buildStartTime:null,buildDuration:4+Math.random()*3,workerBeeIdx:-1};
  hexData.push(hd); if(!startBuilt) buildQueue.push(hd);
}
buildQueue.sort(()=>Math.random()-.5);
const activeBuilds=[];

const pollenGroup=new THREE.Group(); scene.add(pollenGroup);
const pollenData=[];
for(let i=0;i<22;i++){
  const geo=Math.random()>.55?hexSolidGeo:makeHexRing(0.06,0.042);
  const c=Math.random(), matColor=c<.5?GOLD.clone():c<.8?AMBER.clone():HONEY.clone();
  const mat=new THREE.MeshBasicMaterial({color:matColor,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
  const mesh=new THREE.Mesh(geo,mat);
  const freqX=.11+Math.random()*.19, freqY=freqX*(1.3+Math.random()*.8);
  const ampX=1.8+Math.random()*3.5, ampY=1.2+Math.random()*2.8;
  const phaseX=Math.random()*Math.PI*2, phaseY=Math.random()*Math.PI*2, seed=Math.random()*20;
  mesh.position.set(Math.sin(phaseX)*ampX,Math.sin(phaseY)*ampY,-1.2+Math.random()*2.4);
  mesh.rotation.z=Math.random()*Math.PI*2; pollenGroup.add(mesh);
  pollenData.push({mesh,freqX,freqY,ampX,ampY,phaseX,phaseY,seed,zBase:mesh.position.z,zFreq:.07+Math.random()*.12,zAmp:.15+Math.random()*.4,wanderAmpX:.3+Math.random()*.5,wanderAmpY:.2+Math.random()*.4,wanderFreq:.04+Math.random()*.06,baseOp:.35+Math.random()*.45,rotSpd:(Math.random()-.5)*.022,glowFreq:.8+Math.random()*1.4});
}

function makeBee(){
  const g=new THREE.Group();
  const bGeo=new THREE.SphereGeometry(.08,10,6); bGeo.scale(1.1,.58,.58);
  const body=new THREE.Mesh(bGeo,new THREE.MeshBasicMaterial({color:AMBER,transparent:true,opacity:0})); g.add(body);
  const sGeo=new THREE.TorusGeometry(.052,.013,4,12);
  [-.032,.012,.038].forEach((x,i)=>{const m=new THREE.Mesh(sGeo,new THREE.MeshBasicMaterial({color:i%2===0?0x111111:AMBER,transparent:true,opacity:0})); m.position.x=x; m.rotation.y=Math.PI/2; m.scale.set(.65,1,.52); g.add(m);});
  const ws=new THREE.Shape(); ws.ellipse(0,0,.105,.058,0,Math.PI*2,false,0); const wGL=new THREE.ShapeGeometry(ws,10);
  const ws2=new THREE.Shape(); ws2.ellipse(0,0,.08,.044,0,Math.PI*2,false,0); const wGS=new THREE.ShapeGeometry(ws2,10);
  const wm=()=>new THREE.MeshBasicMaterial({color:0xD4F53C,transparent:true,opacity:0,side:THREE.DoubleSide});
  const wFL=new THREE.Mesh(wGL,wm()); wFL.position.set(-.01,.09,.03); wFL.rotation.x=.25;
  const wFR=new THREE.Mesh(wGL,wm()); wFR.position.set(-.01,-.09,.03); wFR.rotation.x=-.25;
  const wHL=new THREE.Mesh(wGS,wm()); wHL.position.set(.04,.075,.02); wHL.rotation.x=.2;
  const wHR=new THREE.Mesh(wGS,wm()); wHR.position.set(.04,-.075,.02); wHR.rotation.x=-.2;
  g.add(wFL,wFR,wHL,wHR);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(.042,8,6),new THREE.MeshBasicMaterial({color:0x1a1000,transparent:true,opacity:0})); hd.position.set(-.12,0,0); g.add(hd);
  return {group:g,body,wFL,wFR,wHL,wHR,head:hd};
}

const beeGroup=new THREE.Group(); scene.add(beeGroup);
const beeData=[], NUM_BEES=18;
const ARCHETYPES=['orbiter','orbiter','orbiter','orbiter','wanderer','wanderer','wanderer','wanderer','worker','worker','worker','worker','worker','forager','forager','forager','forager','forager'];

for(let i=0;i<NUM_BEES;i++){
  const bee=makeBee(); beeGroup.add(bee.group);
  const arch=ARCHETYPES[i], seed=i*.37+Math.random();
  const sa=(Math.PI*2/NUM_BEES)*i+Math.random()*.5, sr=2.5+Math.random()*3.5;
  bee.group.position.set(Math.cos(sa)*sr,Math.sin(sa)*sr*.65,-.8+Math.random()*1.6);
  beeData.push({...bee,archetype:arch,seed,angle:sa,orbitR:2.5+Math.random()*3,orbitEllX:1+Math.random()*.4,orbitEllY:.55+Math.random()*.3,orbitSpd:(0.06+Math.random()*.08)*(Math.random()>.5?1:-1),orbitDriftF:.03+Math.random()*.04,orbitDriftA:.4+Math.random()*.6,wandFreqX:.08+Math.random()*.14,wandFreqY:.11+Math.random()*.17,wandFreqZ:.05+Math.random()*.09,wandAmpX:2+Math.random()*2.5,wandAmpY:1.2+Math.random()*1.8,wandAmpZ:.3+Math.random()*.5,wandPhaseX:Math.random()*Math.PI*2,wandPhaseY:Math.random()*Math.PI*2,wandPhaseZ:Math.random()*Math.PI*2,workerHexIdx:-1,workerHoverT:Math.random()*Math.PI*2,foragerTarget:Math.floor(Math.random()*22),foragerPhase:'fly',foragerT:0,bobPhase:Math.random()*Math.PI*2,bobAmp:.04+Math.random()*.08,bobSpd:2.5+Math.random()*2.5,wingPhase:Math.random()*Math.PI*2,wingSpd:14+Math.random()*8,baseOp:.55+Math.random()*.4,px:bee.group.position.x,py:bee.group.position.y,prevX:bee.group.position.x,prevY:bee.group.position.y});
}
(function assignWorkers(){const b=hexData.filter(h=>h.built);beeData.filter(b=>b.archetype==='worker').forEach(b=>{const c=b[Math.floor(Math.random()*b.length)];if(c)b.workerHexIdx=hexData.indexOf(c);});})();

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
  minDuration: 4.6,   // seconds — slowed for artistry
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
  intro.progress += Math.random() * 0.08;
  if (intro.progress >= 1) intro.progress = 1;
}, 110);

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


// About page scene states — hex colour shifts per section
const SECTION_ACCENTS = [
  new THREE.Color(0x002D72),    // 0 hero — JP Morgan Navy
  new THREE.Color(0xC9A84C),    // 1 brief — Event Gold
  new THREE.Color(0x002D72),    // 2 programme — Navy
  new THREE.Color(0xC9A84C),    // 3 identity — Gold
  new THREE.Color(0x002D72),    // 4 results — Navy
  new THREE.Color(0xC9A84C),    // 5 download/closer — Gold
];

const STATES = [
  {hexOp:.14,pollenOp:.65,beeOp:.78,hexSc:1.0, hexRot:[0,0,0],       gz:0,   pSpr:1,   bR:1.0},   // hero
  {hexOp:.09,pollenOp:.45,beeOp:.60,hexSc:1.1, hexRot:[.12,-.1,0],   gz:-.5, pSpr:1.1, bR:1.1},   // conviction
  {hexOp:.20,pollenOp:.75,beeOp:.88,hexSc:.92, hexRot:[-.1,.15,0],   gz:.3,  pSpr:.88, bR:.9},    // numbers
  {hexOp:.16,pollenOp:.68,beeOp:.82,hexSc:.96, hexRot:[.08,-.08,0],  gz:.1,  pSpr:.94, bR:.96},   // hive
  {hexOp:.10,pollenOp:.50,beeOp:.65,hexSc:1.05,hexRot:[-.08,.1,0],   gz:-.2, pSpr:1.06,bR:1.03},  // founder
  {hexOp:.26,pollenOp:.88,beeOp:.96,hexSc:.94, hexRot:[-.05,-.05,0], gz:.5,  pSpr:.85, bR:.88},   // closer
];

let curS={...STATES[0]}, tgtS={...STATES[0]};
let activeAccent=CH.clone(), targetAccent=CH.clone();

function setScene(i){
  if(i<0||i>=STATES.length) return;
  tgtS={...STATES[i]};
  targetAccent=SECTION_ACCENTS[i].clone();
}

function lerpS(a,b,t){
  return {hexOp:a.hexOp+(b.hexOp-a.hexOp)*t,pollenOp:a.pollenOp+(b.pollenOp-a.pollenOp)*t,beeOp:a.beeOp+(b.beeOp-a.beeOp)*t,hexSc:a.hexSc+(b.hexSc-a.hexSc)*t,gz:a.gz+(b.gz-a.gz)*t,pSpr:a.pSpr+(b.pSpr-a.pSpr)*t,bR:a.bR+(b.bR-a.bR)*t,hexRot:[a.hexRot[0]+(b.hexRot[0]-a.hexRot[0])*t,a.hexRot[1]+(b.hexRot[1]-a.hexRot[1])*t,a.hexRot[2]+(b.hexRot[2]-a.hexRot[2])*t]};
}

const SK=.018,SD=.72,RD=1.8,AD=3.8,RS=.55,AS=.18;
const BI=6; let lBS=0; const MA=3;

function tickConstruction(t){
  if(buildQueue.length>0&&activeBuilds.length<MA&&t-lBS>BI){
    const cell=buildQueue.shift(); cell.buildStartTime=t; cell.buildProgress=0; cell.built=false;
    const fw=beeData.filter(b=>b.archetype==='worker').find(b=>b.workerHexIdx===-1)||beeData.filter(b=>b.archetype==='worker')[0];
    if(fw){fw.workerHexIdx=hexData.indexOf(cell);cell.workerBeeIdx=beeData.indexOf(fw);}
    activeBuilds.push(cell); lBS=t; cell.mesh.geometry=hexRingThin;
  }
  for(let i=activeBuilds.length-1;i>=0;i--){
    const cell=activeBuilds[i];
    cell.buildProgress=Math.min((t-cell.buildStartTime)/cell.buildDuration,1);
    if(cell.buildProgress>=1){
      cell.built=true; cell.mesh.geometry=hexRingGeo; cell.baseOp=.13+Math.random()*.09;
      if(cell.workerBeeIdx>=0){beeData[cell.workerBeeIdx].workerHexIdx=-1;cell.workerBeeIdx=-1;}
      setTimeout(()=>{cell.built=false;cell.buildProgress=0;cell.baseOp=0;cell.mesh.geometry=hexRingThin;buildQueue.push(cell);},(25000+Math.random()*20000));
      activeBuilds.splice(i,1);
    }
  }
}

function render(){
  requestAnimationFrame(render);
  const t=clock.getElapsedTime();
  smMouse.x+=(rawMouse.x-smMouse.x)*.04; smMouse.y+=(rawMouse.y-smMouse.y)*.04;
  raycaster.setFromCamera(rawMouse,camera); raycaster.ray.intersectPlane(zPlane,targetWorld);
  worldMouse.x+=(targetWorld.x-worldMouse.x)*.03; worldMouse.y+=(targetWorld.y-worldMouse.y)*.03;

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
    const hd = 1.5; // handoff duration (seconds)
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

  curS=lerpS(curS,tgtS,.02);
  activeAccent.r+=(targetAccent.r-activeAccent.r)*.015;
  activeAccent.g+=(targetAccent.g-activeAccent.g)*.015;
  activeAccent.b+=(targetAccent.b-activeAccent.b)*.015;
  masterGroup.rotation.x=curS.hexRot[0]+smMouse.y*.1; masterGroup.rotation.y=curS.hexRot[1]+smMouse.x*.1;
  masterGroup.rotation.z=curS.hexRot[2]; masterGroup.position.z=curS.gz; masterGroup.scale.setScalar(curS.hexSc);
  zones.forEach((zone,zi)=>{const ph=zonePhase[zi]+t*zoneSpd[zi];zone.position.x=Math.sin(ph)*zoneAmpX[zi];zone.position.y=Math.cos(ph*.7)*zoneAmpY[zi];zone.rotation.z=Math.sin(ph*.4)*.035;});
  tickConstruction(t);
  hexData.forEach(h=>{
    const wx=h.bx*curS.hexSc,wy=h.by*curS.hexSc,mdx=worldMouse.x-wx,mdy=worldMouse.y-wy,dist=Math.sqrt(mdx*mdx+mdy*mdy);
    let tdx=0,tdy=0;
    if(dist<RD&&dist>.001){const s=RS*(1-dist/RD);tdx=-(mdx/dist)*s;tdy=-(mdy/dist)*s;}
    else if(dist<AD&&dist>RD){const t2=(dist-RD)/(AD-RD);const s=AS*(1-t2)*Math.sin(t2*Math.PI);tdx=(mdx/dist)*s;tdy=(mdy/dist)*s;}
    const fx=SK*(tdx-h.dx)-(1-SD)*h.vx; const fy=SK*(tdy-h.dy)-(1-SD)*h.vy;
    h.vx=(h.vx+fx)*SD; h.vy=(h.vy+fy)*SD; h.dx+=h.vx; h.dy+=h.vy;
    h.mesh.position.x=h.bx+h.dx; h.mesh.position.y=h.by+h.dy;
    h.mesh.position.z=Math.sin(t*.85+h.phase)*.055;
    h.mesh.material.color.copy(activeAccent);
    let op;
    if(!h.built&&h.buildProgress<1&&h.buildStartTime!==null){op=curS.hexOp*h.buildProgress*(0.5+0.5*Math.sin(t*8.3+h.phase))*.7;}
    else if(h.built){op=curS.hexOp*(.52+.48*(0.5+0.5*Math.sin(t*.65+h.phase)));}
    else op=0;
    h.mesh.material.opacity+=(op*sceneIntroMult-h.mesh.material.opacity)*.08;
    h.mesh.scale.setScalar(1+.032*Math.sin(t*1.05+h.phase));
  });
  pollenData.forEach(p=>{
    p.mesh.position.x=Math.sin(t*p.freqX+p.phaseX)*p.ampX*curS.pSpr+noise1(t*p.wanderFreq,p.seed)*p.wanderAmpX;
    p.mesh.position.y=Math.sin(t*p.freqY+p.phaseY)*p.ampY*curS.pSpr+noise1(t*p.wanderFreq,p.seed+10)*p.wanderAmpY;
    p.mesh.position.z=p.zBase+Math.sin(t*p.zFreq)*p.zAmp; p.mesh.rotation.z+=p.rotSpd;
    p.mesh.material.opacity=curS.pollenOp*p.baseOp*(0.55+0.45*Math.sin(t*p.glowFreq+p.seed))*sceneIntroMult;
  });
  beeData.forEach(b=>{
    const bR=curS.bR; let nx=b.px,ny=b.py;
    if(b.archetype==='orbiter'){b.angle+=b.orbitSpd*.016;const rD=b.orbitR*bR+noise1(t*b.orbitDriftF,b.seed)*b.orbitDriftA;nx=Math.cos(b.angle)*rD*b.orbitEllX+smMouse.x*.06+noise1(t*.19,b.seed+5)*.4;ny=Math.sin(b.angle)*rD*b.orbitEllY+smMouse.y*.04+noise1(t*.23,b.seed+8)*.3;}
    else if(b.archetype==='wanderer'){nx=Math.sin(t*b.wandFreqX+b.wandPhaseX)*b.wandAmpX*bR+smMouse.x*.05;ny=Math.sin(t*b.wandFreqY+b.wandPhaseY)*b.wandAmpY*bR+smMouse.y*.04;b.group.position.z=Math.sin(t*b.wandFreqZ+b.wandPhaseZ)*b.wandAmpZ;}
    else if(b.archetype==='worker'){
      if(b.workerHexIdx>=0&&b.workerHexIdx<hexData.length){const cell=hexData[b.workerHexIdx];const ha=t*1.8+b.workerHoverT,hr=.18+.06*Math.sin(t*3.1+b.workerHoverT);nx=cell.bx*curS.hexSc+Math.cos(ha)*hr+noise1(t*.9,b.seed)*.08;ny=cell.by*curS.hexSc+Math.sin(ha)*hr+noise1(t*1.1,b.seed+3)*.06;b.group.position.z=.2+Math.sin(t*2.4+b.workerHoverT)*.08;}
      else{nx=noise1(t*.12,b.seed)*3*bR;ny=noise1(t*.15,b.seed+7)*2*bR;}
    }else{
      const ptgt=pollenData[b.foragerTarget%22];const tx=ptgt.mesh.position.x,ty=ptgt.mesh.position.y;
      b.foragerT+=.004;if(b.foragerT>1){b.foragerT=0;b.foragerPhase=b.foragerPhase==='fly'?'collect':b.foragerPhase==='collect'?'return':'fly';if(b.foragerPhase==='fly')b.foragerTarget=Math.floor(Math.random()*22);}
      if(b.foragerPhase==='fly'){const e=b.foragerT*b.foragerT*(3-2*b.foragerT);nx=b.px+(tx-b.px)*e*.02+noise1(t*.4,b.seed)*.25;ny=b.py+(ty-b.py)*e*.02+noise1(t*.5,b.seed+2)*.2;}
      else if(b.foragerPhase==='collect'){nx=tx+noise1(t*1.4,b.seed)*.12;ny=ty+noise1(t*1.6,b.seed+4)*.10;}
      else{nx=b.px*(1-b.foragerT*.015)+noise1(t*.3,b.seed+1)*.3;ny=b.py*(1-b.foragerT*.015)+noise1(t*.4,b.seed+5)*.25;}
    }
    ny+=Math.sin(t*b.bobSpd+b.bobPhase)*b.bobAmp;
    const LAG=b.archetype==='worker'?.12:.07; b.px+=(nx-b.px)*LAG; b.py+=(ny-b.py)*LAG;
    b.group.position.x=b.px; b.group.position.y=b.py;
    const ddx=b.px-b.prevX,ddy=b.py-b.prevY;
    if(Math.abs(ddx)+Math.abs(ddy)>.0001){const ta=Math.atan2(ddy,ddx);b.group.rotation.z+=(ta-b.group.rotation.z)*.12;}
    b.prevX=b.px; b.prevY=b.py;
    const flap=Math.sin(t*b.wingSpd+b.wingPhase)*.38;
    b.wFL.rotation.x=.25+flap;b.wFR.rotation.x=-.25-flap;b.wHL.rotation.x=.20+flap*.7;b.wHR.rotation.x=-.20-flap*.7;
    let opM=1;if(b.archetype==='worker'&&b.workerHexIdx>=0&&!hexData[b.workerHexIdx].built)opM=1.3;
    let introMult=1.0;
    if(intro.active){ if(intro.handoffStart!==null){ const ht=clock.getElapsedTime()-intro.handoffStart; introMult=Math.min(ht/1.5,1); } else { introMult=0; } }
    const op=curS.beeOp*b.baseOp*opM*introMult;
    b.group.children.forEach((child,ci)=>{if(child.material)child.material.opacity=op*(ci===0?1:ci<=3?.85:ci<=5?.70:ci<=7?.55:.80);});
  });
  camera.position.x=smMouse.x*.12; camera.position.y=smMouse.y*.08; camera.lookAt(scene.position);
  renderer.render(scene,camera);
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
window.addEventListener('resize',()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});

// ═══════════════════════════════════════════════════════════════
// PAGE INIT
// ═══════════════════════════════════════════════════════════════
window.onLoaderComplete = function() {
  gsap.registerPlugin(ScrollTrigger);

  // ── Hero ─────────────────────────────────────────────────────
  const tl = gsap.timeline();
  tl.to('#jpmKicker',  { opacity:1, y:0, duration:1.0, ease:'power3.out' }, .4)
    .to('#jpmTitle',   { opacity:1, y:0, duration:1.6, ease:'power4.out' }, .7)
    .to('#jpmSub',     { opacity:1, y:0, duration:1.2, ease:'power3.out' }, 1.2)
    .to('#jpmSpecs',   { opacity:1, y:0, duration:1.2, ease:'power3.out' }, 1.6);

  // ── Generic reveals ───────────────────────────────────────────
  gsap.utils.toArray('.reveal').forEach(el => {
    ScrollTrigger.create({
      trigger:el, start:'top 87%', once:true,
      onEnter:() => gsap.to(el, { opacity:1, y:0, duration:1.2, ease:'power3.out' })
    });
  });
  gsap.utils.toArray('.reveal-l').forEach(el => {
    ScrollTrigger.create({
      trigger:el, start:'top 85%', once:true,
      onEnter:() => gsap.to(el, { opacity:1, x:0, duration:1.4, ease:'power3.out' })
    });
  });
  gsap.utils.toArray('.reveal-r').forEach(el => {
    ScrollTrigger.create({
      trigger:el, start:'top 85%', once:true,
      onEnter:() => gsap.to(el, { opacity:1, x:0, duration:1.4, ease:'power3.out' })
    });
  });
  gsap.utils.toArray('.reveal-s').forEach(el => {
    ScrollTrigger.create({
      trigger:el, start:'top 85%', once:true,
      onEnter:() => gsap.to(el, { opacity:1, scale:1, duration:1.4, ease:'power3.out' })
    });
  });

  // ── Scene accents ─────────────────────────────────────────────
  const sects = [
    ['.jpm-hero',0],['.jpm-brief',1],
    ['section.jpm-section:nth-of-type(3)',2],
    ['.jpm-identity',3],['.jpm-results',4],
    ['.jpm-download',5],['.jpm-closer',5],
  ];
  sects.forEach(([sel,si]) => {
    const el = document.querySelector(sel);
    if (!el) return;
    ScrollTrigger.create({
      trigger:el, start:'top 55%',
      onEnter:()=>setScene(si), onEnterBack:()=>setScene(si)
    });
  });
};