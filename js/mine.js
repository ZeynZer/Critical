// Critical — le jeu : rendu et interface (logique dans fusion.js, pure et testée).
// On fusionne des astres : orbe → astéroïde → lune → planète → géante gazeuse → étoiles → trou noir.
// Habillage : le verre liquide du reste du jeu, sur fond d'espace profond.
import * as A from './audio.js';
import * as F from './fusion.js';

const KEY = 'critical.forage.v2', TAU = Math.PI * 2;
const sv = { best: 0, depth: 0, chain: 0, tier: 0, runs: 0, tut: 0, cx: {}, dust: 0, themes: { base: 1 }, theme: 'base', daily: { day: '', done: false, best: 0 } };
try { Object.assign(sv, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* ignore */ } };
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const H = { vib: () => {}, toast: () => {}, today: () => '', track: () => {}, quests: () => '', refresh: () => {}, submit: () => Promise.resolve(null), rank: () => {}, askName: () => {}, named: () => true, online: () => false };
const RUN = 'critical.genese.run'; // partie en cours, pour la reprendre après fermeture de l'application
const SECRETS = { binaire: ['Étoile binaire', 'Fusionne deux soleils pendant une chaîne ×3'], festin: ['Festin du trou noir', 'Un trou noir avale 5 astres en une partie'], bigbang: ['Big Bang', 'Fusionne deux trous noirs'] };
const BANG = 0.42; // part du saut passée en implosion, avant le bang
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };

// Un astre par rang : [nom, couleur des effets]
export const BODIES = [
  ['Poussière d\'étoile', [255, 236, 190]], ['Orbe', [77, 243, 255]], ['Astéroïde', [196, 172, 146]], ['Lune', [206, 214, 230]], ['Planète', [80, 150, 255]], ['Géante gazeuse', [244, 176, 96]],
  ['Naine orange', [255, 150, 60]], ['Soleil', [255, 226, 110]], ['Géante rouge', [255, 84, 66]], ['Étoile à neutrons', [170, 212, 255]], ['Trou noir', [190, 110, 255]], ['Quasar', [255, 214, 130]], ['Galaxie', [200, 215, 255]],
];
const CY = [77, 243, 255], MG = [255, 79, 216], AM = [255, 194, 71];
// Thèmes d'arrière-plan : la récompense du jeu, achetée en poussière d'étoile (✦). h = teinte de la nébuleuse pour chacun des 9 secteurs.
export const THEMES = [
  { id: 'base', n: 'Nébuleuse', cost: 0, h: [215, 280, 330, 190, 20, 260, 160, 300, 45], s: 55, a: 0.2, sp: 45 },
  { id: 'aurore', n: 'Aurore', cost: 300, h: [150, 170, 130, 190, 160, 140, 180, 120, 165], s: 65, a: 0.24, sp: 60 },
  { id: 'braise', n: 'Braise', cost: 600, h: [10, 25, 0, 35, 15, 350, 30, 5, 20], s: 70, a: 0.24, sp: 25 },
  { id: 'abysse', n: 'Abysse', cost: 1000, h: [200, 210, 190, 220, 205, 195, 215, 185, 200], s: 80, a: 0.13, sp: 20 },
  { id: 'quartz', n: 'Rose quartz', cost: 1500, h: [320, 300, 340, 310, 330, 290, 345, 305, 325], s: 55, a: 0.26, sp: 40 },
  { id: 'or', n: 'Or noir', cost: 2500, h: [45, 40, 50, 38, 48, 42, 52, 36, 46], s: 75, a: 0.16, sp: 12 },
  { id: 'prisme', n: 'Prisme', cost: 4000, h: [0, 40, 80, 120, 160, 200, 240, 280, 320], s: 90, a: 0.3, sp: 110 },
];
const theme = () => THEMES.find((t) => t.id === sv.theme) || THEMES[0];
// Défis du jour : [objectif, valeur, secondes, texte]. Durées réglées sur un joueur simulé rapide (tools/test.mjs ne les couvre pas).
const CHAL = [['tier', 7, 75, 'Crée un Soleil en moins de 1 min 15'], ['tier', 8, 120, 'Crée une Géante rouge en moins de 2 min'], ['tier', 9, 180, 'Crée une Étoile à neutrons en moins de 3 min'],
  ['chain', 5, 90, 'Déclenche une chaîne ×5 en moins de 1 min 30'], ['depth', 2, 60, 'Atteins le secteur 3 en moins de 1 min'], ['score', 6000, 60, 'Marque 6 000 points en moins de 1 min']];
const TUT = ['Pose ton doigt dans la cuve, glisse pour viser, puis relâche.', 'Lâche le même astre contre le premier : deux astres identiques fusionnent.', 'Chaque fusion remplit la jauge du bas. Encore deux fusions !', 'Touche RÉSERVE, en bas à gauche, pour garder un astre de côté.', 'Voici le classement mondial. Choisis ton pseudo pour y participer.'];
const sectorName = (d) => (d < F.STRATA.length ? F.STRATA[d] : `Origine +${d - F.STRATA.length + 1}`);

/* ============================== état ============================== */
let G = null, isOpen = false, raf = 0, T = 0, last = 0, cv, ctx, W = 0, Hh = 0, DPR = 1, SAT = 0, SAB = 0, lowFx = false, paused = false;
let B = { x: 0, y: 0, w: 0, h: 0, u: 30 }, holdR = null, aimX = F.W / 2, aimT = F.W / 2, want = false, reveal = null, aiming = false, ended = false;
let parts = [], rings = [], labels = [], pops = new Map(), shake = 0, flash = 0, flashC = [255, 255, 255], hitstop = 0;
let FN = 0, hud = null, hudKey = '', tut = -1;
let warp = 0, warpMsg = null, slow = 0, beatT = 0;
let shown = 0, callout = null, texA = null, texB = null, sprites = new Map(), spriteKey = '', landT = 0, giftT = 0;
const stars = Array.from({ length: 46 }, (_, i) => ({ x: rnd(i), y: rnd(i * 2.3), z: 0.3 + rnd(i * 5.1) * 0.7, p: rnd(i * 7) * 6 }));

const sx = (x) => B.x + x * B.u, sy = (y) => B.y + y * B.u;

/* ============================== effets ============================== */
const ring = (x, y, r0, r1, life, col, w = 3) => rings.push({ x, y, r0, r1, l: 0, m: life, col, w });
function burst(x, y, n, col, sp, life = 0.7, sz = 2.5) {
  n = Math.round(n * (lowFx ? 0.5 : 1));
  for (let i = 0; i < n && parts.length < (lowFx ? 110 : 260); i++) { const a = Math.random() * TAU, v = sp * (0.35 + Math.random() * 0.65); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 0, m: life * (0.6 + Math.random() * 0.6), cs: `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`, sz: sz * (0.6 + Math.random() * 0.8) }); }
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
      A.fuse(e.tier <= 3 ? 0 : e.tier <= 5 ? 1 : e.tier <= 8 ? 2 : e.tier <= 10 ? 3 : 4, e.chain); H.vib(8 + e.tier * 3);
      shake = Math.max(shake, 1.5 + e.tier * 0.9); if (e.tier >= 6) { hitstop = 0.05; flash = 0.14; flashC = col; }
      A.setMood(Math.min(1, G.maxTier / F.MAX_TIER * 0.8 + G.depth * 0.04));
      if (e.tier === F.HOLE && !G.holeSeen) { G.holeSeen = true; slow = 1.1; ring(x, y, W * 0.7, r, 0.9, col, 5); ring(x, y, W * 0.45, r, 0.7, [255, 255, 255], 3); A.rumble(); }
      if (!sv.cx[e.tier]) { sv.cx[e.tier] = 1; save(); if (e.tier >= 4) G.bonus += 10; if (e.tier >= 3 && !reveal) { say(BODIES[e.tier][0].toUpperCase(), 'NOUVEL ASTRE · CODEX', col); A.star(2); } }
      else if (e.chain >= 2) say('×' + Math.min(8, e.chain), e.chain >= 3 ? 'CHAÎNE' : '', e.chain >= 5 ? AM : [255, 255, 255]);
      H.track('fusions', 1); H.track('tier', e.tier + 1, true); H.track('chain', e.chain, true);
    } else if (e.t === 'land') { if (T - landT > 0.07) { landT = T; A.thud(Math.min(1, e.v / 30)); if (e.v > 9) burst(x, y, 3, [200, 220, 255], B.u * 2, 0.3, 1.6); } }
    else if (e.t === 'vapor') { const col = BODIES[e.tier][1]; burst(x, y, 7, col, B.u * 5, 0.6); ring(x, y, 2, B.u * 0.9, 0.3, col, 2); }
    else if (e.t === 'boom') { ring(x, y, 4, B.u * 3.4, 0.45, CY, 7); burst(x, y, 40, [200, 240, 255], B.u * 13, 0.8, 3.5); shake = 14; flash = 0.3; flashC = CY; A.breach(); H.vib([20, 30, 40]); }
    else if (e.t === 'morph') { ring(x, y, 2, B.u * 1.4, 0.3, MG, 3); A.star(2); }
    else if (e.t === 'gift') { giftT = T; A.star(e.k === 'j' ? 1 : 0); H.toast(e.k === 'j' ? 'Matière exotique : elle copie l\'astre qu\'elle touche' : 'Belle chaîne ! Comète explosive offerte'); }
    else if (e.t === 'pierce') {
      // saut : l'espace se contracte (implosion), bang, puis le nouveau secteur se déploie — voir draw() et bang()
      texA = texB; texB = makeTex(e.depth); warp = 1; shake = 6; callout = null;
      warpMsg = ['SECTEUR ' + (e.depth + 1), (G.mod.n || sectorName(e.depth)).toUpperCase() + ' · +' + fmt(e.pts), e.depth];
      A.chestRise(0.75); H.vib(20);
      H.track('depth', e.depth + 1, true);
    } else if (e.t === 'nova') {
      // Big Bang : ralenti, la lumière est aspirée, silence… puis l'explosion
      slow = 1.5; for (let k = 0; k < 3; k++) ring(x, y, W * (0.9 - k * 0.2), 4, 0.6, [[190, 110, 255], MG, [255, 255, 255]][k], 4);
      A.chestRise(0.6); if (!sv.cx.bigbang) { sv.cx.bigbang = 1; save(); G.bonus += 40; }
      const pts = e.pts; setTimeout(() => { if (!isOpen) return;
        shake = 30; flash = 1; flashC = [255, 255, 255]; hitstop = 0.16; slow = 0;
        for (let k = 0; k < 5; k++) ring(x, y, 6, W * (0.4 + k * 0.3), 0.6 + k * 0.16, [CY, MG, AM, [255, 255, 255], [190, 110, 255]][k], 11 - k * 2);
        burst(x, y, 110, [255, 240, 220], B.u * 22, 1.3, 4); say('BIG BANG', '+' + fmt(pts), [255, 255, 255]);
        A.win(); A.rumble(); H.vib([40, 30, 40, 30, 80]); }, 650);
      H.track('nova', 1);
    } else if (e.t === 'pulse') { ring(x, y, e.r * B.u, e.r * B.u * 2.7, 0.45, [170, 212, 255], 4); A.ping(); }
    else if (e.t === 'swallow') { burst(x, y, 6, [190, 110, 255], B.u * 3, 0.4, 2); ring(sx(e.hx), sy(e.hy), B.u * 2.6, B.u * 0.6, 0.4, [190, 110, 255], 3); A.gulp(); }
    else if (e.t === 'rare') { // variante rare ou galaxie : grande révélation avec la probabilité
      const r = rarOf(e.tier, e.v, e.p), key = e.tier + ':' + e.v, isNew = !sv.cx[key]; if (isNew) { sv.cx[key] = 1; save(); G.bonus += 15 + r * 15; }
      reveal = { tier: e.tier, v: e.v, r, p: e.p, isNew, l: 0, d: 2.2 + r * 0.45 }; slow = reveal.d * 0.85; callout = null;
      A.rare(r); H.vib(r >= 3 ? [30, 40, 30, 40, 30, 40, 90] : [20, 40, 40]); flash = 0.3 + r * 0.1; flashC = RCOL[r];
    }
    else if (e.t === 'secret') { const S = SECRETS[e.id]; if (!sv.cx[e.id]) { sv.cx[e.id] = 1; save(); G.bonus += 40; } say(S[0].toUpperCase(), 'DÉCOUVERTE SECRÈTE', AM); ring(x, y, 6, W * 0.6, 0.8, AM, 6); A.win();
    } else if (e.t === 'over') endRun();
  }
  G.ev.length = 0;
}

/* ============================== fond et astres (pré-rendus) ============================== */
function makeTex(depth, th = theme(), w = Math.max(64, Math.round(W / 2)), h = Math.max(64, Math.round(Hh / 2))) {
  const c = document.createElement('canvas'), x = c.getContext('2d'); c.width = w; c.height = h;
  const hue = th.h[depth % th.h.length], s0 = depth * 31.7;
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `hsl(${hue} ${th.s}% 7%)`); g.addColorStop(1, `hsl(${hue + 40} ${th.s}% 3%)`); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { // nuages de nébuleuse
    const px = rnd(s0 + i) * w, py = rnd(s0 + i * 2.7) * h, r = (0.25 + rnd(s0 + i * 4.1) * 0.4) * w;
    const n = x.createRadialGradient(px, py, 0, px, py, r); n.addColorStop(0, `hsla(${hue + (i % 3 - 1) * th.sp},90%,55%,${th.a})`); n.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = n; x.fillRect(px - r, py - r, r * 2, r * 2);
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
// Reteinte d'un calque (variantes rares) : on change la couleur, on garde les ombres et la découpe
function tint(c, col) {
  if (!c) return c; const w = c.width / DPR, h = c.height / DPR, [k, x] = mk(w, h);
  x.drawImage(c, 0, 0, w, h); x.globalCompositeOperation = 'color'; x.fillStyle = rgba(col, 1); x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(c, 0, 0, w, h); return k;
}
// Disque d'accrétion (trou noir, quasar) : anneau brûlant strié
function accretion(r, inner, hot) {
  const s = r * 1.3, [d, dx] = mk(s * 2, s * 2), g = dx.createRadialGradient(s, s, r * inner, s, s, r); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, hot ? 'rgba(255,240,170,1)' : 'rgba(255,214,120,1)'); g.addColorStop(0.55, hot ? 'rgba(255,150,60,.95)' : 'rgba(255,79,216,.9)'); g.addColorStop(1, hot ? 'rgba(255,60,40,.1)' : 'rgba(90,40,200,.1)');
  dx.fillStyle = g; dx.beginPath(); dx.arc(s, s, r, 0, TAU); dx.fill(); dx.lineCap = 'round';
  for (let i = 0; i < 34; i++) { const a = rnd(i * 3.7) * TAU, rad = r * (inner + 0.06 + rnd(i * 5.3) * (0.92 - inner)); dx.strokeStyle = i % 3 ? `rgba(255,255,255,${0.2 + rnd(i) * 0.45})` : `rgba(60,10,90,${0.3 + rnd(i) * 0.3})`; dx.lineWidth = r * (0.012 + rnd(i * 2) * 0.03); dx.beginPath(); dx.arc(s, s, rad, a, a + 0.4 + rnd(i * 8) * 1.3); dx.stroke(); }
  return d;
}
// Galaxies : plus la rareté monte, plus il y a de bras, d'étoiles, de couches et de lumière
const GAL = [
  { n: 'Galaxie spirale', arms: 2, a: [150, 190, 255], b: [255, 255, 255], dots: 240 },
  { n: 'Galaxie barrée dorée', arms: 2, bar: 1, a: [255, 196, 100], b: [255, 246, 220], dots: 320 },
  { n: 'Galaxie d\'émeraude', arms: 3, a: [60, 240, 160], b: [225, 255, 240], dots: 400 },
  { n: 'Galaxie annulaire', arms: 4, ring: 1, a: [255, 90, 200], b: [255, 225, 245], dots: 480 },
  { n: 'Galaxie prismatique', arms: 5, rainbow: 1, a: [255, 255, 255], b: [255, 255, 255], dots: 600, two: 1 },
  { n: 'Galaxie critique', arms: 6, rainbow: 1, ring: 1, a: [255, 240, 200], b: [255, 255, 255], dots: 760, two: 1 },
];
const hueC = (h) => { const f = (n) => { const k = (n + h / 60) % 6; return 255 * (1 - 0.75 * Math.max(0, Math.min(k, 4 - k, 1))); }; return [f(5), f(3), f(1)]; };
function galaxy(r, v) {
  const P = GAL[v], s = r * 1.3, layer = (seed, twist, scale) => {
    const [c, x] = mk(s * 2, s * 2); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < P.dots; i++) {
      const t = rnd(seed + i * 1.3) ** 0.8, arm = i % P.arms, a = (arm / P.arms) * TAU + t * twist + (rnd(seed + i * 7.7) - 0.5) * 0.5 * (1 - t * 0.5), rad = r * scale * (0.1 + t * 0.88);
      const col = P.rainbow ? hueC((arm / P.arms) * 360 + t * 90) : [0, 1, 2].map((k) => P.b[k] + (P.a[k] - P.b[k]) * t);
      soft(x, s + Math.cos(a) * rad, s + Math.sin(a) * rad * 0.94, r * (0.035 + rnd(seed + i * 3.1) * 0.07) * (i % 17 ? 1 : 2.4), col, 0.2 + rnd(seed + i) * 0.5);
    }
    if (P.ring) { x.strokeStyle = rgba(P.a, 0.55); x.lineWidth = r * 0.05; x.beginPath(); x.arc(s, s, r * scale * 0.93, 0, TAU); x.stroke(); }
    return c;
  };
  const [o, ox] = mk(s * 2, s * 2); soft(ox, s, s, r * 0.5, P.b, 1); soft(ox, s, s, r * 0.24, [255, 255, 255], 1);
  if (P.bar) { ox.save(); ox.translate(s, s); ox.rotate(0.5); ox.scale(1, 0.24); soft(ox, 0, 0, r * 0.62, P.b, 0.95); ox.restore(); }
  return { back: halo(r, P.rainbow ? [255, 255, 255] : P.a, 0.35 + v * 0.09), spinB: -0.1 - v * 0.03, pulse: 0.03 + v * 0.012, disc: layer(v * 9 + 1, 4.6, 1), spinD: 0.22 + v * 0.05, disc2: P.two ? layer(v * 9 + 5, -3.4, 0.7) : null, over: o };
}
const KIND = ['dust', 'orb', 'rock', 'moon', 'planet', 'gas', 'dwarf', 'sun', 'giant', 'neutron', 'hole', 'quasar', 'galaxy'];
// Variantes rares (une seule par rang, la galaxie a les siennes) : [nom, teinte]
const VAR = { 3: ['Lune de glace', [130, 220, 255]], 4: ['Monde de lave', [255, 84, 36]], 5: ['Géante de saphir', [64, 120, 255]], 7: ['Étoile bleue', [100, 170, 255]], 10: ['Trou blanc', [190, 255, 255]], 11: ['Blazar', [110, 255, 190]] };
const nameOf = (tier, v) => (tier === F.MAX_TIER ? GAL[v | 0].n : v ? VAR[tier][0] : BODIES[tier][0]);
const RCOL = [[160, 185, 225], [77, 243, 255], [255, 79, 216], [255, 194, 71], [255, 120, 90], [255, 255, 255]];
const rarOf = (tier, v, p) => (tier === F.MAX_TIER ? v : p > 0.03 ? 2 : p > 0.02 ? 3 : 4); // niveau de mise en scène 0..5

function build(tier, r, v) {
  const kind = KIND[tier], s = r * 1.3;
  if (kind === 'galaxy') return galaxy(r, v);
  let A;
  if (kind === 'dust') { // poussière d'étoile : un éclat qui scintille
    const [c, x] = mk(s * 2, s * 2); soft(x, s, s, r * 1.25, [255, 236, 190], 0.9); soft(x, s, s, r * 0.55, [255, 255, 255], 1);
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = Math.max(1, r * 0.12); x.lineCap = 'round'; x.beginPath(); x.moveTo(s - r, s); x.lineTo(s + r, s); x.moveTo(s, s - r); x.lineTo(s, s + r); x.stroke();
    return { spr: c, spin: 1.1 };
  }
  if (kind === 'orb') { // orbe : une bille de verre
    const [c, x] = mk(s * 2, s * 2), g = x.createRadialGradient(s - r * 0.3, s - r * 0.35, r * 0.05, s, s, r); g.addColorStop(0, '#f4ffff'); g.addColorStop(0.45, '#4df3ff'); g.addColorStop(1, '#14589c');
    x.fillStyle = g; x.beginPath(); x.arc(s, s, r, 0, TAU); x.fill(); soft(x, s, s + r * 0.55, r * 0.6, [190, 255, 255], 0.5); blob(x, s - r * 0.36, s - r * 0.5, r * 0.3, r * 0.14, -0.6, 'rgba(255,255,255,.8)');
    x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 1.2; x.beginPath(); x.arc(s, s, r - 0.6, 0, TAU); x.stroke(); return { spr: c, spin: 0 };
  }
  if (kind === 'rock') { // astéroïde : remplit tout son cercle de collision (bosses légères seulement), sinon on voit des vides entre les astres
    const [c, x] = mk(s * 2, s * 2), g = x.createLinearGradient(s - r, s - r, s + r, s + r); g.addColorStop(0, '#e2cfb4'); g.addColorStop(1, '#4a3d34'); x.fillStyle = g;
    x.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr = r * (0.94 + rnd(i * 2.7) * 0.06); x.lineTo(s + Math.cos(a) * rr, s + Math.sin(a) * rr); } x.closePath(); x.fill();
    for (let i = 0; i < 5; i++) blob(x, s + (rnd(i * 3) - 0.5) * r * 1.1, s + (rnd(i * 5) - 0.5) * r * 1.1, r * 0.17, r * 0.14, i, 'rgba(40,30,25,.42)');
    blob(x, s - r * 0.35, s - r * 0.45, r * 0.3, r * 0.14, -0.6, 'rgba(255,255,255,.22)');
    return { spr: c, spin: 0.35 };
  }
  if (kind === 'moon') { const [o] = light(r, r); A = { R: r, sp: 0.16, over: o, strip: strip(r, '#aab2c4', 16, 3, (x, px, py, i) => { const cr = r * (0.09 + rnd(i * 7) * 0.17); blob(x, px, py, cr, cr, 0, 'rgba(66,72,92,.5)'); blob(x, px - cr * 0.2, py - cr * 0.2, cr * 0.7, cr * 0.7, 0, 'rgba(120,128,148,.5)'); }) }; }
  else if (kind === 'planet') { // continents lents, nuages plus rapides
    const [o] = light(r, r, null, 'rgba(150,225,255,.75)');
    A = { R: r, sp: 0.2, sp2: 0.38, over: o, back: halo(r, [90, 170, 255], 0.3),
      strip: strip(r, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e9f6ff'); g.addColorStop(0.14, '#2f86ff'); g.addColorStop(0.86, '#1d5fe0'); g.addColorStop(1, '#e9f6ff'); x.fillStyle = g; x.fillRect(0, 0, w, h); }, 15, 11, (x, px, py, i) => { py = r * 0.3 + (py / (r * 2)) * r * 1.4; blob(x, px, py, r * (0.2 + rnd(i) * 0.3), r * (0.13 + rnd(i * 9) * 0.17), rnd(i * 6) * 3, i % 4 ? '#3fcf7c' : '#d9c47a'); }),
      strip2: strip(r, null, 12, 23, (x, px, py, i) => blob(x, px, py, r * (0.3 + rnd(i * 2) * 0.35), r * 0.07, 0.15, 'rgba(255,255,255,.6)')) };
  } else if (kind === 'gas') { // bandes, tempêtes, anneau fixe (décoratif : il dépasse du cercle de collision)
    const ring = (x, a0, a1) => { for (const [k, al, lw] of [[1.24, 0.85, 0.06], [1.12, 0.45, 0.035]]) { x.strokeStyle = `rgba(255,232,190,${al})`; x.lineWidth = r * lw; x.beginPath(); x.ellipse(s, s, r * k, r * k * 0.22, -0.35, a0, a1); x.stroke(); } };
    const [b, bx] = mk(s * 2, s * 2); ring(bx, Math.PI, TAU); const [o, ox] = light(r, r); ring(ox, 0, Math.PI);
    A = { R: r, sp: 0.5, over: o, back: b, still: true, strip: strip(r, (x, w, h) => { for (let i = 0; i < 9; i++) { x.fillStyle = ['#f6d9a8', '#d98a48', '#f0c088', '#b9642e', '#f8e4c0', '#cf7d3e', '#eec489', '#a9562a', '#e9b877'][i]; x.fillRect(0, (i / 9) * h, w, h / 9 + 1); } }, 22, 31, (x, px, py, i) => { py = (Math.floor((py / (r * 2)) * 9) + 0.5) * r * 2 / 9; blob(x, px, py, r * (0.2 + rnd(i * 3) * 0.3), r * 0.045, 0, i % 2 ? 'rgba(255,246,220,.5)' : 'rgba(110,46,18,.4)'); if (i === 0) blob(x, px, r * 1.25, r * 0.22, r * 0.12, 0, '#c8442c'); }) };
  } else if (kind === 'dwarf' || kind === 'sun' || kind === 'giant') { // étoiles : deux couches de plasma qui se croisent, halo qui respire
    const P = { dwarf: ['#ff8a34', [255, 224, 150], [150, 30, 10], [150, 30, 10], [255, 140, 60], 0], sun: ['#ffcf40', [255, 255, 225], [255, 120, 20], [230, 110, 10], [255, 220, 90], 16], giant: ['#ee3d2c', [255, 180, 120], [80, 0, 12], [90, 0, 14], [255, 70, 60], 0] }[kind];
    const [o] = light(r, r, v ? [20, 60, 200] : P[3]);
    A = { R: r, sp: 0.22, sp2: -0.3, add: true, over: o, back: halo(r, P[4], 0.7, P[5]), spinB: P[5] ? 0.12 : 0, pulse: 0.045, strip: starStrip(r, P[0], P[1], P[2], tier * 7), strip2: starStrip(r, null, P[1], [255, 255, 255], tier * 13) };
  } else if (kind === 'neutron') { // jets qui balayent, surface très rapide
    const [j, jx] = mk(s * 2, s * 2), g = jx.createLinearGradient(0, s, s * 2, s); g.addColorStop(0, 'rgba(160,210,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(160,210,255,0)');
    jx.fillStyle = g; jx.beginPath(); jx.moveTo(0, s - r * 0.02); jx.lineTo(s, s - r * 0.16); jx.lineTo(s * 2, s - r * 0.02); jx.lineTo(s * 2, s + r * 0.02); jx.lineTo(s, s + r * 0.16); jx.lineTo(0, s + r * 0.02); jx.fill();
    const [o] = light(r, r, [40, 80, 220]);
    A = { R: r, sp: 1.6, sp2: -1.1, add: true, over: o, back: halo(r, [150, 200, 255], 0.85), pulse: 0.07, disc: j, spinD: 2.4, strip: starStrip(r, '#a9d0ff', [255, 255, 255], [60, 100, 255], 71), strip2: starStrip(r, null, [255, 255, 255], [140, 180, 255], 83) };
  } else if (kind === 'hole') { // le disque tourne autour d'un horizon immobile ; variante rare : trou blanc, cœur de lumière
    const [o, ox] = mk(s * 2, s * 2); ox.fillStyle = v ? '#fff' : '#000'; ox.beginPath(); ox.arc(s, s, r * 0.6, 0, TAU); ox.fill(); if (v) soft(ox, s, s, r * 0.9, [255, 255, 255], 0.9);
    ox.strokeStyle = 'rgba(255,255,255,.95)'; ox.lineWidth = Math.max(1.5, r * 0.03); ox.beginPath(); ox.arc(s, s, r * 0.61, 0, TAU); ox.stroke();
    ox.strokeStyle = 'rgba(255,210,140,.9)'; ox.lineWidth = r * 0.06; ox.beginPath(); ox.ellipse(s, s, r * 1.14, r * 0.16, -0.3, 0, Math.PI); ox.stroke();
    A = { over: o, back: halo(r, [170, 90, 255], 0.8), pulse: 0.06, disc: accretion(r, 0.55), spinD: 0.9 };
  } else { // quasar : un trou noir si vorace que son disque éblouit et crache deux jets
    const [b, bx] = mk(s * 2, s * 2), g = bx.createLinearGradient(s, 0, s, s * 2); g.addColorStop(0, 'rgba(255,230,170,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,230,170,0)');
    soft(bx, s, s, s, [255, 200, 110], 0.55); bx.fillStyle = g; bx.beginPath(); bx.moveTo(s - r * 0.02, 0); bx.lineTo(s - r * 0.2, s); bx.lineTo(s - r * 0.02, s * 2); bx.lineTo(s + r * 0.02, s * 2); bx.lineTo(s + r * 0.2, s); bx.lineTo(s + r * 0.02, 0); bx.fill();
    const [o, ox] = mk(s * 2, s * 2); soft(ox, s, s, r * 0.62, [255, 255, 255], 1); ox.fillStyle = '#000'; ox.beginPath(); ox.arc(s, s, r * 0.3, 0, TAU); ox.fill(); ox.strokeStyle = '#fff'; ox.lineWidth = Math.max(1.5, r * 0.03); ox.stroke();
    A = { over: o, back: b, still: true, spinB: 0.25, disc: accretion(r, 0.3, true), spinD: 1.7 };
  }
  if (v && VAR[tier]) for (const k of ['strip', 'strip2', 'back', 'disc']) A[k] = tint(A[k], VAR[tier][1]);
  return A;
}
function sprite(tier, v) {
  const key = B.u.toFixed(2) + ':' + DPR;
  if (key !== spriteKey) { sprites.clear(); spriteKey = key; }
  let s = sprites.get(tier * 8 + v);
  if (!s) { const r = F.TIERS[tier].r * B.u; s = build(tier, r, v); s.h = r * 1.3; sprites.set(tier * 8 + v, s); }
  return s;
}
// Performance : les calques d'un astre animé (halo, surface découpée, lumière) sont assemblés UNE fois par rang toutes les 2 images
// dans s.comp ; chaque astre de ce rang n'est plus qu'une copie d'image. Avant : découpe + 3 à 5 dessins par astre et par image.
function compose(s, tier) {
  const h = s.h, x = s.cx, img = (c) => x.drawImage(c, -h, -h, h * 2, h * 2);
  x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, h * 2, h * 2); x.translate(h, h);
  if (s.back) { const p = 1 + (s.pulse || 0) * Math.sin(T * 2.3 + tier); x.save(); if (s.spinB) x.rotate(T * s.spinB); if (!s.still) x.scale(p, p); img(s.back); x.restore(); }
  if (s.disc) { x.save(); x.rotate(T * s.spinD); img(s.disc); x.restore(); }
  if (s.disc2) { x.save(); x.rotate(-T * s.spinD * 0.7); img(s.disc2); x.restore(); }
  if (s.strip) {
    const R = s.R, w = (h / 1.3) * 4, lay = (c, sp) => { const o = ((T * sp * R) % w + w) % w; x.drawImage(c, -R - o, -w / 4, w, w / 2); x.drawImage(c, -R - o + w, -w / 4, w, w / 2); };
    x.save(); x.beginPath(); x.arc(0, 0, R, 0, TAU); x.clip(); lay(s.strip, s.sp);
    if (s.strip2) { if (s.add) x.globalCompositeOperation = 'lighter'; lay(s.strip2, s.sp2); }
    x.restore();
  }
  if (s.over) img(s.over);
}
function drawItem(it, x, y, sc = 1, ang = 0, u = B.u) {
  if (it.k === 'c') {
    const v = it.v | 0, s = sprite(it.tier, v), k = sc * (u / B.u) * (it.r ? it.r / F.TIERS[it.tier].r : 1), h = s.h * k; // it.r : la géante rouge enfle
    if (s.spr) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang + T * s.spin); ctx.drawImage(s.spr, -h, -h, h * 2, h * 2); ctx.restore(); }
    else {
      if (!s.comp) { s.comp = document.createElement('canvas'); s.comp.width = s.comp.height = Math.ceil(s.h * 2 * DPR); s.cx = s.comp.getContext('2d'); s.stamp = -1; }
      if (s.stamp !== FN >> 1) { s.stamp = FN >> 1; compose(s, it.tier); }
      ctx.drawImage(s.comp, x - h, y - h, h * 2, h * 2);
    }
    if (v) { ctx.fillStyle = '#fff'; const R = (h / 1.3) * 1.1; for (let i = 0; i < 4; i++) { const a = T * 1.5 + i * 1.57, tw = 2 + 1.5 * Math.sin(T * 6 + i), px = x + Math.cos(a) * R, py = y + Math.sin(a) * R * 0.85; ctx.fillRect(px - tw, py - 0.6, tw * 2, 1.2); ctx.fillRect(px - 0.6, py - tw, 1.2, tw * 2); } } // les astres rares scintillent
  } else { // comète (explose) / matière exotique (copie)
    const r = F.R_SPECIAL * u * sc, bomb = it.k === 'b', p = 0.5 + 0.5 * Math.sin(T * (bomb ? 9 : 4)), col = bomb ? [140 + p * 115, 245, 255] : [255, 79 + p * 120, 216];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5); g.addColorStop(0, '#fff'); g.addColorStop(0.45, rgba(col, 0.95)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - r * 1.5, y - r * 1.5, r * 3, r * 3);
    ctx.fillStyle = '#0a0c1e'; ctx.font = `900 ${r * 1.05}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(bomb ? '!' : '?', x, y + r * 0.06);
  }
}

/* ============================== rendu ============================== */
const RNAME = ['COMMUNE', 'PEU COMMUNE', 'RARE', 'ÉPIQUE', 'LÉGENDAIRE', 'CRITIQUE'];
const odds = (p) => (p >= 0.01 ? `${(p * 100).toLocaleString('fr-FR')} % de chances` : `1 chance sur ${Math.round(1 / p).toLocaleString('fr-FR')}`);
function drawReveal() { // l'écran s'assombrit, des rayons tournent, l'astre grossit au centre, puis son nom, sa rareté et sa probabilité
  const R = reveal, q = R.l / R.d, env = Math.min(1, q * 6, (1 - q) * 5), cx = W / 2, cy = Hh * 0.4, col = R.r === 5 ? hueC(T * 160) : RCOL[R.r];
  ctx.fillStyle = `rgba(2,3,14,${0.78 * env})`; ctx.fillRect(0, 0, W, Hh);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(T * (0.25 + R.r * 0.08)); ctx.globalCompositeOperation = 'lighter';
  const n = 8 + R.r * 5, L = Math.hypot(W, Hh) * (0.35 + 0.12 * R.r) * Math.min(1, q * 3);
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU, w = 0.05 + 0.03 * Math.sin(T * 3 + i), c = R.r >= 4 ? hueC(i * 360 / n + T * 90) : col, g = ctx.createRadialGradient(0, 0, 0, 0, 0, L); g.addColorStop(0, rgba(c, 0.5 * env)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, L, a - w, a + w); ctx.fill(); }
  ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  const z = q < 0.18 ? 0.3 + 0.9 * (q / 0.18) : 1.2 - 0.2 * Math.min(1, (q - 0.18) * 8); ctx.globalAlpha = env;
  drawItem({ k: 'c', tier: R.tier, v: R.v }, cx, cy, z, T * 0.3, Math.min(W * 0.2, 86) / F.TIERS[R.tier].r / 1.3);
  if (R.r >= 3 && Math.random() < 0.35) burst(cx + (Math.random() - 0.5) * W * 0.8, cy + (Math.random() - 0.5) * Hh * 0.4, 6, col, B.u * 6, 0.7, 2.4);
  const ty = cy + Math.min(W * 0.2, 86) + 46, a2 = clamp((q - 0.16) * 6, 0, 1) * env; ctx.globalAlpha = a2; ctx.textAlign = 'center';
  ctx.font = '700 12px Orbitron,sans-serif'; ctx.fillStyle = rgba(col, 1); ctx.fillText((R.tier === F.MAX_TIER ? 'GALAXIE ' : 'VARIANTE ') + RNAME[R.r], cx, ty - 28);
  ctx.font = `900 ${Math.min(30, W * 0.07)}px Orbitron,sans-serif`; ctx.shadowColor = rgba(col, 0.9); ctx.shadowBlur = lowFx ? 0 : 24; ctx.fillStyle = '#fff'; ctx.fillText(nameOf(R.tier, R.v).toUpperCase(), cx, ty); ctx.shadowBlur = 0;
  ctx.font = '700 13px Orbitron,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(odds(R.p).toUpperCase(), cx, ty + 26);
  if (R.isNew) { ctx.font = '700 11px Orbitron,sans-serif'; ctx.fillStyle = '#5dffc0'; ctx.fillText('DÉBLOQUÉE · AJOUTÉE AU CODEX', cx, ty + 46); }
  ctx.globalAlpha = 1;
}
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, lowFx ? 1.5 : 2); W = window.innerWidth; Hh = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR);
  SAT = $('#probe-t') ? $('#probe-t').offsetHeight : 0; SAB = $('#probe-b') ? $('#probe-b').offsetHeight : 0;
  const top = SAT + 104, bar = 86, availH = Hh - top - bar - SAB - 30;
  const u = Math.min((W - 28) / F.W, availH / F.HT, 60);
  B = { u, w: u * F.W, h: u * F.HT, x: (W - u * F.W) / 2, y: top + (availH - u * F.HT) / 2 };
  holdR = { x: B.x, y: B.y + B.h + 36, w: 78, h: 60 };
  texB = makeTex(G ? G.depth : 0); texA = null; hud = null;
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
    { // trajectoire prévue (visible aussi pendant qu'un astre tombe) : droite, ou penchée par le vent du secteur
      const tr = F.trace(G, aimX), n = tr.length; ctx.fillStyle = '#fff';
      for (let i = 2; i < n; i += 2) { ctx.globalAlpha = 0.5 * (1 - i / n) + 0.12; ctx.beginPath(); ctx.arc(sx(tr[i]), sy(tr[i + 1]), 1.8, 0, TAU); ctx.fill(); }
      if (n > 3) { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(sx(tr[n - 2]), sy(tr[n - 1]), (it.k === 'c' ? F.TIERS[it.tier].r : F.R_SPECIAL) * B.u, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = ready ? 1 : 0.6; drawItem(it, ax, ay + (ready ? Math.sin(T * 2.6) * 2 : 0), ready ? 1 : 0.9); ctx.globalAlpha = 1;
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
  if (dp > 0.01) { const hot = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); hot.addColorStop(0, '#4df3ff'); hot.addColorStop(0.6, '#ff4fd8'); hot.addColorStop(1, '#ffc247'); const gl = Math.max(8, gw * dp); if (!lowFx) { ctx.fillStyle = `rgba(255,79,216,${0.1 + 0.08 * dp})`; rr(B.x - 2, fy - 6, gl + 12, 20, 10); ctx.fill(); rr(B.x + 1, fy - 3, gl + 6, 14, 7); ctx.fill(); } rr(B.x + 4, fy, gl, 8, 4); ctx.fillStyle = hot; ctx.fill(); } // halo en deux voiles, sans shadowBlur (très coûteux sur mobile)
  // effets
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) { const q = r.l / r.m, k = 1 - (1 - q) ** 3; ctx.strokeStyle = rgba(r.col, (1 - q) * 0.9); ctx.lineWidth = r.w * (1 - q) + 0.5; ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, TAU); ctx.stroke(); }
  for (const q of parts) { const a = 1 - q.l / q.m; ctx.globalAlpha = a; ctx.fillStyle = q.cs; ctx.beginPath(); ctx.arc(q.x, q.y, q.sz * (0.4 + a * 0.6), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const l of labels) { const a = clamp(1.6 - l.l * 1.9, 0, 1), s = l.l < 0.12 ? 0.6 + l.l / 0.12 * 0.4 : 1; ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,20,.55)'; ctx.font = `900 ${l.sz * s}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.strokeText(l.txt, l.x, l.y - l.l * 46); ctx.fillStyle = rgba(l.col, 1); ctx.fillText(l.txt, l.x, l.y - l.l * 46); }
  ctx.globalAlpha = 1;
  ctx.restore();

  // HUD : score, secteur, record
  const cx = W / 2, ty = SAT + 44;
  const sc = fmt(shown); // le score lumineux est dessiné dans une image, refaite seulement quand le nombre change
  if (sc !== hudKey || !hud) { hudKey = sc; if (!hud) hud = document.createElement('canvas'); hud.width = Math.ceil(W * DPR); hud.height = Math.ceil(64 * DPR); const hx = hud.getContext('2d'); hx.scale(DPR, DPR); hx.font = '900 32px Orbitron,system-ui,sans-serif'; hx.textAlign = 'center'; hx.shadowColor = 'rgba(77,243,255,.7)'; hx.shadowBlur = lowFx ? 0 : 16; hx.fillStyle = '#fff'; hx.fillText(sc, W / 2, 44); }
  ctx.drawImage(hud, 0, ty - 44, W, 64);
  txt(`SECTEUR ${G.depth + 1} · ${sectorName(G.depth).toUpperCase()}`, cx, ty + 20, 10.5, rgba(CY, 0.95), 'center', 'Orbitron', 700);
  if (G.chal) { const left = Math.max(0, G.chal[2] - G.t), m = Math.floor(left / 60); txt(`DÉFI · ${m}:${String(Math.floor(left % 60)).padStart(2, '0')}`, cx, ty + 37, 13, left < 15 ? '#ff6a8a' : '#ffc247', 'center', 'Orbitron', 900); }
  else if (G.mod.n) txt(G.mod.n.toUpperCase(), cx, ty + 35, 9.5, rgba(MG, 1), 'center', 'Orbitron', 700);
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
  // annonce (chaîne, saut, nouvel astre)
  if (reveal) drawReveal();
  else if (callout) { const c = callout, q = c.l / 1.2, s = q < 0.14 ? 1.5 - (q / 0.14) * 0.5 : 1, a = q > 0.7 ? 1 - (q - 0.7) / 0.3 : 1; ctx.globalAlpha = clamp(a, 0, 1); const y = B.y + B.h * 0.3; ctx.font = `900 ${Math.min(42, W * 0.094) * s}px Orbitron,sans-serif`; ctx.textAlign = 'center'; ctx.shadowColor = rgba(c.col, 0.9); ctx.shadowBlur = lowFx ? 0 : 22; ctx.fillStyle = '#fff'; ctx.fillText(c.txt, cx, y); ctx.shadowBlur = 0; if (c.sub) { ctx.font = '700 12px Orbitron,sans-serif'; ctx.fillStyle = rgba(c.col, 1); ctx.fillText(c.sub, cx, y + 24); } ctx.globalAlpha = 1; }
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
  if (reveal && (reveal.l += dt) > reveal.d) reveal = null;
  if (tut >= 0) tutorial();
  if (G.chal && !ended) { // défi du jour : objectif atteint avant la fin du chrono ?
    const c = G.chal, val = c[0] === 'tier' ? G.maxTier : c[0] === 'chain' ? G.maxChain : c[0] === 'depth' ? G.depth : G.score;
    if (val >= c[1]) { G.won = true; endRun(); } else if (G.t >= c[2]) endRun();
  }
  aimX += (aimT - aimX) * Math.min(1, dt * 26); // l'astre suit le doigt en douceur
  if (want && G.cool <= 0 && !ended && !paused) { want = false; if (F.drop(G, aimT)) { aimX = aimT; A.release(); H.vib(6); saveRun(); } } // un relâché pendant le temps de recharge est mémorisé
}
function bang() { // milieu du saut : le nouveau secteur naît
  const m = warpMsg || ['', '', 0], cx = W / 2, cy = B.y + B.h * 0.5;
  flash = 0.95; flashC = [255, 255, 255]; shake = 24; hitstop = 0.08;
  [CY, MG, AM].forEach((c, k) => ring(cx, cy, 8, Math.max(W, Hh) * (0.55 + k * 0.25), 0.8 + k * 0.2, c, 10 - k * 3));
  burst(cx, cy, 70, [220, 240, 255], B.u * 18, 1.1, 3.5); say(m[0], m[1], CY);
  A.rumble(); A.mult(Math.min(8, m[2])); H.vib([30, 40, 70]);
}
function frame(now) {
  raf = 0; if (!isOpen) return; FN++;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
  raf = requestAnimationFrame(frame);
}

/* ============================== entrées ============================== */
const pt = (e) => ({ x: e.clientX, y: e.clientY }); // le canvas couvre tout l'écran
const inZone = (p) => p.x > B.x - 18 && p.x < B.x + B.w + 18 && p.y > B.y - 60 && p.y < B.y + B.h + 20; // la cuve, avec une petite marge
function onDown(e) { // appuie dans la cuve (même pendant qu'un astre tombe), glisse, relâche ; sortir de la cuve annule
  if (!G || G.over) return; const p = pt(e);
  if (p.y > holdR.y - 14 && p.x < holdR.x + holdR.w + 14) { if (F.swapHold(G)) { A.select(); H.vib(8); } return; }
  if (!inZone(p)) return;
  aiming = true; aimT = (p.x - B.x) / B.u; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
}
function onMove(e) { if (!aiming) return; const p = pt(e); if (inZone(p)) aimT = (p.x - B.x) / B.u; else { aiming = false; H.vib(4); } }
function onUp() { if (!aiming) return; aiming = false; want = true; }

/* ============================== écrans ============================== */
const CSS = `
#mn{position:fixed;inset:0;z-index:9;background:#05060f;display:none}#mn.on{display:block;animation:fade .3s}
/* pendant une partie, l'accueil (flous, animations) et le canvas principal sont masqués et figés : ils coûtaient cher derrière l'écran de jeu */
.mn-open #s-title,.mn-open #cv{visibility:hidden}.mn-open #s-title,.mn-open #s-title *{animation-play-state:paused!important}
#mn-cv{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
#mn .icon{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px)}#mn-back{left:14px}#mn-help{right:14px}#mn.tut .icon{display:none}
#mn-tut{position:absolute;left:22px;right:22px;top:calc(env(safe-area-inset-top,0px) + 150px);padding:14px 16px;border-radius:22px;text-align:center;font-size:15px;font-weight:600;line-height:1.4;pointer-events:none;display:none}#mn.tut #mn-tut{display:block;animation:fade .3s}
#mn-th{width:100%;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;max-height:52vh;overflow-y:auto;touch-action:pan-y}
.th{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#fff;font-size:12px}.th canvas{width:100%;height:84px;border-radius:12px;display:block}.th b{font:700 12px var(--disp)}.th.on{border-color:#5dffc0}.th.lock canvas{opacity:.55}.th small{color:rgba(255,255,255,.7)}
#mn-cx{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:46vh;overflow-y:auto;touch-action:pan-y}
.cx{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);text-align:center;opacity:.55}.cx.ok{opacity:1;border-color:rgba(255,255,255,.28)}
.cx canvas{width:64px;height:64px}.cx i{width:64px;height:64px;display:grid;place-items:center;font:900 26px var(--disp);font-style:normal;color:rgba(255,255,255,.4)}.cx.ok i{color:#ffc247}.cx b{font-size:11px}.cx small{font-size:9.5px;line-height:1.25;color:rgba(255,255,255,.55)}
#mn-m-over .card{max-height:calc(100vh - 40px);overflow-y:auto;touch-action:pan-y;scrollbar-width:none}#mn-m-over .stats{flex-wrap:wrap}#mn-m-over .stats div{min-width:40%}#mn-m-over .stats .rec b{color:#5dffc0}
.fg-q{width:100%;font-size:13px;color:rgba(255,255,255,.85)}
.fg-q .q{display:flex;gap:10px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}.fg-q .q:last-child{border:0}
.fg-q .q i{flex:none;width:46px;height:5px;border-radius:3px;background:rgba(255,255,255,.14);position:relative;overflow:hidden}.fg-q .q i::after{content:"";position:absolute;inset:0;width:var(--p);border-radius:3px;background:linear-gradient(90deg,#4df3ff,#ff4fd8)}
.fg-q .q.ok{color:#5dffc0}.fg-q .q.ok i::after{background:#5dffc0}.fg-q .q span{flex:1}.fg-q .q em{font-style:normal;color:rgba(255,255,255,.55);font-size:12px;white-space:nowrap}
#mn-rk{font-size:13px;color:#5dffc0;min-height:0}#mn-rk:empty{display:none}
#mn-lad{font-size:11.5px;line-height:1.6;color:rgba(255,255,255,.6)}
`;
const HTML = `
<div id="mn"><canvas id="mn-cv"></canvas>
<button class="icon glass" id="mn-back" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<button class="icon glass" id="mn-help" aria-label="Règles"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg></button><div class="glass" id="mn-tut"></div></div>
<div class="modal" id="mn-m-over"><div class="card glass"><h2 id="mn-ot">Effondrement</h2><p id="mn-os"></p>
<div class="stats"><div id="mn-c1"><b id="mn-o1">0</b><span>points</span></div><div id="mn-c2"><b id="mn-o2">0</b><span>secteur</span></div><div id="mn-c3"><b id="mn-o3">0</b><span>chaîne max</span></div><div id="mn-c4"><b id="mn-o4" style="font-size:15px">–</b><span>plus gros astre</span></div></div>
<p id="mn-rk"></p><div class="fg-q" id="mn-q"></div>
<div class="btns"><button class="big primary" id="mn-again">Rejouer</button><button class="big glass" id="mn-rkb">Classement mondial</button><button class="big glass" id="mn-share" hidden>Partager mon score</button><button class="big glass" id="mn-menu">Menu</button></div></div></div>
<div class="modal" id="mn-m-help"><div class="card glass"><h2>Comment jouer</h2><p class="multi" id="mn-ht"></p><p id="mn-lad"></p><div class="btns"><button class="big glass" id="mn-cxb">Codex des astres</button><button class="big glass danger" id="mn-quit">Abandonner la partie</button><button class="big primary" id="mn-hok">C'est parti</button></div></div></div>`;
const HTML2 = `<div class="modal" id="mn-m-themes"><div class="card glass"><h2>Thèmes</h2><p id="mn-ths"></p><div id="mn-th"></div><div class="btns"><button class="big primary" id="mn-thok">Fermer</button></div></div></div><div class="modal" id="mn-m-codex"><div class="card glass"><h2>Codex</h2><p id="mn-cxs"></p><div id="mn-cx"></div><div class="btns"><button class="big primary" id="mn-cxok">Fermer</button></div></div></div>`;
const HELP = `Lâche les astres dans le puits. Deux identiques qui se touchent fusionnent en un astre plus gros.

Un seul lâcher qui déclenche plusieurs fusions, c'est une chaîne : chaque maillon multiplie les points. À ×5, tu gagnes une comète explosive.

Chaque fusion charge la jauge de saut. Pleine, tu passes au secteur suivant : l'onde vaporise les petits astres, et tu reçois de la matière exotique qui copie l'astre qu'elle touche.

La visée montre où tombera ton astre. L'étoile à neutrons repousse ses voisins par impulsions, la géante rouge enfle tant qu'on ne la fusionne pas, le trou noir avale les petits astres voisins.

Certains astres ont une variante rare, et chaque galaxie tire sa rareté : les probabilités sont dans le codex.

Chaque secteur change une règle (gravité, vent, parois). Si la pile dépasse la ligne trop longtemps, tout s'effondre.`;

function showCodex() {
  const g = $('#mn-cx'); g.innerHTML = ''; let n = 0;
  const cell = (name, tier, v, hint, ok) => {
    const d = document.createElement('div'); d.className = 'cx' + (ok ? ' ok' : ''); if (ok) n++; tot++;
    if (ok && tier >= 0) { const c = document.createElement('canvas'), keep = ctx; c.width = c.height = 64 * DPR; ctx = c.getContext('2d'); ctx.scale(DPR, DPR); drawItem({ k: 'c', tier, v }, 32, 32, 1, 0, 21 / F.TIERS[tier].r); ctx = keep; d.append(c); }
    else d.insertAdjacentHTML('beforeend', `<i>${ok ? '★' : '?'}</i>`);
    d.insertAdjacentHTML('beforeend', `<b>${ok ? name : '???'}</b>` + (hint ? `<small>${hint}</small>` : '')); g.append(d);
  };
  let tot = 0;
  for (let i = 0; i < F.MAX_TIER; i++) cell(BODIES[i][0], i, 0, '', !!sv.cx[i]);
  GAL.forEach((G2, v) => cell(G2.n, F.MAX_TIER, v, odds(F.GALAXY[v]), !!sv.cx[F.MAX_TIER + ':' + v]));
  for (const t in VAR) cell(VAR[t][0], +t, 1, odds(F.RARE[t]), !!sv.cx[t + ':1']);
  for (const id in SECRETS) cell(SECRETS[id][0], -1, 0, SECRETS[id][1], !!sv.cx[id]);
  $('#mn-cxs').textContent = `${n}/${tot} découvertes. Les variantes rares triplent les points et rapportent de l'énergie.`;
  $('#mn-m-codex').classList.add('on');
}
export function grant(n, label = '') { if (n > 0) { sv.dust += n; save(); H.toast(`+${fmt(n)} ✦ ${label}`.trim()); H.refresh(); } } // poussière d'étoile : la monnaie des thèmes
export const dust = () => sv.dust;
const todayChal = () => CHAL[hash('critical:defi:' + H.today()) % CHAL.length];
export const daily = () => ({ txt: todayChal()[3], done: sv.daily.day === H.today() && sv.daily.done });
export function openDaily() { // même tirage pour tout le monde ; on peut retenter, la récompense tombe une fois par jour
  open(true); const d = H.today(); newRun(hash('critical:defi:seed:' + d), true); G.chal = todayChal(); G.day = d; say('DÉFI DU JOUR', G.chal[3].toUpperCase(), AM);
}
function share() {
  const t = `Critical — défi du jour réussi avec ${sv.daily.best.toLocaleString('fr-FR')} s d'avance : « ${todayChal()[3]} ». À toi !`;
  if (navigator.share) navigator.share({ text: t }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => H.toast('Résultat copié'), () => {});
}
export function openThemes() {
  const g = $('#mn-th'); g.innerHTML = ''; $('#mn-ths').textContent = `Tu as ${fmt(sv.dust)} ✦. La poussière d'étoile se gagne en jouant, avec les missions et le défi du jour.`;
  for (const t of THEMES) {
    const own = !!sv.themes[t.id], b = document.createElement('button'); b.className = 'th' + (sv.theme === t.id ? ' on' : own ? '' : ' lock');
    b.append(makeTex(1, t, 160, 84)); b.insertAdjacentHTML('beforeend', `<b>${t.n}</b><small>${sv.theme === t.id ? 'Équipé' : own ? 'Équiper' : fmt(t.cost) + ' ✦'}</small>`);
    b.addEventListener('click', () => {
      if (!own) { if (sv.dust < t.cost) return H.toast(`Il te manque ${fmt(t.cost - sv.dust)} ✦`); sv.dust -= t.cost; sv.themes[t.id] = 1; A.rare(2); H.vib([20, 40, 40]); }
      sv.theme = t.id; save(); H.refresh(); if (G && W) texB = makeTex(G.depth); openThemes();
    });
    g.append(b);
  }
  $('#mn-m-themes').classList.add('on');
}
// Première partie guidée : chaque étape attend que le joueur fasse le geste demandé.
function tutorial() {
  const orb = () => ({ k: 'c', tier: 1 });
  if (tut <= 2) { G.cur = orb(); G.queue = [orb(), orb()]; } // tirage imposé : des orbes, pour que les fusions soient certaines
  const done = [G.drops >= 1, G.fusions >= 1, G.fusions >= 3, !!G.hold, !$('#rk-ask').classList.contains('on')][tut];
  if (done) { tut++; if (tut === 4) { if (H.online() && !H.named()) H.askName(); else tut = 5; } }
  if (tut >= 5) { tut = -1; sv.tut = 1; save(); $('#mn').classList.remove('tut'); H.toast('À toi de jouer !'); return; }
  const e = $('#mn-tut'); if (e.textContent !== TUT[tut]) e.textContent = TUT[tut];
}

function saveRun() { try { if (G && !ended && !G.over && G.drops > 0 && !G.chal && tut < 0) localStorage.setItem(RUN, JSON.stringify(G)); } catch (e) { /* stockage plein : tant pis */ } }
const dropRun = () => { try { localStorage.removeItem(RUN); } catch (e) { /* ignore */ } };
function rankLine(r) { const e = $('#mn-rk'); if (e) e.textContent = r ? `Classement mondial : n° ${fmt(r.rank)} sur ${fmt(r.total)}` : H.online() && !H.named() ? 'Choisis un pseudo pour entrer dans le classement mondial.' : ''; }
function endRun() {
  if (ended || !G) return; ended = true; const c = G.chal;
  if (!c) dropRun(); // un défi ne touche pas à la partie normale en attente
  if (c) return endChal(c);
  rankLine(null); H.submit({ score: G.score, sector: G.depth + 1, tier: G.maxTier, seed: G.seed, log: G.log, steps: G.n }).then(rankLine, () => {});
  const rec = { s: G.score > sv.best, d: G.depth + 1 > sv.depth, c: G.maxChain > sv.chain };
  sv.runs++; if (rec.s) sv.best = G.score; if (rec.d) sv.depth = G.depth + 1; if (rec.c) sv.chain = G.maxChain; sv.tier = Math.max(sv.tier, G.maxTier + 1); save();
  H.track('score', G.score, true); H.track('runs', 1);
  const gain = Math.min(80, Math.round(G.depth * 5 + G.score / 2000)) + G.bonus; // proportionnel au jeu réel : rien à gagner à saborder une partie
  if (G.over) A.fail();
  setTimeout(() => {
    grant(gain);
    $('#mn-ot').textContent = rec.s && sv.runs > 1 ? 'Nouveau record !' : 'Effondrement'; $('#mn-share').hidden = true; $('#mn-again').textContent = 'Rejouer';
    $('#mn-os').textContent = rec.s ? 'Ton plus bel univers jusqu\'ici.' : G.score > sv.best * 0.8 ? `À ${fmt(sv.best - G.score)} points de ton record.` : `Record : ${fmt(sv.best)} · secteur ${sv.depth}`;
    overPanel(rec);
  }, G.over ? 900 : 0);
  refreshTitle();
}
function overPanel(rec) {
  $('#mn-o1').textContent = fmt(G.score); $('#mn-o2').textContent = G.depth + 1; $('#mn-o3').textContent = '×' + G.maxChain; $('#mn-o4').textContent = G.maxTier === F.MAX_TIER ? 'Galaxie' : BODIES[G.maxTier][0];
  $('#mn-c1').className = rec.s ? 'rec' : ''; $('#mn-c2').className = rec.d ? 'rec' : ''; $('#mn-c3').className = rec.c ? 'rec' : '';
  $('#mn-q').innerHTML = H.quests(); $('#mn-m-over').classList.add('on');
}
function endChal(c) { // fin d'un défi du jour : réussi (objectif atteint à temps) ou manqué
  const won = !!G.won, left = Math.max(0, Math.round((c[2] - G.t) * 10) / 10), first = won && !(sv.daily.day === G.day && sv.daily.done);
  if (won) { sv.daily = { day: G.day, done: true, best: sv.daily.day === G.day ? Math.max(sv.daily.best, left) : left }; save(); A.win(); } else A.fail();
  rankLine(null); if (won) H.submit({ daily: G.day, score: Math.round(left * 100), sector: G.depth + 1, tier: G.maxTier, seed: G.seed, log: G.log, steps: G.n });
  setTimeout(() => {
    if (first) { grant(150, 'Défi du jour'); H.track('daily', 1); }
    $('#mn-ot').textContent = won ? 'Défi réussi !' : 'Défi manqué'; $('#mn-share').hidden = !won; $('#mn-again').textContent = won ? 'Rejouer le défi' : 'Réessayer';
    $('#mn-os').textContent = won ? `Il te restait ${left.toLocaleString('fr-FR')} s. ${first ? '' : 'Récompense déjà reçue aujourd\'hui.'}` : c[3] + '.';
    overPanel({}); H.refresh();
  }, 900);
}
function newRun(seed, keep) {
  if (!keep) dropRun(); G = F.newGame(seed); G.bonus = 0; warp = slow = 0; want = false; reveal = null; aimT = F.W / 2; A.setMood(0); ended = false; parts = []; rings = []; labels = []; pops.clear(); callout = null; shown = 0; shake = flash = 0; aimX = F.W / 2; aiming = false;
  texB = makeTex(0); texA = null; $('#mn-m-over').classList.remove('on');
}
function refreshTitle() { const s = $('#b-mine-s'); if (s) s.textContent = sv.best ? `Record ${fmt(sv.best)} · secteur ${sv.depth}` : 'Touche pour commencer'; H.refresh(); }
export const busy = () => isOpen;
export { rankLine };
export const stats = () => ({ ...sv });
export { showCodex as openCodex };
export function open(fresh) { // fresh : on va lancer autre chose qu'une partie normale (défi du jour)
  isOpen = true; sprites.clear(); $('#mn').classList.add('on'); document.documentElement.classList.add('mn-open'); lowFx = (navigator.hardwareConcurrency || 4) <= 4;
  G = null; let old = null; try { old = JSON.parse(localStorage.getItem(RUN) || 'null'); } catch (e) { /* ignore */ }
  resize(); tut = -1; $('#mn').classList.remove('tut');
  if (fresh === true) { /* l'appelant crée sa partie */ }
  else if (!sv.tut) { newRun(7); tut = 0; $('#mn').classList.add('tut'); } // première fois : partie guidée
  else if (old && Array.isArray(old.bodies) && Array.isArray(old.log) && !old.over) { newRun(1, true); G = old; G.ev = []; shown = G.score; texB = makeTex(G.depth); H.toast('Partie reprise'); }
  else newRun();
  last = performance.now(); if (!raf) raf = requestAnimationFrame(frame);
}
function close() { A.setMood(0); isOpen = false; document.documentElement.classList.remove('mn-open'); $('#mn').classList.remove('on'); $('#mn-m-over').classList.remove('on'); refreshTitle(); }
export function init(opts) {
  Object.assign(H, opts);
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('div'); d.innerHTML = HTML + HTML2; document.body.append(...d.children);
  cv = $('#mn-cv'); ctx = cv.getContext('2d');
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', () => { aiming = false; });
  window.addEventListener('resize', () => { if (isOpen) resize(); });
  document.addEventListener('visibilitychange', () => { last = performance.now(); if (document.hidden && isOpen) saveRun(); }); window.addEventListener('pagehide', () => { if (isOpen) saveRun(); });
  const click = (el, f) => $(el).addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  click('#mn-back', () => { saveRun(); close(); }); // la partie est gardée : on la reprend en revenant
  click('#mn-quit', () => { $('#mn-m-help').classList.remove('on'); paused = false; if (G && !ended && G.drops > 0) endRun(); else close(); });
  click('#mn-rkb', () => (H.online() && !H.named() ? H.askName() : H.rank()));
  click('#mn-help', () => { $('#mn-ht').textContent = HELP; $('#mn-lad').textContent = BODIES.map((b) => b[0]).join(' › '); $('#mn-m-help').classList.add('on'); paused = true; });
  click('#mn-hok', () => { $('#mn-m-help').classList.remove('on'); paused = false; }); click('#mn-again', () => (G && G.chal ? openDaily() : newRun())); click('#mn-share', share); click('#mn-thok', () => $('#mn-m-themes').classList.remove('on')); click('#mn-cxb', showCodex); click('#mn-cxok', () => $('#mn-m-codex').classList.remove('on')); click('#mn-menu', close);
  // bouton principal de l'accueil (home.js le transforme en héros) ; Cascade devient un lien discret
  const menu = $('#s-title .menu');
  if (menu && !$('#b-mine')) { const b = document.createElement('button'); b.className = 'big primary hero'; b.id = 'b-mine'; b.innerHTML = '<span>Jouer</span><small id="b-mine-s"></small>'; menu.insertBefore(b, menu.firstChild); b.addEventListener('click', () => { A.ui(); H.vib(9); open(); }); }
  refreshTitle();
  window.__mine = { get G() { return G; }, get B() { return B; }, F };
}
