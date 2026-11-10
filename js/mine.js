// Critical — « Forage » : interface du mode principal (module autonome, comme editor.js / chest.js).
// Logique dans forage.js (pure, testée) ; ici : rendu, glisser-déposer, animation des réactions en chaîne, effets, sons.
import * as A from './audio.js';
import * as Skins from './skins.js';
import { COLS, ROWS, N, BIOMES, newGame, place, step, preview, pressureLimit } from './forage.js';

const KEY = 'critical.mine.v1', TAU = Math.PI * 2;
const sv = { best: 0, depth: 0, runs: 0, helpV: 0 };
try { Object.assign(sv, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* ignore */ } };
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const easeBack = (t) => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const H = { vib: () => {}, toast: () => {}, COL: { 1: [77, 243, 255], 2: [255, 79, 216], 3: [255, 194, 71] }, mat: () => 'glass', gl: () => 1, boom: () => {}, reward: () => {} };
const NAMES = { 1: 'Croix', 2: 'Pulsar', 3: 'Étoile' };
const BLK = { dirt: ['#85593a', '#4d301c'], rock: ['#76809a', '#3c4457'], ore: ['#566078', '#272d3d'], dyn: ['#e0414c', '#801a26'], gem: ['#473478', '#1f1440'], obs: ['#332552', '#0e0819'] };

/* ============================== état ============================== */
let G = null, ev = null, evT = 0, speed = 1, isOpen = false, raf = 0, T = 0, last = 0, cv, ctx, W = 0, Hh = 0, DPR = 1, SAT = 0, SAB = 0;
let B = { x: 0, y: 0, cs: 40 }, trayRects = [];
let rays = [], parts = [], rings = [], labels = [], drag = null, sel = -1, pv = null, shake = 0, flash = 0, flashC = [255, 255, 255], hitstop = 0;
let shown = 0, shownTxt = '', banner = null, chainBig = null, hue = 28, trayT = 1, overT = 0, hintOn = true, fxq = 1, lowFx = false;

/* ============================== effets ============================== */
const ring = (x, y, r0, r1, life, col, w = 0.08) => rings.push({ x, y, r0, r1, l: 0, m: life, col, w });
const burst = (x, y, n, col, sp, life = 0.7, sz = 2.5) => {
  n = Math.round(n * fxq);
  for (let i = 0; i < n && parts.length < 600; i++) { const a = Math.random() * TAU, s = sp * (0.25 + Math.random() * 0.85); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 0, m: life * (0.5 + Math.random() * 0.7), s: sz * (0.6 + Math.random() * 0.9), col: Math.random() < 0.3 ? [255, 255, 255] : col, g: 0 }); }
};
const debris = (x, y, kind) => {
  const c = BLK[kind][0].match(/\w\w/g).map((h) => parseInt(h, 16));
  for (let i = 0, n = Math.round(8 * fxq); i < n && parts.length < 600; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * B.cs * 5, vy: -Math.random() * B.cs * 3.5, l: 0, m: 0.7 + Math.random() * 0.5, s: B.cs * (0.05 + Math.random() * 0.08), col: c, g: B.cs * 16, sq: 1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 });
};
const cellC = (i, off = 0) => ({ x: B.x + ((i % COLS) + 0.5) * B.cs, y: B.y + (((i / COLS) | 0) + 0.5 + off) * B.cs });
const anim = (c) => c.a || (c.a = { off: 0, v: 0, sh: 0, fl: 0, pop: 1, sq: 0, nw: 0 });

/* ============================== déroulement d'un tour ============================== */
function startEv(e) {
  ev = e; evT = 0; const ch = e.chain || 0;
  switch (e.t) {
    case 'fire': {
      let md = 0;
      for (const r of e.rays) {
        const a = cellC(r.from), tx = r.to >= 0 ? r.from % COLS + r.dx * r.dist : (r.from % COLS) + r.dx * (r.dist - 0.5), ty = r.to >= 0 ? ((r.from / COLS) | 0) + r.dy * r.dist : ((r.from / COLS) | 0) + r.dy * (r.dist - 0.5);
        const dur = 0.07 + 0.032 * Math.min(r.dist, 9); md = Math.max(md, dur);
        rays.push({ x0: a.x, y0: a.y, x1: B.x + (tx + 0.5) * B.cs, y1: B.y + (ty + 0.5) * B.cs, t: 0, dur, col: H.COL[r.ty], w: 0.08 + 0.02 * Math.min(r.dmg, 3), hit: r.to >= 0 });
      }
      ev.dur = md + 0.06;
      for (const s of e.src) { const c = cellC(s.i), col = H.COL[s.ty]; ring(c.x, c.y, B.cs * 0.15, B.cs * (1.5 + Math.min(ch, 9) * 0.12), 0.45, col); ring(c.x, c.y, B.cs * 0.1, B.cs * 0.9, 0.3, [255, 255, 255], 0.05); burst(c.x, c.y, 14 + ch * 2, col, B.cs * 4, 0.8, 2.4); H.boom(ch, { ring, burst }, c.x, c.y, col, B.cs); }
      A.boom(ch); H.vib(ch >= 5 ? [16, 20, 22] : Math.min(10 + ch * 3, 30));
      shake = Math.max(shake, Math.min(15, 2 + ch * 1.7)); flash = Math.max(flash, Math.min(0.9, 0.2 + ch * 0.07)); flashC = H.COL[e.src[0] ? e.src[0].ty : 1];
      if (ch >= 2) chainBig = { n: ch, t: 0 };
      break;
    }
    case 'impact': {
      ev.dur = 0.15 + (e.destroyed.length ? 0.04 : 0);
      for (const d of e.damaged) { const c = G.cells[d.i], a = anim(c), p = cellC(d.i); a.sh = 1; a.fl = 1; debris(p.x, p.y, c.b); }
      for (const d of e.destroyed) { const p = cellC(d.i); debris(p.x, p.y, d.b); burst(p.x, p.y, d.b === 'gem' ? 16 : 6, d.b === 'gem' ? [255, 120, 220] : [255, 220, 160], B.cs * 3, 0.6, 2); if (d.b === 'dyn') ring(p.x, p.y, B.cs * 0.2, B.cs * 1.6, 0.4, [255, 120, 80], 0.1); }
      for (const s of e.spawned) { const c = G.cells[s.i], a = anim(c), p = cellC(s.i); a.pop = 0; ring(p.x, p.y, B.cs * 0.1, B.cs * 0.9, 0.4, H.COL[s.ty], 0.07); burst(p.x, p.y, 14, H.COL[s.ty], B.cs * 3.5, 0.7, 2.4); }
      for (const i of e.hits) { const c = G.cells[i]; if (c && c.k === 'n') anim(c).fl = 1; }
      if (e.destroyed.length) {
        const cx = e.destroyed.reduce((s, d) => s + cellC(d.i).x, 0) / e.destroyed.length, cy = e.destroyed.reduce((s, d) => s + cellC(d.i).y, 0) / e.destroyed.length;
        labels.push({ x: cx, y: cy, txt: '+' + e.score, t: 0, big: ch >= 3 }); (A.crack || A.hit)(); H.vib(8);
        if (e.destroyed.length >= 6) hitstop = 0.05;
      } else if (e.damaged.length) (A.crack || A.hit)();
      if (e.biome) { banner = { txt: e.biome.n.toUpperCase(), sub: `${G.depth} m`, t: 0 }; A.win(); H.vib([20, 40, 60]); hue = e.biome.hue; flash = 0.8; flashC = [255, 255, 255]; }
      break;
    }
    case 'fall': {
      let mr = 0;
      for (const f of e.falls) { const c = G.cells[f.to], a = anim(c); a.off = -f.rows - (a.nw || 0); a.nw = 0; a.v = 0; mr = Math.max(mr, f.rows + (0)); }
      ev.dur = e.falls.length ? Math.sqrt((2 * (mr + 0.3)) / 34) + 0.1 : 0.03;
      break;
    }
    case 'auto': ev.dur = 0.08; break;
    case 'settle': ev.dur = 0.1; if (e.gain >= 8 || e.chain >= 3) { banner = { txt: e.chain >= 6 ? 'CHAÎNE ÉNORME' : e.chain >= 4 ? 'GRANDE CHAÎNE' : 'CHAÎNE', sub: `×${e.chain} · ${e.gain} blocs`, t: 0 }; A.win(); H.vib([14, 30, 14]); } break;
    case 'cave': {
      for (const x of e.cols) { const c = G.cells[x], a = anim(c); a.nw = 1.6; a.off = -1.6; }
      ev.dur = 0.45;
      if (e.strata) { banner = { txt: 'NOUVELLE STRATE', sub: `${G.depth} m`, t: 0 }; (A.land || (() => {}))(); H.vib(10); break; }
      A.rumble && A.rumble(); H.vib([40, 30, 60]); shake = 11;
      for (let k = 0; k < 14; k++) parts.push({ x: B.x + Math.random() * B.cs * COLS, y: B.y + 4, vx: (Math.random() - 0.5) * 30, vy: Math.random() * B.cs * 2, l: 0, m: 0.9, s: 2 + Math.random() * 2, col: [180, 150, 120], g: B.cs * 4 });
      banner = { txt: 'ÉBOULEMENT', sub: 'Enchaîne pour calmer la roche', t: 0, warn: true };
      break;
    }
    case 'idle': ev = null; speed = 1; trayT = 0; pv = null; hintOn = false; break;
    case 'over': ev.dur = 1.1; shake = 18; flash = 1; flashC = [255, 70, 90]; A.fail(); H.vib([70, 40, 70, 40, 120]); overT = 0; break;
    default: ev.dur = 0.02;
  }
}
function nextEv() {
  if (ev && ev.t === 'over') { ev = null; showOver(); return; }
  if (ev && ev.t === 'link') { startEv(step(G)); return; }
  if (!G || G.phase === 'idle') { ev = null; return; }
  startEv(step(G));
}
function doPlace(slot, i) {
  const ty = G.tray[slot], r = place(G, slot, i); if (!r) return false;
  const c = G.cells[i], a = anim(c); a.pop = 0; const p = cellC(i);
  ring(p.x, p.y, B.cs * 0.1, B.cs * 0.7, 0.3, [255, 255, 255], 0.05); A.tap(); H.vib(14); sel = -1; drag = null; pv = null; hintOn = false;
  if (r.run.length) { ev = { t: 'link', run: r.run, dur: 0.24 }; evT = 0; A.mult && A.mult(2); H.vib([10, 20, 10]); } else startEv(step(G));
  return true;
}

/* ============================== rendu ============================== */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; Hh = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); cv.style.width = W + 'px'; cv.style.height = Hh + 'px';
  SAT = $('#probe-t') ? $('#probe-t').offsetHeight : 0; SAB = $('#probe-b') ? $('#probe-b').offsetHeight : 0;
  const top = SAT + 142, trayH = Math.min(122, Hh * 0.15), availH = Hh - top - trayH - SAB - 44;
  const cs = Math.min((W - 28) / COLS, availH / ROWS, 74);
  B = { cs, x: (W - cs * COLS) / 2, y: top };
  const sw = Math.min(104, (W - 40) / 3), ty = B.y + cs * ROWS + 20;
  trayRects = [0, 1, 2].map((k) => ({ x: W / 2 + (k - 1) * (sw + 10) - sw / 2, y: ty, w: sw, h: trayH }));
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const stars = Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, p: Math.random() * 6 }));
function bg() {
  const target = G ? BLK && BIOMES[G.biome].hue : 28; hue += (target - hue) * 0.04;
  const g = ctx.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, `hsl(${hue} 38% 8%)`); g.addColorStop(1, `hsl(${hue + 24} 48% 3%)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
  const dep = G ? G.depth : 0; ctx.fillStyle = `hsla(${hue},40%,50%,.05)`;
  for (let i = 0; i < 9; i++) { const y = (((i * 130 - dep * 4) % 1170) + 1170) % 1170 - 100; ctx.fillRect(0, y * (Hh / 900), W, 26 + (i % 3) * 14); }
  ctx.globalCompositeOperation = 'lighter';
  const rg = ctx.createRadialGradient(W / 2, Hh * 0.45, 0, W / 2, Hh * 0.45, Math.max(W, Hh) * 0.7); rg.addColorStop(0, `hsla(${hue + 20},80%,50%,.13)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, Hh);
  ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = (0.15 + 0.4 * Math.abs(Math.sin(T * s.z + s.p))) * s.z; ctx.fillRect(s.x * W, ((s.y + T * 0.01 * s.z) % 1) * Hh, 1.5, 1.5); }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function drawBlock(c, x, y, cs, i) {
  const a = c.a || {}, k = c.b, [c0, c1] = BLK[k], s = cs - 4, r = cs * 0.17, sq = a.sq ? 1 - a.sq * 0.35 * Math.sin((1 - a.sq / 0.18) * Math.PI) : 1;
  ctx.save(); ctx.translate(x, y + (1 - sq) * cs * 0.5); ctx.scale(1 + (1 - sq) * 0.5, sq);
  if (a.sh) ctx.translate((Math.random() - 0.5) * cs * 0.12 * a.sh, 0);
  const g = ctx.createLinearGradient(0, -s / 2, 0, s / 2); g.addColorStop(0, c0); g.addColorStop(1, c1); rr(-s / 2, -s / 2, s, s, r); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(-s / 2, -s / 2, s, s, r); ctx.clip();
  if (k === 'dirt') { ctx.fillStyle = 'rgba(0,0,0,.22)'; for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc((rnd(i * 7 + q) - 0.5) * s * 0.7, (rnd(i * 11 + q) - 0.5) * s * 0.7, s * (0.04 + rnd(i + q) * 0.05), 0, TAU); ctx.fill(); } }
  else if (k === 'rock' || k === 'ore') { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(-s / 2, -s * 0.1); ctx.lineTo(-s * 0.1, -s / 2); ctx.lineTo(s * 0.25, -s / 2); ctx.lineTo(-s / 2, s * 0.3); ctx.fill(); }
  if (k === 'ore') { ctx.globalCompositeOperation = 'lighter'; for (let q = 0; q < 3; q++) { const px = (rnd(i + q * 5) - 0.5) * s * 0.6, py = (rnd(i * 3 + q) - 0.5) * s * 0.6, p = 0.6 + 0.4 * Math.sin(T * 3 + q * 2 + i); const gg = ctx.createRadialGradient(px, py, 0, px, py, s * 0.28); gg.addColorStop(0, rgba(H.COL[1], 0.9 * p)); gg.addColorStop(1, rgba(H.COL[1], 0)); ctx.fillStyle = gg; ctx.fillRect(px - s * 0.3, py - s * 0.3, s * 0.6, s * 0.6); } ctx.globalCompositeOperation = 'source-over'; }
  if (k === 'dyn') { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(-s / 2, -s * 0.18, s, s * 0.1); ctx.fillRect(-s / 2, s * 0.08, s, s * 0.1); }
  if (k === 'gem') { ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5); gg.addColorStop(0, 'rgba(255,140,230,.7)'); gg.addColorStop(1, 'rgba(255,140,230,0)'); ctx.fillStyle = gg; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.26, 0); ctx.lineTo(0, s * 0.3); ctx.lineTo(-s * 0.26, 0); ctx.closePath(); const dg = ctx.createLinearGradient(-s * 0.2, -s * 0.3, s * 0.2, s * 0.3); dg.addColorStop(0, '#fff'); dg.addColorStop(0.5, '#ff9be8'); dg.addColorStop(1, '#6ad7ff'); ctx.fillStyle = dg; ctx.fill(); }
  if (k === 'obs') { ctx.strokeStyle = 'rgba(190,150,255,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.1); ctx.lineTo(s * 0.1, -s * 0.42); ctx.stroke(); ctx.fillStyle = 'rgba(190,150,255,.18)'; ctx.fillRect(-s / 2, s * 0.2, s, s * 0.3); }
  if (c.hp < c.max) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = Math.max(1.2, cs * 0.03); ctx.beginPath(); for (let q = 0; q < c.max - c.hp + 1; q++) { let px = (rnd(i + q * 3) - 0.5) * s * 0.4, py = -s * 0.45; ctx.moveTo(px, py); for (let z = 0; z < 4; z++) { px += (rnd(i * 5 + q + z) - 0.5) * s * 0.35; py += s * 0.24; ctx.lineTo(px, py); } } ctx.stroke(); }
  if (a.fl) { ctx.fillStyle = `rgba(255,255,255,${a.fl * 0.7})`; ctx.fillRect(-s / 2, -s / 2, s, s); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; rr(-s / 2, -s / 2, s, s, r); ctx.stroke();
  if (k === 'dyn') { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -s / 2); ctx.quadraticCurveTo(s * 0.12, -s * 0.62, s * 0.2, -s * 0.56); ctx.stroke(); ctx.fillStyle = `rgba(255,${180 + Math.sin(T * 30) * 60},60,.95)`; ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.56, 2.6, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawNucleus(c, x, y, cs) {
  const a = c.a || {}, k = a.pop >= 1 ? 1 : easeBack(clamp(a.pop, 0, 1)), r = cs * 0.34 * Math.max(0.01, k) * (1 + 0.03 * Math.sin(T * 2.4 + x));
  Skins.drawOrb(ctx, H.mat(), x, y, r, H.COL[c.ty], c.ty, T, { gl: H.gl() * (a.fl ? 1.8 : 1), fast: lowFx });
  if (a.fl) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,255,255,${a.fl * 0.5})`; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
}
function pattern(x, y, ty, s) { // mini-icône de la géométrie d'alignement
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
  if (ty !== 2) { ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); }
  if (ty !== 1) { const d = s * 0.78; ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); }
  ctx.stroke();
}
function draw(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); bg();
  ctx.save(); if (shake > 0.1) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  const { x, y, cs } = B, bw = cs * COLS, bh = cs * ROWS, lim = G ? pressureLimit(G.depth) : 9, pr = G ? G.pressure : 0;
  // panneau de verre
  rr(x - 10, y - 10, bw + 20, bh + 20, 24); const pg = ctx.createLinearGradient(x, y, x + bw, y + bh); pg.addColorStop(0, 'rgba(255,255,255,.1)'); pg.addColorStop(0.5, 'rgba(255,255,255,.03)'); pg.addColorStop(1, 'rgba(255,255,255,.07)'); ctx.fillStyle = pg; ctx.fill();
  const danger = clamp((pr + 1) / lim, 0, 1); ctx.strokeStyle = pr >= lim - 1 ? `rgba(255,90,110,${0.5 + 0.35 * Math.sin(T * 8)})` : 'rgba(255,255,255,.2)'; ctx.lineWidth = pr >= lim - 1 ? 2 : 1.2; ctx.stroke();
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { rr(x + c * cs + 2.5, y + r * cs + 2.5, cs - 5, cs - 5, cs * 0.18); ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fill(); }
  // jauge d'éboulement
  const sw = Math.min(260, bw), sx = x + (bw - sw) / 2, segW = sw / lim - 4;
  for (let k = 0; k < lim; k++) { const on = k < pr, col = pr >= lim - 1 ? [255, 90, 110] : pr >= lim - 3 ? [255, 194, 71] : [77, 243, 255]; rr(sx + k * (segW + 4), y - 26, segW, 6, 3); ctx.fillStyle = on ? rgba(col, 0.95) : 'rgba(255,255,255,.14)'; ctx.fill(); }
  ctx.fillStyle = 'rgba(238,244,255,.55)'; ctx.font = '600 11px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(pr >= lim - 1 ? 'ÉBOULEMENT IMMINENT' : 'ÉBOULEMENT', x + bw / 2, y - 31);
  if (G) {
    // indice du tutoriel
    if (hintOn && sv.runs === 0 && G.turns === 0) for (const cx of [4, 1]) { const p = cellC((ROWS - 5) * COLS + cx), q = (T * 1.2) % 1; ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - q)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, cs * (0.3 + q * 0.4), 0, TAU); ctx.stroke(); }
    // blocs et noyaux
    for (let i = 0; i < N; i++) { const c = G.cells[i]; if (!c) continue; const a = c.a, p = cellC(i, a ? a.off : 0); if (p.y < B.y - cs * 2) continue; if (c.k === 'b') drawBlock(c, p.x, p.y, cs, i); else drawNucleus(c, p.x, p.y, cs); }
    if (ev && ev.t === 'link') { const q = clamp(evT / ev.dur, 0, 1); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - q * 0.5)})`; ctx.lineWidth = 3 + q * 4; ctx.lineCap = 'round'; const ps = ev.run.map((i) => cellC(i)).sort((a, b) => a.x - b.x || a.y - b.y); ctx.beginPath(); ps.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); for (const p of ps) { ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, cs * (0.4 + q * 0.3), 0, TAU); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
    // aperçu pendant le glisser
    if (drag && drag.moved && drag.cell >= 0) {
      const p = cellC(drag.cell), ty = G.tray[drag.slot];
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; rr(p.x - cs / 2 + 3, p.y - cs / 2 + 3, cs - 6, cs - 6, cs * 0.18); ctx.stroke();
      if (pv && pv.run.length) {
        ctx.globalCompositeOperation = 'lighter';
        for (const j of pv.run) { const q = cellC(j); ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.3 * Math.sin(T * 10)})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(q.x, q.y, cs * 0.46, 0, TAU); ctx.stroke(); }
        ctx.setLineDash([cs * 0.12, cs * 0.14]); ctx.lineDashOffset = -T * 40;
        for (const r of pv.rays) { const a = cellC(r.from), tx = r.to >= 0 ? r.from % COLS + r.dx * r.dist : (r.from % COLS) + r.dx * (r.dist - 0.5), tyy = r.to >= 0 ? ((r.from / COLS) | 0) + r.dy * r.dist : ((r.from / COLS) | 0) + r.dy * (r.dist - 0.5); ctx.strokeStyle = rgba(H.COL[r.ty], 0.55); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(B.x + (tx + 0.5) * cs, B.y + (tyy + 0.5) * cs); ctx.stroke(); }
        ctx.setLineDash([]); for (const r of pv.rays) if (r.to >= 0) { const q = cellC(r.to); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, cs * 0.28, 0, TAU); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
      }
      Skins.drawOrb(ctx, H.mat(), p.x, p.y, cs * 0.34, H.COL[ty], ty, T, { gl: H.gl(), a: 0.6, fast: lowFx });
    }
  }
  // tirs
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const r of rays) { const p = clamp(r.t / r.dur, 0, 1), hx = lerp(r.x0, r.x1, p), hy = lerp(r.y0, r.y1, p), tp = Math.max(0, p - 0.4), tx = lerp(r.x0, r.x1, tp), ty = lerp(r.y0, r.y1, tp); const tg = ctx.createLinearGradient(hx, hy, tx, ty); tg.addColorStop(0, rgba(r.col, 0.95)); tg.addColorStop(1, rgba(r.col, 0)); ctx.strokeStyle = tg; ctx.lineWidth = cs * r.w * 1.6; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke(); const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, cs * 0.26); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.3, rgba(r.col, 0.8)); g.addColorStop(1, rgba(r.col, 0)); ctx.fillStyle = g; ctx.fillRect(hx - cs * 0.27, hy - cs * 0.27, cs * 0.54, cs * 0.54); }
  for (const r of rings) { const k = r.l / r.m; ctx.strokeStyle = rgba(r.col, (1 - k) * 0.9); ctx.lineWidth = Math.max(0.6, cs * r.w * (1 - k)); ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, 1 - (1 - k) ** 3), 0, TAU); ctx.stroke(); }
  for (const p of parts) { const k = p.l / p.m; if (p.sq) { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rgba(p.col, 1 - k); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2); ctx.restore(); ctx.globalCompositeOperation = 'lighter'; } else { ctx.fillStyle = rgba(p.col, (1 - k) ** 0.8); ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1 - k * 0.6), 0, TAU); ctx.fill(); } }
  ctx.globalCompositeOperation = 'source-over'; ctx.restore();
  // plateau d'étiquettes, bannières
  for (const l of labels) { const k = l.t / 0.9; ctx.globalAlpha = 1 - k; ctx.fillStyle = l.big ? '#ffe08a' : '#fff'; ctx.font = `900 ${l.big ? 24 : 17}px Orbitron, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(l.txt, l.x, l.y - k * cs * 0.9); } ctx.globalAlpha = 1;
  if (chainBig) { const k = chainBig.t / 0.8, pop = 1 + Math.max(0, 0.4 - chainBig.t * 2.5); ctx.save(); ctx.translate(B.x + bw / 2, B.y + bh * 0.2); ctx.scale(pop, pop); ctx.globalAlpha = clamp(1.25 - k, 0, 1); ctx.textAlign = 'center'; ctx.font = `900 ${36 + Math.min(chainBig.n, 12) * 3}px Orbitron, system-ui, sans-serif`; const h2 = lerp(190, 330, clamp((chainBig.n - 2) / 8, 0, 1)); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `hsla(${h2},100%,60%,.6)`; ctx.fillText('×' + chainBig.n, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `hsl(${h2},100%,92%)`; ctx.fillText('×' + chainBig.n, 0, 0); ctx.restore(); }
  if (banner) { const k = banner.t / 1.8, a = k < 0.15 ? k / 0.15 : clamp((1 - k) / 0.4, 0, 1); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.fillStyle = banner.warn ? '#ff9aa8' : '#fff'; ctx.font = '900 28px Orbitron, system-ui, sans-serif'; ctx.fillText(banner.txt, B.x + bw / 2, B.y + bh * 0.42); ctx.fillStyle = 'rgba(238,244,255,.8)'; ctx.font = '600 14px ui-rounded, system-ui, sans-serif'; ctx.fillText(banner.sub, B.x + bw / 2, B.y + bh * 0.42 + 26); ctx.globalAlpha = 1; }
  // plateau de noyaux (3 emplacements)
  if (G) trayRects.forEach((r, k) => {
    const ty = G.tray[k], isSel = sel === k, pop = easeBack(clamp((trayT - k * 0.08) / 0.3, 0, 1)), cx = r.x + r.w / 2, cy = r.y + r.h * 0.4;
    rr(r.x, r.y, r.w, r.h, 22); const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); g.addColorStop(0, isSel ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.1)'); g.addColorStop(1, 'rgba(255,255,255,.03)'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = isSel ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.2)'; ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();
    if (!ty || (drag && drag.slot === k && drag.moved)) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.beginPath(); ctx.arc(cx, cy, r.w * 0.2, 0, TAU); ctx.fill(); return; }
    Skins.drawOrb(ctx, H.mat(), cx, cy, r.w * 0.26 * Math.max(0.01, pop), H.COL[ty], ty, T, { gl: H.gl(), fast: lowFx });
    pattern(cx - 16, r.y + r.h * 0.8, ty, 6); ctx.fillStyle = 'rgba(238,244,255,.7)'; ctx.font = '600 12px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(NAMES[ty], cx - 4, r.y + r.h * 0.8 + 4);
  });
  if (drag && drag.moved && G) { const ty = G.tray[drag.slot]; Skins.drawOrb(ctx, H.mat(), drag.x, drag.y - cs * 1.25, cs * 0.4, H.COL[ty], ty, T, { gl: H.gl() * 1.3, fast: lowFx }); }
  if (flash > 0.02) { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(W / 2, Hh * 0.45, 0, W / 2, Hh * 0.45, Math.max(W, Hh) * 0.8); g.addColorStop(0, rgba(flashC, flash * 0.3)); g.addColorStop(1, rgba(flashC, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh); ctx.globalCompositeOperation = 'source-over'; }
  const vg = ctx.createRadialGradient(W / 2, Hh / 2, Math.min(W, Hh) * 0.45, W / 2, Hh / 2, Math.max(W, Hh) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, Hh);
}

/* ============================== boucle ============================== */
function update(dt) {
  T += dt;
  if (hitstop > 0) hitstop -= dt;
  else if (ev) { evT += dt * speed; for (const r of rays) r.t += dt * speed; if (evT >= ev.dur) nextEv(); }
  for (let i = rays.length - 1; i >= 0; i--) { if (!ev || ev.t !== 'fire') rays[i].t += dt; if (rays[i].t > rays[i].dur + 0.1) rays.splice(i, 1); }
  if (G) for (const c of G.cells) { const a = c && c.a; if (!a) continue; if (a.off < 0) { a.v += 34 * dt; a.off += a.v * dt; if (a.off >= 0) { if (a.v > 5) { a.sq = 0.18; (A.land || (() => {}))(); } a.off = 0; a.v = 0; } } a.sh = Math.max(0, a.sh - dt * 5); a.fl = Math.max(0, a.fl - dt * 4); if (a.pop < 1) a.pop += dt * 4; if (a.sq > 0) a.sq = Math.max(0, a.sq - dt); }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].l += dt; if (rings[i].l >= rings[i].m) rings.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.l += dt; if (p.l >= p.m) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; } const d = p.g ? 1 : Math.exp(-3 * dt); p.vx *= d; p.vy = p.vy * d + (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.vr) p.rot += p.vr * dt; }
  for (let i = labels.length - 1; i >= 0; i--) { labels[i].t += dt; if (labels[i].t > 0.9) labels.splice(i, 1); }
  if (banner) { banner.t += dt; if (banner.t > 1.8) banner = null; } if (chainBig) { chainBig.t += dt; if (chainBig.t > 0.8) chainBig = null; }
  shake = Math.max(0, shake - dt * 40); flash = Math.max(0, flash - dt * 3); trayT += dt;
  if (G) { shown += (G.score - shown) * Math.min(1, dt * 8); if (G.score - shown < 1) shown = G.score; const t = Math.round(shown).toLocaleString('fr-FR') + '|' + G.depth + '|' + G.biome; if (t !== shownTxt) { shownTxt = t; $('#mn-depth').textContent = G.depth + ' m'; $('#mn-score').textContent = Math.round(shown).toLocaleString('fr-FR'); $('#mn-bio').textContent = BIOMES[G.biome].n.toUpperCase(); } }
}
function frame(now) {
  if (!isOpen) { raf = 0; return; }
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); draw(dt);
}

/* ============================== entrées ============================== */
function cellAtPoint(px, py) { const x = Math.floor((px - B.x) / B.cs), y = Math.floor((py - B.y) / B.cs); return x >= 0 && y >= 0 && x < COLS && y < ROWS ? y * COLS + x : -1; }
function targetFor(px, py) { // la case libre la plus proche de l'orbe fantôme (au-dessus du doigt)
  const gx = px, gy = py - B.cs * 1.25; let best = -1, bd = (B.cs * 0.95) ** 2;
  for (let i = 0; i < N; i++) { if (G.cells[i]) continue; const c = cellC(i), d = (c.x - gx) ** 2 + (c.y - gy) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
function onDown(e) {
  if (!isOpen || !G) return;
  if (ev) { speed = 2.6; return; } // un tap accélère la résolution de la chaîne
  if (G.over) return;
  const r = trayRects.findIndex((q) => e.clientX >= q.x && e.clientX <= q.x + q.w && e.clientY >= q.y && e.clientY <= q.y + q.h);
  if (r >= 0 && G.tray[r]) { drag = { slot: r, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, cell: -1, id: e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } A.select(); H.vib(6); return; }
  if (sel >= 0) { const i = cellAtPoint(e.clientX, e.clientY); if (i >= 0 && !G.cells[i]) doPlace(sel, i); }
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.clientX; drag.y = e.clientY;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
  if (drag.moved) { const c = targetFor(e.clientX, e.clientY); if (c !== drag.cell) { drag.cell = c; pv = c >= 0 ? preview(G, c, G.tray[drag.slot]) : null; if (c >= 0) H.vib(3); } }
}
function onUp(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag; drag = null;
  if (d.moved) { if (d.cell >= 0) doPlace(d.slot, d.cell); else { pv = null; A.ui(); } }
  else { sel = sel === d.slot ? -1 : d.slot; }
}

/* ============================== écrans ============================== */
const CSS = `
#mn{position:fixed;inset:0;z-index:9;background:#05060f;display:none}#mn.on{display:block;animation:fade .3s}
#mn-cv{position:absolute;inset:0;touch-action:none;display:block}
.mn-top{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 0;display:flex;gap:10px;align-items:flex-start;pointer-events:none}.mn-top>*{pointer-events:auto}
.mn-top .icon svg{width:22px;height:22px}
.mn-stat{flex:1;border-radius:20px;padding:8px 12px 9px;text-align:center;display:flex;flex-direction:column;align-items:center;line-height:1.15}
.mn-stat small{font-size:11px;letter-spacing:2.5px;color:var(--dim);font-weight:600}.mn-stat b{font-family:var(--disp);font-size:30px;font-weight:900}.mn-stat span{font-family:var(--disp);font-size:13px;color:var(--am)}
#s-title .hm-casc{align-self:center;display:flex;gap:8px;align-items:baseline;height:34px;padding:0 16px;border-radius:17px;font-size:13px;font-weight:600;color:var(--dim);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);margin-top:2px}
#s-title .hm-casc small{font-size:12px;font-weight:500;opacity:.8}
`;
const HTML = `
<div id="mn"><canvas id="mn-cv"></canvas>
<div class="mn-top"><button class="icon glass" id="mn-back" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<div class="mn-stat glass"><small id="mn-bio">TERRE</small><b id="mn-depth">0 m</b><span id="mn-score">0</span></div>
<button class="icon glass" id="mn-help" aria-label="Règles"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg></button></div></div>
<div class="modal" id="mn-m-over"><div class="card glass"><h2 id="mn-ot">Effondrement</h2><p id="mn-os"></p>
<div class="stats"><div><b id="mn-o1">0</b><span>points</span></div><div><b id="mn-o2">0</b><span>mètres</span></div><div><b id="mn-o3">0</b><span>chaîne max</span></div></div>
<div class="btns"><button class="big primary" id="mn-again">Rejouer</button><button class="big glass" id="mn-menu">Menu</button></div></div></div>
<div class="modal" id="mn-m-help"><div class="card glass"><h2>Forage</h2><p class="multi" id="mn-ht"></p><div class="btns"><button class="big primary" id="mn-hok">C'est parti</button></div></div></div>`;
const HELP = "Pose un noyau sur une case libre.\\n\\nAligne 3 noyaux identiques : la croix en ligne droite, le pulsar en diagonale, l'étoile dans toutes les directions. Ils explosent et creusent les blocs.\\n\\nLes minerais libèrent des noyaux, et un noyau touché explose à son tour : c'est la chaîne.\\n\\nChaque chaîne calme l'éboulement. Si le plafond cède, c'est fini.";

function showOver() {
  const record = G.score > sv.best; sv.runs++; if (record) sv.best = G.score; if (G.depth > sv.depth) sv.depth = G.depth; save(); H.reward(G.score); refreshTitle();
  $('#mn-ot').textContent = record ? 'Nouveau record !' : 'Effondrement'; $('#mn-os').textContent = record ? 'Tu viens de battre ton meilleur score.' : `Record : ${sv.best.toLocaleString('fr-FR')} · ${sv.depth} m`;
  $('#mn-o1').textContent = G.score.toLocaleString('fr-FR'); $('#mn-o2').textContent = G.depth; $('#mn-o3').textContent = G.maxChain;
  $('#mn-m-over').classList.add('on');
}
function newRun() {
  G = newGame(); ev = null; speed = 1; rays = []; parts = []; rings = []; labels = []; drag = null; sel = -1; pv = null; banner = null; chainBig = null; shown = 0; shownTxt = ''; trayT = 0; hintOn = true; hue = 28;
  G.cells.forEach((c) => { if (c && c.k === 'b') { const a = anim(c); a.off = -(ROWS + 1 + Math.random() * 4); a.v = 0; } else if (c) anim(c).pop = 0; }); // le terrain tombe en place
  $('#mn-m-over').classList.remove('on'); update(0);
}
function refreshTitle() { const s = $('#b-mine-s'); if (s) s.textContent = sv.best ? `Record ${sv.best.toLocaleString('fr-FR')} · ${sv.depth} m` : 'Creuse. Enchaîne.'; }
export const busy = () => isOpen;
export function open() {
  isOpen = true; $('#mn').classList.add('on'); resize(); lowFx = (navigator.hardwareConcurrency || 4) <= 4; fxq = lowFx ? 0.6 : 1;
  newRun(); last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
  if (sv.helpV !== 1) { sv.helpV = 1; save(); $('#mn-ht').textContent = HELP.replace(/\\n/g, '\n'); $('#mn-m-help').classList.add('on'); }
}
function close() { isOpen = false; $('#mn').classList.remove('on'); $('#mn-m-over').classList.remove('on'); refreshTitle(); }
export function init(opts) {
  Object.assign(H, opts);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('div'); d.innerHTML = HTML; document.body.append(...d.children);
  cv = $('#mn-cv'); ctx = cv.getContext('2d');
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', () => { drag = null; pv = null; });
  window.addEventListener('resize', () => { if (isOpen) resize(); });
  const click = (el, f) => $(el).addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  click('#mn-back', () => { if (G && !G.over && G.turns > 2) { sv.runs++; if (G.score > sv.best) sv.best = G.score; if (G.depth > sv.depth) sv.depth = G.depth; save(); } close(); });
  click('#mn-help', () => { $('#mn-ht').textContent = HELP.replace(/\\n/g, '\n'); $('#mn-m-help').classList.add('on'); });
  click('#mn-hok', () => $('#mn-m-help').classList.remove('on')); click('#mn-again', newRun); click('#mn-menu', close);
  // bouton principal de l'accueil (home.js le transforme en héros) ; Cascade devient un lien discret
  const menu = $('#s-title .menu');
  if (menu && !$('#b-mine')) { const b = document.createElement('button'); b.className = 'big primary hero'; b.id = 'b-mine'; b.innerHTML = '<span>Forage</span><small id="b-mine-s"></small>'; menu.insertBefore(b, menu.firstChild); b.addEventListener('click', () => { A.ui(); H.vib(9); open(); }); }
  refreshTitle();
  window.__mine = { get G() { return G; }, get B() { return B; }, get rects() { return trayRects; }, get ev() { return ev; } };
}
