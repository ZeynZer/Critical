// Critical — « Genèse » : rendu et interface du mode principal (logique dans fusion.js, pure et testée).
// On fusionne des astres : orbe → astéroïde → lune → planète → géante gazeuse → étoiles → trou noir.
// Habillage : le verre liquide du reste du jeu, sur fond d'espace profond.
import * as A from './audio.js';
import * as Skins from './skins.js';
import * as F from './fusion.js';

const KEY = 'critical.forage.v2', TAU = Math.PI * 2;
const sv = { best: 0, depth: 0, chain: 0, tier: 0, runs: 0, seen: 0, codex: {}, daily: { day: '', score: 0 } };
try { Object.assign(sv, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* ignore */ } };
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const H = { vib: () => {}, toast: () => {}, mat: () => 'glass', col: () => [77, 243, 255], boom: () => {}, today: () => '', grant: () => {}, track: () => {}, quests: () => '' };
const SECRETS = { binaire: ['Étoile binaire', 'Fusionne deux soleils pendant une chaîne ×3'], festin: ['Festin du trou noir', 'Un trou noir avale 5 astres en une partie'], bigbang: ['Big Bang', 'Fusionne deux trous noirs'] };
const BANG = 0.42; // part du saut passée en implosion, avant le bang
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };

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
let warp = 0, warpMsg = null, slow = 0, beatT = 0;
let shown = 0, callout = null, texA = null, texB = null, sprites = new Map(), spriteKey = '', landT = 0, giftT = 0;
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
      H.boom(e.chain, { ring: (a, b, r0, r1, l, c) => ring(a, b, r0, r1, l, c, 3), burst }, x, y, col, B.u * 1.2); // effet de fusion de la skin équipée
      A.setMood(Math.min(1, G.maxTier / 9 * 0.8 + G.depth * 0.04));
      if (e.tier === F.MAX_TIER && !G.holeSeen) { G.holeSeen = true; slow = 1.1; ring(x, y, W * 0.7, r, 0.9, col, 5); ring(x, y, W * 0.45, r, 0.7, [255, 255, 255], 3); A.rumble(); }
      if (!sv.codex[e.tier]) { sv.codex[e.tier] = 1; save(); if (e.tier >= 3) G.bonus += 10; if (e.tier >= 2) { say(BODIES[e.tier][0].toUpperCase(), 'NOUVEL ASTRE · CODEX', col); A.star(2); } }
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
      // saut : l'espace se contracte (implosion), bang, puis le nouveau secteur se déploie — voir draw() et bang()
      texA = texB; texB = makeTex(e.depth); warp = 1; shake = 6; callout = null;
      warpMsg = ['SECTEUR ' + (e.depth + 1), (G.mod.n || sectorName(e.depth)).toUpperCase() + ' · +' + fmt(e.pts), e.depth];
      A.chestRise(0.75); H.vib(20);
      H.track('depth', e.depth + 1, true);
    } else if (e.t === 'nova') {
      // Big Bang : ralenti, la lumière est aspirée, silence… puis l'explosion
      slow = 1.5; for (let k = 0; k < 3; k++) ring(x, y, W * (0.9 - k * 0.2), 4, 0.6, [[190, 110, 255], MG, [255, 255, 255]][k], 4);
      A.chestRise(0.6); if (!sv.codex.bigbang) { sv.codex.bigbang = 1; save(); G.bonus += 40; }
      const pts = e.pts; setTimeout(() => { if (!isOpen) return;
        shake = 30; flash = 1; flashC = [255, 255, 255]; hitstop = 0.16; slow = 0;
        for (let k = 0; k < 5; k++) ring(x, y, 6, W * (0.4 + k * 0.3), 0.6 + k * 0.16, [CY, MG, AM, [255, 255, 255], [190, 110, 255]][k], 11 - k * 2);
        burst(x, y, 110, [255, 240, 220], B.u * 22, 1.3, 4); say('BIG BANG', '+' + fmt(pts), [255, 255, 255]);
        A.win(); A.rumble(); H.vib([40, 30, 40, 30, 80]); }, 650);
      H.track('nova', 1);
    } else if (e.t === 'pulse') { ring(x, y, e.r * B.u, e.r * B.u * 2.7, 0.45, [170, 212, 255], 4); A.hit(); }
    else if (e.t === 'swallow') { burst(x, y, 6, [190, 110, 255], B.u * 3, 0.4, 2); ring(sx(e.hx), sy(e.hy), B.u * 2.6, B.u * 0.6, 0.4, [190, 110, 255], 3); A.step(0); }
    else if (e.t === 'secret') { const S = SECRETS[e.id]; if (!sv.codex[e.id]) { sv.codex[e.id] = 1; save(); G.bonus += 40; } say(S[0].toUpperCase(), 'DÉCOUVERTE SECRÈTE', AM); ring(x, y, 6, W * 0.6, 0.8, AM, 6); A.win();
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
// Chaque astre est un petit montage de calques pré-rendus, animé à chaque image :
//   back  : halo, couronne, jets, moitié arrière des anneaux (peut tourner et pulser)
//   strip : bande de surface répétable qui défile dans un cercle (la rotation de l'astre) ; strip2 = seconde couche (nuages, plasma)
//   over  : lumière fixe (ombre, reflet, liseré, moitié avant des anneaux) : l'éclairage ne tourne pas avec l'astre
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR); const x = c.getContext('2d'); x.scale(DPR, DPR); return [c, x]; };
const blob = (x, px, py, rx, ry, rot, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, TAU); x.fill(); };
function strip(r, base, n, seed, f) { // n motifs placés au hasard, dessinés 3 fois pour boucler sans couture
  const w = r * 4, h = r * 2, [c, x] = mk(w, h);
  if (typeof base === 'function') base(x, w, h); else if (base) { x.fillStyle = base; x.fillRect(0, 0, w, h); }
  for (let i = 0; i < n; i++) { const px = rnd(seed + i * 1.7) * w, py = rnd(seed + i * 3.1) * h; for (const d of [-w, 0, w]) f(x, px + d, py, i); }
  return c;
}
function halo(r, col, a, rays) {
  const s = r * 1.3, [c, x] = mk(s * 2, s * 2), g = x.createRadialGradient(s, s, r * 0.7, s, s, s); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(0, 0, s * 2, s * 2);
  if (rays) { x.fillStyle = rgba(col, 0.5); for (let i = 0; i < rays; i++) { const t = (i / rays) * TAU, l = r * (1.12 + rnd(i * 2.2) * 0.16); x.beginPath(); x.moveTo(s + Math.cos(t - 0.1) * r * 0.9, s + Math.sin(t - 0.1) * r * 0.9); x.lineTo(s + Math.cos(t) * l, s + Math.sin(t) * l); x.lineTo(s + Math.cos(t + 0.1) * r * 0.9, s + Math.sin(t + 0.1) * r * 0.9); x.fill(); } }
  return c;
}
// lumière d'une planète (ombre portée + reflet + atmosphère) ou d'une étoile (cœur brûlant + bord assombri)
function light(r, R, star, rim) {
  const s = r * 1.3, [c, x] = mk(s * 2, s * 2); x.save(); x.beginPath(); x.arc(s, s, R, 0, TAU); x.clip();
  if (star) { x.globalCompositeOperation = 'lighter'; let g = x.createRadialGradient(s, s, 0, s, s, R * 0.75); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s * 2, s * 2); x.globalCompositeOperation = 'source-over'; g = x.createRadialGradient(s, s, R * 0.6, s, s, R); g.addColorStop(0, rgba(star, 0)); g.addColorStop(1, rgba(star, 0.6)); x.fillStyle = g; x.fillRect(0, 0, s * 2, s * 2); }
  else { const g = x.createRadialGradient(s - R * 0.4, s - R * 0.45, R * 0.35, s - R * 0.1, s - R * 0.1, R * 1.2); g.addColorStop(0, 'rgba(0,0,14,0)'); g.addColorStop(1, 'rgba(0,0,14,.8)'); x.fillStyle = g; x.fillRect(0, 0, s * 2, s * 2); blob(x, s - R * 0.38, s - R * 0.5, R * 0.26, R * 0.11, -0.6, 'rgba(255,255,255,.4)'); }
  x.restore();
  if (rim) { x.strokeStyle = rim; x.lineWidth = Math.max(1.5, R * 0.05); x.beginPath(); x.arc(s, s, R - 0.5, 0, TAU); x.stroke(); }
  return [c, x, s];
}
const soft = (x, px, py, rad, col, a) => { const g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); };
// plasma : taches douces claires et sombres (granulation), jamais de bord net
const starStrip = (r, base, lite, dark, seed) => strip(r, base, 70, seed, (x, px, py, i) => soft(x, px, py, r * (0.16 + rnd(seed + i * 5) * 0.3), i % 3 ? lite : dark, i % 3 ? 0.5 : 0.42));

function build(tier, r) {
  if (tier === 0) { const s = r * 1.3, [c, x] = mk(s * 2, s * 2); Skins.drawOrb(x, H.mat(), s, s, r, H.col().slice(), 0, 1.3, { gl: 0 }); return { spr: c, spin: 0 }; } // l'orbe de départ porte la matière équipée
  if (tier === 1) { // astéroïde : un caillou qui culbute
    const s = r * 1.3, [c, x] = mk(s * 2, s * 2), g = x.createLinearGradient(s - r, s - r, s + r, s + r); g.addColorStop(0, '#dcc8ac'); g.addColorStop(1, '#473b33'); x.fillStyle = g;
    x.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, rr = r * (0.8 + rnd(i * 2.7) * 0.2); x.lineTo(s + Math.cos(a) * rr, s + Math.sin(a) * rr); } x.closePath(); x.fill();
    for (let i = 0; i < 4; i++) blob(x, s + (rnd(i * 3) - 0.5) * r, s + (rnd(i * 5) - 0.5) * r, r * 0.16, r * 0.13, i, 'rgba(40,30,25,.42)');
    return { spr: c, spin: 0.5 };
  }
  if (tier === 2) { const [o] = light(r, r); return { R: r, sp: 0.16, over: o, strip: strip(r, '#aab2c4', 16, 3, (x, px, py, i) => { const cr = r * (0.09 + rnd(i * 7) * 0.17); blob(x, px, py, cr, cr, 0, 'rgba(66,72,92,.5)'); blob(x, px - cr * 0.2, py - cr * 0.2, cr * 0.7, cr * 0.7, 0, 'rgba(120,128,148,.5)'); }) }; }
  if (tier === 3) { // planète : continents lents, nuages plus rapides
    const [o] = light(r, r, null, 'rgba(150,225,255,.75)');
    return { R: r, sp: 0.2, sp2: 0.38, over: o, back: halo(r, [90, 170, 255], 0.3),
      strip: strip(r, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e9f6ff'); g.addColorStop(0.14, '#2f86ff'); g.addColorStop(0.86, '#1d5fe0'); g.addColorStop(1, '#e9f6ff'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 15, 11, (x, px, py, i) => { py = r * 0.3 + (py / (r * 2)) * r * 1.4; blob(x, px, py, r * (0.2 + rnd(i) * 0.3), r * (0.13 + rnd(i * 9) * 0.17), rnd(i * 6) * 3, i % 4 ? '#3fcf7c' : '#d9c47a'); }),
      strip2: strip(r, null, 12, 23, (x, px, py, i) => blob(x, px, py, r * (0.3 + rnd(i * 2) * 0.35), r * 0.07, 0.15, 'rgba(255,255,255,.6)')) };
  }
  if (tier === 4) { // géante gazeuse : bandes, tempêtes, anneau fixe
    const R = r * 0.92, ring = (x, s, a0, a1) => { for (const [k, al, lw] of [[1.26, 0.85, 0.07], [1.12, 0.45, 0.04]]) { x.strokeStyle = `rgba(255,232,190,${al})`; x.lineWidth = r * lw; x.beginPath(); x.ellipse(s, s, r * k, r * k * 0.25, -0.35, a0, a1); x.stroke(); } };
    const s = r * 1.3, [b, bx] = mk(s * 2, s * 2); ring(bx, s, Math.PI, TAU); const [o, ox] = light(r, R); ring(ox, s, 0, Math.PI);
    return { R, sp: 0.5, over: o, back: b, still: true, strip: strip(r, (x, w, h) => { for (let i = 0; i < 9; i++) { x.fillStyle = ['#f6d9a8', '#d98a48', '#f0c088', '#b9642e', '#f8e4c0', '#cf7d3e', '#eec489', '#a9562a', '#e9b877'][i]; x.fillRect(0, (i / 9) * h, w, h / 9 + 1); } }, 22, 31, (x, px, py, i) => { py = (Math.floor((py / (r * 2)) * 9) + 0.5) * r * 2 / 9; blob(x, px, py, r * (0.2 + rnd(i * 3) * 0.3), r * 0.045, 0, i % 2 ? 'rgba(255,246,220,.5)' : 'rgba(110,46,18,.4)'); if (i === 0) blob(x, px, r * 1.25, r * 0.22, r * 0.12, 0, '#c8442c'); }) };
  }
  if (tier <= 7) { // étoiles : deux couches de plasma qui se croisent, halo qui respire
    const P = { 5: ['#ff8a34', [255, 224, 150], [150, 30, 10], [150, 30, 10], [255, 140, 60], 0], 6: ['#ffcf40', [255, 255, 225], [255, 120, 20], [230, 110, 10], [255, 220, 90], 16], 7: ['#ee3d2c', [255, 180, 120], [80, 0, 12], [90, 0, 14], [255, 70, 60], 0] }[tier];
    const [o] = light(r, r, P[3]);
    return { R: r, sp: 0.22, sp2: -0.3, add: true, over: o, back: halo(r, P[4], 0.7, P[5]), spinB: P[5] ? 0.12 : 0, pulse: 0.045, strip: starStrip(r, P[0], P[1], P[2], tier * 7), strip2: starStrip(r, null, P[1], [255, 255, 255], tier * 13) };
  }
  if (tier === 8) { // étoile à neutrons : jets qui balayent, surface très rapide
    const R = r * 0.84, s = r * 1.3, [j, jx] = mk(s * 2, s * 2), g = jx.createLinearGradient(0, s, s * 2, s); g.addColorStop(0, 'rgba(160,210,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(160,210,255,0)');
    jx.fillStyle = g; jx.beginPath(); jx.moveTo(0, s - r * 0.02); jx.lineTo(s, s - r * 0.16); jx.lineTo(s * 2, s - r * 0.02); jx.lineTo(s * 2, s + r * 0.02); jx.lineTo(s, s + r * 0.16); jx.lineTo(0, s + r * 0.02); jx.fill();
    const [o, ox] = light(r, R, [40, 80, 220]); ox.strokeStyle = 'rgba(255,255,255,.65)'; ox.lineWidth = Math.max(1.2, r * 0.035); ox.beginPath(); ox.ellipse(s, s, r * 1.1, r * 0.2, 0.5, 0, TAU); ox.stroke();
    return { R, sp: 1.6, sp2: -1.1, add: true, over: o, back: halo(r, [150, 200, 255], 0.85), pulse: 0.07, disc: j, spinD: 2.4, strip: starStrip(r, '#a9d0ff', [255, 255, 255], [60, 100, 255], 71), strip2: starStrip(r, null, [255, 255, 255], [140, 180, 255], 83) };
  }
  // trou noir : le disque d'accrétion tourne autour d'un horizon immobile
  const s = r * 1.3, [d, dx] = mk(s * 2, s * 2), g = dx.createRadialGradient(s, s, r * 0.55, s, s, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,214,120,1)'); g.addColorStop(0.55, 'rgba(255,79,216,.9)'); g.addColorStop(1, 'rgba(90,40,200,.1)');
  dx.fillStyle = g; dx.beginPath(); dx.arc(s, s, r, 0, TAU); dx.fill(); dx.lineCap = 'round';
  for (let i = 0; i < 34; i++) { const a = rnd(i * 3.7) * TAU, rad = r * (0.64 + rnd(i * 5.3) * 0.34); dx.strokeStyle = i % 3 ? `rgba(255,255,255,${0.2 + rnd(i) * 0.45})` : `rgba(60,10,90,${0.3 + rnd(i) * 0.3})`; dx.lineWidth = r * (0.012 + rnd(i * 2) * 0.03); dx.beginPath(); dx.arc(s, s, rad, a, a + 0.4 + rnd(i * 8) * 1.3); dx.stroke(); }
  const [o, ox] = mk(s * 2, s * 2); ox.fillStyle = '#000'; ox.beginPath(); ox.arc(s, s, r * 0.6, 0, TAU); ox.fill();
  ox.strokeStyle = 'rgba(255,255,255,.95)'; ox.lineWidth = Math.max(1.5, r * 0.03); ox.beginPath(); ox.arc(s, s, r * 0.61, 0, TAU); ox.stroke();
  ox.strokeStyle = 'rgba(255,210,140,.9)'; ox.lineWidth = r * 0.06; ox.beginPath(); ox.ellipse(s, s, r * 1.14, r * 0.16, -0.3, 0, Math.PI); ox.stroke();
  return { over: o, back: halo(r, [170, 90, 255], 0.8), pulse: 0.06, disc: d, spinD: 0.9 };
}
function sprite(tier) {
  const key = H.mat() + ':' + B.u.toFixed(2) + ':' + DPR;
  if (key !== spriteKey) { sprites.clear(); spriteKey = key; }
  let s = sprites.get(tier);
  if (!s) { const r = F.TIERS[tier].r * B.u; s = build(tier, r); s.h = r * 1.3; sprites.set(tier, s); }
  return s;
}
function drawItem(it, x, y, sc = 1, ang = 0, u = B.u) {
  if (it.k === 'c') {
    const s = sprite(it.tier), h = s.h, img = (c) => ctx.drawImage(c, -h, -h, h * 2, h * 2);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc * u / B.u, sc * u / B.u);
    if (s.spr) { ctx.rotate(ang + T * s.spin); img(s.spr); ctx.restore(); return; }
    if (s.back) { const p = 1 + (s.pulse || 0) * Math.sin(T * 2.3 + it.tier); ctx.save(); if (s.spinB) ctx.rotate(T * s.spinB); if (!s.still) ctx.scale(p, p); img(s.back); ctx.restore(); }
    if (s.disc) { ctx.save(); ctx.rotate(T * s.spinD + ang); img(s.disc); ctx.restore(); }
    if (s.strip) {
      const R = s.R, w = (h / 1.3) * 4, lay = (c, sp) => { const o = (((T * sp + ang) * R) % w + w) % w; ctx.drawImage(c, -R - o, -w / 4, w, w / 2); ctx.drawImage(c, -R - o + w, -w / 4, w, w / 2); };
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip(); lay(s.strip, s.sp);
      if (s.strip2) { if (s.add) ctx.globalCompositeOperation = 'lighter'; lay(s.strip2, s.sp2); }
      ctx.restore();
    }
    if (s.over) img(s.over);
    ctx.restore();
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
  const q = warp > 0 ? 1 - warp : -1, im = q >= 0 && q < BANG, p = q < 0 ? 1 : im ? q / BANG : (q - BANG) / (1 - BANG), mx = W / 2, my = B.y + B.h * 0.5;
  const zoomBg = (tex, z, a) => { ctx.globalAlpha = a; ctx.drawImage(tex, mx - mx * z, my - my * z, W * z, Hh * z); ctx.globalAlpha = 1; };
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, Hh);
  if (im && texA) zoomBg(texA, 1 + p * p * 2.2, 1 - p * 0.8); else zoomBg(texB, 1 + (1 - p) ** 3 * 1.5, 1);
  if (q < 0) { ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = (0.2 + 0.6 * Math.abs(Math.sin(T * s.z + s.p))) * s.z; ctx.fillRect(s.x * W, ((s.y + T * 0.006 * s.z) % 1) * Hh, 1.6, 1.6); } ctx.globalAlpha = 1; }
  else { // les étoiles filent vers le centre, puis jaillissent ; la grille d'espace-temps se creuse puis une onde la traverse
    const maxR = Math.hypot(W, Hh) * 0.6, env = im ? p : 1 - p; ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const s of stars) { const a = s.p * 7.3, rad = ((((s.x + (im ? -1 : 1) * p * (0.5 + s.z)) % 1) + 1) % 1) * maxR, len = 3 + env * 110 * s.z, c = Math.cos(a), sn = Math.sin(a); ctx.strokeStyle = `rgba(210,235,255,${0.25 + 0.6 * env * s.z})`; ctx.beginPath(); ctx.moveTo(mx + c * rad, my + sn * rad); ctx.lineTo(mx + c * (rad + len), my + sn * (rad + len)); ctx.stroke(); }
    const front = p * maxR, pt = (x, y, first) => { const dx = x - mx, dy = y - my, d = Math.hypot(dx, dy) || 1, k = im ? -p * p * 0.8 * Math.exp(-d / (maxR * 0.45)) * d : Math.sin((d - front) / 24) * 28 * Math.exp(-(((d - front) / 85) ** 2)) * (1 - p); const nx = x + (dx / d) * k, ny = y + (dy / d) * k; if (first) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny); };
    ctx.strokeStyle = rgba(im ? MG : CY, 0.08 + 0.34 * env); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = mx % 36; x < W; x += 36) for (let y = 0; y <= Hh + 18; y += 18) pt(x, y, y === 0);
    for (let y = my % 36; y < Hh; y += 36) for (let x = 0; x <= W + 18; x += 18) pt(x, y, x === 0);
    ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
  }
  ctx.save(); ctx.translate(ox, oy);
  if (q >= 0) { const z = im ? 1 - 0.12 * p * p : 1 + 0.1 * (1 - p) ** 3; ctx.translate(mx, my); ctx.scale(z, z); ctx.translate(-mx, -my); } // la cuve est aspirée puis rebondit
  // puits de gravité : une cuve de verre
  ctx.fillStyle = 'rgba(4,6,20,.42)'; rr(B.x - 4, B.y - 40, B.w + 8, B.h + 44, 22); ctx.fill();
  glassBox(B.x - 4, B.y - 40, B.w + 8, B.h + 44, 22, 0.26);
  const sheen = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); sheen.addColorStop(0, 'rgba(255,255,255,.1)'); sheen.addColorStop(0.07, 'rgba(255,255,255,0)'); sheen.addColorStop(0.95, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.07)'); ctx.fillStyle = sheen; ctx.fillRect(B.x, B.y - 30, B.w, B.h + 20);
  if (G.inset > 0.02) { const iw = G.inset * B.u; ctx.fillStyle = 'rgba(255,79,216,.16)'; ctx.fillRect(B.x, B.y - 30, iw, B.h + 30); ctx.fillRect(B.x + B.w - iw, B.y - 30, iw, B.h + 30); } // parois resserrées
  // ligne de danger
  const dg = G.danger, ly = sy(F.LINE);
  ctx.strokeStyle = dg > 0 ? rgba([255, 80, 110], 0.5 + 0.5 * Math.sin(T * 14)) : 'rgba(255,255,255,.22)'; ctx.lineWidth = dg > 0 ? 2.5 : 1; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(B.x + 6, ly); ctx.lineTo(B.x + B.w - 6, ly); ctx.stroke(); ctx.setLineDash([]);
  if (dg > 0) { const g = ctx.createLinearGradient(0, B.y - 40, 0, ly + B.u * 2); g.addColorStop(0, rgba([255, 50, 90], 0.36 * dg)); g.addColorStop(1, 'rgba(255,50,90,0)'); ctx.fillStyle = g; ctx.fillRect(B.x, B.y - 36, B.w, ly + B.u * 2 - B.y + 36); }
  // visée
  if (!G.over) {
    const it = G.cur, ax = sx(F.clampX(it, aimX, G.inset)), ay = sy(F.DROP_Y), ready = G.cool <= 0;
    if (ready) { // trajectoire prévue : la gravité des étoiles la courbe
      const tr = F.trace(G, aimX), n = tr.length; ctx.fillStyle = '#fff';
      for (let i = 2; i < n; i += 2) { ctx.globalAlpha = 0.5 * (1 - i / n) + 0.12; ctx.beginPath(); ctx.arc(sx(tr[i]), sy(tr[i + 1]), 1.8, 0, TAU); ctx.fill(); }
      if (n > 3) { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(sx(tr[n - 2]), sy(tr[n - 1]), (it.k === 'c' ? F.TIERS[it.tier].r : F.R_SPECIAL) * B.u, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = ready ? 1 : 0.35; drawItem(it, ax, ay + (ready ? Math.sin(T * 2.6) * 2 : 0), ready ? 1 : 0.8); ctx.globalAlpha = 1;
  }
  // astres
  for (const b of G.bodies) {
    const t0 = pops.get(b.id); let sc = 1;
    if (t0 != null) { const p = (T - t0) / 0.4; if (p >= 1) pops.delete(b.id); else sc = 1 + Math.sin(p * Math.PI * 2.2) * (1 - p) * 0.26 + (p < 0.15 ? (p / 0.15 - 1) * 0.4 : 0); }
    drawItem(b, sx(b.x), sy(b.y), sc, b.ang);
  }
  // jauge de saut, sous la cuve
  const fy = B.y + B.h + 10, dp = clamp(G.drill / F.need(G.depth), 0, 1), gw = B.w - 8;
  rr(B.x + 4, fy, gw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  if (dp > 0.01) { const hot = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); hot.addColorStop(0, '#4df3ff'); hot.addColorStop(0.6, '#ff4fd8'); hot.addColorStop(1, '#ffc247'); ctx.shadowColor = '#ff4fd8'; ctx.shadowBlur = lowFx ? 0 : 10 + 8 * dp; rr(B.x + 4, fy, Math.max(8, gw * dp), 8, 4); ctx.fillStyle = hot; ctx.fill(); ctx.shadowBlur = 0; }
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
  txt(`${G.daily ? 'UNIVERS DU JOUR · ' : ''}SECTEUR ${G.depth + 1} · ${sectorName(G.depth).toUpperCase()}`, cx, ty + 20, 10.5, rgba(CY, 0.95), 'center', 'Orbitron', 700);
  if (G.mod.n) txt(G.mod.n.toUpperCase(), cx, ty + 35, 9.5, rgba(MG, 1), 'center', 'Orbitron', 700);
  else if (sv.best) txt(G.score > sv.best ? 'NOUVEAU RECORD' : 'RECORD ' + fmt(sv.best), cx, ty + 35, 9.5, G.score > sv.best ? '#5dffc0' : 'rgba(255,255,255,.5)', 'center', 'Orbitron', 700);
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
  if (im) { ctx.fillStyle = `rgba(2,3,12,${p * 0.45})`; ctx.fillRect(0, 0, W, Hh); }
  if (slow > 0) { const g = ctx.createRadialGradient(W / 2, Hh / 2, W * 0.2, W / 2, Hh / 2, Hh * 0.7); g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, `rgba(0,0,10,${Math.min(0.8, slow * 1.6)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh); }
  if (flash > 0.01) { ctx.fillStyle = rgba(flashC, flash); ctx.fillRect(0, 0, W, Hh); }
}
const miniU = (it) => Math.min(B.u, 20 / (it.k === 'c' ? F.TIERS[it.tier].r : F.R_SPECIAL));

/* ============================== boucle ============================== */
function update(dt) {
  T += dt;
  if (hitstop > 0) hitstop -= dt; else if (!ended && !paused) { F.tick(G, slow > 0 ? dt * 0.3 : dt); onEvents(); }
  if (slow > 0) slow -= dt;
  if (warp > 0) { const w0 = warp; warp = Math.max(0, warp - dt / 1.8); if (w0 > 1 - BANG && warp <= 1 - BANG) bang(); }
  if (G.danger > 0 && !ended && T - beatT > 0.62 - 0.3 * G.danger) { beatT = T; A.chestBeat(G.danger); H.vib(6); } // le cœur s'emballe près de la ligne
  shake *= Math.exp(-dt * 9); flash *= Math.exp(-dt * 7);
  shown += (G.score - shown) * Math.min(1, dt * 10); if (G.score - shown < 1) shown = G.score;
  for (const p of parts) { p.l += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
  for (const r of rings) r.l += dt; for (const l of labels) l.l += dt;
  parts = parts.filter((p) => p.l < p.m); rings = rings.filter((r) => r.l < r.m); labels = labels.filter((l) => l.l < 0.9);
  if (callout && (callout.l += dt) > 1.2) callout = null;
}
function bang() { // milieu du saut : le nouveau secteur naît
  const m = warpMsg || ['', '', 0], cx = W / 2, cy = B.y + B.h * 0.5;
  flash = 0.95; flashC = [255, 255, 255]; shake = 24; hitstop = 0.08;
  [CY, MG, AM].forEach((c, k) => ring(cx, cy, 8, Math.max(W, Hh) * (0.55 + k * 0.25), 0.8 + k * 0.2, c, 10 - k * 3));
  burst(cx, cy, 70, [220, 240, 255], B.u * 18, 1.1, 3.5); say(m[0], m[1], CY);
  A.rumble(); A.mult(Math.min(8, m[2])); H.vib([30, 40, 70]);
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
#mn .icon{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px)}#mn-back{left:14px}#mn-help{right:14px}#mn-day{right:68px}
#mn-cx{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:46vh;overflow-y:auto;touch-action:pan-y}
.cx{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:center;opacity:.55}.cx.ok{opacity:1;border-color:rgba(255,255,255,.28)}
.cx canvas{width:64px;height:64px}.cx i{width:64px;height:64px;display:grid;place-items:center;font:900 26px var(--disp);font-style:normal;color:rgba(255,255,255,.4)}.cx.ok i{color:#ffc247}.cx b{font-size:11px}.cx small{font-size:9.5px;line-height:1.25;color:rgba(255,255,255,.55)}
#mn-m-over .stats{flex-wrap:wrap}#mn-m-over .stats div{min-width:40%}#mn-m-over .stats .rec b{color:#5dffc0}
.fg-q{width:100%;font-size:13px;color:rgba(255,255,255,.85)}
.fg-q .q{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}.fg-q .q:last-child{border:0}
.fg-q .q i{flex:none;width:46px;height:5px;border-radius:3px;background:rgba(255,255,255,.14);position:relative;overflow:hidden}.fg-q .q i::after{content:"";position:absolute;inset:0;width:var(--p);border-radius:3px;background:linear-gradient(90deg,#4df3ff,#ff4fd8)}
.fg-q .q.ok{color:#5dffc0}.fg-q .q.ok i::after{background:#5dffc0}.fg-q .q span{flex:1}.fg-q .q em{font-style:normal;color:rgba(255,255,255,.55);font-size:12px;white-space:nowrap}
#mn-lad{font-size:11.5px;line-height:1.6;color:rgba(255,255,255,.6)}
`;
const HTML = `
<div id="mn"><canvas id="mn-cv"></canvas>
<button class="icon glass" id="mn-back" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<button class="icon glass" id="mn-day" aria-label="Univers du jour"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg></button>
<button class="icon glass" id="mn-help" aria-label="Règles"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg></button></div>
<div class="modal" id="mn-m-over"><div class="card glass"><h2 id="mn-ot">Effondrement</h2><p id="mn-os"></p>
<div class="stats"><div id="mn-c1"><b id="mn-o1">0</b><span>points</span></div><div id="mn-c2"><b id="mn-o2">0</b><span>secteur</span></div><div id="mn-c3"><b id="mn-o3">0</b><span>chaîne max</span></div><div id="mn-c4"><b id="mn-o4" style="font-size:15px">–</b><span>plus gros astre</span></div></div>
<div class="fg-q" id="mn-q"></div>
<div class="btns"><button class="big primary" id="mn-again">Rejouer</button><button class="big glass" id="mn-share" hidden>Partager mon score</button><button class="big glass" id="mn-menu">Menu</button></div></div></div>
<div class="modal" id="mn-m-help"><div class="card glass"><h2>Genèse</h2><p class="multi" id="mn-ht"></p><p id="mn-lad"></p><div class="btns"><button class="big glass" id="mn-cxb">Codex des astres</button><button class="big primary" id="mn-hok">C'est parti</button></div></div></div>`;
const HTML2 = `<div class="modal" id="mn-m-codex"><div class="card glass"><h2>Codex</h2><p id="mn-cxs"></p><div id="mn-cx"></div><div class="btns"><button class="big primary" id="mn-cxok">Fermer</button></div></div></div>`;
const HELP = `Lâche les astres dans le puits. Deux identiques qui se touchent fusionnent en un astre plus gros.

Un seul lâcher qui déclenche plusieurs fusions, c'est une chaîne : chaque maillon multiplie les points. À ×5, tu gagnes une comète explosive.

Chaque fusion charge la jauge de saut. Pleine, tu passes au secteur suivant : l'onde vaporise les petits astres et les débris, et tu reçois de la matière exotique qui copie l'astre qu'elle touche.

Les étoiles attirent les astres plus petits : la visée montre la trajectoire courbée. L'étoile à neutrons repousse par impulsions, la géante rouge enfle tant qu'on ne la fusionne pas, le trou noir avale les petits astres voisins.

Chaque secteur change une règle (gravité, vent, parois). Si la pile dépasse la ligne trop longtemps, tout s'effondre.`;

function showCodex() {
  const g = $('#mn-cx'); g.innerHTML = ''; let n = 0;
  const cell = (name, tier, hint, ok) => {
    const d = document.createElement('div'); d.className = 'cx' + (ok ? ' ok' : ''); if (ok) n++;
    if (ok && tier >= 0) { const c = document.createElement('canvas'), keep = ctx; c.width = c.height = 64 * DPR; ctx = c.getContext('2d'); ctx.scale(DPR, DPR); drawItem({ k: 'c', tier }, 32, 32, 1, 0, 21 / F.TIERS[tier].r); ctx = keep; d.append(c); }
    else d.insertAdjacentHTML('beforeend', `<i>${ok ? '★' : '?'}</i>`);
    d.insertAdjacentHTML('beforeend', `<b>${ok ? name : '???'}</b>` + (hint ? `<small>${hint}</small>` : '')); g.append(d);
  };
  BODIES.forEach((b, i) => cell(b[0], i, '', !!sv.codex[i]));
  for (const id in SECRETS) cell(SECRETS[id][0], -1, SECRETS[id][1], !!sv.codex[id]);
  $('#mn-cxs').textContent = `${n}/${BODIES.length + 3} découvertes. Chaque nouvelle entrée rapporte de l'énergie.`;
  $('#mn-m-codex').classList.add('on');
}
function startDaily() {
  const d = H.today(); if (!d) return;
  if (sv.daily.day === d) return H.toast(`Univers du jour déjà joué : ${fmt(sv.daily.score)} points. Reviens demain !`);
  if (G && !ended && G.drops > 8) return H.toast('Termine d\'abord ta partie en cours');
  newRun(hash('critical:genese:' + d)); G.daily = d; H.toast('Univers du jour : même tirage pour tous, une seule tentative');
}
function share() {
  const t = `Critical · Genèse — univers du ${sv.daily.day} : ${fmt(sv.daily.score)} points. À toi !`;
  if (navigator.share) navigator.share({ text: t }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => H.toast('Score copié'), () => {});
}

function endRun() {
  if (ended || !G) return; ended = true;
  const rec = { s: G.score > sv.best, d: G.depth + 1 > sv.depth, c: G.maxChain > sv.chain };
  sv.runs++; sv.seen = Math.max(sv.seen, 1); if (rec.s) sv.best = G.score; if (rec.d) sv.depth = G.depth + 1; if (rec.c) sv.chain = G.maxChain; sv.tier = Math.max(sv.tier, G.maxTier + 1); save();
  H.track('score', G.score, true); H.track('runs', 1);
  if (G.daily) sv.daily = { day: G.daily, score: G.score }, save();
  const energy = Math.min(80, Math.round(G.depth * 5 + G.score / 2000)) + G.bonus; // proportionnel au jeu réel : rien à gagner à saborder une partie
  if (G.over) A.fail();
  setTimeout(() => {
    if (energy > 0) H.grant(energy);
    $('#mn-ot').textContent = G.daily ? 'Univers du jour' : rec.s && sv.runs > 1 ? 'Nouveau record !' : 'Effondrement'; $('#mn-share').hidden = !G.daily;
    $('#mn-os').textContent = rec.s ? 'Ton plus bel univers jusqu\'ici.' : G.score > sv.best * 0.8 ? `À ${fmt(sv.best - G.score)} points de ton record.` : `Record : ${fmt(sv.best)} · secteur ${sv.depth}`;
    $('#mn-o1').textContent = fmt(G.score); $('#mn-o2').textContent = G.depth + 1; $('#mn-o3').textContent = '×' + G.maxChain; $('#mn-o4').textContent = BODIES[G.maxTier][0];
    $('#mn-c1').className = rec.s ? 'rec' : ''; $('#mn-c2').className = rec.d ? 'rec' : ''; $('#mn-c3').className = rec.c ? 'rec' : '';
    $('#mn-q').innerHTML = H.quests();
    $('#mn-m-over').classList.add('on');
  }, G.over ? 900 : 0);
  refreshTitle();
}
function newRun(seed) {
  G = F.newGame(seed); G.bonus = 0; warp = slow = 0; A.setMood(0); ended = false; parts = []; rings = []; labels = []; pops.clear(); callout = null; shown = 0; shake = flash = 0; aimX = F.W / 2; aiming = false;
  texB = makeTex(0); texA = null; $('#mn-m-over').classList.remove('on');
}
function refreshTitle() { const s = $('#b-mine-s'); if (s) s.textContent = sv.best ? `Record ${fmt(sv.best)} · secteur ${sv.depth}` : 'De l\'orbe au trou noir'; }
export const busy = () => isOpen;
export const stats = () => ({ ...sv });
export function open() {
  isOpen = true; sprites.clear(); $('#mn').classList.add('on'); lowFx = (navigator.hardwareConcurrency || 4) <= 4;
  G = null; resize(); newRun(); last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
}
function close() { A.setMood(0); isOpen = false; $('#mn').classList.remove('on'); $('#mn-m-over').classList.remove('on'); refreshTitle(); }
export function init(opts) {
  Object.assign(H, opts);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('div'); d.innerHTML = HTML + HTML2; document.body.append(...d.children);
  cv = $('#mn-cv'); ctx = cv.getContext('2d');
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', () => { aiming = false; });
  window.addEventListener('resize', () => { if (isOpen) resize(); });
  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  const click = (el, f) => $(el).addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  click('#mn-back', () => { if (G && !ended && G.drops > 8) { endRun(); return; } close(); }); // partie entamée : on la comptabilise
  click('#mn-help', () => { $('#mn-ht').textContent = HELP; $('#mn-lad').textContent = BODIES.map((b) => b[0]).join(' › '); $('#mn-m-help').classList.add('on'); paused = true; });
  click('#mn-hok', () => { $('#mn-m-help').classList.remove('on'); paused = false; }); click('#mn-again', () => newRun()); click('#mn-day', startDaily); click('#mn-share', share); click('#mn-cxb', showCodex); click('#mn-cxok', () => $('#mn-m-codex').classList.remove('on')); click('#mn-menu', close);
  // bouton principal de l'accueil (home.js le transforme en héros) ; Cascade devient un lien discret
  const menu = $('#s-title .menu');
  if (menu && !$('#b-mine')) { const b = document.createElement('button'); b.className = 'big primary hero'; b.id = 'b-mine'; b.innerHTML = '<span>Genèse</span><small id="b-mine-s"></small>'; menu.insertBefore(b, menu.firstChild); b.addEventListener('click', () => { A.ui(); H.vib(9); open(); }); }
  refreshTitle();
  window.__mine = { get G() { return G; }, get B() { return B; }, F };
}
