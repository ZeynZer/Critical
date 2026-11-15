// Critical — « Forage » : rendu et interface du mode principal (logique dans fusion.js, pure et testée).
// Direction artistique : coupe géologique. Roche mate autour du puits, noyaux lumineux dedans, HUD d'instrument.
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

// Un minéral par rang : teinte ET taille distinctes (lisible sans la couleur).
export const MINERALS = [
  ['Quartz', [186, 202, 224]], ['Aigue-marine', [70, 222, 255]], ['Émeraude', [64, 226, 134]], ['Soufre', [255, 214, 64]], ['Ambre', [255, 148, 46]],
  ['Rubis', [255, 70, 86]], ['Rhodonite', [255, 84, 198]], ['Améthyste', [164, 104, 255]], ['Saphir', [72, 112, 255]], ['Singularité', [255, 244, 214]],
];
const AMBER = [255, 178, 56];
// teinte, saturation de la roche par strate
const ROCK = [[28, 34], [14, 40], [36, 36], [46, 16], [215, 18], [250, 22], [285, 34], [8, 62], [188, 44]];
const rock = (d) => ROCK[d % ROCK.length];
const strataName = (d) => (d < F.STRATA.length ? F.STRATA[d] : `Noyau +${d - F.STRATA.length + 1}`);

/* ============================== état ============================== */
let G = null, isOpen = false, raf = 0, T = 0, last = 0, cv, ctx, W = 0, Hh = 0, DPR = 1, SAT = 0, SAB = 0, lowFx = false;
let paused = false;
let B = { x: 0, y: 0, w: 0, h: 0, u: 30 }, holdR = null, aimX = F.W / 2, aiming = false, ended = false;
let parts = [], rings = [], labels = [], pops = new Map(), shake = 0, flash = 0, flashC = [255, 255, 255], hitstop = 0;
let shown = 0, callout = null, scroll = 0, texA = null, texB = null, sprites = new Map(), spriteKey = '', landT = 0, giftT = 0;

const sx = (x) => B.x + x * B.u, sy = (y) => B.y + y * B.u;

/* ============================== effets ============================== */
const ring = (x, y, r0, r1, life, col, w = 3) => rings.push({ x, y, r0, r1, l: 0, m: life, col, w });
function burst(x, y, n, col, sp, life = 0.7, sz = 2.5) {
  n = Math.round(n * (lowFx ? 0.5 : 1));
  for (let i = 0; i < n && parts.length < (lowFx ? 110 : 240); i++) { const a = Math.random() * TAU, v = sp * (0.35 + Math.random() * 0.65); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: life * (0.6 + Math.random() * 0.6), col, sz: sz * (0.6 + Math.random() * 0.8) }); }
}
const label = (x, y, txt, col, sz = 16) => labels.push({ x, y, txt, col, sz, l: 0 });
const say = (txt, sub, col) => { callout = { txt, sub, col, l: 0 }; };

function onEvents() {
  for (const e of G.ev) {
    const x = sx(e.x || 0), y = sy(e.y || 0);
    if (e.t === 'merge') {
      const col = MINERALS[e.tier][1], r = F.TIERS[e.tier].r * B.u;
      pops.set(e.id, T);
      ring(x, y, r * 0.6, r * 1.9, 0.38, col, 4); burst(x, y, 8 + e.tier * 3, col, B.u * (5 + e.tier), 0.55, 2 + e.tier * 0.25);
      label(x, y - r, '+' + fmt(e.pts), e.chain > 1 ? AMBER : [255, 255, 255], 14 + Math.min(10, e.tier * 1.4));
      A.boom(e.chain + (e.tier >> 1)); H.vib(8 + e.tier * 3);
      shake = Math.max(shake, 1.5 + e.tier * 0.9); if (e.tier >= 5) { hitstop = 0.05; flash = 0.12; flashC = col; }
      if (e.chain >= 2) say('×' + Math.min(8, e.chain), e.chain >= 3 ? 'CHAÎNE' : '', e.chain >= 5 ? AMBER : [255, 255, 255]);
      H.track('fusions', 1); H.track('tier', e.tier + 1, true); H.track('chain', e.chain, true);
    } else if (e.t === 'land') { if (T - landT > 0.07) { landT = T; A.land(); if (e.v > 9) burst(x, y, 3, [200, 190, 170], B.u * 2, 0.3, 1.6); } }
    else if (e.t === 'vapor') { const col = e.tier >= 0 ? MINERALS[e.tier][1] : [150, 140, 130]; burst(x, y, 7, col, B.u * 5, 0.6); ring(x, y, 2, B.u * 0.9, 0.3, col, 2); }
    else if (e.t === 'crumble') { burst(x, y, 9, [165, 150, 135], B.u * 4, 0.5, 3); A.crack(); }
    else if (e.t === 'boom') { ring(x, y, 4, B.u * 3.4, 0.45, [255, 120, 60], 7); burst(x, y, 40, [255, 150, 70], B.u * 13, 0.8, 3.5); shake = 14; flash = 0.3; flashC = [255, 150, 80]; A.breach(); H.vib([20, 30, 40]); }
    else if (e.t === 'morph') { ring(x, y, 2, B.u * 1.4, 0.3, [255, 255, 255], 3); A.star(2); }
    else if (e.t === 'gift') { giftT = T; A.star(e.k === 'j' ? 1 : 0); H.toast(e.k === 'j' ? 'Catalyseur offert : il copie le noyau qu\'il touche' : 'Belle chaîne ! Charge explosive offerte'); }
    else if (e.t === 'rubble') A.step(2);
    else if (e.t === 'pierce') {
      texA = texB; texB = makeTex(e.depth); scroll = 1;
      shake = 18; flash = 0.45; flashC = AMBER; hitstop = 0.09;
      ring(W / 2, sy(F.HT), 10, W, 0.7, AMBER, 9); burst(W / 2, sy(F.HT), 60, [220, 190, 150], B.u * 16, 1, 4);
      say('STRATE ' + (e.depth + 1), strataName(e.depth).toUpperCase() + ' · +' + fmt(e.pts), AMBER);
      A.rumble(); A.mult(Math.min(8, e.depth)); H.vib([30, 40, 60]);
      H.track('depth', e.depth + 1, true);
    } else if (e.t === 'nova') {
      shake = 26; flash = 0.8; flashC = [255, 255, 255]; hitstop = 0.14;
      for (let k = 0; k < 4; k++) ring(x, y, 6, W * (0.4 + k * 0.3), 0.6 + k * 0.15, MINERALS[(9 - k * 2)][1], 10 - k * 2);
      burst(x, y, 90, [255, 240, 200], B.u * 20, 1.2, 4); say('SUPERNOVA', '+' + fmt(e.pts), [255, 244, 214]);
      A.win(); A.rumble(); H.vib([40, 30, 40, 30, 80]); H.track('nova', 1);
    } else if (e.t === 'over') endRun();
  }
  G.ev.length = 0;
}

/* ============================== textures et sprites ============================== */
function makeTex(depth) {
  const c = document.createElement('canvas'), w = c.width = Math.max(64, Math.round(W / 2)), h = c.height = Math.max(64, Math.round(Hh / 2)), x = c.getContext('2d');
  const [hue, sat] = rock(depth), s0 = depth * 31.7;
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `hsl(${hue} ${sat}% 15%)`); g.addColorStop(1, `hsl(${hue + 8} ${sat + 6}% 8%)`); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) { // couches sédimentaires ondulées
    const y0 = (i / 16) * h, amp = 4 + rnd(s0 + i) * 9, ph = rnd(s0 + i * 3) * 6, th = 6 + rnd(s0 + i * 7) * 22;
    x.fillStyle = `hsla(${hue + (rnd(s0 + i * 5) - 0.5) * 16},${sat + 8}%,${rnd(s0 + i * 11) > 0.5 ? 26 : 5}%,.22)`;
    x.beginPath(); x.moveTo(0, y0); for (let px = 0; px <= w; px += 8) x.lineTo(px, y0 + Math.sin(px * 0.021 + ph) * amp); for (let px = w; px >= 0; px -= 8) x.lineTo(px, y0 + th + Math.sin(px * 0.017 + ph * 1.7) * amp); x.fill();
  }
  for (let i = 0; i < 260; i++) { const l = rnd(s0 + i * 1.3) > 0.5; x.fillStyle = l ? `hsla(${hue},${sat}%,60%,.11)` : 'rgba(0,0,0,.22)'; x.fillRect(rnd(s0 + i) * w, rnd(s0 + i * 2.1) * h, 1 + rnd(i) * 2.4, 1 + rnd(i * 3) * 1.6); }
  if (F.STRATA[depth % F.STRATA.length] === 'Magma') { x.strokeStyle = 'rgba(255,120,40,.5)'; x.lineWidth = 1.5; for (let i = 0; i < 7; i++) { x.beginPath(); let px = rnd(i + 9) * w, py = 0; x.moveTo(px, py); while (py < h) { py += 14; px += (rnd(px + py) - 0.5) * 22; x.lineTo(px, py); } x.stroke(); } }
  if (F.STRATA[depth % F.STRATA.length] === 'Géode') for (let i = 0; i < 40; i++) { x.fillStyle = `hsla(${270 + rnd(i) * 60},90%,75%,${0.25 + rnd(i * 2) * 0.4})`; const px = rnd(i * 5) * w, py = rnd(i * 7) * h, s = 1.5 + rnd(i * 9) * 3; x.beginPath(); x.moveTo(px, py - s); x.lineTo(px + s * 0.6, py); x.lineTo(px, py + s); x.lineTo(px - s * 0.6, py); x.fill(); }
  return c;
}
function sprite(tier) {
  const mat = H.mat(), key = mat + ':' + B.u.toFixed(2) + ':' + DPR;
  if (key !== spriteKey) { sprites.clear(); spriteKey = key; }
  let s = sprites.get(tier);
  if (!s) {
    const r = F.TIERS[tier].r * B.u, half = Math.ceil(r * 1.12 * DPR);
    s = document.createElement('canvas'); s.width = s.height = half * 2;
    const x = s.getContext('2d'); x.scale(DPR, DPR);
    Skins.drawOrb(x, mat, half / DPR, half / DPR, r, MINERALS[tier][1], 0, 1.3, { gl: 0 });
    if (tier === F.MAX_TIER) { x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 2; x.setLineDash([r * 0.2, r * 0.14]); x.beginPath(); x.arc(half / DPR, half / DPR, r * 0.72, 0, TAU); x.stroke(); }
    s.half = half / DPR; sprites.set(tier, s);
  }
  return s;
}
function drawItem(it, x, y, sc = 1, ang = 0, u = B.u) {
  if (it.k === 'c') {
    const s = sprite(it.tier), k = sc * u / B.u, h = s.half * k;
    if (ang) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(s, -h, -h, h * 2, h * 2); ctx.restore(); } else ctx.drawImage(s, x - h, y - h, h * 2, h * 2);
  } else if (it.k === 'r') {
    const r = F.R_RUBBLE * u * sc; ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = '#5d554c'; ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, rr = r * (0.82 + rnd(i * 3.3) * 0.26); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.lineTo(-r * 0.1, -r * 0.75); ctx.lineTo(r * 0.35, -r * 0.4); ctx.lineTo(-r * 0.2, -r * 0.1); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.1); ctx.lineTo(r * 0.1, r * 0.3); ctx.lineTo(r * 0.5, r * 0.05); ctx.stroke(); ctx.restore();
  } else {
    const r = F.R_SPECIAL * u * sc, bomb = it.k === 'b', p = 0.5 + 0.5 * Math.sin(T * (bomb ? 9 : 4));
    ctx.fillStyle = bomb ? '#1b1614' : '#f4f1ea'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = bomb ? rgba([255, 90 + p * 90, 40], 1) : `hsl(${(T * 120) % 360} 90% 60%)`; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, TAU); ctx.stroke();
    ctx.fillStyle = bomb ? rgba([255, 120 + p * 100, 50], 1) : '#16130f'; ctx.font = `900 ${r * 1.05}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bomb ? '!' : '?', x, y + r * 0.06);
  }
}

/* ============================== rendu ============================== */
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, lowFx ? 1.5 : 2); W = window.innerWidth; Hh = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR);
  SAT = $('#probe-t') ? $('#probe-t').offsetHeight : 0; SAB = $('#probe-b') ? $('#probe-b').offsetHeight : 0;
  const top = SAT + 104, bar = 86, availH = Hh - top - bar - SAB - 26;
  const u = Math.min((W - 24) / F.W, availH / F.HT, 60);
  B = { u, w: u * F.W, h: u * F.HT, x: (W - u * F.W) / 2, y: top + (availH - u * F.HT) / 2 };
  holdR = { x: B.x, y: B.y + B.h + 30, w: 74, h: 62 };
  texB = makeTex(G ? G.depth : 0); texA = null;
}
function txt(s, x, y, size, col, align = 'center', font = 'Orbitron', weight = 900) { ctx.font = `${weight} ${size}px ${font},system-ui,sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = col; ctx.fillText(s, x, y); }

function draw(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sh = shake > 0.3 ? shake : 0, ox = (Math.random() - 0.5) * sh, oy = (Math.random() - 0.5) * sh;
  // roche : en perçant une strate, l'ancienne texture file vers le haut
  const e = scroll > 0 ? 1 - (1 - scroll) ** 3 : 0, off = e * Hh;
  if (texA && scroll > 0) ctx.drawImage(texA, 0, off - Hh, W, Hh);
  ctx.drawImage(texB, 0, off, W, Hh);
  ctx.save(); ctx.translate(ox, oy);
  // puits
  ctx.fillStyle = '#0b0a0d'; ctx.fillRect(B.x, 0, B.w, B.y + B.h);
  const [hue, sat] = rock(G.depth);
  const wg = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); wg.addColorStop(0, 'rgba(0,0,0,.55)'); wg.addColorStop(0.09, 'rgba(0,0,0,0)'); wg.addColorStop(0.91, 'rgba(0,0,0,0)'); wg.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = `hsl(${hue} ${sat}% 6%)`; ctx.fillRect(B.x, 0, B.w, B.y + B.h);
  ctx.save(); ctx.beginPath(); ctx.rect(B.x, 0, B.w, B.y + B.h); ctx.clip(); ctx.globalAlpha = 0.34; ctx.drawImage(texB, -W * 0.25, off * 0.6 - Hh * 0.2, W * 1.5, Hh * 1.5); ctx.restore(); // paroi du fond, en parallaxe
  ctx.fillStyle = wg; ctx.fillRect(B.x, 0, B.w, B.y + B.h);
  ctx.fillStyle = `hsl(${hue} ${sat}% 30%)`; ctx.fillRect(B.x - 3, 0, 3, B.y + B.h + 16); ctx.fillRect(B.x + B.w, 0, 3, B.y + B.h + 16);
  // graduations de carottage sur la paroi gauche
  ctx.fillStyle = 'rgba(255,255,255,.16)'; for (let i = 1; i < F.HT; i++) ctx.fillRect(B.x, sy(i), i % 5 ? 5 : 10, 1);
  // ligne de danger
  const dg = G.danger, ly = sy(F.LINE);
  ctx.strokeStyle = dg > 0 ? rgba([255, 70, 70], 0.5 + 0.5 * Math.sin(T * 14)) : 'rgba(255,255,255,.2)'; ctx.lineWidth = dg > 0 ? 2.5 : 1; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(B.x, ly); ctx.lineTo(B.x + B.w, ly); ctx.stroke(); ctx.setLineDash([]);
  if (dg > 0) { const g = ctx.createLinearGradient(0, B.y, 0, ly + B.u * 2); g.addColorStop(0, rgba([255, 40, 40], 0.34 * dg)); g.addColorStop(1, 'rgba(255,40,40,0)'); ctx.fillStyle = g; ctx.fillRect(B.x, 0, B.w, ly + B.u * 2); }
  // visée
  if (!G.over) {
    const it = G.cur, ax = sx(F.clampX(it, aimX)), ay = sy(F.DROP_Y), ready = G.cool <= 0;
    if (ready) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.lineDashOffset = -T * 30; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, B.y + B.h); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt'; }
    ctx.globalAlpha = ready ? 1 : 0.35; drawItem(it, ax, ay, ready ? 1 + (aiming ? 0.04 * Math.sin(T * 9) : 0) : 0.8); ctx.globalAlpha = 1;
  }
  // noyaux
  for (const b of G.bodies) {
    const t0 = pops.get(b.id); let sc = 1;
    if (t0 != null) { const p = (T - t0) / 0.36; if (p >= 1) pops.delete(b.id); else sc = 1 + Math.sin(p * Math.PI * 2.2) * (1 - p) * 0.24 + (p < 0.15 ? (p / 0.15 - 1) * 0.35 : 0); }
    drawItem(b, sx(b.x), sy(b.y), sc, b.ang);
  }
  // sol + foreuse : la dalle se fissure et rougeoie à mesure que la jauge monte
  const fy = B.y + B.h, p = clamp(G.drill / F.need(G.depth), 0, 1);
  ctx.fillStyle = `hsl(${hue} ${sat}% 22%)`; ctx.fillRect(B.x - 3, fy, B.w + 6, 16);
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(B.x, fy + 5, B.w, 6);
  const hot = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); hot.addColorStop(0, '#ff7a2e'); hot.addColorStop(1, '#ffd65a'); ctx.fillStyle = hot; ctx.fillRect(B.x, fy + 5, B.w * p, 6);
  ctx.strokeStyle = rgba(AMBER, 0.25 + 0.6 * p); ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0, n = Math.floor(p * 9); i < n; i++) { let cx = B.x + rnd(i * 7.7 + G.depth) * B.w, cy = fy; ctx.moveTo(cx, cy); for (let k = 0; k < 3; k++) { cx += (rnd(i * 3 + k) - 0.5) * 16; cy += 5; ctx.lineTo(cx, cy); } }
  ctx.stroke();
  // effets
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) { const q = r.l / r.m, k = 1 - (1 - q) ** 3; ctx.strokeStyle = rgba(r.col, (1 - q) * 0.9); ctx.lineWidth = r.w * (1 - q) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU); ctx.stroke(); }
  for (const q of parts) { const a = 1 - q.l / q.m; ctx.fillStyle = rgba(q.col, a); ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz); }
  ctx.globalCompositeOperation = 'source-over';
  for (const l of labels) { const a = clamp(1.6 - l.l * 1.9, 0, 1), s = l.l < 0.12 ? 0.6 + l.l / 0.12 * 0.4 : 1; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.font = `900 ${l.sz * s}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.strokeText(l.txt, l.x, l.y - l.l * 46); ctx.fillStyle = rgba(l.col, 1); ctx.fillText(l.txt, l.x, l.y - l.l * 46); }
  ctx.globalAlpha = 1;
  ctx.restore();

  // HUD : score, strate, record
  const cx = W / 2, ty = SAT + 46;
  txt(fmt(shown), cx, ty, 34, '#fff');
  txt(`STRATE ${G.depth + 1} · ${strataName(G.depth).toUpperCase()}`, cx, ty + 22, 11, rgba(AMBER, 0.95), 'center', 'Orbitron', 700);
  if (sv.best) txt(G.score > sv.best ? 'NOUVEAU RECORD' : 'RECORD ' + fmt(sv.best), cx, ty + 38, 10, G.score > sv.best ? '#7dffb0' : 'rgba(255,255,255,.5)', 'center', 'Orbitron', 700);
  // barre du bas : réserve à gauche, suivants à droite
  const hr = holdR, by = hr.y;
  txt('RÉSERVE', hr.x + hr.w / 2, by - 6, 9, 'rgba(255,255,255,.55)', 'center', 'Orbitron', 700);
  ctx.strokeStyle = G.swapped ? 'rgba(255,255,255,.14)' : rgba(AMBER, 0.75); ctx.lineWidth = 1.5; ctx.strokeRect(hr.x + 0.5, by + 0.5, hr.w, hr.h); ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(hr.x + 1, by + 1, hr.w - 1, hr.h - 1);
  if (G.hold) { ctx.globalAlpha = G.swapped ? 0.4 : 1; drawItem(G.hold, hr.x + hr.w / 2, by + hr.h / 2, 1, 0, miniU(G.hold)); ctx.globalAlpha = 1; } else txt('⇄', hr.x + hr.w / 2, by + hr.h / 2 + 8, 22, 'rgba(255,255,255,.28)', 'center', 'system-ui', 400);
  const nx = B.x + B.w; txt('SUIVANT', nx - 60, by - 6, 9, 'rgba(255,255,255,.55)', 'center', 'Orbitron', 700);
  ctx.fillStyle = 'rgba(0,0,0,.42)'; ctx.fillRect(nx - 120, by, 120, hr.h); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.strokeRect(nx - 119.5, by + 0.5, 119, hr.h);
  const gp = clamp(1 - (T - giftT) * 2, 0, 1);
  drawItem(G.queue[0], nx - 82, by + hr.h / 2, 1 + gp * 0.5, 0, miniU(G.queue[0])); ctx.globalAlpha = 0.55; drawItem(G.queue[1], nx - 30, by + hr.h / 2, 0.7, 0, miniU(G.queue[1])); ctx.globalAlpha = 1;
  // consignes diégétiques (première partie)
  if (sv.seen < 2 && !G.over) { const m = G.drops === 0 ? 'Glisse pour viser · relâche pour lâcher' : G.fusions === 0 ? 'Deux minéraux identiques fusionnent' : G.depth === 0 ? 'Chaque fusion charge la foreuse du sol' : ''; if (m) txt(m, cx, B.y + B.h * 0.42, 13, `rgba(255,255,255,${0.55 + 0.25 * Math.sin(T * 3)})`, 'center', 'system-ui', 600); }
  // annonce (chaîne, percée)
  if (callout) { const c = callout, q = c.l / 1.1, s = q < 0.14 ? 1.5 - (q / 0.14) * 0.5 : 1, a = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1; ctx.globalAlpha = clamp(a, 0, 1); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.font = `900 ${44 * s}px Orbitron,sans-serif`; ctx.textAlign = 'center'; const y = B.y + B.h * 0.3; ctx.strokeText(c.txt, cx, y); ctx.fillStyle = rgba(c.col, 1); ctx.fillText(c.txt, cx, y); if (c.sub) { ctx.font = '700 13px Orbitron,sans-serif'; ctx.lineWidth = 4; ctx.strokeText(c.sub, cx, y + 24); ctx.fillStyle = '#fff'; ctx.fillText(c.sub, cx, y + 24); } ctx.globalAlpha = 1; }
  if (flash > 0.01) { ctx.fillStyle = rgba(flashC, flash); ctx.fillRect(0, 0, W, Hh); }
}
const miniU = (it) => Math.min(B.u, 24 / (it.k === 'c' ? F.TIERS[it.tier].r : F.R_SPECIAL));

/* ============================== boucle ============================== */
function update(dt) {
  T += dt;
  if (hitstop > 0) hitstop -= dt; else if (!ended && !paused) { F.tick(G, dt); onEvents(); }
  shake *= Math.exp(-dt * 9); flash *= Math.exp(-dt * 7); if (scroll > 0) scroll = Math.max(0, scroll - dt * 1.1);
  shown += (G.score - shown) * Math.min(1, dt * 10); if (G.score - shown < 1) shown = G.score;
  for (const p of parts) { p.l += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += B.u * 22 * dt; p.vx *= 0.985; }
  for (const r of rings) r.l += dt; for (const l of labels) l.l += dt;
  parts = parts.filter((p) => p.l < p.m); rings = rings.filter((r) => r.l < r.m); labels = labels.filter((l) => l.l < 0.9);
  if (callout && (callout.l += dt) > 1.1) callout = null;
}
function frame(now) {
  raf = 0; if (!isOpen) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw(dt);
  raf = requestAnimationFrame(frame);
}

/* ============================== entrées ============================== */
const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
function onDown(e) {
  if (!G || G.over) return; const p = pt(e);
  if (p.y > holdR.y - 14 && p.x < holdR.x + holdR.w + 14) { if (F.swapHold(G)) { A.select(); H.vib(8); } return; }
  if (p.y > B.y + B.h + 16) return;
  aiming = true; aimX = (p.x - B.x) / B.u; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
}
function onMove(e) { if (aiming) aimX = (pt(e).x - B.x) / B.u; }
function onUp() { if (!aiming) return; aiming = false; if (F.drop(G, aimX)) { A.select(); H.vib(6); if (sv.seen < 2 && G.depth > 0) { sv.seen = 2; save(); } } }

/* ============================== écrans ============================== */
const CSS = `
#mn{position:fixed;inset:0;z-index:9;background:#0b0a0d;display:none}#mn.on{display:block;animation:fade .25s}
#mn-cv{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
.fg-ib{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);width:44px;height:44px;display:grid;place-items:center;background:rgba(0,0,0,.45);border:1.5px solid rgba(255,255,255,.22);border-radius:6px;color:#fff}
.fg-ib:active{transform:translateY(2px)}.fg-ib svg{width:20px;height:20px}#mn-back{left:12px}#mn-help{right:12px}
.fg-modal{position:fixed;inset:0;z-index:12;display:none;align-items:flex-end;justify-content:center;background:rgba(5,4,6,.72)}.fg-modal.on{display:flex;animation:fade .2s}
.fg-panel{width:min(440px,100%);background:#17141a;border-top:3px solid #ffb238;padding:22px 20px calc(env(safe-area-inset-bottom,0px) + 20px);animation:fg-up .32s cubic-bezier(.2,.9,.3,1.15)}
@keyframes fg-up{from{transform:translateY(40%);opacity:0}}
.fg-panel h2{font-family:var(--disp);font-size:24px;letter-spacing:1px;margin:0 0 4px;color:#fff}.fg-panel p{margin:0 0 14px;color:rgba(255,255,255,.66);font-size:14px;line-height:1.45;white-space:pre-line}
.fg-stats{display:grid;grid-template-columns:repeat(4,1fr);border:1.5px solid rgba(255,255,255,.14);margin-bottom:12px}
.fg-stats div{padding:10px 2px;text-align:center;border-left:1.5px solid rgba(255,255,255,.14)}.fg-stats div:first-child{border:0}
.fg-stats b{display:block;font-family:var(--disp);font-size:17px;color:#fff}.fg-stats span{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,.5)}
.fg-stats .rec b{color:#7dffb0}
.fg-q{margin:0 0 14px;font-size:13px;color:rgba(255,255,255,.8)}
.fg-q .q{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}.fg-q .q i{flex:none;width:54px;height:5px;background:rgba(255,255,255,.12);position:relative}.fg-q .q i::after{content:"";position:absolute;inset:0;width:var(--p);background:#ffb238}.fg-q .q.ok{color:#7dffb0}.fg-q .q.ok i::after{background:#7dffb0}.fg-q .q span{flex:1}.fg-q .q em{font-style:normal;color:rgba(255,255,255,.5);font-size:12px}
.fg-btn{display:block;width:100%;min-height:54px;margin-top:10px;font-family:var(--disp);font-weight:900;font-size:15px;letter-spacing:1.5px;text-transform:uppercase;color:#17141a;background:#ffb238;border-radius:6px;box-shadow:0 5px 0 #a8651a;transition:transform .08s,box-shadow .08s}
.fg-btn:active{transform:translateY(4px);box-shadow:0 1px 0 #a8651a}.fg-btn.alt{background:#2a252e;color:#fff;box-shadow:0 5px 0 #0c0a0e}.fg-btn.alt:active{box-shadow:0 1px 0 #0c0a0e}
.fg-lad{display:flex;flex-wrap:wrap;gap:6px 4px;align-items:center;margin:0 0 14px;font-size:11px;color:rgba(255,255,255,.4)}.fg-lad i{width:16px;height:16px;border-radius:50%;display:block}
`;
const HTML = `
<div id="mn"><canvas id="mn-cv"></canvas>
<button class="fg-ib" id="mn-back" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<button class="fg-ib" id="mn-help" aria-label="Règles"><svg viewBox="0 0 24 24"><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg></button></div>
<div class="fg-modal" id="mn-m-over"><div class="fg-panel"><h2 id="mn-ot">Puits saturé</h2><p id="mn-os"></p>
<div class="fg-stats"><div id="mn-c1"><b id="mn-o1">0</b><span>points</span></div><div id="mn-c2"><b id="mn-o2">0</b><span>strate</span></div><div id="mn-c3"><b id="mn-o3">0</b><span>chaîne</span></div><div id="mn-c4"><b id="mn-o4">–</b><span>minéral</span></div></div>
<div class="fg-q" id="mn-q"></div>
<button class="fg-btn" id="mn-again">Rejouer</button><button class="fg-btn alt" id="mn-menu">Menu</button></div></div>
<div class="fg-modal" id="mn-m-help"><div class="fg-panel"><h2>Forage</h2><p id="mn-ht"></p><div class="fg-lad" id="mn-lad"></div><button class="fg-btn" id="mn-hok">Compris</button></div></div>`;
const HELP = `Lâche les minéraux dans le puits. Deux identiques qui se touchent fusionnent en un minéral plus gros.

Quand un seul lâcher déclenche plusieurs fusions d'affilée, c'est une chaîne : chaque maillon multiplie les points. À ×5, tu gagnes une charge explosive.

Chaque fusion charge la foreuse. Jauge pleine : la strate cède, le souffle vaporise les petits minéraux et les gravats, et tu reçois un catalyseur qui copie le minéral qu'il touche.

La réserve garde un minéral pour plus tard. Si la pile dépasse la ligne trop longtemps, le puits est saturé.`;

function endRun() {
  if (ended || !G) return; ended = true;
  const rec = { s: G.score > sv.best, d: G.depth + 1 > sv.depth, c: G.maxChain > sv.chain };
  sv.runs++; sv.seen = Math.max(sv.seen, 1); if (rec.s) sv.best = G.score; if (rec.d) sv.depth = G.depth + 1; if (rec.c) sv.chain = G.maxChain; sv.tier = Math.max(sv.tier, G.maxTier + 1); save();
  H.track('score', G.score, true); H.track('runs', 1);
  const energy = Math.min(80, Math.round(G.depth * 5 + G.score / 2000)); // proportionnel au jeu réel : rien à gagner à saborder une partie
  if (G.over) A.fail();
  setTimeout(() => {
    if (energy > 0) H.grant(energy);
    $('#mn-ot').textContent = rec.s && sv.runs > 1 ? 'Nouveau record' : 'Puits saturé';
    $('#mn-os').textContent = rec.s ? 'Ton meilleur forage jusqu\'ici.' : G.score > sv.best * 0.8 ? `À ${fmt(sv.best - G.score)} points de ton record.` : `Record : ${fmt(sv.best)} · strate ${sv.depth}`;
    $('#mn-o1').textContent = fmt(G.score); $('#mn-o2').textContent = G.depth + 1; $('#mn-o3').textContent = '×' + G.maxChain; $('#mn-o4').textContent = MINERALS[G.maxTier][0];
    $('#mn-c1').className = rec.s ? 'rec' : ''; $('#mn-c2').className = rec.d ? 'rec' : ''; $('#mn-c3').className = rec.c ? 'rec' : '';
    $('#mn-q').innerHTML = H.quests();
    $('#mn-m-over').classList.add('on');
  }, G.over ? 900 : 0);
  refreshTitle();
}
function newRun() {
  G = F.newGame(); ended = false; parts = []; rings = []; labels = []; pops.clear(); callout = null; shown = 0; shake = flash = scroll = 0; aimX = F.W / 2; aiming = false;
  texB = makeTex(0); texA = null; $('#mn-m-over').classList.remove('on');
}
function refreshTitle() { const s = $('#b-mine-s'); if (s) s.textContent = sv.best ? `Record ${fmt(sv.best)} · strate ${sv.depth}` : 'Mode principal · touche pour jouer'; }
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
  click('#mn-help', () => { $('#mn-ht').textContent = HELP; $('#mn-lad').innerHTML = MINERALS.map((m, i) => `<i style="background:rgb(${m[1]});width:${10 + i * 1.6}px;height:${10 + i * 1.6}px" title="${m[0]}"></i>`).join('›'); $('#mn-m-help').classList.add('on'); paused = true; });
  click('#mn-hok', () => { $('#mn-m-help').classList.remove('on'); paused = false; }); click('#mn-again', newRun); click('#mn-menu', close);
  // bouton principal de l'accueil (home.js le transforme en héros) ; Cascade devient un lien discret
  const menu = $('#s-title .menu');
  if (menu && !$('#b-mine')) { const b = document.createElement('button'); b.className = 'big primary hero'; b.id = 'b-mine'; b.innerHTML = '<span>Forage</span><small id="b-mine-s"></small>'; menu.insertBefore(b, menu.firstChild); b.addEventListener('click', () => { A.ui(); H.vib(9); open(); }); }
  refreshTitle();
  window.__mine = { get G() { return G; }, get B() { return B; }, F };
}
