// Critical — « Genèse » : rendu et interface du mode principal (logique dans fusion.js, pure et testée).
// On fusionne des astres : orbe → astéroïde → lune → planète → géante gazeuse → étoiles → trou noir.
// Habillage : le verre liquide du reste du jeu, sur fond d'espace profond.
import * as A from './audio.js';
import * as Skins from './skins.js';
import * as F from './fusion.js';

const KEY = 'critical.forage.v2', TAU = Math.PI * 2;
const sv = { best: 0, depth: 0, chain: 0, tier: 0, runs: 0, seen: 0 };
try { Object.assign(sv, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* ignore */ } };
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const H = { vib: () => {}, toast: () => {}, mat: () => 'glass', grant: () => {}, track: () => {}, quests: () => '' };

// Un astre par rang : [nom, couleur des effets]
export const BODIES = [
  ['Orbe', [77, 243, 255]], ['Astéroïde', [196, 172, 146]], ['Lune', [206, 214, 230]], ['Planète', [80, 150, 255]], ['Géante gazeuse', [244, 176, 96]],
  ['Naine orange', [255, 150, 60]], ['Soleil', [255, 226, 110]], ['Géante rouge', [255, 84, 66]], ['Étoile à neutrons', [170, 212, 255]], ['Trou noir', [190, 110, 255]],
];
const CY = [77, 243, 255], MG = [255, 79, 216], AM = [255, 194, 71];
const HUES = [215, 280, 330, 190, 20, 260, 160, 300, 45]; // teinte de la nébuleuse par secteur
const sectorName = (d) => (d < F.STRATA.length ? F.STRATA[d] : `Origine +${d - F.STRATA.length + 1}`);

/* ============================== état ============================== */
let G = null, isOpen = false, raf = 0, T = 0, last = 0, cv, ctx, W = 0, Hh = 0, DPR = 1, SAT = 0, SAB = 0, lowFx = false, paused = false;
let B = { x: 0, y: 0, w: 0, h: 0, u: 30 }, holdR = null, aimX = F.W / 2, aiming = false, ended = false;
let parts = [], rings = [], labels = [], pops = new Map(), shake = 0, flash = 0, flashC = [255, 255, 255], hitstop = 0;
let shown = 0, callout = null, scroll = 0, texA = null, texB = null, sprites = new Map(), spriteKey = '', landT = 0, giftT = 0;
const stars = Array.from({ length: 46 }, (_, i) => ({ x: rnd(i), y: rnd(i * 2.3), z: 0.3 + rnd(i * 5.1) * 0.7, p: rnd(i * 7) * 6 }));

const sx = (x) => B.x + x * B.u, sy = (y) => B.y + y * B.u;

/* ============================== effets ============================== */
const ring = (x, y, r0, r1, life, col, w = 3) => rings.push({ x, y, r0, r1, l: 0, m: life, col, w });
function burst(x, y, n, col, sp, life = 0.7, sz = 2.5) {
  n = Math.round(n * (lowFx ? 0.5 : 1));
  for (let i = 0; i < n && parts.length < (lowFx ? 110 : 260); i++) { const a = Math.random() * TAU, v = sp * (0.35 + Math.random() * 0.65); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: life * (0.6 + Math.random() * 0.6), col, sz: sz * (0.6 + Math.random() * 0.8) }); }
}
const label = (x, y, txt, col, sz = 16) => labels.push({ x, y, txt, col, sz, l: 0 });
const say = (txt, sub, col) => { callout = { txt, sub, col, l: 0 }; };

function onEvents() {
  for (const e of G.ev) {
    const x = sx(e.x || 0), y = sy(e.y || 0);
    if (e.t === 'merge') {
      const col = BODIES[e.tier][1], r = F.TIERS[e.tier].r * B.u;
      pops.set(e.id, T);
      ring(x, y, r * 0.5, r * 2, 0.42, col, 4); ring(x, y, r * 0.3, r * 1.4, 0.3, [255, 255, 255], 2);
      burst(x, y, 8 + e.tier * 3, col, B.u * (5 + e.tier), 0.6, 2 + e.tier * 0.25);
      label(x, y - r, '+' + fmt(e.pts), e.chain > 1 ? AM : [255, 255, 255], 14 + Math.min(10, e.tier * 1.4));
      A.boom(e.chain + (e.tier >> 1)); H.vib(8 + e.tier * 3);
      shake = Math.max(shake, 1.5 + e.tier * 0.9); if (e.tier >= 5) { hitstop = 0.05; flash = 0.14; flashC = col; }
      if (e.tier > sv.tier - 1 && e.tier >= 3 && e.tier > G.maxSeen) { G.maxSeen = e.tier; say(BODIES[e.tier][0].toUpperCase(), 'NOUVEL ASTRE', col); A.star(2); }
      else if (e.chain >= 2) say('×' + Math.min(8, e.chain), e.chain >= 3 ? 'CHAÎNE' : '', e.chain >= 5 ? AM : [255, 255, 255]);
      H.track('fusions', 1); H.track('tier', e.tier + 1, true); H.track('chain', e.chain, true);
    } else if (e.t === 'land') { if (T - landT > 0.07) { landT = T; A.land(); if (e.v > 9) burst(x, y, 3, [200, 220, 255], B.u * 2, 0.3, 1.6); } }
    else if (e.t === 'vapor') { const col = e.tier >= 0 ? BODIES[e.tier][1] : [150, 150, 170]; burst(x, y, 7, col, B.u * 5, 0.6); ring(x, y, 2, B.u * 0.9, 0.3, col, 2); }
    else if (e.t === 'crumble') { burst(x, y, 9, [170, 170, 190], B.u * 4, 0.5, 3); A.crack(); }
    else if (e.t === 'boom') { ring(x, y, 4, B.u * 3.4, 0.45, CY, 7); burst(x, y, 40, [200, 240, 255], B.u * 13, 0.8, 3.5); shake = 14; flash = 0.3; flashC = CY; A.breach(); H.vib([20, 30, 40]); }
    else if (e.t === 'morph') { ring(x, y, 2, B.u * 1.4, 0.3, MG, 3); A.star(2); }
    else if (e.t === 'gift') { giftT = T; A.star(e.k === 'j' ? 1 : 0); H.toast(e.k === 'j' ? 'Matière exotique : elle copie l\'astre qu\'elle touche' : 'Belle chaîne ! Comète explosive offerte'); }
    else if (e.t === 'rubble') A.step(2);
    else if (e.t === 'pierce') {
      texA = texB; texB = makeTex(e.depth); scroll = 1;
      shake = 16; flash = 0.4; flashC = [200, 230, 255]; hitstop = 0.09;
      ring(W / 2, sy(F.HT), 10, W, 0.7, CY, 9); ring(W / 2, sy(F.HT), 10, W * 0.8, 0.9, MG, 6);
      say('SECTEUR ' + (e.depth + 1), sectorName(e.depth).toUpperCase() + ' · +' + fmt(e.pts), CY);
      A.rumble(); A.mult(Math.min(8, e.depth)); H.vib([30, 40, 60]);
      H.track('depth', e.depth + 1, true);
    } else if (e.t === 'nova') {
      shake = 26; flash = 0.85; flashC = [255, 255, 255]; hitstop = 0.14;
      for (let k = 0; k < 4; k++) ring(x, y, 6, W * (0.4 + k * 0.3), 0.6 + k * 0.15, [CY, MG, AM, [255, 255, 255]][k], 10 - k * 2);
      burst(x, y, 90, [255, 240, 220], B.u * 20, 1.2, 4); say('BIG BANG', '+' + fmt(e.pts), [255, 255, 255]);
      A.win(); A.rumble(); H.vib([40, 30, 40, 30, 80]); H.track('nova', 1);
    } else if (e.t === 'over') endRun();
  }
  G.ev.length = 0;
}

/* ============================== fond et astres (pré-rendus) ============================== */
function makeTex(depth) {
  const c = document.createElement('canvas'), w = c.width = Math.max(64, Math.round(W / 2)), h = c.height = Math.max(64, Math.round(Hh / 2)), x = c.getContext('2d');
  const hue = HUES[depth % HUES.length], s0 = depth * 31.7;
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `hsl(${hue} 55% 7%)`); g.addColorStop(1, `hsl(${hue + 40} 60% 3%)`); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { // nuages de nébuleuse
    const px = rnd(s0 + i) * w, py = rnd(s0 + i * 2.7) * h, r = (0.25 + rnd(s0 + i * 4.1) * 0.4) * w;
    const n = x.createRadialGradient(px, py, 0, px, py, r); n.addColorStop(0, `hsla(${hue + (i % 3 - 1) * 45},90%,55%,.2)`); n.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = n; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  for (let i = 0; i < 150; i++) { x.fillStyle = `rgba(255,255,255,${0.15 + rnd(s0 + i * 1.7) * 0.6})`; const s = rnd(i * 3.3) > 0.9 ? 1.6 : 0.8; x.fillRect(rnd(s0 + i) * w, rnd(s0 + i * 2.1) * h, s, s); }
  return c;
}
const ball = (x, c, r, a, b, d) => { const g = x.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.05, c, c, r); g.addColorStop(0, a); g.addColorStop(0.55, b); g.addColorStop(1, d); x.fillStyle = g; x.beginPath(); x.arc(c, c, r, 0, TAU); x.fill(); };
const halo = (x, c, r, col, a = 0.6) => { const g = x.createRadialGradient(c, c, r * 0.75, c, c, r * 1.3); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(c - r * 1.3, c - r * 1.3, r * 2.6, r * 2.6); };
const clipC = (x, c, r) => { x.save(); x.beginPath(); x.arc(c, c, r, 0, TAU); x.clip(); };
const blob = (x, px, py, rx, ry, rot, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, TAU); x.fill(); };
const shadeC = (x, c, r) => { const g = x.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.5, c, c, r * 1.05); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,10,.55)'); x.fillStyle = g; x.fillRect(c - r, c - r, 2 * r, 2 * r); };
const gloss = (x, c, r) => blob(x, c - r * 0.36, c - r * 0.5, r * 0.28, r * 0.12, -0.6, 'rgba(255,255,255,.5)');

function paint(x, tier, c, r) {
  if (tier === 0) { Skins.drawOrb(x, H.mat(), c, c, r, CY, 0, 1.3, { gl: 0 }); return; } // l'orbe de départ porte la matière équipée
  if (tier === 1) { // astéroïde
    const g = x.createLinearGradient(c - r, c - r, c + r, c + r); g.addColorStop(0, '#d9c4a8'); g.addColorStop(1, '#4e4138'); x.fillStyle = g;
    x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, rr = r * (0.82 + rnd(i * 2.7) * 0.18); x.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } x.closePath(); x.fill();
    for (let i = 0; i < 4; i++) blob(x, c + (rnd(i * 3) - 0.5) * r, c + (rnd(i * 5) - 0.5) * r, r * 0.16, r * 0.13, i, 'rgba(40,30,25,.4)');
  } else if (tier === 2) { // lune
    ball(x, c, r, '#ffffff', '#b4bccd', '#565d70'); clipC(x, c, r);
    for (let i = 0; i < 6; i++) { const px = c + (rnd(i * 3.1) - 0.5) * r * 1.4, py = c + (rnd(i * 5.3) - 0.5) * r * 1.4, cr = r * (0.1 + rnd(i * 7) * 0.14); blob(x, px, py, cr, cr, 0, 'rgba(70,76,96,.4)'); x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 1; x.beginPath(); x.arc(px, py, cr, 0.5, 2.6); x.stroke(); }
    shadeC(x, c, r); x.restore();
  } else if (tier === 3) { // planète habitable
    ball(x, c, r, '#bff0ff', '#2f7bff', '#0a1c66'); clipC(x, c, r);
    for (let i = 0; i < 5; i++) blob(x, c + (rnd(i * 2.3) - 0.5) * r * 1.5, c + (rnd(i * 4.7) - 0.5) * r * 1.5, r * (0.2 + rnd(i) * 0.25), r * (0.14 + rnd(i * 9) * 0.16), rnd(i * 6) * 3, 'rgba(70,214,130,.85)');
    for (let i = 0; i < 4; i++) blob(x, c + (rnd(i * 8.1) - 0.5) * r * 1.4, c + (rnd(i * 3.9) - 0.5) * r * 1.4, r * 0.42, r * 0.07, 0.25, 'rgba(255,255,255,.55)');
    shadeC(x, c, r); x.restore(); x.strokeStyle = 'rgba(150,225,255,.7)'; x.lineWidth = Math.max(1.5, r * 0.05); x.beginPath(); x.arc(c, c, r - 1, 0, TAU); x.stroke(); gloss(x, c, r);
  } else if (tier === 4) { // géante gazeuse et son anneau
    const rg = () => { x.strokeStyle = 'rgba(255,232,190,.8)'; x.lineWidth = r * 0.08; };
    rg(); x.beginPath(); x.ellipse(c, c, r * 1.22, r * 0.3, -0.35, Math.PI, TAU); x.stroke();
    ball(x, c, r * 0.94, '#fff0cf', '#eaa055', '#6e3216'); clipC(x, c, r * 0.94);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? 'rgba(255,244,215,.3)' : 'rgba(120,52,20,.3)'; x.fillRect(c - r, c - r + i * r * 0.26 + rnd(i) * r * 0.06, 2 * r, r * (0.08 + rnd(i * 3) * 0.1)); }
    blob(x, c + r * 0.3, c + r * 0.25, r * 0.2, r * 0.11, 0, 'rgba(200,60,40,.7)'); shadeC(x, c, r); x.restore();
    rg(); x.beginPath(); x.ellipse(c, c, r * 1.22, r * 0.3, -0.35, 0, Math.PI); x.stroke();
  } else if (tier === 5) { halo(x, c, r, [255, 140, 60]); ball(x, c, r, '#fff8dc', '#ff9a3d', '#b52c14'); }
  else if (tier === 6) { // soleil : couronne
    halo(x, c, r, [255, 220, 90], 0.75); x.fillStyle = 'rgba(255,236,150,.5)';
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU, l = r * (1.14 + rnd(i * 2.2) * 0.14); x.beginPath(); x.moveTo(c + Math.cos(a - 0.09) * r * 0.9, c + Math.sin(a - 0.09) * r * 0.9); x.lineTo(c + Math.cos(a) * l, c + Math.sin(a) * l); x.lineTo(c + Math.cos(a + 0.09) * r * 0.9, c + Math.sin(a + 0.09) * r * 0.9); x.fill(); }
    ball(x, c, r, '#ffffff', '#ffe36a', '#ff971c');
  } else if (tier === 7) { // géante rouge
    halo(x, c, r, [255, 70, 60], 0.65); ball(x, c, r, '#ffd9b4', '#ff4a3a', '#6e0a16'); clipC(x, c, r);
    for (let i = 0; i < 16; i++) blob(x, c + (rnd(i * 2.9) - 0.5) * r * 1.7, c + (rnd(i * 6.1) - 0.5) * r * 1.7, r * (0.1 + rnd(i) * 0.2), r * (0.08 + rnd(i * 4) * 0.14), rnd(i * 8) * 3, i % 2 ? 'rgba(255,200,120,.2)' : 'rgba(90,0,10,.22)');
    x.restore();
  } else if (tier === 8) { // étoile à neutrons : jets et anneaux
    halo(x, c, r, [150, 200, 255], 0.85);
    const g = x.createLinearGradient(c - r * 1.3, c - r * 1.3, c + r * 1.3, c + r * 1.3); g.addColorStop(0, 'rgba(180,220,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(180,220,255,0)');
    x.strokeStyle = g; x.lineWidth = r * 0.14; x.lineCap = 'round'; x.beginPath(); x.moveTo(c - r * 0.9, c - r * 0.9); x.lineTo(c + r * 0.9, c + r * 0.9); x.stroke();
    ball(x, c, r * 0.86, '#ffffff', '#cfe8ff', '#4d7bff');
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = Math.max(1.2, r * 0.035); x.beginPath(); x.ellipse(c, c, r * 1.12, r * 0.22, -0.78, 0, TAU); x.stroke();
  } else { // trou noir : disque d'accrétion, horizon, lentille
    halo(x, c, r, [170, 90, 255], 0.75);
    const g = x.createRadialGradient(c, c, r * 0.55, c, c, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,214,120,1)'); g.addColorStop(0.55, 'rgba(255,79,216,.9)'); g.addColorStop(1, 'rgba(90,40,200,.15)');
    x.fillStyle = g; x.beginPath(); x.arc(c, c, r, 0, TAU); x.fill();
    x.fillStyle = '#000'; x.beginPath(); x.arc(c, c, r * 0.6, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = Math.max(1.5, r * 0.03); x.beginPath(); x.arc(c, c, r * 0.61, 0, TAU); x.stroke();
    x.strokeStyle = 'rgba(255,200,120,.85)'; x.lineWidth = r * 0.07; x.beginPath(); x.ellipse(c, c, r * 1.2, r * 0.2, -0.3, 0, TAU); x.stroke();
  }
}
function sprite(tier) {
  const key = H.mat() + ':' + B.u.toFixed(2) + ':' + DPR;
  if (key !== spriteKey) { sprites.clear(); spriteKey = key; }
  let s = sprites.get(tier);
  if (!s) {
    const r = F.TIERS[tier].r * B.u, half = Math.ceil(r * 1.3 * DPR);
    s = document.createElement('canvas'); s.width = s.height = half * 2;
    const x = s.getContext('2d'); x.scale(DPR, DPR); paint(x, tier, half / DPR, r);
    s.half = half / DPR; sprites.set(tier, s);
  }
  return s;
}
function drawItem(it, x, y, sc = 1, ang = 0, u = B.u) {
  if (it.k === 'c') {
    const s = sprite(it.tier), star = it.tier >= 5, k = sc * (u / B.u) * (star ? 1 + 0.018 * Math.sin(T * 3 + it.tier) : 1), h = s.half * k;
    if (it.tier === F.MAX_TIER) ang += T * 0.7; // le disque d'accrétion tourne
    if (ang) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(s, -h, -h, h * 2, h * 2); ctx.restore(); } else ctx.drawImage(s, x - h, y - h, h * 2, h * 2);
  } else if (it.k === 'r') { // débris
    const r = F.R_RUBBLE * u * sc; ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#4b4f63'; ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, rr = r * (0.82 + rnd(i * 3.3) * 0.26); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.lineTo(-r * 0.1, -r * 0.75); ctx.lineTo(r * 0.35, -r * 0.4); ctx.lineTo(-r * 0.2, -r * 0.1); ctx.fill(); ctx.restore();
  } else { // comète (explose) / matière exotique (copie)
    const r = F.R_SPECIAL * u * sc, bomb = it.k === 'b', p = 0.5 + 0.5 * Math.sin(T * (bomb ? 9 : 4)), col = bomb ? [140 + p * 115, 245, 255] : [255, 79 + p * 120, 216];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5); g.addColorStop(0, '#fff'); g.addColorStop(0.45, rgba(col, 0.95)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    ctx.fillStyle = '#0a0c1e'; ctx.font = `900 ${r * 1.05}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bomb ? '!' : '?', x, y + r * 0.06);
  }
}

/* ============================== rendu ============================== */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, lowFx ? 1.5 : 2); W = window.innerWidth; Hh = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR);
  SAT = $('#probe-t') ? $('#probe-t').offsetHeight : 0; SAB = $('#probe-b') ? $('#probe-b').offsetHeight : 0;
  const top = SAT + 104, bar = 86, availH = Hh - top - bar - SAB - 30;
  const u = Math.min((W - 28) / F.W, availH / F.HT, 60);
  B = { u, w: u * F.W, h: u * F.HT, x: (W - u * F.W) / 2, y: top + (availH - u * F.HT) / 2 };
  holdR = { x: B.x, y: B.y + B.h + 36, w: 78, h: 60 };
  texB = makeTex(G ? G.depth : 0); texA = null;
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function txt(s, x, y, size, col, align = 'center', font = 'Orbitron', weight = 900) { ctx.font = `${weight} ${size}px ${font},system-ui,sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = col; ctx.fillText(s, x, y); }
function glassBox(x, y, w, h, r, hi = 0.2) { // panneau de verre : voile, reflet haut, liseré
  rr(x, y, w, h, r); const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,255,255,.13)'); g.addColorStop(0.5, 'rgba(255,255,255,.035)'); g.addColorStop(1, 'rgba(255,255,255,.08)'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${hi})`; ctx.lineWidth = 1.2; ctx.stroke();
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sh = shake > 0.3 ? shake : 0, ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
  // espace : en changeant de secteur, l'ancien ciel file vers le haut
  const e = scroll > 0 ? 1 - (1 - scroll) ** 3 : 0, off = e * Hh;
  if (texA && scroll > 0) ctx.drawImage(texA, 0, off - Hh, W, Hh);
  ctx.drawImage(texB, 0, off, W, Hh);
  ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = (0.2 + 0.6 * Math.abs(Math.sin(T * s.z + s.p))) * s.z; const y = ((s.y + T * 0.006 * s.z) % 1) * Hh; ctx.fillRect(s.x * W, y, 1.6, scroll > 0 ? 1.6 + scroll * 60 * s.z : 1.6); }
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(ox, oy);
  // puits de gravité : une cuve de verre
  ctx.fillStyle = 'rgba(4,6,20,.42)'; rr(B.x - 4, B.y - 40, B.w + 8, B.h + 44, 22); ctx.fill();
  glassBox(B.x - 4, B.y - 40, B.w + 8, B.h + 44, 22, 0.26);
  const sheen = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); sheen.addColorStop(0, 'rgba(255,255,255,.1)'); sheen.addColorStop(0.07, 'rgba(255,255,255,0)'); sheen.addColorStop(0.95, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.07)'); ctx.fillStyle = sheen; ctx.fillRect(B.x, B.y - 30, B.w, B.h + 20);
  // ligne de danger
  const dg = G.danger, ly = sy(F.LINE);
  ctx.strokeStyle = dg > 0 ? rgba([255, 80, 110], 0.5 + 0.5 * Math.sin(T * 14)) : 'rgba(255,255,255,.22)'; ctx.lineWidth = dg > 0 ? 2.5 : 1; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(B.x + 6, ly); ctx.lineTo(B.x + B.w - 6, ly); ctx.stroke(); ctx.setLineDash([]);
  if (dg > 0) { const g = ctx.createLinearGradient(0, B.y - 40, 0, ly + B.u * 2); g.addColorStop(0, rgba([255, 50, 90], 0.36 * dg)); g.addColorStop(1, 'rgba(255,50,90,0)'); ctx.fillStyle = g; ctx.fillRect(B.x, B.y - 36, B.w, ly + B.u * 2 - B.y + 36); }
  // visée
  if (!G.over) {
    const it = G.cur, ax = sx(F.clampX(it, aimX)), ay = sy(F.DROP_Y), ready = G.cool <= 0;
    if (ready) { const g = ctx.createLinearGradient(0, ay, 0, B.y + B.h); g.addColorStop(0, 'rgba(255,255,255,.42)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.lineDashOffset = -T * 34; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, B.y + B.h); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt'; }
    ctx.globalAlpha = ready ? 1 : 0.35; drawItem(it, ax, ay + (ready ? Math.sin(T * 2.6) * 2 : 0), ready ? 1 : 0.8); ctx.globalAlpha = 1;
  }
  // astres
  for (const b of G.bodies) {
    const t0 = pops.get(b.id); let sc = 1;
    if (t0 != null) { const p = (T - t0) / 0.4; if (p >= 1) pops.delete(b.id); else sc = 1 + Math.sin(p * Math.PI * 2.2) * (1 - p) * 0.26 + (p < 0.15 ? (p / 0.15 - 1) * 0.4 : 0); }
    drawItem(b, sx(b.x), sy(b.y), sc, b.ang);
  }
  // jauge de saut, sous la cuve
  const fy = B.y + B.h + 10, p = clamp(G.drill / F.need(G.depth), 0, 1), gw = B.w - 8;
  rr(B.x + 4, fy, gw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  if (p > 0.01) { const hot = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); hot.addColorStop(0, '#4df3ff'); hot.addColorStop(0.6, '#ff4fd8'); hot.addColorStop(1, '#ffc247'); ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = lowFx ? 0 : 10 + 8 * p; rr(B.x + 4, fy, Math.max(8, gw * p), 8, 4); ctx.fillStyle = hot; ctx.fill(); ctx.shadowBlur = 0; }
  // effets
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) { const q = r.l / r.m, k = 1 - (1 - q) ** 3; ctx.strokeStyle = rgba(r.col, (1 - q) * 0.9); ctx.lineWidth = r.w * (1 - q) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU); ctx.stroke(); }
  for (const q of parts) { const a = 1 - q.l / q.m; ctx.fillStyle = rgba(q.col, a); ctx.beginPath(); ctx.arc(q.x, q.y, q.sz * (0.4 + a * 0.6), 0, TAU); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  for (const l of labels) { const a = clamp(1.6 - l.l * 1.9, 0, 1), s = l.l < 0.12 ? 0.6 + l.l / 0.12 * 0.4 : 1; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,20,.55)'; ctx.font = `900 ${l.sz * s}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.strokeText(l.txt, l.x, l.y - l.l * 46); ctx.fillStyle = rgba(l.col, 1); ctx.fillText(l.txt, l.x, l.y - l.l * 46); }
  ctx.globalAlpha = 1;
  ctx.restore();

  // HUD : score, secteur, record
  const cx = W / 2, ty = SAT + 44;
  ctx.shadowColor = 'rgba(77,243,255,.7)'; ctx.shadowBlur = lowFx ? 0 : 16; txt(fmt(shown), cx, ty, 32, '#fff'); ctx.shadowBlur = 0;
  txt(`SECTEUR ${G.depth + 1} · ${sectorName(G.depth).toUpperCase()}`, cx, ty + 20, 10.5, rgba(CY, 0.95), 'center', 'Orbitron', 700);
  if (sv.best) txt(G.score > sv.best ? 'NOUVEAU RECORD' : 'RECORD ' + fmt(sv.best), cx, ty + 35, 9.5, G.score > sv.best ? '#5dffc0' : 'rgba(255,255,255,.5)', 'center', 'Orbitron', 700);
  // barre du bas : réserve à gauche, suivants à droite
  const hr = holdR, by = hr.y;
  txt('RÉSERVE', hr.x + hr.w / 2, by - 6, 9, 'rgba(255,255,255,.6)', 'center', 'Orbitron', 700);
  glassBox(hr.x, by, hr.w, hr.h, 20, G.swapped ? 0.14 : 0.45);
  if (G.hold) { ctx.globalAlpha = G.swapped ? 0.4 : 1; drawItem(G.hold, hr.x + hr.w / 2, by + hr.h / 2, 1, 0, miniU(G.hold)); ctx.globalAlpha = 1; } else txt('⇄', hr.x + hr.w / 2, by + hr.h / 2 + 8, 22, 'rgba(255,255,255,.3)', 'center', 'system-ui', 400);
  const nx = B.x + B.w; txt('SUIVANT', nx - 62, by - 6, 9, 'rgba(255,255,255,.6)', 'center', 'Orbitron', 700);
  glassBox(nx - 124, by, 124, hr.h, 20);
  const gp = clamp(1 - (T - giftT) * 2, 0, 1);
  drawItem(G.queue[0], nx - 84, by + hr.h / 2, 1 + gp * 0.5, 0, miniU(G.queue[0])); ctx.globalAlpha = 0.55; drawItem(G.queue[1], nx - 32, by + hr.h / 2, 0.7, 0, miniU(G.queue[1])); ctx.globalAlpha = 1;
  // consignes intégrées (première partie)
  if (sv.seen < 2 && !G.over) { const m = G.drops === 0 ? 'Glisse pour viser · relâche pour lâcher' : G.fusions === 0 ? 'Deux astres identiques fusionnent' : G.depth === 0 ? 'Chaque fusion charge la jauge de saut' : ''; if (m) txt(m, cx, B.y + B.h * 0.42, 13, `rgba(255,255,255,${0.6 + 0.25 * Math.sin(T * 3)})`, 'center', 'system-ui', 600); }
  // annonce (chaîne, saut, nouvel astre)
  if (callout) { const c = callout, q = c.l / 1.2, s = q < 0.14 ? 1.5 - (q / 0.14) * 0.5 : 1, a = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1; ctx.globalAlpha = clamp(a, 0, 1); const y = B.y + B.h * 0.3; ctx.font = `900 ${Math.min(42, W * 0.094) * s}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.shadowColor = rgba(c.col, 0.9); ctx.shadowBlur = lowFx ? 0 : 22; ctx.fillStyle = '#fff'; ctx.fillText(c.txt, cx, y); ctx.shadowBlur = 0; if (c.sub) { ctx.font = '700 12px Orbitron,sans-serif'; ctx.fillStyle = rgba(c.col, 1); ctx.fillText(c.sub, cx, y + 24); } ctx.globalAlpha = 1; }
  if (flash > 0.01) { ctx.fillStyle = rgba(flashC, flash); ctx.fillRect(0, 0, W, Hh); }
}
const miniU = (it) => Math.min(B.u, 20 / (it.k === 'c' ? F.TIERS[it.tier].r : F.R_SPECIAL));

/* ============================== boucle ============================== */
function update(dt) {
  T += dt;
  if (hitstop > 0) hitstop -= dt; else if (!ended && !paused) { F.tick(G, dt); onEvents(); }
  shake *= Math.exp(-dt * 9); flash *= Math.exp(-dt * 7); if (scroll > 0) scroll = Math.max(0, scroll - dt * 1.1);
  shown += (G.score - shown) * Math.min(1, dt * 10); if (G.score - shown < 1) shown = G.score;
  for (const p of parts) { p.l += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
  for (const r of rings) r.l += dt; for (const l of labels) l.l += dt;
  parts = parts.filter((p) => p.l < p.m); rings = rings.filter((r) => r.l < r.m); labels = labels.filter((l) => l.l < 0.9);
  if (callout && (callout.l += dt) > 1.2) callout = null;
}
function frame(now) {
  raf = 0; if (!isOpen) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
  raf = requestAnimationFrame(frame);
}

/* ============================== entrées ============================== */
const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function onDown(e) {
  if (!G || G.over) return; const p = pt(e);
  if (p.y > holdR.y - 14 && p.x < holdR.x + holdR.w + 14) { if (F.swapHold(G)) { A.select(); H.vib(8); } return; }
  if (p.y > B.y + B.h + 22) return;
  aiming = true; aimX = (p.x - B.x) / B.u; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
}
function onMove(e) { if (aiming) aimX = (pt(e).x - B.x) / B.u; }
function onUp() { if (!aiming) return; aiming = false; if (F.drop(G, aimX)) { A.select(); H.vib(6); if (sv.seen < 2 && G.depth > 0) { sv.seen = 2; save(); } } }

/* ============================== écrans ============================== */
const CSS = `
#mn{position:fixed;inset:0;z-index:9;background:#05060f;display:none}#mn.on{display:block;animation:fade .3s}
#mn-cv{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#mn .icon{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px)}#mn-back{left:14px}#mn-help{right:14px}
#mn-m-over .stats{flex-wrap:wrap}#mn-m-over .stats div{min-width:40%}#mn-m-over .stats .rec b{color:#5dffc0}
.fg-q{width:100%;font-size:13px;color:rgba(255,255,255,.85)}
.fg-q .q{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}.fg-q .q:last-child{border:0}
.fg-q .q i{flex:none;width:46px;height:5px;border-radius:3px;background:rgba(255,255,255,.14);position:relative;overflow:hidden}.fg-q .q i::after{content:"";position:absolute;inset:0;width:var(--p);border-radius:3px;background:linear-gradient(90deg,#4df3ff,#ff4fd8)}
.fg-q .q.ok{color:#5dffc0}.fg-q .q.ok i::after{background:#5dffc0}.fg-q .q span{flex:1}.fg-q .q em{font-style:normal;color:rgba(255,255,255,.55);font-size:12px;white-space:nowrap}
#mn-lad{font-size:11.5px;line-height:1.6;color:rgba(255,255,255,.6)}
#s-title .hm-casc{align-self:center;display:flex;gap:8px;align-items:baseline;height:34px;padding:0 16px;border-radius:17px;font-size:13px;font-weight:600;color:var(--dim);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);margin-top:2px}
#s-title .hm-casc small{font-size:12px;font-weight:500;opacity:.8}
`;
const HTML = `
<div id="mn"><canvas id="mn-cv"></canvas>
<button class="icon glass" id="mn-back" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<button class="icon glass" id="mn-help" aria-label="Règles"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg></button></div>
<div class="modal" id="mn-m-over"><div class="card glass"><h2 id="mn-ot">Effondrement</h2><p id="mn-os"></p>
<div class="stats"><div id="mn-c1"><b id="mn-o1">0</b><span>points</span></div><div id="mn-c2"><b id="mn-o2">0</b><span>secteur</span></div><div id="mn-c3"><b id="mn-o3">0</b><span>chaîne max</span></div><div id="mn-c4"><b id="mn-o4" style="font-size:15px">–</b><span>plus gros astre</span></div></div>
<div class="fg-q" id="mn-q"></div>
<div class="btns"><button class="big primary" id="mn-again">Rejouer</button><button class="big glass" id="mn-menu">Menu</button></div></div></div>
<div class="modal" id="mn-m-help"><div class="card glass"><h2>Genèse</h2><p class="multi" id="mn-ht"></p><p id="mn-lad"></p><div class="btns"><button class="big primary" id="mn-hok">C'est parti</button></div></div></div>`;
const HELP = `Lâche les astres dans le puits. Deux identiques qui se touchent fusionnent en un astre plus gros.

Un seul lâcher qui déclenche plusieurs fusions, c'est une chaîne : chaque maillon multiplie les points. À ×5, tu gagnes une comète explosive.

Chaque fusion charge la jauge de saut. Pleine, tu passes au secteur suivant : l'onde vaporise les petits astres et les débris, et tu reçois de la matière exotique qui copie l'astre qu'elle touche.

Si la pile dépasse la ligne trop longtemps, tout s'effondre.`;

function endRun() {
  if (ended || !G) return; ended = true;
  const rec = { s: G.score > sv.best, d: G.depth + 1 > sv.depth, c: G.maxChain > sv.chain };
  sv.runs++; sv.seen = Math.max(sv.seen, 1); if (rec.s) sv.best = G.score; if (rec.d) sv.depth = G.depth + 1; if (rec.c) sv.chain = G.maxChain; sv.tier = Math.max(sv.tier, G.maxTier + 1); save();
  H.track('score', G.score, true); H.track('runs', 1);
  const energy = Math.min(80, Math.round(G.depth * 5 + G.score / 2000)); // proportionnel au jeu réel : rien à gagner à saborder une partie
  if (G.over) A.fail();
  setTimeout(() => {
    if (energy > 0) H.grant(energy);
    $('#mn-ot').textContent = rec.s && sv.runs > 1 ? 'Nouveau record !' : 'Effondrement';
    $('#mn-os').textContent = rec.s ? 'Ton plus bel univers jusqu\'ici.' : G.score > sv.best * 0.8 ? `À ${fmt(sv.best - G.score)} points de ton record.` : `Record : ${fmt(sv.best)} · secteur ${sv.depth}`;
    $('#mn-o1').textContent = fmt(G.score); $('#mn-o2').textContent = G.depth + 1; $('#mn-o3').textContent = '×' + G.maxChain; $('#mn-o4').textContent = BODIES[G.maxTier][0];
    $('#mn-c1').className = rec.s ? 'rec' : ''; $('#mn-c2').className = rec.d ? 'rec' : ''; $('#mn-c3').className = rec.c ? 'rec' : '';
    $('#mn-q').innerHTML = H.quests();
    $('#mn-m-over').classList.add('on');
  }, G.over ? 900 : 0);
  refreshTitle();
}
function newRun() {
  G = F.newGame(); G.maxSeen = 0; ended = false; parts = []; rings = []; labels = []; pops.clear(); callout = null; shown = 0; shake = flash = scroll = 0; aimX = F.W / 2; aiming = false;
  texB = makeTex(0); texA = null; $('#mn-m-over').classList.remove('on');
}
function refreshTitle() { const s = $('#b-mine-s'); if (s) s.textContent = sv.best ? `Record ${fmt(sv.best)} · secteur ${sv.depth}` : 'De l\'orbe au trou noir'; }
export const busy = () => isOpen;
export const stats = () => ({ ...sv });
export function open() {
  isOpen = true; $('#mn').classList.add('on'); lowFx = (navigator.hardwareConcurrency || 4) <= 4;
  G = null; resize(); newRun(); last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
}
function close() { isOpen = false; $('#mn').classList.remove('on'); $('#mn-m-over').classList.remove('on'); refreshTitle(); }
export function init(opts) {
  Object.assign(H, opts);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('div'); d.innerHTML = HTML; document.body.append(...d.children);
  cv = $('#mn-cv'); ctx = cv.getContext('2d');
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', () => { aiming = false; });
  window.addEventListener('resize', () => { if (isOpen) resize(); });
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  const click = (el, f) => $(el).addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  click('#mn-back', () => { if (G && !ended && G.drops > 8) { endRun(); return; } close(); }); // partie entamée : on la comptabilise
  click('#mn-help', () => { $('#mn-ht').textContent = HELP; $('#mn-lad').textContent = BODIES.map((b) => b[0]).join(' › '); $('#mn-m-help').classList.add('on'); paused = true; });
  click('#mn-hok', () => { $('#mn-m-help').classList.remove('on'); paused = false; }); click('#mn-again', newRun); click('#mn-menu', close);
  // bouton principal de l'accueil (home.js le transforme en héros) ; Cascade devient un lien discret
  const menu = $('#s-title .menu');
  if (menu && !$('#b-mine')) { const b = document.createElement('button'); b.className = 'big primary hero'; b.id = 'b-mine'; b.innerHTML = '<span>Genèse</span><small id="b-mine-s"></small>'; menu.insertBefore(b, menu.firstChild); b.addEventListener('click', () => { A.ui(); H.vib(9); open(); }); }
  refreshTitle();
  window.__mine = { get G() { return G; }, get B() { return B; }, F };
}
