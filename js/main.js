// Critical — jeu, rendu canvas, effets (« juice ») et interface.
import { decode, begin, newSim, addTap, step, done, remaining, reactors, solve, trace, isReactor, FUSE_TICKS } from './engine.js';
import { chunk, stepInterval, spawnEvery, STAGE_SECONDS } from './endless.js';
import { LEVELS } from './levels.js';
import { WORLDS, PER_WORLD } from './gen.js';
import * as A from './audio.js';
import * as CH from './chest.js';
import * as ED from './editor.js';
import * as HOME from './home.js';
import * as INTRO from './intro.js';
import * as DAILY from './daily.js';
import * as Skins from './skins.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) ** 3;

/* ============================== sauvegarde ============================== */
const KEY = 'critical.v1';
const S = { stars: {}, daily: {}, endless: { best: 0, chain: 0, runs: 0, seen: false, helpV: 0 }, set: { sfx: true, mus: true, vib: true, q: 'auto' } };
try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); Object.assign(S, o); S.set = Object.assign({ sfx: true, mus: true, vib: true, q: 'auto' }, o.set); S.endless = Object.assign({ best: 0, chain: 0, runs: 0, seen: false, helpV: 0 }, o.endless); } catch (e) { /* stockage indisponible */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } };
// Haptique : Android = navigator.vibrate ; iPhone (iOS 17.4+) = astuce de l'interrupteur natif de Safari.
const canVib = typeof navigator.vibrate === 'function';
const hx = document.createElement('label');
hx.setAttribute('aria-hidden', 'true');
hx.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;pointer-events:none;overflow:hidden';
hx.innerHTML = '<input type="checkbox" switch tabindex="-1">';
document.body.appendChild(hx);
let lastTick = 0;
function tickIOS() { const n = performance.now(); if (n - lastTick < 26) return; lastTick = n; try { hx.click(); } catch (e) { /* ignore */ } }
function vib(p) {
  if (!S.set.vib) return;
  if (canVib) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } return; }
  if (Array.isArray(p)) { let t = 0; p.forEach((v, i) => { if (i % 2 === 0) setTimeout(tickIOS, t); t += v; }); } else tickIOS();
}
const starsOf = (i) => S.stars[i] || 0;
const totalStars = () => Object.values(S.stars).reduce((a, b) => a + b, 0);

/* ============================== qualité ============================== */
const Q = { fx: 1, dpr: 2 };
function applyQuality() {
  const q = S.set.q, low = (navigator.hardwareConcurrency || 4) <= 4;
  Q.fx = q === 'low' ? 0.5 : q === 'high' ? 1.2 : low ? 0.7 : 1;
  Q.dpr = q === 'low' ? 1 : q === 'high' ? 2 : low ? 1.5 : 2;
}

/* ============================== canvas ============================== */
const cv = $('#cv'), ctx = cv.getContext('2d');
const OV = 3; // débordement du canvas hors écran
let W = 0, H = 0, DPR = 1, SAT = 0, SAB = 0, BAND = 0; // BAND = bande système iOS au-dessus de la page (px)
let B = { x: 0, y: 0, cs: 40, w: 1, h: 1 };
function resize() {
  const standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  DPR = Math.min(window.devicePixelRatio || 1, Q.dpr);
  W = Math.max(window.innerWidth, document.documentElement.clientWidth);
  H = Math.max(window.innerHeight, document.documentElement.clientHeight);
  // PWA iPhone en portrait : on compare la page à la dalle.
  //  • écart ≤ 6 px : simple arrondi → on couvre toute la dalle (évite la ligne de pixels manquante en bas)
  //  • écart > 6 px : iOS (bug WebKit 301994) dessine lui-même une bande opaque AU-DESSUS de la page : impossible d'y dessiner depuis le web.
  //    On garde alors la vraie taille de la page (sinon le bas du jeu déborde) et on fond le haut vers le noir pour que la bande se fonde dans le décor.
  let band = 0;
  if (standalone && window.innerHeight > window.innerWidth) {
    const gap = Math.max(screen.width || 0, screen.height || 0) - H;
    if (gap > 0 && gap <= 6) H += gap; else if (gap > 6) band = gap;
  }
  BAND = band; document.documentElement.classList.toggle('has-band', band > 0);
  cv.style.width = (W + 2 * OV) + 'px'; cv.style.height = (H + 2 * OV) + 'px';
  cv.width = Math.round((W + 2 * OV) * DPR); cv.height = Math.round((H + 2 * OV) * DPR);
  SAT = $('#probe-t').offsetHeight || 0; SAB = $('#probe-b').offsetHeight || 0;
  if (CH.ADMIN) { // (admin) affichage : utile pour diagnostiquer le plein écran sur iPhone
    let dg = document.getElementById('diag'), card = document.querySelector('#m-settings .card');
    if (!dg && card) { dg = document.createElement('p'); dg.id = 'diag'; dg.style.cssText = 'font-size:11px;opacity:.6;margin:0;text-align:center;line-height:1.4'; card.insertBefore(dg, card.children[1] || null); }
    if (dg) dg.textContent = `Page ${W}×${H} · écran ${screen.width}×${screen.height} · bande système ${BAND}px · haut sûr ${SAT}px${standalone ? ' · PWA' : ''}`;
  }
  layout();
}
function layout() {
  if (!G.st) return;
  const { w, h } = G.st, play = G.mode === 'play';
  const top = SAT + (play ? 138 : 70), bot = SAB + (play ? 92 : 70);
  const rows = G.endless ? h - 1 : h, aw = W - 44, ah = H - top - bot - 20;
  const cs = Math.min(aw / w, ah / rows, 92);
  B = { cs, w, h: rows, x: (W - cs * w) / 2, y: top + 10 + (ah - cs * rows) / 2 };
}
let FALL = 0; // décalage vertical continu du contenu en mode Cascade (px)
const cc = (x, y) => ({ x: B.x + (x + 0.5) * B.cs, y: B.y + (y + 0.5) * B.cs + FALL });

/* ============================== état du jeu ============================== */
const TICK = 0.078;
const COL = { 1: [77, 243, 255], 2: [255, 79, 216], 3: [255, 194, 71], 7: [150, 255, 90], 8: [255, 125, 60], 9: [255, 85, 85], 11: [255, 222, 100] };
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const G = {
  mode: 'title', lv: null, st: null, vis: null, sim: null, phase: 'idle', used: 0, allowed: 0,
  chain: 0, maxChain: 0, acc: 0, hitstop: 0, fxNext: [], flying: [], sel: -1, hint: -1, hintT: 0,
  attract: true, atT: 0, clock: 0, hue: 215, hueT: 215, energy: 0, flash: 0, fpos: [0, 0], fcol: COL[1],
  endless: false, shake: 0, comboN: 0, comboAge: 9, label: null, introT: 0, boardA: 0.5, celeb: 0, ptr: null,
};
const rings = [], parts = [];
const E = { t: 0, d: 0, score: 0, shown: 0, mult: 1, lives: 3, stepAcc: 0, stepInt: 0.95, queue: [], sinceSpawn: 0, fallT: 1, tapId: 0, taps: {}, sim: null, over: false, paused: false, maxChain: 0, stage: 0, empty: false, spawned: 0, nTaps: 0, shownTxt: '' };
let curIdx = -1;

function load(lv, attract = false) {
  G.endless = false; G.lv = lv; G.st = decode(lv); G.vis = { type: G.st.type.slice(), hp: G.st.hp.slice() };
  G.sim = null; G.phase = 'idle'; G.used = 0; G.allowed = lv.min + (lv.extra ?? 2); G.friendLost = false; G.chain = 0; G.maxChain = 0;
  G.sel = -1; G.hint = -1; G.flying = []; G.fxNext = []; G.attract = attract; G.atT = 0;
  G.introT = 0; G.comboAge = 9; G.label = null; G.celeb = 0; G.hitstop = 0;
  G.hueT = lv.daily ? 280 : WORLDS[lv.world].hue;
  rings.length = 0; parts.length = 0;
  layout();
}

/* ---- effets ---- */
function ring(x, y, r0, r1, life, col, w = 0.08) { rings.push({ x, y, r0, r1, life: 0, max: life, col, w }); }
function burst(x, y, n, col, speed, life = 0.8, size = 3) {
  n = Math.round(n * Q.fx);
  for (let i = 0; i < n && parts.length < 700; i++) {
    const a = Math.random() * 6.283, s = speed * (0.25 + Math.random() * 0.85);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: life * (0.5 + Math.random() * 0.7), s: size * (0.6 + Math.random() * 0.9), col: Math.random() < 0.3 ? [255, 255, 255] : col });
  }
}
function boomFx(x, y, type, n) {
  const col = COL[type], cs = B.cs;
  ring(x, y, cs * 0.15, cs * (1.7 + Math.min(n, 12) * 0.09), 0.5, col);
  ring(x, y, cs * 0.1, cs * 1.0, 0.34, [255, 255, 255], 0.05);
  burst(x, y, 16 + Math.min(n, 12) * 2.5, col, cs * 4.2, 0.85, 2.6);
  G.flash = Math.min(1, 0.3 + n * 0.07); G.fpos = [x, y]; G.fcol = col;
  G.energy = Math.min(1, G.energy + 0.12);
  G.shake = Math.max(G.shake, Math.min(15, 2.5 + n * 0.95));
  G.comboN = n; G.comboAge = 0;
  if (!G.attract) { A.boom(n); const d = clamp(5 + n * 2.2, 7, 28); vib(n >= 6 ? [d, 28, d] : d); }
  if (!G.attract) CH.boom(n, { ring, burst }, x, y, col, cs);
  if (n >= 4 && !G.attract) G.hitstop = G.endless ? Math.min(0.04, 0.012 + n * 0.003) : Math.min(0.075, 0.018 + n * 0.006);
}
function applyBoom(b) {
  G.vis.type[b.i] = 0; G.vis.hp[b.i] = 0;
  G.chain = b.n; G.maxChain = Math.max(G.maxChain, b.n);
  const c = cc(b.x, b.y); boomFx(c.x, c.y, b.t, b.n);
  if (G.endless) eBoom(b);
}
function hitFx(m) {
  if (G.vis.hp[m.i] > 0) G.vis.hp[m.i]--;
  const dx = Math.sign(m.tx - m.fx), dy = Math.sign(m.ty - m.fy), c = cc(m.tx, m.ty);
  const x = c.x - dx * B.cs * 0.32, y = c.y - dy * B.cs * 0.32, col = COL[m.c];
  burst(x, y, 7, col, B.cs * 2.2, 0.45, 2); ring(x, y, B.cs * 0.05, B.cs * 0.42, 0.28, col, 0.05);
  G.energy = Math.min(1, G.energy + 0.03); if (!G.attract) A.hit(); G.shake = Math.max(G.shake, 1.5);
}
function armFx(a) {
  G.vis.type[a.i] = 9; G.vis.hp[a.i] = FUSE_TICKS;
  const c = cc(a.x, a.y); ring(c.x, c.y, B.cs * 0.15, B.cs * 0.8, 0.3, COL[8], 0.07); burst(c.x, c.y, 8, COL[8], B.cs * 2, 0.5, 2); A.hit();
}
function friendKillFx(k) {
  G.vis.type[k.i] = 0; G.vis.hp[k.i] = 0;
  const c = cc(k.x, k.y); ring(c.x, c.y, B.cs * 0.2, B.cs * 1.4, 0.45, COL[11], 0.09); burst(c.x, c.y, 26, COL[11], B.cs * 3.4, 0.9, 2.6);
  if (G.endless) { // cristal doré : bonus de multiplicateur + points (aucune vie perdue)
    if (E.mult < 8) E.mult++;
    const bonus = 200 * E.mult; E.score += bonus;
    G.label = { t: 'Cristal ×' + E.mult + ' +' + bonus, age: 0 }; G.flash = 0.55; G.fpos = [c.x, c.y]; G.fcol = COL[11]; G.shake = Math.max(G.shake, 5);
    ring(c.x, c.y, B.cs * 0.2, B.cs * 2.6, 0.6, [255, 255, 255], 0.05); A.mult(E.mult); A.star(1); vib([12, 50, 12, 50, 18]);
  } else { G.friendLost = true; G.flash = 0.7; G.fpos = [c.x, c.y]; G.fcol = COL[11]; G.shake = 11; A.breach(); vib([40, 30, 60]); }
}
function wallFx(m) {
  const dx = Math.sign(m.tx - m.fx), dy = Math.sign(m.ty - m.fy), c = cc(m.tx, m.ty);
  burst(c.x - dx * B.cs * 0.42, c.y - dy * B.cs * 0.42, 5, [170, 180, 255], B.cs * 1.6, 0.3, 1.6);
}

/* ---- déroulement ---- */
function fire(i) {
  if (G.phase !== 'idle' || !isReactor(G.st.type[i])) return;
  if (!G.attract && G.used >= G.allowed) return;
  G.used++; G.hint = -1; G.chain = 0; G.maxChain = 0; G.label = null;
  G.sim = begin(G.st, i, true); G.phase = 'run'; G.acc = TICK; G.fxNext = [];
  const c = cc(i % G.st.w, (i / G.st.w) | 0);
  if (!G.attract) { A.tap(); vib(16); ring(c.x, c.y, B.cs * 0.2, B.cs * 0.7, 0.3, [255, 255, 255], 0.04); updateTaps(true); }
  applyBoom(G.sim.first);
}
function tick() {
  for (const f of G.fxNext) f();
  G.fxNext = [];
  if (G.sim.pending) { endChain(); return; }
  const r = step(G.st, G.sim);
  G.flying = r.mv;
  for (const m of r.mv) { if (m.end === 2 || m.ph) G.fxNext.push(() => hitFx(m)); else if (m.end === 3) G.fxNext.push(() => wallFx(m)); }
  for (const b of r.boom) G.fxNext.push(() => applyBoom(b));
  for (const a of r.arm) G.fxNext.push(() => armFx(a));
  for (const k of r.kill) G.fxNext.push(() => friendKillFx(k));
  if (done(G.sim)) G.sim.pending = true;
}
function endChain() {
  G.flying = []; G.sim = null;
  if (G.attract) { G.phase = 'idle'; G.atT = 0; return; }
  if (G.friendLost) return lose(-1);
  const left = remaining(G.st);
  if (left === 0) return win();
  if (G.used >= G.allowed) return lose(left);
  G.phase = 'idle';
  const n = G.maxChain;
  if (n >= 5) G.label = { t: n >= 12 ? 'Fission totale' : n >= 8 ? 'Critique' : 'Surcharge', age: 0 };
}
const starCount = () => (G.used <= G.lv.min ? 3 : G.used === G.lv.min + 1 ? 2 : 1);
function win() {
  G.phase = 'won'; G.celeb = 1.6;
  const stars = starCount(), b = { x: B.x + B.cs * B.w / 2, y: B.y + B.cs * B.h / 2 };
  ring(b.x, b.y, 10, Math.max(W, H) * 0.9, 0.9, [255, 255, 255], 0.03);
  ring(b.x, b.y, 10, Math.max(W, H) * 0.6, 0.7, [77, 243, 255], 0.05);
  G.flash = 1; G.shake = 16; G.energy = 1; G.hitstop = 0.09;
  A.win(); vib([30, 40, 60, 40, 90]);
  if (G.lv.custom) ED.onResult(G.lv, stars, G.used, G.maxChain);
  else if (G.lv.daily) { const o = S.daily[G.lv.daily]; if (!o || stars > o.stars || (stars === o.stars && G.used < o.taps)) S.daily[G.lv.daily] = { stars, taps: G.used, chain: G.maxChain }; }
  else S.stars[curIdx] = Math.max(starsOf(curIdx), stars);
  save();
  if (!G.lv.custom) { const wi = G.lv.daily ? -1 : (curIdx / PER_WORLD) | 0, full = wi >= 0 && Array.from({ length: PER_WORLD }, (_, k) => starsOf(wi * PER_WORLD + k)).every(Boolean); CH.onWin({ stars, daily: !!G.lv.daily, world: full ? wi : -1 }); }
  setTimeout(() => showResult(true, stars), 1250);
}
function lose(left) {
  G.phase = 'lost'; A.fail(); vib([60, 40, 60]); G.shake = 8;
  setTimeout(() => showResult(false, 0, left), 800);
}
function restart() { if (G.endless) { startEndless(); A.ui(); return; } if (!G.lv) return; load(G.lv, false); updateHud(); A.ui(); }
function hint() {
  if (G.phase !== 'idle' || G.attract) return;
  const r = solve(G.st, Math.min(G.allowed - G.used, 4), 1);
  if (r) { G.hint = r.sols[0][0]; G.hintT = 0; A.ui(); }
  else toast('Plus de solution depuis cette position. Recommence.');
}

/* ============================== rendu ============================== */
const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, p: Math.random() * 6 }));
const imgs = { title: null, w: [] };
function tryImg(src, cb) { const im = new Image(); im.onload = () => cb(im); im.src = src; }
tryImg('assets/title-bg.webp', (im) => { imgs.title = im; });
for (let i = 0; i < 6; i++) tryImg(`assets/bg-world${i + 1}.webp`, (im) => { imgs.w[i] = im; });
function cover(im, a) { const k = Math.max(W / im.width, H / im.height), w = im.width * k, h = im.height * k; ctx.globalAlpha = a; ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); ctx.globalAlpha = 1; }

function drawBG(t) {
  G.hue += ((G.hueT - G.hue) * Math.min(1, 0.05)) || 0;
  const h = G.hue, e = G.endless ? Math.min(G.energy, 0.42) : G.energy;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${h} 55% ${5 + e * 3}%)`); g.addColorStop(1, `hsl(${h + 35} 65% ${3 + e * 2}%)`);
  ctx.fillStyle = g; ctx.fillRect(-OV - 1, -OV - 1, W + 2 * OV + 2, H + 2 * OV + 2);
  const bgi = G.mode === 'play' && G.lv && !G.lv.daily ? imgs.w[G.lv.world] : G.mode !== 'play' ? imgs.title : null;
  if (bgi) cover(bgi, 0.5);
  ctx.globalCompositeOperation = 'lighter';
  const blobs = [[0.2, 0.25, 0], [0.85, 0.5, 60], [0.35, 0.9, -50]];
  blobs.forEach((b, i) => {
    const x = (b[0] + Math.sin(t * 0.07 + i * 2) * 0.12) * W, y = (b[1] + Math.cos(t * 0.05 + i) * 0.1) * H, r = Math.max(W, H) * (0.55 + e * 0.15);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `hsla(${h + b[2]},90%,55%,${0.16 + e * 0.2})`); rg.addColorStop(1, `hsla(${h + b[2]},90%,55%,0)`);
    ctx.fillStyle = rg; ctx.fillRect(-OV - 1, -OV - 1, W + 2 * OV + 2, H + 2 * OV + 2);
  });
  ctx.fillStyle = '#fff';
  for (const s of stars) {
    const y = ((s.y + t * 0.004 * s.z) % 1) * H;
    ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * s.z + s.p))) * s.z * (0.6 + e);
    ctx.fillRect(s.x * W, y, 1.4 * s.z + 0.4, 1.4 * s.z + 0.4);
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawReactor(i, type, hp, cx, cy, t, sc, sel) {
  const cs = B.cs, r = cs * 0.29 * sc * (1 + 0.025 * Math.sin(t * 2.3 + i * 1.7)) * (sel ? 1.13 : 1);
  Skins.drawOrb(ctx, CH.matOf(), cx, cy, r, COL[type], type, t, { hp: type === 9 ? 0 : hp, gl: CH.matGl() * (sel ? 1.4 : 1), fast: Q.fx < 0.6 });
  if (type === 9) { // mèche amorcée : compte à rebours + clignotement
    const f = clamp(hp / FUSE_TICKS, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${0.12 + 0.5 * (0.5 + 0.5 * Math.sin(t * 28))})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(2, cs * 0.06); ctx.beginPath(); ctx.arc(cx, cy, r * 1.32, -1.5708, -1.5708 + 6.2832 * f); ctx.stroke();
  }
}

function drawDanger(t) {
  const { x, y, cs, w, h } = B, p = 0.5 + 0.5 * Math.sin(t * 6);
  let hot = false; for (let i = (h - 1) * w; i < (h + 1) * w; i++) { const q = G.vis.type[i]; if (isReactor(q) || q === 9) hot = true; }
  const g = ctx.createLinearGradient(0, y + cs * (h - 1.6), 0, y + cs * h);
  g.addColorStop(0, 'rgba(255,70,90,0)'); g.addColorStop(1, `rgba(255,70,90,${hot ? 0.16 + 0.2 * p : 0.07})`);
  ctx.fillStyle = g; ctx.fillRect(x, y + cs * (h - 1.6), cs * w, cs * 1.6);
  ctx.strokeStyle = `rgba(255,90,110,${hot ? 0.5 + 0.4 * p : 0.25})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 6, y + cs * h + 1); ctx.lineTo(x + cs * w - 6, y + cs * h + 1); ctx.stroke();
}

function drawFriend(cx, cy, t, k) {
  const cs = B.cs, r = cs * 0.31 * k, col = COL[11], by = cy + Math.sin(t * 3 + cx) * cs * 0.02;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(cx, by, r * 0.3, cx, by, r * 2.3); g.addColorStop(0, rgba(col, 0.4)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(cx - r * 2.4, by - r * 2.4, r * 4.8, r * 4.8);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.translate(cx, by); ctx.rotate(Math.sin(t * 1.6 + cx) * 0.12);
  ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 0.88, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r * 0.88, 0); ctx.closePath();
  const lg = ctx.createLinearGradient(-r, -r, r, r); lg.addColorStop(0, 'rgba(255,255,255,.95)'); lg.addColorStop(0.5, rgba(col, 0.75)); lg.addColorStop(1, 'rgba(255,160,60,.55)');
  ctx.fillStyle = lg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-r * 0.88, 0); ctx.lineTo(r * 0.88, 0); ctx.moveTo(0, -r * 1.2); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(0, r * 1.2); ctx.stroke();
  ctx.restore();
}

function drawBoard(t, dt) {
  const { x, y, cs, w, h } = B;
  ctx.globalAlpha = G.boardA;
  // panneau de verre
  rr(x - 12, y - 12, cs * w + 24, cs * h + 24, 26);
  let g = ctx.createLinearGradient(x, y, x + cs * w, y + cs * h);
  g.addColorStop(0, 'rgba(255,255,255,.11)'); g.addColorStop(0.5, 'rgba(255,255,255,.035)'); g.addColorStop(1, 'rgba(255,255,255,.08)');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(x + 14, y - 11.5); ctx.lineTo(x + cs * w - 14, y - 11.5); ctx.stroke();
  // cases
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    rr(x + c * cs + 2.5, y + r * cs + 2.5, cs - 5, cs - 5, cs * 0.2);
    ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.stroke();
  }
  // éléments (découpés au panneau : les vagues entrent depuis hors écran)
  if (G.endless) { ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y - 2, cs * w + 8, cs * h + 4); ctx.clip(); }
  const V = G.vis, intro = G.introT, oy = 0;
  if (G.endless) drawDanger(t);
  for (let i = 0; i < V.type.length; i++) {
    const ty = V.type[i]; if (!ty) continue;
    const c = cc(i % w, (i / w) | 0), k = G.endless ? 1 : easeOut(clamp((intro - i * 0.012) / 0.4, 0, 1)); if (k <= 0) continue;
    c.y += oy;
    if (isReactor(ty) || ty === 9) drawReactor(i, ty, ty === 9 ? G.st.hp[i] : V.hp[i], c.x, c.y, t, k, i === G.sel);
    else if (ty === 11) drawFriend(c.x, c.y, t, k);
    else if (ty === 4) {
      rr(c.x - cs * 0.4 * k, c.y - cs * 0.4 * k, cs * 0.8 * k, cs * 0.8 * k, cs * 0.14);
      ctx.fillStyle = 'rgba(8,10,26,.88)'; ctx.fill(); ctx.strokeStyle = 'rgba(165,175,255,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(165,175,255,.16)'; ctx.beginPath();
      for (let q = -1; q <= 1; q++) { ctx.moveTo(c.x - cs * 0.3, c.y + q * cs * 0.2 + cs * 0.3); ctx.lineTo(c.x + cs * 0.3, c.y + q * cs * 0.2 - cs * 0.3); }
      ctx.stroke();
    } else {
      const d = cs * 0.34 * k, a = ty === 5 ? -1 : 1;
      rr(c.x - cs * 0.4, c.y - cs * 0.4, cs * 0.8, cs * 0.8, cs * 0.14); ctx.fillStyle = 'rgba(150,255,235,.07)'; ctx.fill();
      ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(93,255,192,.28)'; ctx.lineWidth = cs * 0.13;
      ctx.beginPath(); ctx.moveTo(c.x - d, c.y + a * d); ctx.lineTo(c.x + d, c.y - a * d); ctx.stroke();
      ctx.strokeStyle = 'rgba(220,255,248,.95)'; ctx.lineWidth = cs * 0.045; ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // indice
  if (G.hint >= 0 && G.phase === 'idle') {
    G.hintT += dt; const c = cc(G.hint % w, (G.hint / w) | 0), p = (G.hintT % 1.1) / 1.1;
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, cs * (0.35 + p * 0.5), 0, 6.2832); ctx.stroke();
  }
  // aperçu des trajectoires (doigt maintenu)
  if (G.sel >= 0 && G.phase === 'idle') {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const col = COL[G.st.type[G.sel]];
    for (const tr of trace(G.st, G.sel)) {
      ctx.setLineDash([cs * 0.14, cs * 0.16]); ctx.lineDashOffset = -t * 30;
      ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = Math.max(2, cs * 0.05); ctx.beginPath();
      tr.pts.forEach((p, k) => { const q = cc(clamp(p[0], -0.42, B.w - 0.58), clamp(p[1], -0.42, B.h - 0.58)); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke();
      ctx.setLineDash([]);
      for (const hh of tr.hits) { const q = cc(hh[0], hh[1]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, cs * (0.4 + 0.04 * Math.sin(t * 9)), 0, 6.2832); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // tirs en vol
  if (G.flying.length) {
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    const p = clamp(G.acc / TICK, 0, 1);
    for (const m of G.flying) {
      let tx = m.tx, ty = m.ty;
      if (m.end >= 2) { tx -= Math.sign(tx - m.fx) * 0.3; ty -= Math.sign(ty - m.fy) * 0.3; }
      const a = cc(m.fx, m.fy), b = cc(tx, ty), px = lerp(a.x, b.x, p), py = lerp(a.y, b.y, p);
      const vx = b.x - a.x, vy = b.y - a.y, col = COL[m.c];
      const tg = ctx.createLinearGradient(px, py, px - vx * (m.c === 7 ? 2.4 : 1.1), py - vy * (m.c === 7 ? 2.4 : 1.1));
      tg.addColorStop(0, rgba(col, 0.95)); tg.addColorStop(1, rgba(col, 0));
      const tl = m.c === 7 ? 2.4 : 1.1; ctx.strokeStyle = tg; ctx.lineWidth = cs * (m.c === 7 ? 0.17 : 0.1); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - vx * tl, py - vy * tl); ctx.stroke();
      const rg = ctx.createRadialGradient(px, py, 0, px, py, cs * 0.26);
      rg.addColorStop(0, 'rgba(255,255,255,.95)'); rg.addColorStop(0.3, rgba(col, 0.8)); rg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = rg; ctx.fillRect(px - cs * 0.27, py - cs * 0.27, cs * 0.54, cs * 0.54);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (G.endless) ctx.restore();
}

function drawFx() {
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) {
    const k = r.life / r.max, rad = lerp(r.r0, r.r1, easeOut(k));
    ctx.strokeStyle = rgba(r.col, (1 - k) * 0.9); ctx.lineWidth = Math.max(0.6, B.cs * r.w * (1 - k));
    ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, 6.2832); ctx.stroke();
  }
  for (const p of parts) {
    const k = p.life / p.max, s = p.s * (1 - k * 0.7);
    ctx.fillStyle = rgba(p.col, (1 - k) ** 0.8);
    ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, 6.2832); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawOverlay(t) {
  if (G.flash > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    const r = Math.max(W, H) * 0.9, rg = ctx.createRadialGradient(G.fpos[0], G.fpos[1], 0, G.fpos[0], G.fpos[1], r);
    rg.addColorStop(0, rgba(G.fcol, G.flash * 0.32)); rg.addColorStop(1, rgba(G.fcol, 0));
    ctx.fillStyle = rg; ctx.fillRect(-OV - 1, -OV - 1, W + 2 * OV + 2, H + 2 * OV + 2); ctx.globalCompositeOperation = 'source-over';
  }
  // compteur de chaîne
  if (G.mode === 'play' && G.comboN >= 2 && G.comboAge < 1.4) {
    const n = G.comboN, a = G.comboAge, pop = 1 + Math.max(0, 0.45 - a * 3) * 1.1, fade = clamp(1.4 - a, 0, 1);
    const size = (30 + Math.min(n, 14) * 1.8) * pop, hue = lerp(190, 330, clamp((n - 2) / 10, 0, 1));
    ctx.save(); ctx.translate(W / 2, B.y - 32); ctx.globalAlpha = fade; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${size}px Orbitron, system-ui, sans-serif`;
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `hsla(${hue},100%,60%,.55)`; ctx.fillText('×' + n, 0, 0); ctx.fillText('×' + n, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `hsl(${hue},100%,92%)`; ctx.fillText('×' + n, 0, 0);
    ctx.restore();
  }
  if (G.mode === 'play' && G.label) {
    const L = G.label, k = clamp(L.age / 0.3, 0, 1), fade = clamp(2.2 - L.age, 0, 1);
    ctx.save(); ctx.globalAlpha = fade * k; ctx.translate(W / 2, B.y + B.cs * B.h + 38); ctx.scale(0.8 + 0.2 * easeOut(k), 0.8 + 0.2 * easeOut(k));
    ctx.textAlign = 'center'; ctx.font = '900 22px Orbitron, system-ui, sans-serif';
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,79,216,.6)'; ctx.fillText(L.t, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.fillText(L.t, 0, 0); ctx.restore();
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)');
  ctx.fillStyle = vg; ctx.fillRect(-OV - 1, -OV - 1, W + 2 * OV + 2, H + 2 * OV + 2);
  if (BAND > 0) { // la bande iOS du haut est noire : le haut du décor fond vers le noir pour s'y raccorder sans couture
    const tf = ctx.createLinearGradient(0, -OV, 0, 90); tf.addColorStop(0, 'rgba(0,0,0,1)'); tf.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tf; ctx.fillRect(-OV - 1, -OV - 1, W + 2 * OV + 2, 90 + OV + 1);
  }
}

/* ============================== boucle ============================== */
let last = performance.now(), slow = 0, frames = 0;
function update(dt) {
  G.introT += dt;
  G.boardA += ((G.mode === 'play' ? 1 : G.mode === 'title' ? 0.34 : 0.18) - G.boardA) * Math.min(1, dt * 5);
  G.energy = Math.max(0, G.energy - dt * 0.45); G.flash = Math.max(0, G.flash - dt * 3.2); G.shake = Math.max(0, G.shake - dt * 42);
  G.comboAge += dt; if (G.label) G.label.age += dt;
  if (G.endless) { if (!E.paused) updateEndless(dt); FALL = (E.stepAcc / E.stepInt - 1) * B.cs; }
  else if (G.phase === 'run') {
    FALL = 0;
    if (G.hitstop > 0) G.hitstop -= dt;
    else { G.acc += dt; let g = 0; while (G.acc >= TICK && G.phase === 'run' && g++ < 4) { G.acc -= TICK; tick(); if (G.hitstop > 0) break; } }
  }
  if (G.phase === 'won' && G.celeb > 0) {
    G.celeb -= dt;
    if (Math.random() < dt * 14) { const x = B.x + Math.random() * B.cs * B.w, y = B.y + Math.random() * B.cs * B.h, c = COL[1 + ((Math.random() * 3) | 0)]; burst(x, y, 10, c, B.cs * 3, 0.9, 2.4); ring(x, y, 4, B.cs * 1.1, 0.4, c, 0.05); A.hit(); }
  }
  if (G.attract && G.phase === 'idle' && G.st) {
    G.atT += dt;
    if (G.atT > (reactors(G.st).length ? 1.5 : 1.7)) {
      G.atT = 0; const rs = reactors(G.st);
      if (!rs.length) { load(LEVELS[(Math.random() * 30) | 0], true); }
      else { const s = G.lv.sol[G.used]; fire(s !== undefined && isReactor(G.st.type[s]) ? s : rs[(Math.random() * rs.length) | 0]); }
    }
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].life += dt; if (rings[i].life >= rings[i].max) rings.splice(i, 1); }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt;
    if (p.life >= p.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    const d = Math.exp(-3.2 * dt); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
/* ============================== mode sans fin (Cascade) ============================== */
const COLS_E = 6, ROWS_E = 9;
function eBoom(b) {
  E.score += 10 * b.n * E.mult; E.maxChain = Math.max(E.maxChain, b.n);
  const tk = E.taps[b.k];
  if (tk) { tk.n = Math.max(tk.n, b.n); if (b.n >= 3 && !tk.ok) { tk.ok = true; if (E.mult < 8) { E.mult++; A.mult(E.mult); vib(12); } } }
}
function spawnChunk() {
  if (E.queue.length) return false;
  const w = G.st.w, rows = [0, 1, 2].map(() => Array(w).fill(null));
  for (const c of chunk(E.d, w, 3)) rows[c.y][c.x] = { t: c.t, hp: c.hp };
  E.queue.push(rows[2], rows[1], rows[0]); // la ligne du bas entre en premier, depuis hors écran
  E.sinceSpawn = 0; E.spawned++; E.empty = false; return true;
}
// Grâce : un réacteur de la ligne de sortie que la chaîne EN VOL va détruire dans les ~3 prochains ticks n'est pas une brèche.
function exitSaved(ty, hp, w, h, sim) {
  const saved = new Set(), last = (h - 1) * w;
  if (!sim.shots.length) return saved;
  let any = false; for (let x = 0; x < w; x++) if (isReactor(ty[last + x]) || ty[last + x] === 9) any = true;
  if (!any) return saved;
  const s2 = { w, h, type: ty.slice(), hp: hp.slice() };
  const sm = { shots: sim.shots.map((q) => ({ ...q })), booms: 0, tick: 0, rec: false, cnt: { ...sim.cnt }, fuse: sim.fuse, kk: sim.kk };
  for (let n = 0; n < 3 && sm.shots.length; n++) step(s2, sm);
  for (let x = 0; x < w; x++) { const t = ty[last + x]; if ((isReactor(t) || t === 9) && !isReactor(s2.type[last + x]) && s2.type[last + x] !== 9) saved.add(x); }
  return saved;
}
function shiftDown() {
  const { w, h } = G.st, ty = G.st.type, hp = G.st.hp, vt = G.vis.type, vh = G.vis.hp, yb = B.y + B.cs * B.h;
  let breach = 0;
  const saved = exitSaved(ty, hp, w, h, E.sim);
  for (let x = 0; x < w; x++) { // dernière ligne = ligne de sortie
    const i = (h - 1) * w + x, t = ty[i], cx = B.x + (x + 0.5) * B.cs;
    if ((isReactor(t) || t === 9) && saved.has(x)) { burst(cx, yb, 10, [120, 255, 200], B.cs * 2, 0.5, 2.2); }
    else if (isReactor(t) || t === 9) { breach++; ring(cx, yb, B.cs * 0.2, B.cs * 1.7, 0.5, [255, 70, 90], 0.1); burst(cx, yb, 20, [255, 70, 90], B.cs * 3.2, 0.7, 2.6); }
    else if (t === 11) { ring(cx, yb, B.cs * 0.2, B.cs * 1.2, 0.4, COL[11], 0.06); burst(cx, yb, 8, COL[11], B.cs * 2, 0.5, 2); } // bonus raté : aucun malus
  }
  for (let y = h - 1; y > 0; y--) for (let x = 0; x < w; x++) { const a = y * w + x, b = a - w; ty[a] = ty[b]; hp[a] = hp[b]; vt[a] = vt[b]; vh[a] = vh[b]; }
  const row = E.queue.shift();
  for (let x = 0; x < w; x++) { const c = row && row[x]; ty[x] = vt[x] = c ? c.t : 0; hp[x] = vh[x] = c ? c.hp : 0; }
  for (const sh of E.sim.shots) sh.y++;
  E.sim.shots = E.sim.shots.filter((sh) => sh.y < h);
  A.step(E.d);
  if (breach) {
    E.lives -= breach; E.mult = 1; G.flash = 0.9; G.fpos = [W / 2, yb]; G.fcol = [255, 70, 90]; G.shake = 14;
    A.breach(); vib([40, 30, 70]); updateLives(); if (E.lives <= 0) endOver();
  }
}
function etick() {
  for (const f of G.fxNext) f();
  G.fxNext = [];
  if (E.over) return;
  if (E.stepAcc >= E.stepInt) { E.stepAcc -= E.stepInt; shiftDown(); if (E.over) return; if (++E.sinceSpawn >= spawnEvery(E.d)) spawnChunk(); }
  const r = step(G.st, E.sim);
  G.flying = r.mv;
  for (const m of r.mv) { if (m.end === 2 || m.ph) G.fxNext.push(() => hitFx(m)); else if (m.end === 3) G.fxNext.push(() => wallFx(m)); }
  for (const b of r.boom) G.fxNext.push(() => applyBoom(b));
  for (const a of r.arm) G.fxNext.push(() => armFx(a));
  for (const k of r.kill) G.fxNext.push(() => friendKillFx(k));
  // série brisée : un tap qui n'a pas atteint ×3 en 1,3 s fait retomber le multiplicateur
  for (const k in E.taps) {
    const tk = E.taps[k];
    if (tk.done) { if (E.t - tk.t > 6) delete E.taps[k]; continue; }
    if (tk.ok) tk.done = true;
    else if (E.t - tk.t > 1.3) { tk.done = true; if (E.mult > 1) { E.mult = 1; G.label = { t: 'Série brisée', age: 0 }; } }
  }
  // plateau vide : bonus + nouvelle vague immédiate
  if (remaining(G.st) === 0 && !E.sim.shots.length && !E.queue.length && !(E.sim.fuse > 0)) {
    if (!E.empty && E.spawned > 0) { E.empty = true; E.score += 250 * E.mult; G.label = { t: 'Plateau vide +' + 250 * E.mult, age: 0 }; vib([10, 30, 10]); spawnChunk(); }
  } else E.empty = false;
}
function updateEndless(dt) {
  if (E.over) return;
  E.t += dt;
  E.d = E.t / STAGE_SECONDS; E.stepInt = stepInterval(E.d);
  const stage = Math.floor(E.d);
  if (stage > E.stage) { E.stage = stage; G.label = { t: 'Palier ' + stage, age: 0 }; }
  G.hueT = (190 + E.d * 16) % 360; G.energy = Math.max(G.energy, Math.min(0.5, E.d / 24));
  if (G.hitstop > 0) G.hitstop -= dt;
  else { E.stepAcc += dt; G.acc += dt; let g = 0; while (G.acc >= TICK && g++ < 4 && !E.over) { G.acc -= TICK; etick(); if (G.hitstop > 0) break; } }
  E.shown += (E.score - E.shown) * Math.min(1, dt * 9); if (E.score - E.shown < 1) E.shown = E.score;
  const txt = Math.round(E.shown).toLocaleString('fr-FR') + '|' + E.mult + '|' + E.stage;
  if (txt !== E.shownTxt) { E.shownTxt = txt; $('#h-lvl').textContent = Math.round(E.shown).toLocaleString('fr-FR'); $('#h-goal').textContent = `×${E.mult} · Palier ${E.stage} · Record ${Math.max(S.endless.best, E.score).toLocaleString('fr-FR')}`; }
}
function pickNear(px, py) {
  let best = -1, bd = (B.cs * 0.62) ** 2; // rayon serré : il faut viser le réacteur
  const top = B.y - B.cs * 0.1, bot = B.y + B.cs * B.h + B.cs * 0.8; // la ligne de sortie reste touchable jusqu'à la chute
  for (const i of reactors(G.st)) { const c = cc(i % G.st.w, (i / G.st.w) | 0); if (c.y < top || c.y > bot) continue; const d = (c.x - px) ** 2 + (c.y - py) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
function missTap(x, y) {
  ring(x, y, 4, B.cs * 0.5, 0.22, [255, 255, 255], 0.03); A.select();
  if (E.mult > 1) { E.mult = 1; G.label = { t: 'Raté', age: 0 }; vib(8); }
}
function efire(i) {
  if (E.over || E.paused || !isReactor(G.st.type[i])) return;
  const k = ++E.tapId; E.taps[k] = { t: E.t, n: 0, ok: false, done: false }; E.nTaps++;
  const c = cc(i % G.st.w, (i / G.st.w) | 0);
  A.tap(); vib(14); ring(c.x, c.y, B.cs * 0.2, B.cs * 0.7, 0.3, [255, 255, 255], 0.04);
  applyBoom(addTap(G.st, E.sim, i, k));
}
function updateLives() {
  const box = $('#h-taps');
  if (box.children.length !== 3) box.innerHTML = '<i></i><i></i><i></i>';
  [...box.children].forEach((el, i) => el.classList.toggle('off', i >= E.lives));
}
function startEndless() {
  const w = COLS_E, h = ROWS_E + 1; // +1 : ligne de sortie sous l'écran
  G.endless = true; G.attract = false; G.phase = 'e'; G.lv = { world: 5, idx: 0, min: 1, sol: [] };
  G.st = { w, h, type: new Uint8Array(w * h), hp: new Uint8Array(w * h) }; G.vis = { type: new Uint8Array(w * h), hp: new Uint8Array(w * h) };
  G.flying = []; G.fxNext = []; G.hitstop = 0; G.acc = 0; G.sel = -1; G.label = null; G.comboAge = 9; G.introT = 9; G.hint = -1; G.sim = null;
  rings.length = 0; parts.length = 0; curIdx = -1;
  Object.assign(E, { t: 0, d: 0, score: 0, shown: 0, mult: 1, lives: 3, stepAcc: stepInterval(0) * 0.7, stepInt: stepInterval(0), queue: [], sinceSpawn: 0, fallT: 1, tapId: 0, taps: {}, sim: newSim(true), over: false, paused: false, maxChain: 0, stage: 0, empty: false, spawned: 0, nTaps: 0, shownTxt: '' });
  G.hueT = 190; document.documentElement.style.setProperty('--acc', '#ff5c7a');
  show('play'); layout(); spawnChunk(); updateLives();
  $('#h-lvl').textContent = '0'; $('#h-goal').textContent = `×1 · Palier 0 · Record ${S.endless.best.toLocaleString('fr-FR')}`;
}
function saveEndless() {
  if (E.score > S.endless.best) S.endless.best = E.score;
  if (E.maxChain > S.endless.chain) S.endless.chain = E.maxChain;
  save();
}
function endOver() {
  if (E.over) return;
  E.over = true; G.phase = 'over'; G.flying = []; G.shake = 18; G.flash = 1; G.energy = 1;
  const record = E.score > S.endless.best; S.endless.runs++; saveEndless(); CH.onEndless(E.score);
  A.fail(); vib([70, 40, 70, 40, 120]);
  setTimeout(() => showEndlessOver(record), 1000);
}
function showEndlessOver(record) {
  const m = $('#m-result');
  $('#r-title').textContent = record ? 'Nouveau record !' : 'Cœur instable';
  $('#r-sub').textContent = record ? 'Tu viens de battre ton meilleur score.' : `Record : ${S.endless.best.toLocaleString('fr-FR')} · tenu ${Math.round(E.t)} s`;
  $('#r-taps').textContent = Math.round(E.score).toLocaleString('fr-FR'); $('#r-l1').textContent = 'points';
  $('#r-chain').textContent = E.maxChain; $('#r-l2').textContent = 'chaîne max';
  $('#r-stars').style.display = 'none'; $('#r-next').textContent = 'Rejouer';
  $('#r-again').style.display = 'none'; $('#r-menu').style.flex = '1'; $('#r-share').hidden = false; $('#r-share').textContent = 'Partager le score';
  m.classList.add('on');
}
function showInfo(title, text, ok, onOk, alt, onAlt) {
  $('#i-title').textContent = title; $('#i-text').textContent = text; $('#i-ok').textContent = ok;
  const a = $('#i-alt'); a.hidden = !alt; if (alt) a.textContent = alt;
  $('#i-ok').onclick = () => { A.ui(); vib(9); $('#m-info').classList.remove('on'); onOk && onOk(); };
  a.onclick = () => { A.ui(); $('#m-info').classList.remove('on'); onAlt && onAlt(); };
  $('#m-info').classList.add('on');
}
function pauseEndless() {
  if (!G.endless || E.over || E.paused || G.mode !== 'play') return;
  E.paused = true;
  showInfo('Pause', `Score ${Math.round(E.score).toLocaleString('fr-FR')} · ×${E.mult}`, 'Reprendre', () => { E.paused = false; }, 'Quitter', () => { saveEndless(); E.paused = false; show('title'); });
}
function playEndless() {
  if (S.endless.helpV !== 3) {
    S.endless.helpV = 3; S.endless.seen = true; save();
    showInfo('Cascade', 'Les réacteurs descendent. Touche-les avant qu\'ils sortent en bas : 3 brèches et le cœur lâche.\n\nChaîne de 3 ou plus : multiplicateur +1. Taper dans le vide brise ta série.\n\nLaser vert : perce toute la ligne. Mèche orange : explose avec retard. Cristal doré : touche-le avec ta chaîne pour +1 au multiplicateur et des points bonus (il ne coûte jamais de vie).', 'C\'est parti', startEndless);
  } else startEndless();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (CH.busy() || ED.busy() || INTRO.busy()) { last = now; return; } // ouverture d'un noyau : on économise le rendu du jeu
  const dt = Math.min(0.05, (now - last) / 1000); last = now; G.clock += dt;
  CH.tick(dt);
  update(dt);
  ctx.setTransform(DPR, 0, 0, DPR, OV * DPR, OV * DPR);
  drawBG(G.clock);
  ctx.save();
  if (G.shake > 0.1) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  if (G.st) drawBoard(G.clock, dt);
  drawFx();
  ctx.restore();
  drawOverlay(G.clock);
  // qualité adaptative (mode Auto) : si l'appareil rame, on allège les effets
  if (S.set.q === 'auto' && dt > 0.026) { if (++slow > 80 && Q.fx > 0.45) { Q.fx *= 0.75; Q.dpr = Math.max(1, Q.dpr - 0.25); slow = 0; resize(); } } else if (slow > 0 && ++frames % 30 === 0) slow--;
}

/* ============================== entrées ============================== */
function pick(px, py) {
  if (!G.st) return -1;
  let best = -1, bd = (B.cs * 0.68) ** 2;
  for (const i of reactors(G.st)) { const c = cc(i % B.w, (i / B.w) | 0), d = (c.x - px) ** 2 + (c.y - py) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
cv.addEventListener('pointerdown', (e) => {
  A.init(); A.resume();
  if (G.mode === 'play' && G.endless) {
    if (E.over || E.paused) return;
    const i = pickNear(e.clientX, e.clientY);
    if (i >= 0) efire(i); else missTap(e.clientX, e.clientY);
    return;
  }
  if (G.mode !== 'play' || G.phase !== 'idle') return;
  if (G.used >= G.allowed) return;
  G.ptr = e.pointerId; try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  const i = pick(e.clientX, e.clientY); if (i !== G.sel) { G.sel = i; if (i >= 0) { A.select(); vib(5); } }
});
cv.addEventListener('pointermove', (e) => {
  if (G.ptr !== e.pointerId) return;
  const i = pick(e.clientX, e.clientY); if (i !== G.sel) { G.sel = i; if (i >= 0) { A.select(); vib(4); } }
});
const release = (e, go) => { if (G.ptr !== e.pointerId) return; G.ptr = null; const s = G.sel; G.sel = -1; if (go && s >= 0) fire(s); };
cv.addEventListener('pointerup', (e) => release(e, true));
cv.addEventListener('pointercancel', (e) => release(e, false));
['pointerdown', 'pointerup', 'click'].forEach((ev) => document.addEventListener(ev, () => { A.init(); A.resume(); }, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) A.resume(); else pauseEndless(); });
document.addEventListener('contextmenu', (e) => e.preventDefault());

/* ============================== interface ============================== */
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const btn = (id, fn) => $(id).addEventListener('click', () => { A.ui(); vib(9); fn(); });

function show(name) {
  if (G.endless && name !== 'play' && !E.over) saveEndless();
  G.mode = name;
  $('#hud').classList.toggle('endless', G.endless && name === 'play');
  $('#s-title').classList.toggle('on', name === 'title');
  $('#s-levels').classList.toggle('on', name === 'levels');
  $('#hud').hidden = name !== 'play';
  if (name !== 'play') { if (!G.attract) startAttract(); refreshTitle(); if (name === 'levels') buildLevels(); }
  layout();
}
function startAttract() { load(LEVELS[(Math.random() * 30) | 0], true); }
function nextUnlocked() { for (let i = 0; i < LEVELS.length; i++) if (!starsOf(i)) return i; return LEVELS.length - 1; }
function refreshTitle() {
  const n = nextUnlocked(), L = LEVELS[n], d = S.daily[todayStr()];
  $('#b-endless-s').textContent = S.endless.best ? `Record ${S.endless.best.toLocaleString('fr-FR')}` : 'Sans fin · bats ton record';
  $('#b-play-t').textContent = totalStars() ? 'Campagne · continuer' : 'Campagne';
  $('#b-play-s').textContent = `${WORLDS[L.world].name} · niveau ${L.idx + 1}`;
  $('#b-daily-s').textContent = d ? `Fait · ${starStr(d.stars)}` : 'Le même pour tous';
  $('#t-stars').innerHTML = `<b>★ ${totalStars()}</b> / ${LEVELS.length * 3}`;
  HOME.update({ pct: totalStars() / (LEVELS.length * 3), lvl: L.idx + 1, col: WORLDS[L.world].col });
}
function updateHud() {
  const L = G.lv, w = L.daily ? null : WORLDS[L.world];
  $('#h-lvl').textContent = L.custom ? (L.name || 'Niveau perso') : L.daily ? 'Défi du jour' : `${w.name} · ${L.idx + 1}`;
  $('#h-goal').textContent = `Parfait en ${L.min} tap${L.min > 1 ? 's' : ''}`;
  document.documentElement.style.setProperty('--acc', L.daily ? '#c78bff' : w.col);
  updateTaps(false);
}
function updateTaps(pop) {
  const box = $('#h-taps');
  if (box.children.length !== G.allowed) box.innerHTML = '<i></i>'.repeat(G.allowed);
  [...box.children].forEach((el, i) => { el.classList.toggle('off', i < G.used); el.classList.remove('pop'); if (pop && i === G.used - 1) { void el.offsetWidth; el.classList.add('pop'); } });
}
function play(i) {
  curIdx = i; load(LEVELS[i], false); show('play'); updateHud();
}
function playCustom(lv) { curIdx = -1; load(lv, false); show('play'); updateHud(); }
function playDaily() {
  const ds = todayStr(), def = DAILY.get(ds); // calculé en arrière-plan pendant l'intro : instantané
  if (!def) { toast('Impossible de générer le défi. Réessaie.'); return; }
  curIdx = -1; load({ ...def, daily: ds, world: 5 }, false); show('play'); updateHud();
}
function buildLevels() {
  const box = $('#l-list'); box.innerHTML = '';
  const cur = nextUnlocked();
  $('#l-count').textContent = `★ ${totalStars()} / ${LEVELS.length * 3}`;
  WORLDS.forEach((w, wi) => {
    const sec = document.createElement('div'); sec.className = 'world glass'; sec.style.setProperty('--acc', w.col);
    sec.innerHTML = `<h3>${w.name}</h3><p>${w.sub}</p>`;
    const grid = document.createElement('div'); grid.className = 'grid';
    for (let k = 0; k < PER_WORLD; k++) {
      const i = wi * PER_WORLD + k, s = starsOf(i), unlocked = i === 0 || starsOf(i - 1) > 0 || s > 0;
      const b = document.createElement('button');
      b.className = 'lv' + (s ? ' done' : '') + (i === cur ? ' cur' : '') + (unlocked ? '' : ' lock');
      b.innerHTML = `${k + 1}<small>${s ? '★'.repeat(s) : unlocked ? '' : '🔒'}</small>`;
      b.onclick = () => { A.ui(); vib(9); play(i); };
      grid.appendChild(b);
    }
    sec.appendChild(grid); box.appendChild(sec);
  });
  const c = box.querySelector('.cur'); if (c) setTimeout(() => c.scrollIntoView({ block: 'center' }), 30);
}

function showResult(won, stars, left) {
  const m = $('#m-result'), L = G.lv;
  $('#r-l1').textContent = 'taps'; $('#r-l2').textContent = 'chaîne max'; $('#r-again').style.display = '';
  $('#r-title').textContent = won ? (stars === 3 ? 'Réaction parfaite' : 'Réaction complète') : 'Plus de taps';
  $('#r-sub').textContent = won ? (stars === 3 ? 'Impossible de faire mieux.' : `Parfait en ${L.min} tap${L.min > 1 ? 's' : ''}. Tu peux encore optimiser.`) : left < 0 ? 'Un cristal a été détruit : c\'est perdu.' : `Il restait ${left} réacteur${left > 1 ? 's' : ''}.`;
  $('#r-taps').textContent = G.used; $('#r-chain').textContent = G.maxChain;
  const st = [...$('#r-stars').children]; st.forEach((s) => s.classList.remove('on'));
  $('#r-stars').style.display = won ? 'flex' : 'none';
  $('#r-next').textContent = won ? (L.custom ? 'Retour à l\'atelier' : L.daily ? 'Menu' : 'Niveau suivant') : 'Réessayer';
  $('#r-again').style.display = won ? '' : 'none'; $('#r-menu').style.flex = won ? '' : '1';
  $('#r-share').hidden = !(won && (L.daily || L.custom)); $('#r-share').textContent = L.custom ? 'Partager le code' : 'Partager le score';
  m.classList.add('on');
  if (won) for (let i = 0; i < stars; i++) setTimeout(() => { st[i].classList.add('on'); A.star(i); vib(15); }, 350 + i * 330);
}
const closeResult = () => $('#m-result').classList.remove('on');
$('#r-next').onclick = () => {
  A.ui(); closeResult();
  if (G.endless) return startEndless();
  if (G.phase === 'lost') return restart();
  if (G.lv.custom) { show('title'); return ED.back(); }
  if (G.lv.daily || curIdx + 1 >= LEVELS.length) return show('title');
  play(curIdx + 1);
};
btn('#r-again', () => { closeResult(); restart(); });
btn('#r-menu', () => { closeResult(); show('title'); });
btn('#r-share', async () => {
  if (G.lv && G.lv.custom && !G.endless) return ED.share(G.lv);
  const d = G.endless ? null : S.daily[G.lv.daily], url = location.href.split('#')[0];
  const text = G.endless ? `Critical · Cascade\n${Math.round(E.score).toLocaleString('fr-FR')} points · chaîne ×${E.maxChain} · palier ${E.stage}\nFais mieux : ${url}` : `Critical · Défi du ${G.lv.daily}\n${starStr(d.stars)} en ${d.taps} tap${d.taps > 1 ? 's' : ''} (chaîne ×${d.chain})\nFais mieux : ${url}`;
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Score copié'); } } catch (e) { /* annulé */ }
});

btn('#b-play', () => play(nextUnlocked()));
btn('#b-endless', playEndless);
btn('#b-pause', pauseEndless);
btn('#b-daily', playDaily);
btn('#b-levels', () => show('levels'));
btn('#b-lback', () => show('title'));
btn('#b-back', () => { closeResult(); const cu = G.lv && G.lv.custom && !G.endless; show('title'); if (cu) ED.back(); });
btn('#b-restart', restart);
btn('#b-hint', hint);

/* ---- réglages ---- */
const setM = $('#m-settings');
function openSettings() { $('#o-sfx').checked = S.set.sfx; $('#o-mus').checked = S.set.mus; $('#o-vib').checked = S.set.vib; syncQ(); $('#o-reset').textContent = 'Effacer la progression'; setM.classList.add('on'); }
function syncQ() { document.querySelectorAll('#o-q button').forEach((b) => b.classList.toggle('on', b.dataset.q === S.set.q)); }
btn('#b-set1', openSettings); btn('#b-set2', openSettings);
btn('#o-close', () => setM.classList.remove('on'));
setM.addEventListener('click', (e) => { if (e.target === setM) setM.classList.remove('on'); });
$('#o-sfx').onchange = (e) => { S.set.sfx = e.target.checked; A.setSfx(S.set.sfx); save(); };
$('#o-mus').onchange = (e) => { S.set.mus = e.target.checked; A.setMusic(S.set.mus); save(); };
$('#o-vib').onchange = (e) => { S.set.vib = e.target.checked; save(); if (S.set.vib) vib([14, 40, 14]); };
document.querySelectorAll('#o-q button').forEach((b) => b.onclick = () => { S.set.q = b.dataset.q; applyQuality(); resize(); syncQ(); save(); A.ui(); });
let armed = false;
$('#o-reset').onclick = () => {
  if (!armed) { armed = true; $('#o-reset').textContent = 'Confirmer : tout effacer ?'; setTimeout(() => { armed = false; $('#o-reset').textContent = 'Effacer la progression'; }, 3000); return; }
  S.stars = {}; S.daily = {}; save(); armed = false; setM.classList.remove('on'); refreshTitle(); toast('Progression effacée');
};

/* ============================== démarrage ============================== */
A.setSfx(S.set.sfx); A.setMusic(S.set.mus);
applyQuality(); resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
CH.init({ vib, toast: (m) => toast(m), COL });
ED.init({ vib, toast: (m) => toast(m), COL, play: playCustom, mat: () => CH.matOf() });
HOME.init();
INTRO.init({ vib, today: () => todayStr() });
startAttract(); refreshTitle();
requestAnimationFrame(frame);
INTRO.start(); // intro cinématique + chargement (première fois ~8 s, ensuite ~4 s ; Réglages → Revoir l'intro)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* hors-ligne indisponible */ });
window.__critical = { G, E, getB: () => B }; // debug / tests
