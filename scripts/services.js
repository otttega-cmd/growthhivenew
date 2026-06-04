/* ================================================================
   Growthhive — Services Page Script
   services.js
   Depends on: shared.css, shared.js, three.js, gsap, ScrollTrigger
   Work. Play. Grow. 🐝
================================================================ */

// ═══════════════════════════════════════════════════════════════
// THREE.JS — Full colony scene, consistent with index + work
// ═══════════════════════════════════════════════════════════════

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
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

// ── Pseudo-noise ──────────────────────────────────────────────
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
  hole.closePath(); shape.holes.push(hole);
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
const hexRingThin = makeHexRing(0.46, 0.42);
const hexSolidGeo = makeSolidHex(0.07);

// ── Honeycomb grid ────────────────────────────────────────────
const COLS = 11, ROWS = 8, HS = 0.5;
const HW = HS * Math.sqrt(3), HH = HS * 2;
const TW = COLS * HW, TH = ROWS * HH * 0.75;

const masterGroup = new THREE.Group(); scene.add(masterGroup);
const zones = [0,1,2,3].map(() => new THREE.Group());
zones.forEach(z => masterGroup.add(z));

const zonePhase = zones.map((_, i) => (Math.PI / 2) * i);
const zoneAmpX  = [0.16, 0.10, 0.20, 0.12];
const zoneAmpY  = [0.08, 0.18, 0.06, 0.16];
const zoneSpd   = [0.25, 0.20, 0.32, 0.17];

const hexData = [], buildQueue = [];

for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const bx   = col * HW + (row % 2) * HW * 0.5 - TW / 2;
    const by   = row * HH * 0.75 - TH / 2;
    const zone = (Math.floor(col / 3) + Math.floor(row / 2)) % 4;
    const phase = Math.random() * Math.PI * 2;
    const seed  = Math.random();
    const isEdge = col === 0 || col === COLS-1 || row === 0 || row === ROWS-1;
    const startBuilt = !isEdge || Math.random() > 0.5;
    const mat = new THREE.MeshBasicMaterial({ color: CH.clone(), transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(startBuilt ? hexRingGeo : hexRingThin, mat);
    mesh.position.set(bx, by, 0);
    zones[zone].add(mesh);
    const hd = { mesh, bx, by, zone, phase, seed, baseOp: startBuilt ? (0.13 + Math.random() * 0.09) : 0.0, dx:0,dy:0,vx:0,vy:0, built:startBuilt, buildProgress:startBuilt?1.0:0.0, buildStartTime:null, buildDuration:4.0+Math.random()*3.0, workerBeeIdx:-1 };
    hexData.push(hd);
    if (!startBuilt) buildQueue.push(hd);
  }
}
buildQueue.sort(() => Math.random() - 0.5);
const activeBuilds = [];

// ── Pollen ────────────────────────────────────────────────────
const pollenGroup = new THREE.Group(); scene.add(pollenGroup);
const pollenData = [];
for (let i = 0; i < 22; i++) {
  const geo = Math.random() > 0.55 ? hexSolidGeo : makeHexRing(0.06, 0.042);
  const col = Math.random();
  const mat = new THREE.MeshBasicMaterial({ color: col < 0.5 ? GOLD.clone() : col < 0.8 ? AMBER.clone() : HONEY.clone(), transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  const freqX = 0.11 + Math.random() * 0.19, freqY = freqX * (1.3 + Math.random() * 0.8);
  const ampX = 1.8 + Math.random() * 3.5, ampY = 1.2 + Math.random() * 2.8;
  const phaseX = Math.random() * Math.PI * 2, phaseY = Math.random() * Math.PI * 2;
  const seed = Math.random() * 20;
  mesh.position.set(Math.sin(phaseX)*ampX, Math.sin(phaseY)*ampY, -1.2+Math.random()*2.4);
  mesh.rotation.z = Math.random() * Math.PI * 2;
  pollenGroup.add(mesh);
  pollenData.push({ mesh, freqX, freqY, ampX, ampY, phaseX, phaseY, seed, zBase:mesh.position.z, zFreq:0.07+Math.random()*0.12, zAmp:0.15+Math.random()*0.4, wanderAmpX:0.3+Math.random()*0.5, wanderAmpY:0.2+Math.random()*0.4, wanderFreq:0.04+Math.random()*0.06, baseOp:0.35+Math.random()*0.45, rotSpd:(Math.random()-0.5)*0.022, glowFreq:0.8+Math.random()*1.4 });
}

// ── Bees ──────────────────────────────────────────────────────
function makeBee() {
  const g = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.08,10,6); bodyGeo.scale(1.1,0.58,0.58);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshBasicMaterial({color:AMBER,transparent:true,opacity:0})); g.add(body);
  const sGeo = new THREE.TorusGeometry(0.052,0.013,4,12);
  [-0.032,0.012,0.038].forEach((x,i)=>{ const m=new THREE.Mesh(sGeo,new THREE.MeshBasicMaterial({color:i%2===0?0x111111:AMBER,transparent:true,opacity:0})); m.position.x=x; m.rotation.y=Math.PI/2; m.scale.set(0.65,1,0.52); g.add(m); });
  const ws=new THREE.Shape(); ws.ellipse(0,0,0.105,0.058,0,Math.PI*2,false,0); const wGL=new THREE.ShapeGeometry(ws,10);
  const ws2=new THREE.Shape(); ws2.ellipse(0,0,0.08,0.044,0,Math.PI*2,false,0); const wGS=new THREE.ShapeGeometry(ws2,10);
  const wm=()=>new THREE.MeshBasicMaterial({color:0xD4F53C,transparent:true,opacity:0,side:THREE.DoubleSide});
  const wFL=new THREE.Mesh(wGL,wm()); wFL.position.set(-0.01,0.09,0.03); wFL.rotation.x=0.25;
  const wFR=new THREE.Mesh(wGL,wm()); wFR.position.set(-0.01,-0.09,0.03); wFR.rotation.x=-0.25;
  const wHL=new THREE.Mesh(wGS,wm()); wHL.position.set(0.04,0.075,0.02); wHL.rotation.x=0.2;
  const wHR=new THREE.Mesh(wGS,wm()); wHR.position.set(0.04,-0.075,0.02); wHR.rotation.x=-0.2;
  g.add(wFL,wFR,wHL,wHR);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(0.042,8,6),new THREE.MeshBasicMaterial({color:0x1a1000,transparent:true,opacity:0})); hd.position.set(-0.12,0,0); g.add(hd);
  return {group:g,body,wFL,wFR,wHL,wHR,head:hd};
}

const beeGroup = new THREE.Group(); scene.add(beeGroup);
const beeData  = [];
const NUM_BEES = 18;
const ARCHETYPES = ['orbiter','orbiter','orbiter','orbiter','wanderer','wanderer','wanderer','wanderer','worker','worker','worker','worker','worker','forager','forager','forager','forager','forager'];

for (let i = 0; i < NUM_BEES; i++) {
  const bee = makeBee(); beeGroup.add(bee.group);
  const archetype = ARCHETYPES[i], seed = i * 0.37 + Math.random();
  const sa = (Math.PI*2/NUM_BEES)*i+Math.random()*0.5, sr = 2.5+Math.random()*3.5;
  bee.group.position.set(Math.cos(sa)*sr, Math.sin(sa)*sr*0.65, -0.8+Math.random()*1.6);
  beeData.push({ ...bee, archetype, seed, angle:sa, orbitR:2.5+Math.random()*3.0, orbitEllX:1.0+Math.random()*0.4, orbitEllY:0.55+Math.random()*0.3, orbitSpd:(0.06+Math.random()*0.08)*(Math.random()>0.5?1:-1), orbitDriftF:0.03+Math.random()*0.04, orbitDriftA:0.4+Math.random()*0.6, wandFreqX:0.08+Math.random()*0.14, wandFreqY:0.11+Math.random()*0.17, wandFreqZ:0.05+Math.random()*0.09, wandAmpX:2.0+Math.random()*2.5, wandAmpY:1.2+Math.random()*1.8, wandAmpZ:0.3+Math.random()*0.5, wandPhaseX:Math.random()*Math.PI*2, wandPhaseY:Math.random()*Math.PI*2, wandPhaseZ:Math.random()*Math.PI*2, workerHexIdx:-1, workerHoverT:Math.random()*Math.PI*2, foragerTarget:Math.floor(Math.random()*22), foragerPhase:'fly', foragerT:0, bobPhase:Math.random()*Math.PI*2, bobAmp:0.04+Math.random()*0.08, bobSpd:2.5+Math.random()*2.5, wingPhase:Math.random()*Math.PI*2, wingSpd:14+Math.random()*8, baseOp:0.55+Math.random()*0.4, px:bee.group.position.x, py:bee.group.position.y, prevX:bee.group.position.x, prevY:bee.group.position.y });
}
(function assignWorkers() {
  const built = hexData.filter(h=>h.built);
  beeData.filter(b=>b.archetype==='worker').forEach(b=>{ const c=built[Math.floor(Math.random()*built.length)]; if(c) b.workerHexIdx=hexData.indexOf(c); });
})();

// ── Scene states — per service accent colour ──────────────────
const SVC_ACCENTS = [
  new THREE.Color(0x5BB8F5), // Brand Strategy
  new THREE.Color(0xC77DFF), // PR & Comms
  new THREE.Color(0xD4F53C), // Paid & Owned
  new THREE.Color(0xFF8C42), // Creative
  new THREE.Color(0x52D68A), // Product Mktg
  new THREE.Color(0xFFD166), // GTM
  new THREE.Color(0x00E5CC), // Analytics
  new THREE.Color(0xFF6B9D), // Audience
  new THREE.Color(0xB5EAD7), // CX+UX
];

const STATES = [
  { hexOp:0.14, pollenOp:0.65, beeOp:0.78, hexSc:1.0,  hexRot:[0,0,0],         gz:0,    pSpr:1,    bR:1.0  }, // intro
  { hexOp:0.12, pollenOp:0.55, beeOp:0.72, hexSc:0.96, hexRot:[-0.08,0.12,0],  gz:0.15, pSpr:0.92, bR:0.95 }, // 0 brand
  { hexOp:0.10, pollenOp:0.50, beeOp:0.68, hexSc:1.04, hexRot:[0.1,-0.08,0],   gz:-0.2, pSpr:1.08, bR:1.02 }, // 1 PR
  { hexOp:0.20, pollenOp:0.78, beeOp:0.88, hexSc:0.92, hexRot:[-0.12,0.15,0],  gz:0.3,  pSpr:0.88, bR:0.9  }, // 2 paid
  { hexOp:0.16, pollenOp:0.68, beeOp:0.82, hexSc:0.98, hexRot:[0.06,-0.1,0],   gz:0.1,  pSpr:0.95, bR:0.97 }, // 3 creative
  { hexOp:0.14, pollenOp:0.62, beeOp:0.75, hexSc:1.02, hexRot:[-0.06,0.1,0],   gz:-0.1, pSpr:1.04, bR:1.01 }, // 4 product
  { hexOp:0.18, pollenOp:0.72, beeOp:0.85, hexSc:0.94, hexRot:[0.1,-0.14,0],   gz:0.25, pSpr:0.9,  bR:0.93 }, // 5 GTM
  { hexOp:0.22, pollenOp:0.80, beeOp:0.90, hexSc:0.9,  hexRot:[-0.1,0.1,0],    gz:0.4,  pSpr:0.86, bR:0.88 }, // 6 analytics
  { hexOp:0.12, pollenOp:0.58, beeOp:0.72, hexSc:1.06, hexRot:[0.08,-0.06,0],  gz:-0.15,pSpr:1.1,  bR:1.04 }, // 7 audience
  { hexOp:0.16, pollenOp:0.70, beeOp:0.83, hexSc:0.97, hexRot:[-0.05,0.08,0],  gz:0.18, pSpr:0.93, bR:0.96 }, // 8 CX+UX
  { hexOp:0.28, pollenOp:0.90, beeOp:1.0,  hexSc:0.95, hexRot:[0,0,0],         gz:0.5,  pSpr:0.85, bR:0.88 }, // outro
];

let curS = { ...STATES[0] }, tgtS = { ...STATES[0] };
let activeAccent = CH.clone(), targetAccent = CH.clone();

function setScene(i) {
  tgtS = { ...STATES[i] };
  targetAccent = (i >= 1 && i <= 9) ? SVC_ACCENTS[i-1].clone() : CH.clone();
}

function lerpS(a, b, t) {
  return { hexOp:a.hexOp+(b.hexOp-a.hexOp)*t, pollenOp:a.pollenOp+(b.pollenOp-a.pollenOp)*t, beeOp:a.beeOp+(b.beeOp-a.beeOp)*t, hexSc:a.hexSc+(b.hexSc-a.hexSc)*t, gz:a.gz+(b.gz-a.gz)*t, pSpr:a.pSpr+(b.pSpr-a.pSpr)*t, bR:a.bR+(b.bR-a.bR)*t, hexRot:[a.hexRot[0]+(b.hexRot[0]-a.hexRot[0])*t, a.hexRot[1]+(b.hexRot[1]-a.hexRot[1])*t, a.hexRot[2]+(b.hexRot[2]-a.hexRot[2])*t] };
}

const SPRING_K=0.018, SPRING_DAMP=0.72, REPEL_DIST=1.8, ATTRACT_DIST=3.8, REPEL_STR=0.55, ATTRACT_STR=0.18;
const BUILD_INTERVAL=6.0; let lastBuildStart=0; const MAX_ACTIVE=3;

function tickConstruction(t) {
  if (buildQueue.length>0&&activeBuilds.length<MAX_ACTIVE&&t-lastBuildStart>BUILD_INTERVAL) {
    const cell=buildQueue.shift(); cell.buildStartTime=t; cell.buildProgress=0; cell.built=false;
    const fw=beeData.filter(b=>b.archetype==='worker').find(b=>b.workerHexIdx===-1)||beeData.filter(b=>b.archetype==='worker')[0];
    if(fw){fw.workerHexIdx=hexData.indexOf(cell);cell.workerBeeIdx=beeData.indexOf(fw);}
    activeBuilds.push(cell); lastBuildStart=t; cell.mesh.geometry=hexRingThin;
  }
  for(let i=activeBuilds.length-1;i>=0;i--){
    const cell=activeBuilds[i];
    cell.buildProgress=Math.min((t-cell.buildStartTime)/cell.buildDuration,1.0);
    if(cell.buildProgress>=1.0){
      cell.built=true; cell.mesh.geometry=hexRingGeo; cell.baseOp=0.13+Math.random()*0.09;
      if(cell.workerBeeIdx>=0){beeData[cell.workerBeeIdx].workerHexIdx=-1;cell.workerBeeIdx=-1;}
      setTimeout(()=>{cell.built=false;cell.buildProgress=0;cell.baseOp=0.0;cell.mesh.geometry=hexRingThin;buildQueue.push(cell);},(25000+Math.random()*20000));
      activeBuilds.splice(i,1);
    }
  }
}

// ── Render loop ───────────────────────────────────────────────
function render() {
  requestAnimationFrame(render);
  const t = clock.getElapsedTime();
  smMouse.x+=(rawMouse.x-smMouse.x)*0.04; smMouse.y+=(rawMouse.y-smMouse.y)*0.04;
  raycaster.setFromCamera(rawMouse,camera); raycaster.ray.intersectPlane(zPlane,targetWorld);
  worldMouse.x+=(targetWorld.x-worldMouse.x)*0.03; worldMouse.y+=(targetWorld.y-worldMouse.y)*0.03;
  curS=lerpS(curS,tgtS,0.02);
  activeAccent.r+=(targetAccent.r-activeAccent.r)*0.015;
  activeAccent.g+=(targetAccent.g-activeAccent.g)*0.015;
  activeAccent.b+=(targetAccent.b-activeAccent.b)*0.015;
  masterGroup.rotation.x=curS.hexRot[0]+smMouse.y*0.1; masterGroup.rotation.y=curS.hexRot[1]+smMouse.x*0.1;
  masterGroup.rotation.z=curS.hexRot[2]; masterGroup.position.z=curS.gz; masterGroup.scale.setScalar(curS.hexSc);
  zones.forEach((zone,zi)=>{ const ph=zonePhase[zi]+t*zoneSpd[zi]; zone.position.x=Math.sin(ph)*zoneAmpX[zi]; zone.position.y=Math.cos(ph*0.7)*zoneAmpY[zi]; zone.rotation.z=Math.sin(ph*0.4)*0.035; });
  tickConstruction(t);

  hexData.forEach(h=>{
    const wx=h.bx*curS.hexSc, wy=h.by*curS.hexSc;
    const mdx=worldMouse.x-wx, mdy=worldMouse.y-wy, dist=Math.sqrt(mdx*mdx+mdy*mdy);
    let tdx=0,tdy=0;
    if(dist<REPEL_DIST&&dist>0.001){const s=REPEL_STR*(1-dist/REPEL_DIST);tdx=-(mdx/dist)*s;tdy=-(mdy/dist)*s;}
    else if(dist<ATTRACT_DIST&&dist>REPEL_DIST){const t2=(dist-REPEL_DIST)/(ATTRACT_DIST-REPEL_DIST);const s=ATTRACT_STR*(1-t2)*Math.sin(t2*Math.PI);tdx=(mdx/dist)*s;tdy=(mdy/dist)*s;}
    const fx=SPRING_K*(tdx-h.dx)-(1-SPRING_DAMP)*h.vx; const fy=SPRING_K*(tdy-h.dy)-(1-SPRING_DAMP)*h.vy;
    h.vx=(h.vx+fx)*SPRING_DAMP; h.vy=(h.vy+fy)*SPRING_DAMP; h.dx+=h.vx; h.dy+=h.vy;
    h.mesh.position.x=h.bx+h.dx; h.mesh.position.y=h.by+h.dy;
    h.mesh.position.z=Math.sin(t*0.85+h.phase)*0.055;
    h.mesh.material.color.copy(activeAccent);
    let op;
    if(!h.built&&h.buildProgress<1.0&&h.buildStartTime!==null){ const fl=0.5+0.5*Math.sin(t*8.3+h.phase); op=curS.hexOp*h.buildProgress*fl*0.7; }
    else if(h.built){ const wave=0.5+0.5*Math.sin(t*0.65+h.phase); op=curS.hexOp*(0.52+0.48*wave); }
    else op=0.0;
    h.mesh.material.opacity+=(op-h.mesh.material.opacity)*0.08;
    h.mesh.scale.setScalar(1+0.032*Math.sin(t*1.05+h.phase));
  });

  pollenData.forEach(p=>{
    const lx=Math.sin(t*p.freqX+p.phaseX)*p.ampX*curS.pSpr;
    const ly=Math.sin(t*p.freqY+p.phaseY)*p.ampY*curS.pSpr;
    p.mesh.position.x=lx+noise1(t*p.wanderFreq,p.seed)*p.wanderAmpX;
    p.mesh.position.y=ly+noise1(t*p.wanderFreq,p.seed+10)*p.wanderAmpY;
    p.mesh.position.z=p.zBase+Math.sin(t*p.zFreq)*p.zAmp;
    p.mesh.rotation.z+=p.rotSpd;
    p.mesh.material.opacity=curS.pollenOp*p.baseOp*(0.55+0.45*Math.sin(t*p.glowFreq+p.seed));
  });

  beeData.forEach(b=>{
    const bR=curS.bR; let nx=b.px, ny=b.py;
    if(b.archetype==='orbiter'){
      b.angle+=b.orbitSpd*0.016;
      const rD=b.orbitR*bR+noise1(t*b.orbitDriftF,b.seed)*b.orbitDriftA;
      nx=Math.cos(b.angle)*rD*b.orbitEllX+smMouse.x*0.06+noise1(t*0.19,b.seed+5)*0.4;
      ny=Math.sin(b.angle)*rD*b.orbitEllY+smMouse.y*0.04+noise1(t*0.23,b.seed+8)*0.3;
    } else if(b.archetype==='wanderer'){
      nx=Math.sin(t*b.wandFreqX+b.wandPhaseX)*b.wandAmpX*bR+smMouse.x*0.05;
      ny=Math.sin(t*b.wandFreqY+b.wandPhaseY)*b.wandAmpY*bR+smMouse.y*0.04;
      b.group.position.z=Math.sin(t*b.wandFreqZ+b.wandPhaseZ)*b.wandAmpZ;
    } else if(b.archetype==='worker'){
      if(b.workerHexIdx>=0&&b.workerHexIdx<hexData.length){
        const cell=hexData[b.workerHexIdx];
        const ha=t*1.8+b.workerHoverT, hr=0.18+0.06*Math.sin(t*3.1+b.workerHoverT);
        nx=cell.bx*curS.hexSc+Math.cos(ha)*hr+noise1(t*0.9,b.seed)*0.08;
        ny=cell.by*curS.hexSc+Math.sin(ha)*hr+noise1(t*1.1,b.seed+3)*0.06;
        b.group.position.z=0.2+Math.sin(t*2.4+b.workerHoverT)*0.08;
      } else { nx=noise1(t*0.12,b.seed)*3.0*bR; ny=noise1(t*0.15,b.seed+7)*2.0*bR; }
    } else {
      const ptgt=pollenData[b.foragerTarget%22]; const tx=ptgt.mesh.position.x, ty=ptgt.mesh.position.y;
      b.foragerT+=0.004; if(b.foragerT>1.0){b.foragerT=0;b.foragerPhase=b.foragerPhase==='fly'?'collect':b.foragerPhase==='collect'?'return':'fly';if(b.foragerPhase==='fly')b.foragerTarget=Math.floor(Math.random()*22);}
      if(b.foragerPhase==='fly'){const e=b.foragerT*b.foragerT*(3-2*b.foragerT);nx=b.px+(tx-b.px)*e*0.02+noise1(t*0.4,b.seed)*0.25;ny=b.py+(ty-b.py)*e*0.02+noise1(t*0.5,b.seed+2)*0.2;}
      else if(b.foragerPhase==='collect'){nx=tx+noise1(t*1.4,b.seed)*0.12;ny=ty+noise1(t*1.6,b.seed+4)*0.10;}
      else{nx=b.px*(1-b.foragerT*0.015)+noise1(t*0.3,b.seed+1)*0.3;ny=b.py*(1-b.foragerT*0.015)+noise1(t*0.4,b.seed+5)*0.25;}
    }
    ny+=Math.sin(t*b.bobSpd+b.bobPhase)*b.bobAmp;
    const LAG=b.archetype==='worker'?0.12:0.07;
    b.px+=(nx-b.px)*LAG; b.py+=(ny-b.py)*LAG;
    b.group.position.x=b.px; b.group.position.y=b.py;
    const ddx=b.px-b.prevX, ddy=b.py-b.prevY;
    if(Math.abs(ddx)+Math.abs(ddy)>0.0001){ const ta=Math.atan2(ddy,ddx); b.group.rotation.z+=(ta-b.group.rotation.z)*0.12; }
    b.prevX=b.px; b.prevY=b.py;
    const flap=Math.sin(t*b.wingSpd+b.wingPhase)*0.38;
    b.wFL.rotation.x=0.25+flap; b.wFR.rotation.x=-0.25-flap;
    b.wHL.rotation.x=0.20+flap*0.7; b.wHR.rotation.x=-0.20-flap*0.7;
    let opMult=1.0; if(b.archetype==='worker'&&b.workerHexIdx>=0&&!hexData[b.workerHexIdx].built) opMult=1.3;
    const op=curS.beeOp*b.baseOp*opMult;
    b.group.children.forEach((child,ci)=>{ if(child.material) child.material.opacity=op*(ci===0?1.0:ci<=3?0.85:ci<=5?0.70:ci<=7?0.55:0.80); });
  });

  camera.position.x=smMouse.x*0.12; camera.position.y=smMouse.y*0.08; camera.lookAt(scene.position);
  renderer.render(scene,camera);
}
render();

window.addEventListener('resize',()=>{ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); });

// ═══════════════════════════════════════════════════════════════
// PAGE INIT — called by shared.js loader via onLoaderComplete
// ═══════════════════════════════════════════════════════════════
window.onLoaderComplete = function() {
  gsap.registerPlugin(ScrollTrigger);

  const PANELS = document.querySelectorAll('.svc-panel');
  const INDEX_ITEMS = document.querySelectorAll('.svc-index-item');

  function setActiveIndex(idx) {
    INDEX_ITEMS.forEach((item, i) => item.classList.toggle('active', i === idx));
  }

  // Intro reveals
  gsap.to('.svc-eyebrow span',   { y:0, duration:1,   ease:'power4.out', delay:0.1 });
  gsap.to('.svc-title .word',    { y:0, duration:1.3, ease:'power4.out', stagger:0.08, delay:0.2 });
  gsap.to('.svc-intro-desc span',{ y:0, duration:1,   ease:'power4.out', delay:0.45 });
  gsap.to('#svcCount',           { opacity:1, duration:1, delay:0.7 });

  // Hide scroll hint once past intro
  ScrollTrigger.create({
    trigger:'#svcIntro', start:'bottom 80%',
    onEnter:     () => document.getElementById('scrollHint').classList.add('hidden'),
    onLeaveBack: () => document.getElementById('scrollHint').classList.remove('hidden'),
  });

  // Each service panel
  PANELS.forEach((panel, i) => {
    ScrollTrigger.create({
      trigger: panel,
      start: 'top 55%', end: 'bottom 45%',
      onEnter:     () => { panel.classList.add('is-active');    setActiveIndex(i); setScene(i + 1); },
      onLeave:     () => { panel.classList.remove('is-active'); },
      onEnterBack: () => { panel.classList.add('is-active');    setActiveIndex(i); setScene(i + 1); },
      onLeaveBack: () => { panel.classList.remove('is-active'); setActiveIndex(i > 0 ? i-1 : 0); setScene(i > 0 ? i : 0); },
    });
  });

  // Intro — reset index on scroll back
  ScrollTrigger.create({
    trigger:'#svcIntro', start:'top 55%', end:'bottom 45%',
    onEnterBack: () => { setActiveIndex(-1); setScene(0); },
  });

  // Outro
  ScrollTrigger.create({ trigger:'#svcOutro', start:'top 75%', once:true, onEnter:() => {
    setScene(10);
    gsap.to('.svc-outro-label span', { y:0, duration:.9, ease:'power4.out' });
    gsap.to('.svc-outro-title .inner',{ y:0, duration:1.1, ease:'power4.out', stagger:.1 });
    gsap.to('#svcOutroBtns',          { opacity:1, y:0, duration:.8, ease:'power3.out', delay:.25 });
  }});
};