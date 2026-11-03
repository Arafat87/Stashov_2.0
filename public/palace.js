/* =====================================================================
 * Stashov Palace — the vault as a walkable 3D memory palace.
 * Sections: config, helpers, data, renderer/scene, environment, ground sky,
 * labels, atrium, wings, shelf, treasury, input, camera, panel, main loop.
 * Data: GET /api/vault (same origin, cookie authed). three.js r160 local.
 * ===================================================================== */
import * as THREE from './vendor/three.module.js';

/* ------------------------------- config ------------------------------- */
const CLUSTER_VISUALS = {
  'Programming, Cloud & Dev Tools': { slug: 'programming-cloud', color: '#667c2e' },
  'Life Hacks, Utilities & Reference': { slug: 'life-hacks', color: '#31517e' },
  'AI Models, Agents & Infra': { slug: 'ai-models', color: '#96603a' },
  'Career, Jobs & Interview Prep': { slug: 'career', color: '#a96f12' },
  'Menswear & Streetwear': { slug: 'menswear', color: '#3d6b4c' },
  'Business, Finance & Auto/Real Estate': { slug: 'business', color: '#a83c2a' },
  'Watches, Footwear & Accessories': { slug: 'watches', color: '#5d6d7a' },
  'Gaming, Mods & Esports': { slug: 'gaming', color: '#667c2e' },
  'Soccer Kits & Sportswear': { slug: 'soccer', color: '#31517e' },
  'Skincare, Health & Protocols': { slug: 'skincare', color: '#96603a' },
  'Global Sourcing & Proxies': { slug: 'sourcing', color: '#a96f12' },
  'Fragrances & Cologne': { slug: 'fragrances', color: '#3d6b4c' },
  'Cybersecurity & NetSec': { slug: 'cybersecurity', color: '#a83c2a' },
  'Food, Halal & Specialty Groceries': { slug: 'food', color: '#5d6d7a' },
};
const FALLBACK_VISUAL = { slug: null, color: '#9aa7b4' };
const SLUG_KEYWORDS = [
  [/career|job|interview/i, 'career', '#a96f12'],
  [/kitchen|food|halal|grocer|cook/i, 'food', '#5d6d7a'],
  [/footwear|shoe|sneaker|boot|watch|accessor/i, 'watches', '#5d6d7a'],
  [/fragrance|cologne|perfume|scent|candle/i, 'fragrances', '#3d6b4c'],
  [/menswear|streetwear|cloth|wardrobe|fashion|apparel/i, 'menswear', '#3d6b4c'],
  [/skin|health|groom|supplement|routine|wellness/i, 'skincare', '#96603a'],
  [/soccer|sport|fitness|gym/i, 'soccer', '#31517e'],
  [/game|gaming|esport/i, 'gaming', '#667c2e'],
  [/program|code|dev|cloud|software/i, 'programming-cloud', '#667c2e'],
  [/\bai\b|agent|model|llm|infra/i, 'ai-models', '#96603a'],
  [/business|finance|money|invest|rent|auto|car|estate/i, 'business', '#a83c2a'],
  [/secur|cyber|netsec|hack/i, 'cybersecurity', '#a83c2a'],
  [/sourc|proxy|wholesale|supplier/i, 'sourcing', '#a96f12'],
];
function visualFor(category) {
  if (CLUSTER_VISUALS[category]) return CLUSTER_VISUALS[category];
  for (const [pattern, slug, color] of SLUG_KEYWORDS) {
    if (pattern.test(String(category || ''))) return { slug, color };
  }
  return FALLBACK_VISUAL;
}
const GATE_COLORS = { cooling: 0xd99a2b, ready: 0x6fae7d, snoozed: 0x7d9bbd, bought: 0x5a4a36, skipped: 0x5a4a36 };
const GOLD = 0xd8a94e;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let motionReduced = REDUCED_MOTION;
try {
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => { motionReduced = e.matches; });
} catch { /* load-time value stands */ }

/* ------------------------------- helpers ------------------------------ */
const canvas = document.getElementById('scene');
const veil = document.getElementById('veil');
const panel = document.getElementById('panel');
const errbox = document.getElementById('errbox');

function showError(message) {
  errbox.style.display = 'block';
  errbox.textContent = message;
}
window.addEventListener('error', (event) => showError(`Palace error: ${(event.error && event.error.message) || event.message}`));
window.addEventListener('unhandledrejection', (event) => showError(`Palace error: ${(event.reason && event.reason.message) || event.reason}`));

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
}
function seededRand(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(text) {
  let h = 2166136261;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* -------------------------------- data -------------------------------- */
async function loadVaultData() {
  const res = await fetch('/api/vault', { headers: { Accept: 'application/json' } });
  if (res.status === 401) throw new Error('locked');
  if (!res.ok) throw new Error(`vault-${res.status}`);
  return res.json();
}

/* --------------------------- renderer & scene ------------------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a120a);
scene.fog = new THREE.Fog(0x1a120a, 48, 150);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);

/* Miniature gradient room so metals have something to reflect (no addons). */
function makeEnvironment() {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x241a10);
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const warm = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshBasicMaterial({ color: 0xffe0b0 }));
  warm.position.set(5, 6, 2);
  const cool = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshBasicMaterial({ color: 0x6a5a3a }));
  cool.position.set(-6, 3, -4);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1), new THREE.MeshBasicMaterial({ color: 0xd8a94e }));
  strip.position.set(0, 7, -6);
  env.add(warm, cool, strip);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  geo.dispose();
  return texture;
}
scene.environment = makeEnvironment();

const hemi = new THREE.HemisphereLight(0xffe6bb, 0x54381e, 0.92);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffd9b0, 1.3);
sun.position.set(-30, 38, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -48;
sun.shadow.camera.right = 48;
sun.shadow.camera.top = 48;
sun.shadow.camera.bottom = -48;
sun.shadow.camera.far = 140;
sun.shadow.bias = -0.0004;
scene.add(sun);
const hearth = new THREE.PointLight(0xffc37e, 130, 46, 2);
hearth.position.set(0, 9, 0);
scene.add(hearth);

/* --------------------- procedural textures & materials ----------------- */
function woodTexture(seed, repeatX = 1, repeatY = 1) {
  const rand = seededRand(seed);
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#7c5029';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i += 1) {
    const v = (rand() - 0.5) * 14;
    ctx.fillStyle = `rgba(${40 + v},${26 + v * 0.7},${12},0.08)`;
    ctx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }
  const streaks = 18 + Math.floor(rand() * 8);
  for (let s = 0; s < streaks; s += 1) {
    const y0 = rand() * 512;
    const dark = rand() > 0.35;
    ctx.strokeStyle = dark ? 'rgba(89,55,30,0.55)' : 'rgba(132,86,50,0.5)';
    ctx.lineWidth = 1 + rand() * 2.4;
    ctx.beginPath();
    ctx.moveTo(-8, y0);
    for (let x = 0; x <= 512; x += 64) ctx.lineTo(x, y0 + (rand() - 0.5) * 9);
    ctx.stroke();
  }
  for (let k = 0; k < 3; k += 1) {
    const kx = rand() * 512; const ky = rand() * 512;
    ctx.strokeStyle = 'rgba(70,42,20,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(kx, ky, 5 + rand() * 6, 3 + rand() * 3, 0, 0, Math.PI * 2); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function parchmentTexture(seed, w = 512, h = 256) {
  const rand = seededRand(seed);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e8d9b0';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4200; i += 1) {
    ctx.fillStyle = `rgba(160,128,74,${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * w, rand() * h, 1.6, 1.1);
  }
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.72);
  grad.addColorStop(0, 'rgba(255,250,230,0.12)');
  grad.addColorStop(1, 'rgba(160,120,60,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
function stoneTexture() {
  const rand = seededRand(777);
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#7a6a52';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i += 1) {
    const v = (rand() - 0.5) * 22;
    ctx.fillStyle = `rgba(${90 + v},${76 + v},${54 + v * 0.6},0.1)`;
    ctx.fillRect(rand() * 512, rand() * 512, 2.4, 2.4);
  }
  ctx.strokeStyle = 'rgba(52,40,26,0.65)';
  ctx.lineWidth = 3;
  for (let y = 0; y <= 512; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke(); }
  for (let r = 0; r < 4; r += 1) {
    const off = (r % 2) * 128;
    for (let x = off; x <= 512; x += 256) { ctx.beginPath(); ctx.moveTo(x, r * 128); ctx.lineTo(x, r * 128 + 128); ctx.stroke(); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function clothNoiseTexture() {
  const rand = seededRand(4242);
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i += 1) {
    const v = 168 + Math.floor(rand() * 60);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rand() * 128, rand() * 128, 1.6, 1);
  }
  ctx.fillStyle = 'rgba(60,50,40,0.18)';
  for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 128, 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function duskTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2e3a5c');
  g.addColorStop(0.42, '#516d95');
  g.addColorStop(0.68, '#949db4');
  g.addColorStop(0.78, '#d9906a');
  g.addColorStop(0.84, '#8a6a7a');
  g.addColorStop(1, '#2c2438');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 256);
  const rand = seededRand(99);
  ctx.fillStyle = 'rgba(255,244,214,0.85)';
  for (let i = 0; i < 26; i += 1) ctx.fillRect(rand() * 128, rand() * 90, 1.4, 1.4);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const woodTexA = woodTexture(11, 2, 2);
const woodTexB = woodTexture(23, 1.4, 3);
const woodTexFloor = woodTexture(37, 10, 10);
const parchmentTex = parchmentTexture(51);
const stoneTex = stoneTexture();
const clothTex = clothNoiseTexture();
const duskTex = duskTexture();
const walnutMat = new THREE.MeshStandardMaterial({ map: woodTexA, roughnessMap: woodTexA, roughness: 0.68, metalness: 0.02 });
const walnutDarkMat = new THREE.MeshStandardMaterial({ map: woodTexB, color: 0xB99F83, roughnessMap: woodTexB, roughness: 0.72, metalness: 0.02 });
const walnutLightMat = new THREE.MeshStandardMaterial({ map: woodTexA, color: 0xE8C9A0, roughnessMap: woodTexA, roughness: 0.62, metalness: 0.02 });
const floorMat = new THREE.MeshStandardMaterial({ map: woodTexFloor, color: 0xa08b74, roughnessMap: woodTexFloor, roughness: 0.88, metalness: 0.02 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.32, metalness: 1.0 });
const goldMat = new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.35, metalness: 0.9 });
const parchmentMat = new THREE.MeshStandardMaterial({ map: parchmentTex, roughness: 0.92, metalness: 0 });
const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xCBB99A, roughness: 0.95, metalness: 0.02 });
const darkStoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x8A7A60, roughness: 0.97, metalness: 0 });
const pagesMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.95, metalness: 0 });
const sageMat = new THREE.MeshStandardMaterial({ map: clothTex, color: 0x7a8464, roughness: 0.94, metalness: 0 });
const CLOTH_COLORS = [0x5c6b3c, 0x33506e, 0x8a4a2e, 0xa97e3f, 0x667c2e, 0x31517e, 0x96603a, 0xa96f12, 0x3d6b4c, 0xa83c2a, 0x5d6d7a];
const clothMats = CLOTH_COLORS.map((c) => new THREE.MeshStandardMaterial({ map: clothTex, color: c, roughness: 0.9, metalness: 0 }));

/* --------------------------- ground & sky ----------------------------- */
const ground = new THREE.Mesh(new THREE.CircleGeometry(75, 72), new THREE.MeshStandardMaterial({ color: 0x4a331e, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

for (const [radius, opacity] of [[8.5, 0.55], [26, 0.35], [45, 0.2]]) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.12, radius + 0.12, 96),
    new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  scene.add(ring);
}

function softDotTexture() {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(cv);
  return texture;
}
const dotTexture = softDotTexture();

/* Motion registries (phases seeded per object; loop allocates nothing). */
const swayLabels = [];
const wishCubes = [];
const lanterns = [];
const treasuryLiquids = [];
const funBeams = [];
const _tmpV = new THREE.Vector3();
const _tmpQ = new THREE.Quaternion();
const _tmpM = new THREE.Matrix4();
const _tmpS = new THREE.Vector3(1, 1, 1);
const UP_Y = new THREE.Vector3(0, 1, 0);

let dust = null;
let dustBase = null;
let dustPhase = null;
function buildDust() {
  const count = 260;
  const positions = new Float32Array(count * 3);
  dustBase = new Float32Array(count * 3);
  dustPhase = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const x = (Math.random() - 0.5) * 56;
    const y = Math.random() * 16 + 0.5;
    const z = (Math.random() - 0.5) * 56;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    dustBase[i * 3] = x; dustBase[i * 3 + 1] = y; dustBase[i * 3 + 2] = z;
    dustPhase[i * 2] = Math.random() * Math.PI * 2;
    dustPhase[i * 2 + 1] = 7 + Math.random() * 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dust = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.35, map: dotTexture, color: 0xd8a94e, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);
}

function buildStars() {
  const count = 420;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.42;
    const radius = 230;
    positions[i * 3] = Math.cos(theta) * Math.cos(phi) * radius;
    positions[i * 3 + 1] = Math.sin(phi) * radius * 0.6 + 12;
    positions[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * radius;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 1.6, sizeAttenuation: false, map: dotTexture, color: 0xffe2b0,
    transparent: true, opacity: 0.8, depthWrite: false,
  }));
  scene.add(stars);
}

/* ------------------------- room enclosure (§4.1) ----------------------- */
function buildRoom() {
  const room = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(30, 30, 11, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: woodTexB, roughness: 0.74, metalness: 0.02, side: THREE.BackSide })
  );
  wall.position.y = 5.5;
  wall.receiveShadow = true;
  room.add(wall);
  const stileGeo = new THREE.BoxGeometry(0.18, 11, 0.14);
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    const stile = new THREE.Mesh(stileGeo, walnutDarkMat);
    stile.position.set(Math.cos(a) * 29.82, 5.5, Math.sin(a) * 29.82);
    stile.lookAt(0, 5.5, 0);
    room.add(stile);
  }
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(29.9, 29.9, 0.5, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: woodTexB, color: 0x9A8266, roughness: 0.8, side: THREE.BackSide }));
  skirt.position.y = 0.25;
  room.add(skirt);
  const cornice = new THREE.Mesh(new THREE.CylinderGeometry(29.9, 29.9, 0.6, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: woodTexB, color: 0x9A8266, roughness: 0.8, side: THREE.BackSide }));
  cornice.position.y = 10.7;
  room.add(cornice);
  const pinLine = new THREE.Mesh(new THREE.TorusGeometry(29.8, 0.04, 8, 72), brassMat);
  pinLine.rotation.x = Math.PI / 2;
  pinLine.position.y = 10.38;
  room.add(pinLine);
  // Arched windows: walnut frame, dusk glass, mullion cross, brass hinges.
  const archShape = new THREE.Shape();
  archShape.moveTo(-1.3, -3.75);
  archShape.lineTo(1.3, -3.75);
  archShape.lineTo(1.3, 2.45);
  archShape.absarc(0, 2.45, 1.3, 0, Math.PI, false);
  archShape.lineTo(-1.3, -3.75);
  const glassGeo = new THREE.ShapeGeometry(archShape, 20);
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-1.48, -3.9);
  frameShape.lineTo(1.48, -3.9);
  frameShape.lineTo(1.48, 2.45);
  frameShape.absarc(0, 2.45, 1.48, 0, Math.PI, false);
  frameShape.lineTo(-1.48, -3.9);
  frameShape.holes.push(new THREE.Path(archShape.getPoints(20)));
  const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.16, bevelEnabled: false });
  const glassMat = new THREE.MeshBasicMaterial({ map: duskTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const mullVGeo = new THREE.BoxGeometry(0.09, 6.6, 0.07);
  const mullHGeo = new THREE.BoxGeometry(2.5, 0.09, 0.07);
  const hingeGeo = new THREE.SphereGeometry(0.06, 8, 8);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(a) * 29.9, 6.2, Math.sin(a) * 29.9);
    holder.lookAt(0, 6.2, 0);
    const frame = new THREE.Mesh(frameGeo, walnutDarkMat);
    frame.position.z = -0.08;
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = 0.02;
    const mv = new THREE.Mesh(mullVGeo, walnutDarkMat);
    mv.position.set(0, -0.4, 0.06);
    const mh = new THREE.Mesh(mullHGeo, walnutDarkMat);
    mh.position.set(0, 0.38, 0.06);
    holder.add(frame, glass, mv, mh);
    for (const [hx, hy] of [[-1.32, 1.6], [1.32, 1.6], [-1.32, -2.4], [1.32, -2.4]]) {
      const dot = new THREE.Mesh(hingeGeo, brassMat);
      dot.position.set(hx, hy, 0.1);
      holder.add(dot);
    }
    room.add(holder);
  }
  // Timber dome: inward boarding + 24 ribs to the oculus hub.
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 30, 8, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: woodTexB, color: 0xD9BC96, roughness: 0.8, side: THREE.BackSide })
  );
  dome.position.y = 15;
  room.add(dome);
  const ribGeo = new THREE.BoxGeometry(0.22, 0.16, 27.6);
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const rib = new THREE.Mesh(ribGeo, walnutDarkMat);
    rib.position.set(Math.cos(a) * 17, 15, Math.sin(a) * 17);
    rib.lookAt(0, 19.4, 0);
    room.add(rib);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 0.7, 24), walnutDarkMat);
  hub.position.y = 18.85;
  room.add(hub);
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(2.65, 0.09, 10, 40), brassMat);
  hubRing.rotation.x = Math.PI / 2;
  hubRing.position.y = 18.55;
  room.add(hubRing);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.01;
  floor.receiveShadow = true;
  room.add(floor);
  // Window-seat cushions under four windows.
  const cushionCols = [0x3d4a5c, 0x7a8464];
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 0.7),
      new THREE.MeshStandardMaterial({ map: clothTex, color: cushionCols[i % 2], roughness: 0.95 }));
    cushion.position.set(Math.cos(a) * 28.4, 0.32, Math.sin(a) * 28.4);
    cushion.lookAt(0, 0.32, 0);
    cushion.castShadow = true;
    room.add(cushion);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.24, 0.85), walnutDarkMat);
    bench.position.set(Math.cos(a) * 28.4, 0.12, Math.sin(a) * 28.4);
    bench.lookAt(0, 0.12, 0);
    room.add(bench);
  }
  scene.add(room);
}

/* -------------------------------- labels ------------------------------ */
const focusables = [];
let budgetRing = null;
let budgetRingGroup = null;
const labelsByKey = new Map();
const _labelPos = new THREE.Vector3();

/* Labels fade as the camera closes in, so a flight never ends inside a card
   and a pass-by never balloons into a translucent sheet: the fade reaches
   zero at 9 units. Two harder hides, eased so nothing pops: a label whose
   centre projects under the top bar or the side panel leaves completely
   (a 0.12 ghost behind the panel still read as broken), and while a place
   is focused its near neighbours (< 16 units) leave too, so an arrived
   view is never crossed by a half-clipped parchment strip. */
const _labelScreen = new THREE.Vector3();
let focusedLabelKey = null;
function updateLabelOpacity(dt) {
  const rect = panel.getBoundingClientRect();
  for (const [name, sprite] of labelsByKey) {
    sprite.getWorldPosition(_labelPos);
    const dist = camera.position.distanceTo(_labelPos);
    const near = THREE.MathUtils.clamp((dist - 9) / 7, 0, 1);
    let hide = false;
    _labelScreen.copy(_labelPos).project(camera);
    if (_labelScreen.z < 1) {
      const sx = (_labelScreen.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_labelScreen.y * 0.5 + 0.5) * window.innerHeight;
      const underBar = sy < 64;
      const underPanel = sx > rect.left - 150 && sx < rect.right + 16
        && sy > rect.top - 26 && sy < rect.bottom + 26;
      hide = underBar || underPanel;
    }
    if (focusedLabelKey && name !== focusedLabelKey && dist < 16) hide = true;
    const cur = sprite.userData.uiFade ?? 1;
    const next = THREE.MathUtils.clamp(cur + (hide ? -dt * 3.5 : dt * 3.5), 0, 1);
    sprite.userData.uiFade = next;
    sprite.material.opacity = Math.min(sprite.userData.baseOpacity ?? 1, near) * next;
  }
}
/* Invisible hit-proxies are the only pick targets: generous, unambiguous,
   and immune to sprite-vs-mesh occlusion fights. */
const proxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

function addProxy(parent, geometry, x, y, z, info) {
  const proxy = new THREE.Mesh(geometry, proxyMat);
  proxy.position.set(x, y, z);
  proxy.userData.focus = info;
  parent.add(proxy);
  focusables.push(proxy);
  return proxy;
}

function setFocusedLabel(key) {
  /* The focused place hides its own label: the side panel already names
     it, and a faded ghost of the parchment over its shelves reads as a
     rendering bug. It returns when focus clears (Esc / Back / Atrium). */
  focusedLabelKey = key || null;
  for (const [name, sprite] of labelsByKey) {
    sprite.userData.baseOpacity = (key && name === key) ? 0 : 1;
  }
}

function parchmentLabelTexture(lines, accent, seedKey) {
  const rand = seededRand(hashSeed(seedKey || lines[0] || 'label'));
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 160;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 512, 160);
  const pts = [];
  const steps = 26;
  for (let i = 0; i <= steps; i += 1) pts.push([10 + (492 * i) / steps, 8 + (rand() - 0.5) * 11]);
  for (let i = 1; i <= 10; i += 1) pts.push([502 + (rand() - 0.5) * 11, 8 + (144 * i) / 10]);
  for (let i = steps; i >= 0; i -= 1) pts.push([10 + (492 * i) / steps, 152 + (rand() - 0.5) * 11]);
  for (let i = 9; i >= 1; i -= 1) pts.push([10 + (rand() - 0.5) * 11, 8 + (144 * i) / 10]);
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = '#e8d9b0';
  ctx.fill();
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 2600; i += 1) {
    ctx.fillStyle = `rgba(160,128,74,${0.03 + rand() * 0.06})`;
    ctx.fillRect(rand() * 512, rand() * 160, 1.7, 1.1);
  }
  ctx.fillStyle = 'rgba(120,90,50,0.05)';
  for (let i = 0; i < 5; i += 1) ctx.fillRect(40, 108 + i * 9, 300 + rand() * 120, 2);
  ctx.restore();
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(146,110,58,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  for (const px of [42, 470]) {
    ctx.beginPath(); ctx.arc(px, 26, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#b08a3e'; ctx.fill();
    ctx.beginPath(); ctx.arc(px - 2, 23, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe2a0'; ctx.fill();
  }
  ctx.textAlign = 'center';
  /* Shrink-to-fit instead of maxWidth squeeze: long category names stay
     undistorted and inside the parchment (maxWidth condenses glyphs). */
  const fitFont = (text, weight, size, minSize) => {
    let s = size;
    ctx.font = `${weight} ${s}px "Departure Mono", ui-monospace, monospace`;
    while (s > minSize && ctx.measureText(text).width > 436) {
      s -= 2;
      ctx.font = `${weight} ${s}px "Departure Mono", ui-monospace, monospace`;
    }
    return s;
  };
  ctx.fillStyle = '#2b2115';
  fitFont(String(lines[0]), '600', 44, 21);
  ctx.fillText(lines[0], 256, 84);
  if (lines[1]) {
    ctx.fillStyle = accent;
    fitFont(String(lines[1]), '400', 30, 17);
    ctx.fillText(lines[1], 256, 126);
  }
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function cordBetween(a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, len, 5),
    new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 })
  );
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP_Y, dir.normalize());
  return mesh;
}

/* Hanging parchment label: pivot group at the brass ring (label y + 1.2),
   sprite 1.2 below it, so sway rotates about the ring (§4.6, §6).
   Returns the group to add; sprite keeps labelsByKey/focusables wiring. */
function makeHangingLabel(lines, accent = '#d8a94e', key = '', x = 0, y = 0, z = 0, scaleW = 8.6) {
  const group = new THREE.Group();
  group.position.set(x, y + 1.2, z);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: parchmentLabelTexture(lines, accent, key || lines[0]), transparent: true, depthWrite: false,
  }));
  sprite.scale.set(scaleW, scaleW * 0.25, 1);
  sprite.position.set(0, -1.2, 0);
  group.add(sprite);
  const cordX = scaleW * 0.433;
  group.add(cordBetween(new THREE.Vector3(-cordX, -0.12, 0), new THREE.Vector3(-0.55, 0.02, 0)));
  group.add(cordBetween(new THREE.Vector3(cordX, -0.12, 0), new THREE.Vector3(0.55, 0.02, 0)));
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.032, 8, 20), brassMat);
  group.add(ringMesh);
  if (key) {
    labelsByKey.set(key, sprite);
    sprite.userData.focus = key.startsWith('wing:')
      ? { type: 'wing', category: key.slice(5) }
      : { type: key };
    focusables.push(sprite);
  }
  const rand = seededRand(hashSeed(key || lines[0] || 'x'));
  const baseZ = (rand() - 0.5) * 0.06;
  group.rotation.z = baseZ;
  swayLabels.push({
    group, sprite, baseZ,
    phase: rand() * Math.PI * 2,
    period: 3.8 + rand() * 1.4,
  });
  return group;
}

function shortenCategory(name) {
  return String(name || '')
    .replace(' & ', ' · ')
    .replace(', ', ' ');
}

/* Shared dressing: brass lantern with flickering point light (M5). */
function makeLantern(parent, x, y, z, seedText) {
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.07, 12), brassMat);
  base.position.y = 0.04;
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xffd9a0, emissive: 0xffb45e, emissiveIntensity: 2.2, roughness: 0.4, transparent: true, opacity: 0.92,
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.14, 0.36, 10), glassMat);
  glass.position.y = 0.28;
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 0.1, 12), brassMat);
  capTop.position.y = 0.51;
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 14), brassMat);
  loop.position.y = 0.62;
  holder.add(base, glass, capTop, loop);
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.03), brassMat);
    bar.position.set(Math.cos(a) * 0.15, 0.28, Math.sin(a) * 0.15);
    holder.add(bar);
  }
  const light = new THREE.PointLight(0xffb45e, 17, 15, 2);
  light.position.y = 0.32;
  holder.add(light);
  parent.add(holder);
  const rand = seededRand(hashSeed(seedText));
  lanterns.push({ light, glassMat, phase: rand() * Math.PI * 2 });
  return holder;
}

/* One clothbound book lying flat (cover + cream pages + spine bands). */
function makeFlatBook(w, h, d, colorHex) {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: clothTex, color: colorHex, roughness: 0.88 }));
  cover.castShadow = true;
  const pages = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, h * 0.62, d * 1.01), pagesMat);
  pages.position.x = w * 0.03;
  const bandGeo = new THREE.BoxGeometry(w * 1.01, h * 0.16, d * 0.2);
  const bandMat = new THREE.MeshStandardMaterial({ map: clothTex, color: colorHex, roughness: 0.8 });
  const b1 = new THREE.Mesh(bandGeo, bandMat); b1.position.set(0, 0, -d * 0.28);
  const b2 = new THREE.Mesh(bandGeo, bandMat); b2.position.set(0, 0, d * 0.28);
  g.add(cover, pages, b1, b2);
  return g;
}
function addBookStack(parent, x, y, z, n, colorOffset, seedText, bookW = 0.85, bookD = 0.6) {
  const rand = seededRand(hashSeed(seedText));
  let cy = y;
  for (let b = 0; b < n; b += 1) {
    const h = 0.14 + rand() * 0.05;
    const book = makeFlatBook(bookW * (0.92 + rand() * 0.14), h, bookD * (0.92 + rand() * 0.14),
      CLOTH_COLORS[(colorOffset + b) % CLOTH_COLORS.length]);
    book.position.set(x + (rand() - 0.5) * 0.06, cy + h / 2, z + (rand() - 0.5) * 0.05);
    book.rotation.y = (rand() - 0.5) * 0.22;
    parent.add(book);
    cy += h;
  }
  return cy;
}

/* -------------------------------- atrium ------------------------------ */
function buildAtrium(data) {
  const group = new THREE.Group();
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7.2, 1, 8), stoneMat);
  dais.position.y = 0.5;
  dais.receiveShadow = true;
  dais.castShadow = true;
  const step = new THREE.Mesh(new THREE.CylinderGeometry(7.8, 8.3, 0.35, 8), darkStoneMat);
  step.position.y = 0.175;
  step.receiveShadow = true;
  const profile = [
    [1.5, 0], [1.75, 0.35], [1.8, 1.0], [1.45, 1.5], [1.18, 2.2],
    [1.12, 4.5], [1.15, 6.8], [1.3, 7.9], [1.55, 8.5], [1.35, 9.0],
  ].map(([px, py]) => new THREE.Vector2(px, py));
  const pillar = new THREE.Mesh(new THREE.LatheGeometry(profile, 8), walnutMat);
  pillar.position.y = 1;
  pillar.castShadow = true;
  group.add(dais, step, pillar);
  for (const [r, y] of [[1.62, 9.3], [1.5, 9.68], [1.4, 10.02]]) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 10, 24), walnutLightMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = y;
    group.add(collar);
  }
  for (const y of [2.2, 5.5, 8.8]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 24), brassMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.45, 0.4, 8), brassMat);
  cap.position.y = 10.35;
  group.add(cap);
  /* Upper shaft: hero.jpg's pillar runs dais-to-dome, so the column
     continues past the cap to the oculus hub instead of stopping at y10. */
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.08, 8.3, 8), walnutMat);
  shaft.position.y = 14.7;
  shaft.castShadow = true;
  group.add(shaft);
  const shaftCollar = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.07, 8, 24), walnutLightMat);
  shaftCollar.rotation.x = Math.PI / 2;
  shaftCollar.position.y = 14.6;
  group.add(shaftCollar);
  const budget = data.budget || {};
  const capAmount = Number(budget.cap) || 0;
  const remaining = Number(budget.remaining) || 0;
  const healthy = capAmount <= 0 ? true : remaining >= 0;
  const ringMat = new THREE.MeshStandardMaterial({
    color: healthy ? 0x6fae7d : 0xd96a4a, emissive: healthy ? 0x6fae7d : 0xd96a4a,
    emissiveIntensity: 1.1, roughness: 0.4, metalness: 0.2,
  });
  budgetRingGroup = new THREE.Group();
  budgetRingGroup.position.y = 6.4;
  budgetRing = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.16, 16, 64), ringMat);
  budgetRing.rotation.x = Math.PI / 2;
  budgetRingGroup.add(budgetRing);
  const tickGeo = new THREE.BoxGeometry(0.12, 0.12, 0.36);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(tickGeo, ringMat);
    tick.position.set(Math.cos(a) * 2.7, 0, Math.sin(a) * 2.7);
    tick.rotation.y = -a;
    budgetRingGroup.add(tick);
  }
  group.add(budgetRingGroup);
  const saves = Number(data.total_bookmarks) || 0;
  group.add(makeHangingLabel(['Atrium', `${saves.toLocaleString('en-US')} saves`], '#d8a94e', 'atrium', 3.6, 13.4, 0, 6.6));
  scene.add(group);
  addProxy(group, new THREE.CylinderGeometry(7.5, 7.5, 14, 12), 0, 6, 0, { type: 'atrium' });
}

/* -------------------------------- wings ------------------------------- */
const textureLoader = new THREE.TextureLoader();

function fallbackCoverTexture(label, color) {
  const cv = document.createElement('canvas');
  cv.width = 400;
  cv.height = 300;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#241708';
  ctx.fillRect(0, 0, 400, 300);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 372, 272);
  ctx.fillStyle = color;
  ctx.font = '700 120px "Departure Mono", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(label || '?').slice(0, 1).toUpperCase(), 200, 205);
  const texture = new THREE.CanvasTexture(cv);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function coverTextureFor(category) {
  const visual = visualFor(category);
  if (!visual.slug) return fallbackCoverTexture(category, visual.color);
  const texture = textureLoader.load(
    `/cluster-cards/${visual.slug}.svg`,
    undefined,
    undefined,
    () => {
      texture.image = fallbackCoverTexture(category, visual.color).image;
      texture.needsUpdate = true;
    }
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function brassBracket() {
  const g = new THREE.Group();
  const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), brassMat);
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), brassMat);
  vBar.position.set(-0.145, -0.145, 0);
  const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), brassMat);
  rivet.position.set(0.1, 0, 0.04);
  g.add(hBar, vBar, rivet);
  return g;
}

function carvedWingMesh() {
  const pts = [];
  pts.push(new THREE.Vector2(0.02, 0.08));
  pts.push(new THREE.Vector2(0.5, 0.72));
  pts.push(new THREE.Vector2(1.05, 1.38));
  pts.push(new THREE.Vector2(1.5, 1.82));
  pts.push(new THREE.Vector2(1.18, 1.66));
  pts.push(new THREE.Vector2(1.3, 1.42));
  pts.push(new THREE.Vector2(0.98, 1.34));
  pts.push(new THREE.Vector2(1.08, 1.08));
  pts.push(new THREE.Vector2(0.76, 1.02));
  pts.push(new THREE.Vector2(0.84, 0.74));
  pts.push(new THREE.Vector2(0.54, 0.7));
  pts.push(new THREE.Vector2(0.58, 0.42));
  pts.push(new THREE.Vector2(0.3, 0.4));
  pts.push(new THREE.Vector2(0.3, 0.14));
  pts.push(new THREE.Vector2(0.12, 0.02));
  const shape = new THREE.Shape(pts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
  const mat = new THREE.MeshStandardMaterial({ map: woodTexA, roughness: 0.6, metalness: 0.02 });
  mat.color.setRGB(1.06, 1.03, 0.98);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  const grooveMat = new THREE.MeshStandardMaterial({ color: 0x4a2e16, roughness: 0.9 });
  for (let i = 0; i < 4; i += 1) {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.62 - i * 0.07, 0.022, 0.02), grooveMat);
    groove.position.set(0.52 + i * 0.16, 0.62 + i * 0.26, 0.1);
    groove.rotation.z = 0.72;
    mesh.add(groove);
  }
  return mesh;
}

function buildWing(category, count, wishes, index, total, maxCount) {
  const visual = visualFor(category);
  const group = new THREE.Group();
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  const radius = 27;
  group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  group.lookAt(0, 0, 0);
  const rand = seededRand(hashSeed(category));

  const slab = new THREE.Mesh(new THREE.BoxGeometry(9, 0.6, 11), stoneMat);
  slab.position.y = 0.3;
  slab.receiveShadow = true;
  group.add(slab);

  // Bookcase carcass (§4.3): back, posts, cornice, plinth, 4 shelves.
  const caseZ = -2.35;
  const back = new THREE.Mesh(new THREE.BoxGeometry(8.6, 6.8, 0.16), walnutMat);
  back.position.set(0, 3.7, -2.82);
  back.castShadow = true; back.receiveShadow = true;
  group.add(back);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.8, 1.1), walnutMat);
    post.position.set(side * 4.05, 3.7, caseZ);
    post.castShadow = true;
    group.add(post);
  }
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(8.84, 0.35, 1.34), walnutDarkMat);
  cornice.position.set(0, 7.27, caseZ);
  cornice.castShadow = true;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.4, 1.14), walnutDarkMat);
  plinth.position.set(0, 0.8, caseZ);
  group.add(cornice, plinth);
  const shelfYs = [1.35, 2.95, 4.55, 6.15];
  for (const sy of shelfYs) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.14, 0.95), walnutMat);
    board.position.set(0, sy, caseZ);
    board.receiveShadow = true;
    group.add(board);
  }
  // Shelved cloth books: one InstancedMesh for covers, one for page tops.
  const totalBooks = Math.max(44, Math.min(60, 44 + Math.round(16 * (count / Math.max(1, maxCount)))));
  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  const coverMesh = new THREE.InstancedMesh(bookGeo,
    new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.9, metalness: 0 }), totalBooks);
  const pageMesh = new THREE.InstancedMesh(bookGeo,
    new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.95 }), totalBooks);
  coverMesh.castShadow = true;
  const bookColor = new THREE.Color();
  let bi = 0;
  const perShelf = [0, 0, 0, 0];
  for (let i = 0; i < totalBooks; i += 1) perShelf[i % 4] += 1;
  // Fill back-to-front per shelf with a small shuffle of row order.
  const rowBase = [1.02, 3.02, 4.62, 6.22];
  let bookIndex = 0;
  for (let s = 0; s < 4; s += 1) {
    let cx = -3.62;
    for (let k = 0; k < perShelf[s] && bi < totalBooks; k += 1) {
      const bw = 0.28 + rand() * 0.14;
      const bh = (s === 3 ? 0.68 + rand() * 0.16 : 1.02 + rand() * 0.3);
      const bd = 0.68 + rand() * 0.08;
      const lean = (bookIndex % 11 === 7) ? (0.07 + rand() * 0.05) * (rand() > 0.5 ? 1 : -1) : 0;
      _tmpV.set(cx + bw / 2, rowBase[s] + bh / 2, caseZ + (rand() - 0.5) * 0.05);
      _tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), lean);
      _tmpS.set(bw, bh, bd);
      _tmpM.compose(_tmpV, _tmpQ, _tmpS);
      coverMesh.setMatrixAt(bi, _tmpM);
      coverMesh.setColorAt(bi, bookColor.setHex(CLOTH_COLORS[Math.floor(rand() * CLOTH_COLORS.length)]).multiplyScalar(1.4));
      _tmpV.y = rowBase[s] + bh + 0.028;
      _tmpS.set(bw * 0.9, 0.05, bd * 0.88);
      _tmpM.compose(_tmpV, _tmpQ, _tmpS);
      pageMesh.setMatrixAt(bi, _tmpM);
      cx += bw + 0.018 + (lean !== 0 ? 0.08 : 0);
      if (cx > 3.55) { /* shelf full: remaining books stack flat below */ }
      bi += 1; bookIndex += 1;
    }
  }
  coverMesh.count = bi; pageMesh.count = bi;
  coverMesh.instanceMatrix.needsUpdate = true;
  pageMesh.instanceMatrix.needsUpdate = true;
  if (coverMesh.instanceColor) coverMesh.instanceColor.needsUpdate = true;
  group.add(coverMesh, pageMesh);
  // Brass brackets: 4 outer corners + 4 shelf-end caps, 1 rivet each.
  for (const [bx, by] of [[-4.28, 7.05], [4.28, 7.05], [-4.28, 0.72], [4.28, 0.72]]) {
    const br = brassBracket();
    br.position.set(bx, by, -1.7);
    if (bx > 0) br.scale.x = -1;
    if (by < 2) br.scale.y = -1;
    group.add(br);
  }
  for (let s = 0; s < 4; s += 1) {
    for (const side of [-1, 1]) {
      const capB = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.2), brassMat);
      capB.position.set(side * 3.82, shelfYs[s] + 0.05, -1.85);
      group.add(capB);
    }
  }
  // Framed parchment plaque with the wing's cover art (§4.3).
  const plaque = new THREE.Group();
  plaque.position.set(0.55, 4.1, -1.7);
  const frameBox = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.5, 0.14), walnutDarkMat);
  frameBox.castShadow = true;
  const matPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.02, 2.12), parchmentMat);
  matPlane.position.z = 0.08;
  const art = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.82),
    new THREE.MeshStandardMaterial({ map: coverTextureFor(category), roughness: 0.85, metalness: 0 }));
  art.position.z = 0.095;
  plaque.add(frameBox, matPlane, art);
  for (const [cx, cy] of [[-1.58, 1.13], [1.58, 1.13], [-1.58, -1.13], [1.58, -1.13]]) {
    const br = brassBracket();
    br.position.set(cx, cy, 0.1);
    br.scale.setScalar(0.8);
    if (cx > 0) br.scale.x = -0.8;
    if (cy < 0) br.scale.y = -0.8;
    plaque.add(br);
  }
  group.add(plaque);
  const carving = carvedWingMesh();
  carving.position.set(-3.62, 3.7, -1.74);
  group.add(carving);
  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 6.5, 10), walnutMat);
    column.position.set(side * 3.9, 3.85, -2.1);
    column.castShadow = true;
    const collarTop = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 10, 20), brassMat);
    collarTop.rotation.x = Math.PI / 2;
    collarTop.position.set(side * 3.9, 6.6, -2.1);
    const collarBottom = collarTop.clone();
    collarBottom.position.y = 1.1;
    group.add(column, collarTop, collarBottom);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 0.9), walnutMat);
  lintel.position.set(0, 7.35, caseZ);
  const namePlate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.06), brassMat);
  namePlate.position.set(0, 7.35, -1.82);
  group.add(lintel, namePlate);

  group.add(makeHangingLabel([shortenCategory(category), `${count} saves`], visual.color, `wing:${category}`, 0, 9.2, 0));

  // Desk with sage runner, lantern, stacks (hero: 1 desk per bay).
  const desk = new THREE.Group();
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.15), walnutMat);
  deskTop.position.set(0, 1.55, 0.6);
  deskTop.castShadow = true; deskTop.receiveShadow = true;
  desk.add(deskTop);
  for (const [lx, lz] of [[-1.5, 0.18], [1.5, 0.18], [-1.5, 1.02], [1.5, 1.02]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.46, 0.16), walnutDarkMat);
    leg.position.set(lx, 0.82, lz);
    desk.add(leg);
  }
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), sageMat);
  runner.rotation.x = -Math.PI / 2;
  runner.rotation.z = 0.02;
  runner.position.set(0, 1.65, 0.6);
  desk.add(runner);
  group.add(desk);
  makeLantern(group, -1.25, 1.64, 0.6, `${category}-lantern`);
  addBookStack(group, 1.05, 1.64, 0.45, 4, index + 1, `${category}-desk-a`);
  addBookStack(group, 0.5, 1.64, 0.88, 3, index + 4, `${category}-desk-b`);
  if (index % 2 === 0) {
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.75), parchmentMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.rotation.z = 0.28;
    sheet.position.set(-0.25, 1.66, 0.78);
    group.add(sheet);
    const inkPot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.22, 10), brassMat);
    inkPot.position.set(0.82, 1.75, 0.88);
    group.add(inkPot);
  }

  const active = wishes.filter((w) => w.status === 'cooling' || w.status === 'ready' || w.status === 'snoozed').slice(0, 6);
  active.forEach((wish, i) => {
    const color = GATE_COLORS[wish.status] ?? 0xd99a2b;
    const px = (i - (active.length - 1) / 2) * 1.35;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 1), walnutMat);
    plinth.position.set(px, 0.78, 2.6);
    plinth.castShadow = true;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.07, 0.05, 1.07), brassMat);
    trim.position.set(px, 0.97, 2.6);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1c232c, emissive: color, emissiveIntensity: 0.85, roughness: 0.5 })
    );
    box.position.set(px, 1.35, 2.6);
    box.castShadow = true;
    box.userData.wish = { id: wish.id, title: wish.title, status: wish.status };
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTexture, color, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    core.scale.set(1.05, 1.05, 1);
    box.add(core);
    group.add(plinth, trim, box);
    const sparkles = [];
    for (let sIdx = 0; sIdx < 3; sIdx += 1) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dotTexture, color: 0xffd9a0, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      sp.scale.set(0.17, 0.17, 1);
      group.add(sp);
      sparkles.push({
        sprite: sp, r: 0.5 + rand() * 0.3, speed: (Math.PI * 2) / (5 + rand() * 3),
        phase: rand() * Math.PI * 2, blink: 1.7 + rand() * 0.6,
      });
    }
    wishCubes.push({
      mesh: box, core, baseY: 1.35, center: new THREE.Vector3(px, 1.35, 2.6), sparkles,
      phase: rand() * Math.PI * 2, floatPeriod: 2.6 + rand() * 0.8, pulsePeriod: 2.2,
    });
  });

  scene.add(group);
  // Table dressing: book stacks scaled to how much the wing holds.
  const stacks = Math.max(1, Math.min(5, Math.round(count / 45)));
  for (let s = 0; s < stacks; s += 1) {
    const bx = -3.1 + s * 1.55 + ((index + s) % 2) * 0.2;
    addBookStack(group, bx, 0.6, -1.1 + ((s % 2) * 0.5), 2 + ((index + s) % 3), index + s, `${category}-floor-${s}`);
  }

  // Slightly smaller than the visible wing: edge misses stay honest misses,
  // and the proxy never steals clicks from labels behind it.
  addProxy(group, new THREE.BoxGeometry(8.5, 12, 10), 0, 5, 0, { type: 'wing', category });
  return group;
}

function buildWings(data) {
  const counts = data.category_counts || {};
  const categories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 14);
  const wishes = Array.isArray(data.wishlist) ? data.wishlist : [];
  const maxCount = categories.length ? Math.max(...categories.map((c) => counts[c])) : 1;
  categories.forEach((category, index) => {
    buildWing(category, counts[category], wishes.filter((w) => w.category === category), index, categories.length, maxCount);
  });
  return categories;
}

/* ----------------------------- shelf & treasury ----------------------- */
function indexCardTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 156;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e8d9b0';
  ctx.fillRect(0, 0, 256, 156);
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 250, 150);
  ctx.fillStyle = '#2b2115';
  ctx.font = '600 17px "Departure Mono", ui-monospace, monospace';
  ctx.fillText('INDEX · PROOF', 18, 38);
  ctx.font = '400 13px "Departure Mono", ui-monospace, monospace';
  ctx.fillStyle = 'rgba(43,33,21,0.75)';
  ctx.fillText('OWNED · ON SHELF', 18, 68);
  ctx.fillText('GATE CHECKS HERE', 18, 92);
  ctx.fillText('NO DUPLICATES', 18, 116);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const indexCardTex = indexCardTexture();

function buildShelf(data) {
  const context = data.personal_context || {};
  const owned = Array.isArray(context.owned_inventory) ? context.owned_inventory : [];
  const group = new THREE.Group();
  group.position.set(14, 0, 0);
  group.lookAt(0, 0, 0);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 5.4, 12), walnutMat);
    post.position.set(side * 3.4, 2.7, 0);
    post.castShadow = true;
    group.add(post);
    for (const cy of [1.0, 4.6]) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 8, 20), brassMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.set(side * 3.4, cy, 0);
      group.add(collar);
    }
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.22, 12), walnutDarkMat);
    foot.position.set(side * 3.4, 0.11, 0);
    group.add(foot);
  }
  const plankYs = [1.1, 2.8, 4.5];
  for (const py of plankYs) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.25, 1.4), walnutMat);
    plank.position.set(0, py, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  owned.slice(0, 12).forEach((item, i) => {
    const visual = visualFor(item.category);
    const row = Math.floor(i / 4);
    const col = i % 4;
    const ix = (col - 1.5) * 1.6;
    const topY = plankYs[row] + 0.125;
    const clothHex = parseInt(String(visual.color).replace('#', ''), 16);
    const stack = new THREE.Group();
    stack.position.set(ix - 0.18, topY, -0.12);
    group.add(stack);
    let cy = 0;
    const randI = seededRand(hashSeed(item.name || `item-${i}`));
    for (let b = 0; b < 3; b += 1) {
      const h = 0.15 + randI() * 0.04;
      const book = makeFlatBook(0.78, h, 0.55, clothHex);
      book.position.set((randI() - 0.5) * 0.05, cy + h / 2, (randI() - 0.5) * 0.04);
      book.rotation.y = (randI() - 0.5) * 0.2;
      stack.add(book);
      cy += h;
    }
    const card = new THREE.Group();
    card.position.set(ix + 0.42, topY + 0.3, 0.52);
    card.rotation.set(-0.1, 0.12, -0.07);
    const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55),
      new THREE.MeshStandardMaterial({ map: indexCardTex, roughness: 0.92, side: THREE.DoubleSide }));
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), brassMat);
    pin.position.set(0, 0.24, 0.03);
    card.add(cardMesh, pin);
    group.add(card);
  });
  makeLantern(group, 2.85, 4.63, 0, 'shelf-lantern');
  group.add(makeHangingLabel(['Shelf of Proof', `${owned.length} owned`], '#3d6b4c', 'shelf', 0, 8.2, 0, 7.2));
  scene.add(group);
  addProxy(group, new THREE.BoxGeometry(9, 10, 8), 0, 4.5, 0, { type: 'shelf' });
}

function buildTreasury(data) {
  const treasury = data.treasury || {};
  const buckets = Array.isArray(treasury.buckets) ? treasury.buckets.slice(0, 6) : [];
  const group = new THREE.Group();
  group.position.set(-14, 0, 0);
  group.lookAt(0, 0, 0);
  // Curved walnut counter (hero bottom-right dressing).
  const counter = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.45, 1.05, 36, 1, false, -0.92, 1.84),
    new THREE.MeshStandardMaterial({ map: woodTexA, roughness: 0.66, metalness: 0.02, side: THREE.DoubleSide })
  );
  counter.position.y = 0.525;
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);
  const counterTop = new THREE.Mesh(
    new THREE.CylinderGeometry(5.32, 5.32, 0.09, 36, 1, false, -0.92, 1.84), walnutDarkMat);
  counterTop.position.y = 1.06;
  group.add(counterTop);
  const counterTrim = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.045, 8, 48, 1.84), brassMat);
  counterTrim.rotation.x = Math.PI / 2;
  counterTrim.rotation.z = -0.92 + Math.PI;
  counterTrim.position.y = 1.11;
  group.add(counterTrim);
  const income = Number(treasury.yearly_income) || 0;
  buckets.forEach((bucket, i) => {
    const angle = (i / Math.max(1, buckets.length)) * Math.PI - Math.PI / 2;
    const x = Math.cos(angle) * 4.2;
    const z = Math.sin(angle) * 2.4;
    const share = income > 0 && Number(bucket.resolved_yearly) > 0
      ? Math.min(1, Number(bucket.resolved_yearly) / income)
      : 0;
    const liquidR = 0.35 + share * 1.0;
    const bowlR = liquidR + 0.24;
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(bowlR, 22, 14),
      new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.28, metalness: 1.0 }));
    bowl.scale.y = 0.42;
    bowl.position.set(x, 1.14, z);
    bowl.castShadow = true;
    group.add(bowl);
    const liquid = new THREE.Mesh(
      new THREE.CircleGeometry(liquidR, 24),
      new THREE.MeshStandardMaterial({
        color: bucket.feeds_fun_money ? 0x6fae7d : GOLD, emissive: bucket.feeds_fun_money ? 0x6fae7d : GOLD,
        emissiveIntensity: 0.9, roughness: 0.3,
      })
    );
    liquid.rotation.x = -Math.PI / 2;
    liquid.position.set(x, 1.2, z);
    group.add(liquid);
    treasuryLiquids.push({ mesh: liquid, baseY: 1.2, phase: (i * 1.37) % (Math.PI * 2) });
    if (bucket.feeds_fun_money) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.5, 5, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x6fae7d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
      );
      beam.position.set(x, 3, z);
      group.add(beam);
      const beamCap = new THREE.Sprite(new THREE.SpriteMaterial({
        map: dotTexture, color: 0x6fae7d, transparent: true, opacity: 0.5,
        depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      beamCap.scale.set(2.4, 2.4, 1);
      beamCap.position.set(x, 5.55, z);
      group.add(beamCap);
      funBeams.push({ mesh: beam, cap: beamCap, phase: 0.6 });
    }
  });
  // Static dressing: 2 lidded chests + brass pitcher on the counter.
  for (const cx of [-2.3, 2.3]) {
    const chest = new THREE.Group();
    chest.position.set(cx * 0.82, 1.1, -2.15);
    chest.rotation.y = cx > 0 ? -0.3 : 0.3;
    const bodyC = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.65), walnutMat);
    bodyC.position.y = 0.25;
    bodyC.castShadow = true;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.2, 0.69), walnutDarkMat);
    lid.position.y = 0.58;
    chest.add(bodyC, lid);
    for (const bx of [-0.32, 0.32]) {
      const bandM = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.8, 0.7), brassMat);
      bandM.position.set(bx, 0.36, 0);
      chest.add(bandM);
    }
    group.add(chest);
  }
  const pitcherPts = [
    [0.02, 0], [0.3, 0.02], [0.36, 0.2], [0.24, 0.48], [0.2, 0.68], [0.28, 0.8],
  ].map(([px, py]) => new THREE.Vector2(px, py));
  const pitcher = new THREE.Mesh(new THREE.LatheGeometry(pitcherPts, 18),
    new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.28, metalness: 1.0 }));
  pitcher.position.set(3.4, 1.1, -1.1);
  pitcher.castShadow = true;
  group.add(pitcher);
  if (!buckets.length) {
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.9, 0.7, 8), stoneMat);
    plinth.position.y = 0.35;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);
  }
  makeLantern(group, -3.1, 1.1, -1.9, 'treasury-lantern');
  const allocated = Number(treasury.allocated) || 0;
  group.add(makeHangingLabel(['Treasury', income ? `${money(allocated)} of ${money(income)}` : 'no income set'], '#a96f12', 'treasury', 0, 8.2, 0, 7.2));
  scene.add(group);
  addProxy(group, new THREE.BoxGeometry(12, 10, 8), 0, 4.5, 0, { type: 'treasury' });
}

/* ------------------------------ camera -------------------------------- */
function homeForViewport() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  /* Interior eye-level home (refs/hero.jpg wins over the old outside
     dollhouse radius): dais reads ≈0.33 of frame width, the full-height
     pillar leaves the top of frame, far bays spread across the horizon.
     Portrait goes higher and further back so the ring stays readable. */
  return aspect < 0.8
    ? { theta: 0.95, phi: 1.38, radius: 30, target: new THREE.Vector3(0, 3, 0) }
    : { theta: 0.95, phi: 1.42, radius: 29, target: new THREE.Vector3(0, 3, 0) };
}
const _home = homeForViewport();
const orbit = { theta: _home.theta, phi: _home.phi, radius: _home.radius, target: _home.target.clone() };
const tween = { active: false, t: 0, dur: 1.1, from: null, to: null };
/* Idle drift (M7/G2): additive offset only, never written into orbit. */
let lastActivity = 0;
let driftFade = 0;
function noteActivity() { lastActivity = clock.elapsedTime; }

function applyCamera() {
  const driftTheta = motionReduced ? 0 : Math.sin(clock.elapsedTime * ((Math.PI * 2) / 26)) * 0.018 * driftFade;
  const driftPhi = motionReduced ? 0 : Math.sin(clock.elapsedTime * ((Math.PI * 2) / 26) + 1.3) * 0.006 * driftFade;
  const theta = orbit.theta + driftTheta;
  const phi = Math.min(1.45, Math.max(0.35, orbit.phi + driftPhi));
  const { radius, target } = orbit;
  camera.position.set(
    target.x + radius * Math.sin(phi) * Math.sin(theta),
    target.y + radius * Math.cos(phi),
    target.z + radius * Math.sin(phi) * Math.cos(theta)
  );
  /* The room is the world: however far the orbit values run (zoom max,
     an atrium flight), the camera itself never leaves the interior, so
     no view ends up behind the wall looking at bookcase backs — and it
     stays under the dome surface, so no view clips into the timber. */
  {
    const dx = camera.position.x;
    const dy = camera.position.y - 3;
    const dz = camera.position.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > 28.5) {
      const k = 28.5 / d;
      camera.position.set(dx * k, 3 + dy * k, dz * k);
    }
    const rH = Math.hypot(camera.position.x, camera.position.z);
    const yMax = 11 + (Math.max(0, 30 - rH) / 27.4) * 8 - 1.1;
    if (camera.position.y > yMax) camera.position.y = yMax;
  }
  camera.lookAt(target);
}

function flyTo(target, radius, theta = null, phi = null) {
  noteActivity();
  let toTheta = theta === null ? orbit.theta : theta;
  if (theta !== null) {
    while (toTheta - orbit.theta > Math.PI) toTheta -= Math.PI * 2;
    while (toTheta - orbit.theta < -Math.PI) toTheta += Math.PI * 2;
  }
  const toPhi = phi === null ? Math.min(orbit.phi, 1.15) : phi;
  if (REDUCED_MOTION) {
    orbit.target.copy(target);
    orbit.radius = radius;
    orbit.theta = toTheta;
    orbit.phi = toPhi;
    applyCamera();
    return;
  }
  tween.from = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, target: orbit.target.clone() };
  tween.to = { theta: toTheta, phi: toPhi, radius, target: target.clone() };
  tween.t = 0;
  tween.active = true;
}

function resetView() {
  noteActivity();
  const home = homeForViewport();
  if (REDUCED_MOTION) {
    orbit.theta = home.theta;
    orbit.phi = home.phi;
    orbit.radius = home.radius;
    orbit.target.copy(home.target);
    applyCamera();
    return;
  }
  tween.from = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, target: orbit.target.clone() };
  tween.to = { theta: home.theta, phi: home.phi, radius: home.radius, target: home.target.clone() };
  tween.t = 0;
  tween.active = true;
}

function smootherstep(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function updateTween(dt) {
  if (!tween.active) return;
  tween.t += dt / tween.dur;
  const k = smootherstep(Math.min(1, tween.t));
  orbit.theta = tween.from.theta + (tween.to.theta - tween.from.theta) * k;
  orbit.phi = tween.from.phi + (tween.to.phi - tween.from.phi) * k;
  orbit.radius = tween.from.radius + (tween.to.radius - tween.from.radius) * k;
  orbit.target.lerpVectors(tween.from.target, tween.to.target, k);
  if (tween.t >= 1) tween.active = false;
}

/* ------------------------------- input -------------------------------- */
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
const pointers = new Map();
let downAt = null;
let pinchStart = 0;
let radiusStart = 0;

function focusCenterOf(info) {
  if (info.type === 'atrium') return { point: new THREE.Vector3(0, 4, 0), dist: 30 };
  if (info.type === 'shelf') return { point: new THREE.Vector3(14, 2.5, 0), dist: 19 };
  if (info.type === 'treasury') return { point: new THREE.Vector3(-14, 2, 0), dist: 19 };
  return { point: new THREE.Vector3(0, 3, 0), dist: 54 };
}

function wingCenterOf(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = new THREE.Vector3();
  box.getCenter(center);
  return center;
}

function pickHit(hits) {
  // Click what you see: a visible label beats any volume behind it, and small
  // foreground features (shelf, treasury, atrium) beat the big wing volumes.
  // Stable sort keeps closest-first order within each rank.
  const rank = (hit) => {
    if (hit.object.isSprite) return 0;
    return hit.object.userData.focus.type === 'wing' ? 2 : 1;
  };
  return [...hits].sort((a, b) => rank(a) - rank(b))[0];
}

function handlePick(clientX, clientY) {
  noteActivity();
  pointerNDC.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(focusables, false);
  if (!hits.length) return;
  let picked = pickHit(hits);
  const spriteHits = hits.filter((h) => h.object.isSprite);
  if (spriteHits.length > 1) {
    let bestD = Infinity;
    for (const h of spriteHits) {
      h.object.getWorldPosition(_labelPos);
      _labelPos.project(camera);
      const d = Math.hypot(_labelPos.x - pointerNDC.x, _labelPos.y - pointerNDC.y);
      if (d < bestD) { bestD = d; picked = h; }
    }
  }
  const info = picked.object.userData.focus;
  if (!info) return;
  if (info.type === 'wing') {
    let root = picked.object;
    while (root.parent && root.parent !== scene) root = root.parent;
    const center = wingCenterOf(root);
    // Approach from the atrium side so the art cover faces the camera.
    const approach = Math.atan2(-root.position.x, -root.position.z);
    flyTo(center, 19, approach, 0.95);
    setFocusedLabel(`wing:${info.category}`);
    showWing(info.category);
  } else {
    const { point, dist } = focusCenterOf(info);
    /* Shelf/Treasury sit at r14, so a straight atrium-side approach at
       dist 19 overshoots past the pillar and parks it in front of the
       subject; swing 0.55 rad off-axis so the sightline clears it. */
    const approach = info.type === 'shelf' ? Math.atan2(-14, 0) + 0.55
      : info.type === 'treasury' ? Math.atan2(14, 0) - 0.55 : null;
    flyTo(point, dist, approach, approach === null ? null : 0.95);
    if (info.type === 'shelf') { setFocusedLabel('shelf'); showShelf(); }
    else if (info.type === 'treasury') { setFocusedLabel('treasury'); showTreasury(); }
    else { setFocusedLabel(null); showAtrium(); }
  }
}

canvas.addEventListener('pointerdown', (event) => {
  tourToken += 1;
  noteActivity();
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  tween.active = false;
  if (pointers.size === 1) downAt = { x: event.clientX, y: event.clientY, moved: 0 };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    radiusStart = orbit.radius;
  }
});

canvas.addEventListener('pointermove', (event) => {
  const prior = pointers.get(event.pointerId);
  if (!prior) return;
  const dx = event.clientX - prior.x;
  const dy = event.clientY - prior.y;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchStart > 0) orbit.radius = Math.min(40, Math.max(16, (radiusStart * pinchStart) / Math.max(1, dist)));
    if (downAt) downAt.moved = 99;
  } else if (pointers.size === 1 && downAt) {
    downAt.moved += Math.abs(dx) + Math.abs(dy);
    orbit.theta -= dx * 0.0052;
    orbit.phi = Math.min(1.45, Math.max(0.35, orbit.phi - dy * 0.004));
  }
  applyCamera();
});

canvas.addEventListener('pointerup', (event) => {
  pointers.delete(event.pointerId);
  if (pointers.size === 0 && downAt && downAt.moved < 6) handlePick(event.clientX, event.clientY);
  if (pointers.size === 0) downAt = null;
});

canvas.addEventListener('pointercancel', (event) => {
  pointers.delete(event.pointerId);
  if (pointers.size === 0) downAt = null;
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  noteActivity();
  tween.active = false;
  orbit.radius = Math.min(40, Math.max(16, orbit.radius * (1 + event.deltaY * 0.001)));
  applyCamera();
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    tourToken += 1;
    noteActivity();
    resetView();
    showAtrium();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ------------------------------- panel -------------------------------- */
let vaultData = null;

function panelShell(title, sub, body) {
  panel.innerHTML = `<h2>${esc(title)}</h2><div class="sub">${esc(sub)}</div><div>${body}</div>`
    + `<button id="panelHome" type="button">Back to overview</button>`;
  document.getElementById('panelHome').addEventListener('click', () => {
    resetView();
    showAtrium();
  });
}

function wishRows(wishes) {
  const rows = wishes.slice(0, 8).map((w) => {
    const price = Number(w.lowest_verified_price) > 0 ? money(w.lowest_verified_price) : 'price pending';
    return `<li>${esc(w.title)} — ${esc(price)}<span class="pill">${esc(w.status)}</span></li>`;
  }).join('');
  const extra = wishes.length > 8 ? `<li>+${wishes.length - 8} more in the Vault</li>` : '';
  return `<ul>${rows}${extra}</ul>`;
}

function showAtrium() {
  if (!vaultData) return;
  setFocusedLabel(null);
  const budget = vaultData.budget || {};
  const gate = (vaultData.gate && vaultData.gate.counts) || {};
  const journal = Array.isArray(vaultData.decision_journal) ? vaultData.decision_journal.length : 0;
  panelShell(
    'Atrium',
    `${Number(vaultData.total_bookmarks || 0).toLocaleString('en-US')} saves across the palace`,
    `<ul>`
    + `<li>Fun money: ${money(budget.spent)} of ${money(budget.cap)} <span class="pill">${money(budget.remaining)} left</span></li>`
    + `<li>Gate: ${(gate.cooling || 0)} cooling · ${(gate.ready || 0)} ready · ${(gate.snoozed || 0)} snoozed</li>`
    + `<li>Decisions remembered: ${journal}</li>`
    + `</ul>`
  );
}

function showWing(category) {
  if (!vaultData) return;
  const count = (vaultData.category_counts || {})[category] || 0;
  const meta = (vaultData.cluster_meta || {})[category] || {};
  const wishes = (vaultData.wishlist || []).filter((w) => w.category === category);
  panelShell(
    category,
    `${count} saves · ${esc(meta.mode || 'reference')} wing`,
    wishes.length ? wishRows(wishes) : `<div class="sub">No gated wishes here yet.</div>`
  );
}

function showShelf() {
  if (!vaultData) return;
  const owned = ((vaultData.personal_context || {}).owned_inventory) || [];
  const rows = owned.slice(0, 10).map((item) => `<li>${esc(item.name)}<span class="pill">${esc(item.status || 'owned')}</span></li>`).join('');
  const extra = owned.length > 10 ? `<li>+${owned.length - 10} more</li>` : '';
  panelShell('Shelf of Proof', `${owned.length} items the Gate checks against`, `<ul>${rows}${extra}</ul>`);
}

function showTreasury() {
  if (!vaultData) return;
  const treasury = vaultData.treasury || {};
  const buckets = Array.isArray(treasury.buckets) ? treasury.buckets : [];
  const rows = buckets.map((b) => {
    const yearly = Number(b.resolved_yearly) || 0;
    const flag = b.feeds_fun_money ? `<span class="pill">feeds fun money</span>` : '';
    return `<li>${esc(b.name)} — ${money(yearly)}/yr${flag}</li>`;
  }).join('');
  panelShell(
    'Treasury',
    `Income ${money(treasury.yearly_income)} · allocated ${money(treasury.allocated)}`,
    buckets.length ? `<ul>${rows}</ul>` : `<div class="sub">No buckets yet — set an income in the Vault.</div>`
  );
}

/* ------------------------------ demo tour ----------------------------- */
let tourToken = 0;
const tourSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function narrate(title, sub, text) {
  panelShell(title, sub, `<p class="narrate">${esc(text)}</p>`);
}

async function playDemo() {
  if (!vaultData) return;
  const btn = document.getElementById('demoBtn');
  if (btn && btn.dataset.playing === '1') { tourToken += 1; return; }
  const my = ++tourToken;
  const alive = () => my === tourToken;
  if (btn) { btn.dataset.playing = '1'; btn.textContent = '■ Stop demo'; }
  noteActivity();
  // Wonder writes the closing narration while the tour flies (non-blocking).
  let wonderLine = '';
  fetch('/api/vault-audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'In two or three sentences, narrate this vault like a memory-palace tour guide: what does the owner collect, what is the Impulse Gate holding back right now, and what does the Treasury say about their fun money? Quote one decision-journal memory if one exists.' }),
  }).then((r) => r.json()).then((d) => {
    wonderLine = String((d && d.report) || '').replace(/\s+/g, ' ').trim().slice(0, 340);
  }).catch(() => { wonderLine = ''; });

  try {
    const total = Number(vaultData.total_bookmarks || 0).toLocaleString('en-US');
    const counts = vaultData.category_counts || {};
    const categories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 14);
    const top = categories[0];
    resetView();
    setFocusedLabel(null);
    narrate('Palace tour — Atrium', `${total} saves across ${categories.length} wings`,
      `Everything you have saved lives in this ring. ${top ? `Your biggest wing is ${top} with ${counts[top]} saves.` : ''} Watch what the Gate is holding back, what you already own, and where the money comes from.`);
    await tourSleep(4200); if (!alive()) return;

    const wishes = Array.isArray(vaultData.wishlist) ? vaultData.wishlist : [];
    const cooling = wishes.find((w) => w.status === 'cooling') || wishes.find((w) => w.status === 'ready') || wishes[0];
    if (cooling && categories.includes(cooling.category)) {
      const idx = categories.indexOf(cooling.category);
      const angle = (idx / Math.max(1, categories.length)) * Math.PI * 2 - Math.PI / 2;
      const center = new THREE.Vector3(Math.cos(angle) * 27, 3, Math.sin(angle) * 27);
      flyTo(center, 19, Math.atan2(-center.x, -center.z), 0.95);
      setFocusedLabel(`wing:${cooling.category}`);
      narrate(cooling.category, 'the Impulse Gate, live',
        `“${cooling.title}” is ${cooling.status} here. Wonder holds every wish against your budget, your closet and your own past decisions for fourteen days before it may be bought.`);
    } else {
      showAtrium();
      narrate('Palace tour — the Gate', 'no active wishes',
        'No wish is cooling right now. Anything new you capture lands in a wing like this one and waits fourteen days.');
    }
    await tourSleep(4600); if (!alive()) return;

    const owned = ((vaultData.personal_context || {}).owned_inventory) || [];
    flyTo(new THREE.Vector3(14, 2.5, 0), 19, Math.atan2(-14, 0) + 0.55, 0.95);
    setFocusedLabel('shelf');
    narrate('Shelf of Proof', `${owned.length} owned items`,
      owned.length
        ? `Before Wonder approves anything, it checks this shelf: ${owned.slice(0, 3).map((i) => i.name).join('; ')}${owned.length > 3 ? '…' : ''} Duplicates die here.`
        : 'This shelf is where owned items live, so the Gate can kill duplicate purchases before they happen.');
    await tourSleep(4600); if (!alive()) return;

    const treasury = vaultData.treasury || {};
    const buckets = Array.isArray(treasury.buckets) ? treasury.buckets : [];
    const fun = buckets.find((b) => b.feeds_fun_money);
    flyTo(new THREE.Vector3(-14, 2, 0), 19, Math.atan2(14, 0) - 0.55, 0.95);
    setFocusedLabel('treasury');
    narrate('Treasury', 'paycheck to purchase',
      Number(treasury.yearly_income) > 0
        ? `${money(treasury.yearly_income)} a year flows into ${buckets.length} buckets${fun ? `, and “${fun.name}” feeds the fun-money cap the Gate enforces` : ''}. Salary becomes permission.`
        : 'No income is filed yet. Set a yearly income in the Vault and this corner fills with buckets — one of them feeds the fun-money cap every Gate verdict obeys.');
    await tourSleep(4600); if (!alive()) return;

    resetView();
    if (wonderLine) {
      panelShell('Wonder, on your palace', 'live narration · Muse Wonder',
        `<p class="narrate">${esc(wonderLine)}</p>`);
    } else {
      showAtrium();
    }
    await tourSleep(5200); if (!alive()) return;
    showAtrium();
  } finally {
    if (btn) { btn.dataset.playing = ''; btn.textContent = '▶ Play demo'; }
  }
}

/* ----------------------------- main loop ------------------------------ */
const clock = new THREE.Clock();
let firstFrame = true;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const elapsed = clock.elapsedTime;
  updateTween(dt);
  // M7 idle drift: fade in after 4 s untouched, out over 0.3 s on activity.
  const demoBtnEl = document.getElementById('demoBtn');
  const tourPlaying = demoBtnEl && demoBtnEl.dataset.playing === '1';
  const wantDrift = !motionReduced && !tween.active && !tourPlaying
    && pointers.size === 0 && (elapsed - lastActivity) > 4.0;
  const driftTarget = wantDrift ? 1 : 0;
  if (driftFade < driftTarget) driftFade = Math.min(driftTarget, driftFade + dt / 0.3);
  else if (driftFade > driftTarget) driftFade = Math.max(driftTarget, driftFade - dt / 0.3);

  if (!motionReduced) {
    // M1 parchment sway (pivot at the brass ring; sprite tilt follows).
    for (const s of swayLabels) {
      const w = (Math.PI * 2) / s.period;
      const sway = Math.sin(elapsed * w + s.phase) + 0.35 * Math.sin(elapsed * w * 2.7 + s.phase * 1.3);
      s.group.rotation.z = s.baseZ + sway * 0.018;
      s.group.rotation.x = Math.sin(elapsed * w * 0.83 + s.phase + 1.1) * 0.01;
      s.sprite.position.y = -1.2 + Math.sin(elapsed * w + s.phase) * 0.05;
      s.sprite.material.rotation = s.group.rotation.z;
    }
    // M2 dust drift: rise 0.28 u/s + lateral wander, wrap y 0.4 -> 17.
    if (dust && dustBase) {
      const positions = dust.geometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        let y = positions.getY(i) + dt * 0.28;
        if (y > 17) y = 0.4;
        const ph = dustPhase[i * 2];
        const per = dustPhase[i * 2 + 1];
        positions.setXYZ(i,
          dustBase[i * 3] + Math.sin(elapsed * ((Math.PI * 2) / per) + ph) * 0.6,
          y,
          dustBase[i * 3 + 2] + Math.cos(elapsed * ((Math.PI * 2) / (per * 1.17)) + ph * 1.3) * 0.6);
      }
      positions.needsUpdate = true;
    }
    // M3 wish-cube float + pulse; M8 sparkle orbits.
    for (const c of wishCubes) {
      c.mesh.position.y = c.baseY + Math.sin(elapsed * ((Math.PI * 2) / c.floatPeriod) + c.phase) * 0.14;
      const pulse = Math.sin(elapsed * ((Math.PI * 2) / c.pulsePeriod) + c.phase * 1.7);
      c.mesh.material.emissiveIntensity = 0.85 + pulse * 0.35;
      c.mesh.scale.setScalar(1 + pulse * 0.03);
      if (c.core) c.core.material.opacity = 0.65 + pulse * 0.25;
      for (const sp of c.sparkles) {
        const a = sp.phase + elapsed * sp.speed;
        sp.sprite.position.set(
          c.center.x + Math.cos(a) * sp.r,
          c.mesh.position.y + 0.18 + Math.sin(elapsed * 0.9 + sp.phase) * 0.25,
          c.center.z + Math.sin(a) * sp.r);
        sp.sprite.material.opacity = Math.max(0, Math.sin(elapsed * ((Math.PI * 2) / sp.blink) + sp.phase * 2)) * 0.7;
      }
    }
    // M4 budget ring: slow rotation (tick beads show it) + emissive pulse.
    if (budgetRingGroup) budgetRingGroup.rotation.y -= dt * ((Math.PI * 2) / 90);
    if (budgetRing) budgetRing.material.emissiveIntensity = 1.1 + Math.sin(elapsed * 2) * 0.45;
    // M5 lantern + hearth flicker (seeded, neighbours never in sync).
    for (const l of lanterns) {
      const f = (Math.sin(elapsed * 44 + l.phase) * 0.5
        + Math.sin(elapsed * 82 + l.phase * 1.7) * 0.28
        + Math.sin(elapsed * 2.5 + l.phase) * 0.45) / 1.23;
      l.light.intensity = 17 * (1 + f * 0.09);
      l.glassMat.emissiveIntensity = 2.2 + f * 0.3;
    }
    const hf = (Math.sin(elapsed * 44) * 0.5 + Math.sin(elapsed * 82 + 1.7) * 0.28
      + Math.sin(elapsed * 2.5) * 0.45) / 1.23;
    hearth.intensity = 130 * (1 + hf * 0.13);
    // M6 treasury shimmer + fun-money beam.
    for (const liq of treasuryLiquids) {
      const s = Math.sin(elapsed * ((Math.PI * 2) / 3.1) + liq.phase);
      liq.mesh.material.emissiveIntensity = 0.9 + s * 0.25;
      liq.mesh.position.y = liq.baseY + s * 0.015;
      const sc = 1 + s * 0.012;
      liq.mesh.scale.set(sc, sc, 1);
    }
    for (const b of funBeams) {
      b.mesh.material.opacity = 0.22 + Math.sin(elapsed * ((Math.PI * 2) / 2.4) + b.phase) * 0.07;
      b.mesh.rotation.y += dt * ((Math.PI * 2) / 40);
      if (b.cap) b.cap.material.opacity = 0.4 + Math.sin(elapsed * ((Math.PI * 2) / 2.4) + b.phase) * 0.18;
    }
  } else {
    // Reduced motion: every system rests in its table static state.
    for (const s of swayLabels) {
      s.group.rotation.z = s.baseZ;
      s.group.rotation.x = 0;
      s.sprite.position.y = -1.2;
      s.sprite.material.rotation = s.baseZ;
    }
    for (const c of wishCubes) {
      c.mesh.position.y = c.baseY;
      c.mesh.material.emissiveIntensity = 0.85;
      c.mesh.scale.setScalar(1);
      for (const sp of c.sparkles) sp.sprite.material.opacity = 0;
    }
    if (budgetRing) budgetRing.material.emissiveIntensity = 1.1;
    for (const l of lanterns) { l.light.intensity = 17; l.glassMat.emissiveIntensity = 2.2; }
    hearth.intensity = 130;
    for (const liq of treasuryLiquids) {
      liq.mesh.material.emissiveIntensity = 0.9;
      liq.mesh.position.y = liq.baseY;
      liq.mesh.scale.set(1, 1, 1);
    }
    for (const b of funBeams) { b.mesh.material.opacity = 0.22; if (b.cap) b.cap.material.opacity = 0.5; }
  }
  applyCamera();
  updateLabelOpacity(dt);
  renderer.render(scene, camera);
  if (firstFrame) {
    firstFrame = false;
    veil.classList.add('hidden');
  }
}

/* -------------------------------- boot -------------------------------- */
async function boot() {
  try { await document.fonts.load('600 40px "Departure Mono"'); } catch { /* fallback monospace */ }
  buildDust();
  buildStars();
  buildRoom();
  applyCamera();
  animate();
  try {
    vaultData = await loadVaultData();
  } catch (err) {
    veil.classList.add('hidden');
    if (err.message === 'locked') {
      panelShell('Locked vault', 'This palace is private', `<div class="sub">Open the Vault in this browser and unlock it, then return here.</div>`);
      showError('Vault is locked (401). Unlock at / first.');
    } else {
      showError(`Could not load vault data (${err.message}). Is the server running?`);
    }
    return;
  }
  const demoBtn = document.getElementById('demoBtn');
  if (demoBtn) demoBtn.addEventListener('click', playDemo);
  buildAtrium(vaultData);
  const categories = buildWings(vaultData);
  buildShelf(vaultData);
  buildTreasury(vaultData);
  showAtrium();
  if (!categories.length) {
    panelShell('Empty palace', 'Nothing saved yet', `<div class="sub">Save bookmarks and wishes in the Vault and they will raise wings here.</div>`);
  }
}

boot();
