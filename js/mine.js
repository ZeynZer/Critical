// Critical — le jeu : rendu et interface (logique dans fusion.js, pure et testée).
// On fusionne des astres : débris → astéroïde → lune → planète → géante gazeuse → étoiles → trou noir.
// Habillage : le verre liquide du reste du jeu, sur fond d'espace profond.
import * as A from './audio.js';
import * as F from './fusion.js';
import { CAT, RAR, equipable } from './catalog.js';
import { PACKS, draw as drawPack } from './packs.js';
import * as IM from './immersive.js';
import { channel } from './realtime.js';

const KEY = 'critical.forage.v2', TAU = Math.PI * 2;
const sv = { best: 0, depth: 0, chain: 0, tier: 0, runs: 0, tut: 0, cx: {}, xp: 0, inv: {}, skin: {}, power: {}, pk: { etoile: 0, nebuleuse: 0, galaxie: 0 }, pity: {}, pkDay: '', pkN: 0, dust: 0, themes: { base: 1 }, theme: 'base', time: 0, daily: { day: '', done: false, best: 0 } };
try { Object.assign(sv, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
if (!Object.keys(sv.inv).length) for (const k of Object.keys(sv.cx)) if (/^\d+:[1-8]$/.test(k) && !k.startsWith('12:')) sv.inv[k] = 1; // les variantes déjà découvertes comptent pour un exemplaire chacune
if (!sv.eco) { sv.eco = 1; sv.dust = Math.round((sv.dust || 0) * 10); } // l'économie est passée à l'échelle ×10 (Éclats) : on convertit l'ancien solde une seule fois
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(sv)); } catch (e) { /* ignore */ } };
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const H = { vib: () => {}, toast: () => {}, today: () => '', time: () => {}, track: () => {}, quests: () => '', refresh: () => {}, submit: () => Promise.resolve(null), rank: () => {}, askName: () => {}, named: () => true, online: () => false, name: () => '', goal: () => {}, back: () => {}, challenge: () => Promise.resolve(), challengeCancel: () => {}, rival: () => Promise.resolve(null), runOf: () => Promise.resolve(null) };
const RUN = 'critical.genese.run'; // partie en cours, pour la reprendre après fermeture de l'application
const SECRETS = { binaire: ['Étoile binaire', 'Fusionne deux soleils pendant une chaîne ×3'], festin: ['Festin cosmique', 'Tes trous noirs, quasars et galaxies avalent 5 astres en une partie'], bigbang: ['Big Bang', 'Fusionne deux galaxies : tout disparaît'] };
const BANG = 0.42; // part du saut passée en implosion, avant le bang
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; };

// Un astre par rang : [nom, couleur des effets]
export const BODIES = [
  ['Poussière d\'étoile', [255, 236, 190]], ['Débris', [255, 170, 110]], ['Astéroïde', [196, 172, 146]], ['Lune', [206, 214, 230]], ['Planète', [80, 150, 255]], ['Géante gazeuse', [244, 176, 96]],
  ['Naine orange', [255, 150, 60]], ['Soleil', [255, 226, 110]], ['Géante rouge', [255, 84, 66]], ['Étoile à neutrons', [170, 212, 255]], ['Trou noir', [190, 110, 255]], ['Quasar', [255, 214, 130]], ['Galaxie', [200, 215, 255]],
];
const CY = [77, 243, 255], MG = [255, 79, 216], AM = [255, 194, 71];
// Thèmes d'arrière-plan : la récompense du jeu, achetée en Éclats. h = teinte de la nébuleuse pour chacun des 9 secteurs.
export const THEMES = [
  { id: 'base', n: 'Nébuleuse', cost: 0, h: [215, 280, 330, 190, 20, 260, 160, 300, 45], s: 55, a: 0.2, sp: 45 },
  { id: 'aurore', n: 'Aurore', cost: 3000, h: [150, 170, 130, 190, 160, 140, 180, 120, 165], s: 65, a: 0.24, sp: 60 },
  { id: 'braise', n: 'Braise', cost: 6000, h: [10, 25, 0, 35, 15, 350, 30, 5, 20], s: 70, a: 0.24, sp: 25 },
  { id: 'abysse', n: 'Abysse', cost: 10000, h: [200, 210, 190, 220, 205, 195, 215, 185, 200], s: 80, a: 0.13, sp: 20 },
  { id: 'quartz', n: 'Rose quartz', cost: 15000, h: [320, 300, 340, 310, 330, 290, 345, 305, 325], s: 55, a: 0.26, sp: 40 },
  { id: 'or', n: 'Or noir', cost: 25000, h: [45, 40, 50, 38, 48, 42, 52, 36, 46], s: 75, a: 0.16, sp: 12 },
  { id: 'prisme', n: 'Prisme', cost: 40000, h: [0, 40, 80, 120, 160, 200, 240, 280, 320], s: 90, a: 0.3, sp: 110 },
];
const theme = () => THEMES.find((t) => t.id === sv.theme) || THEMES[0];
// Défis du jour : [objectif, valeur, secondes, texte]. Durées réglées sur un joueur simulé rapide (tools/test.mjs ne les couvre pas).
const CHAL = [['tier', 7, 75, 'Crée un Soleil en moins de 1 min 15'], ['tier', 8, 120, 'Crée une Géante rouge en moins de 2 min'], ['tier', 9, 180, 'Crée une Étoile à neutrons en moins de 3 min'],
  ['chain', 5, 90, 'Déclenche une chaîne ×5 en moins de 1 min 30'], ['depth', 2, 60, 'Atteins le secteur 3 en moins de 1 min'], ['score', 6000, 60, 'Marque 6 000 points en moins de 1 min']];
const TUT = ['Pose ton doigt dans la cuve, glisse pour viser, puis relâche.', 'Lâche un astre identique contre le premier : ils fusionnent !', 'Bravo ! Chaque fusion remplit la jauge du bas. Encore deux fusions.', 'Touche RÉSERVE pour garder un astre de côté et le ressortir plus tard.', 'Voici le classement mondial. Choisis un pseudo pour y participer.'];
let tutShown = -1;
const sectorName = (d) => (d < F.STRATA.length ? F.STRATA[d] : `Origine +${d - F.STRATA.length + 1}`);

/* ============================== état ============================== */
let G = null, isOpen = false, raf = 0, T = 0, last = 0, cv, ctx, W = 0, Hh = 0, DPR = 1, SAT = 0, SAB = 0, lowFx = false, paused = false;
let B = { x: 0, y: 0, w: 0, h: 0, u: 30 }, holdR = null, aimX = F.W / 2, aimT = F.W / 2, want = false, reveal = null, aiming = false, ended = false;
let parts = [], rings = [], labels = [], pops = new Map(), shake = 0, flash = 0, flashC = [255, 255, 255], hitstop = 0;
let FN = 0, hud = null, hudKey = '', tut = -1;
let duel = null; // duel 1v1 en cours (salon Realtime)
let rv = null, rvDone = false, gh = null, runTok = 0; // rival (joueur juste au-dessus de mon record) et fantôme optionnel de sa partie
let warp = 0, warpMsg = null, slow = 0, beatT = 0, tAcc = 0, ghosts = []; // tAcc : secondes de jeu pas encore enregistrées ; ghosts : astres aspirés par un Big Bang
let shown = 0, callout = null, texA = null, texB = null, sprites = new Map(), spriteKey = '', landT = 0, giftT = 0, giftLock = 0, giftDur = 1, lastCur = null, blitzMult = 1; // giftLock : un astre spécial (matière exotique, comète) vient de devenir l'astre en main ; on ignore les touches un instant pour ne pas le lâcher par réflexe
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
      if (!G.nop) { addXp(Math.ceil((e.tier + 1) / 2)); H.goal('merge', { tier: e.tier, chain: e.chain }); }
      if (G.nop) { /* rien ne se débloque ici */ }
      else if (!sv.cx[e.tier]) { sv.cx[e.tier] = 1; save(); addXp(20); if (e.tier >= 4) G.bonus += 10; if (e.tier >= 3 && !reveal) { say(BODIES[e.tier][0].toUpperCase(), 'NOUVEL ASTRE · CODEX', col); A.star(2); } }
      else if (e.chain >= 2) say('×' + Math.min(8, e.chain), e.chain >= 3 ? 'CHAÎNE' : '', e.chain >= 5 ? AM : [255, 255, 255]);
      if (!G.nop) { H.track('fusions', 1); H.track('tier', e.tier + 1, true); H.track('chain', e.chain, true); }
    } else if (e.t === 'tgain') { // Blitz : temps rendu par le lâcher, et palier de tempo
      label(x, y + B.u * 1.6, '+' + e.gain.toFixed(1) + ' s', e.gain > 0.6 ? CY : [255, 255, 255], 12); if (e.mult > blitzMult) { label(W / 2, B.y + B.h * 0.24, 'TEMPO ×' + e.mult, AM, 26); A.star(1); H.vib([8, 20, 8]); } blitzMult = e.mult;
    } else if (e.t === 'land') { if (T - landT > 0.07) { landT = T; A.thud(Math.min(1, e.v / 30)); if (e.v > 9) burst(x, y, 3, [200, 220, 255], B.u * 2, 0.3, 1.6); } }
    else if (e.t === 'vapor') { const col = BODIES[e.tier][1]; burst(x, y, 7, col, B.u * 5, 0.6); ring(x, y, 2, B.u * 0.9, 0.3, col, 2); }
    else if (e.t === 'boom') { ring(x, y, 4, B.u * 3.4, 0.45, CY, 7); burst(x, y, 40, [200, 240, 255], B.u * 13, 0.8, 3.5); shake = 14; flash = 0.3; flashC = CY; A.breach(); H.vib([20, 30, 40]); }
    else if (e.t === 'morph') { ring(x, y, 2, B.u * 1.4, 0.3, MG, 3); A.star(2); }
    else if (e.t === 'gift') { giftT = T; A.star(e.k === 'j' ? 1 : 0); if (!G.rep) H.toast(e.k === 'j' ? 'Matière exotique : elle copie l\'astre qu\'elle touche' : 'Belle chaîne ! Comète explosive offerte'); }
    else if (e.t === 'pierce') {
      // saut : l'espace se contracte (implosion), bang, puis le nouveau secteur se déploie — voir draw() et bang()
      texA = texB; texB = makeTex(e.depth); warp = 1; shake = 6; callout = null;
      warpMsg = ['SECTEUR ' + (e.depth + 1), (G.mod.n || sectorName(e.depth)).toUpperCase() + ' · +' + fmt(e.pts), e.depth];
      A.chestRise(0.75); H.vib(20);
      H.track('depth', e.depth + 1, true); if (!G.nop) H.goal('sector', { n: e.depth + 1 });
    } else if (e.t === 'nova') {
      // Big Bang : ralenti, la lumière est aspirée, silence… puis l'explosion
      slow = 1.5; for (let k = 0; k < 3; k++) ring(x, y, W * (0.9 - k * 0.2), 4, 0.6, [[190, 110, 255], MG, [255, 255, 255]][k], 4);
      ghosts = (e.gone || []).filter((o) => o.k === 'c').slice(0, 40).map((o) => ({ ...o, t0: T, cx: x, cy: y, x0: sx(o.x), y0: sy(o.y) })); // tout est aspiré vers le point d'impact avant l'explosion
      A.chestRise(0.6); if (!G.nop && !sv.cx.bigbang) { sv.cx.bigbang = 1; save(); G.bonus += 40; }
      const pts = e.pts; setTimeout(() => { if (!isOpen) return;
        shake = 30; flash = 1; flashC = [255, 255, 255]; hitstop = 0.16; slow = 0;
        for (let k = 0; k < 5; k++) ring(x, y, 6, W * (0.4 + k * 0.3), 0.6 + k * 0.16, [CY, MG, AM, [255, 255, 255], [190, 110, 255]][k], 11 - k * 2);
        burst(x, y, 110, [255, 240, 220], B.u * 22, 1.3, 4); say('BIG BANG', '+' + fmt(pts), [255, 255, 255]);
        A.win(); A.rumble(); H.vib([40, 30, 40, 30, 80]); }, 650);
      if (!G.nop) { H.track('nova', 1); H.goal('nova'); }
    } else if (e.t === 'pulse') { const mag = e.v ? [90, 255, 200] : [170, 212, 255]; ring(x, y, e.r * B.u, e.r * B.u * (e.reach || 2.7), 0.45, mag, e.v ? 7 : 4); if (e.v) ring(x, y, e.r * B.u, e.r * B.u * e.reach * 0.7, 0.35, [255, 255, 255], 3); A.ping(); }
    else if (e.t === 'swallow') { // le petit astre est aspiré : un filet de lumière file vers l'absorbeur
      if (!G.nop) H.goal('swallow');
      const hx = sx(e.hx), hy = sy(e.hy), col = e.by === F.MAX_TIER ? RCOL[Math.min(5, e.bv)] : e.by === 11 ? AM : e.by === 7 ? [100, 170, 255] : [190, 110, 255];
      for (let k = 0; k < 9 && parts.length < 260; k++) { const f = 0.5 + k / 9; parts.push({ x, y, vx: (hx - x) * 3.4 * f + (Math.random() - 0.5) * 30, vy: (hy - y) * 3.4 * f + (Math.random() - 0.5) * 30, l: 0, m: 0.3 + Math.random() * 0.15, cs: `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`, sz: 2.4 }); }
      ring(hx, hy, B.u * 2.4, B.u * 0.5, 0.4, col, 3); A.gulp();
    }
    else if (e.t === 'rare') { // variante rare ou galaxie : grande révélation la 1re fois seulement, ensuite un simple éclat
      const r = Math.max(0, catR(e.tier, e.v)), key = e.tier + ':' + e.v;
      if (G.nop) continue;
      sv.inv[key] = (sv.inv[key] | 0) + 1; save(); H.goal('rare', { tier: e.tier, v: e.v }); // un exemplaire de plus pour la fusion de collection
      if (sv.cx[key]) { say(nameOf(e.tier, e.v).toUpperCase(), e.v === 1 || e.tier === F.MAX_TIER ? 'RARE · ×3 POINTS' : 'VARIANTE DE STYLE', RCOL[r]); ring(x, y, B.u * 3, B.u * 0.6, 0.55, RCOL[r], 3); burst(x, y, 14, RCOL[r], B.u * 6, 0.7, 2.4); A.rare(Math.min(r, 1)); H.vib(18); }
      else {
        sv.cx[key] = 1; save(); G.bonus += 15 + r * 15; addXp(40);
        reveal = { tier: e.tier, v: e.v, r, p: e.p, pw: powerText(e.tier, e.v), l: 0, d: 3.4 + r * 0.35 }; slow = reveal.d * 0.85; callout = null;
        A.rare(r); H.vib(r >= 3 ? [30, 40, 30, 40, 30, 40, 90] : [20, 40, 40]);
      }
    }
    else if (e.t === 'secret') { const S = SECRETS[e.id]; if (!G.nop && !sv.cx[e.id]) { sv.cx[e.id] = 1; save(); G.bonus += 40; } say(S[0].toUpperCase(), 'DÉCOUVERTE SECRÈTE', AM); ring(x, y, 6, W * 0.6, 0.8, AM, 6); A.win();
    } else if (e.t === 'over') { if (G.rep) G.rep.done = true; else if (G.duel) duelFinish(); else endRun(); }
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
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * DPR - 1e-6); c.height = Math.ceil(h * DPR - 1e-6); const x = c.getContext('2d'); x.scale(DPR, DPR); return [c, x]; };
const blob = (x, px, py, rx, ry, rot, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(px, py, rx, ry, rot, 0, TAU); x.fill(); };
function strip(r, base, n, seed, f) { // n motifs placés au hasard, dessinés 3 fois pour boucler sans couture
  const w = Math.ceil(r * 4 * DPR) / DPR, h = Math.ceil(r * 2 * DPR) / DPR, [c, x] = mk(w, h); // taille entière en pixels : sinon la dernière colonne reste transparente et laisse une raie sombre à la jointure
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
// Variantes : VAR[rang][v] = [nom, teinte, effet] dérivé du catalogue (js/catalog.js). v = 9 : prismatique (fusion).
const VAR = {};
for (const t of Object.keys(CAT)) { VAR[t] = {}; for (const v of Object.keys(CAT[t])) VAR[t][v] = [CAT[t][v].n, CAT[t][v].c, CAT[t][v].fx]; VAR[t][9] = [BODIES[t][0] + ' prismatique', [255, 255, 255]]; }
const catR = (t, v) => (t === F.MAX_TIER ? v : v === 9 ? 5 : CAT[t] && CAT[t][v] ? CAT[t][v].r : -1); // rareté d'une carte
const vOdds = (t, v) => (v === 1 ? F.RARE[t] : v === 9 || v < 1 ? 0 : (F.STYLES[t] || [])[v - 2] || 0); // 0 : skin de pack (pas tiré en partie)
const nameOf = (tier, v) => (tier === F.MAX_TIER ? GAL[v | 0].n : v && VAR[tier] && VAR[tier][v] ? VAR[tier][v][0] : BODIES[tier][0]);
const RCOL = [[160, 185, 225], [77, 243, 255], [255, 79, 216], [255, 194, 71], [255, 120, 90], [255, 255, 255]];
const rarOf = (tier, v, p) => (tier === F.MAX_TIER ? v : v === 9 ? 5 : p > 0.05 ? 1 : p > 0.03 ? 2 : p > 0.02 ? 3 : 4); // niveau de mise en scène 0..5

// Effets des skins : décorations posées sur le calque de lumière fixe (over), découpées dans le disque (et hors du cœur noir des trous noirs / quasars)
function skinFx(A, tier, r, col, fx) {
  const x = A.over.getContext('2d'), s = r * 1.3, core = tier === 10 ? 0.62 : tier === 11 ? 0.32 : 0, L = rgba(col, 1), lite = [Math.min(255, col[0] + 90), Math.min(255, col[1] + 90), Math.min(255, col[2] + 90)];
  const disc = () => { x.beginPath(); x.arc(s, s, r, 0, TAU); if (core) { x.arc(s, s, r * core, 0, TAU, true); } };
  const clip = () => { x.save(); disc(); x.clip(core ? 'evenodd' : 'nonzero'); };
  if (fx === 'frost') { clip(); soft(x, s - r * 0.3, s - r * 0.3, r * 0.9, [255, 255, 255], 0.35); for (let i = 0; i < 46; i++) { const a = rnd(i * 2.1) * TAU, d = Math.sqrt(rnd(i * 3.7)) * r; x.fillStyle = `rgba(235,250,255,${0.25 + rnd(i * 5.3) * 0.6})`; x.save(); x.translate(s + Math.cos(a) * d, s + Math.sin(a) * d); x.rotate(rnd(i) * 3); x.fillRect(-r * 0.015, -r * 0.07, r * 0.03, r * 0.14); x.restore(); } x.restore(); x.strokeStyle = 'rgba(220,245,255,.85)'; x.lineWidth = Math.max(1.5, r * 0.05); x.beginPath(); x.arc(s, s, r - 0.5, 0, TAU); x.stroke(); }
  else if (fx === 'neon') { clip(); x.fillStyle = 'rgba(0,0,20,.32)'; x.fill(); x.restore(); x.save(); x.shadowColor = L; x.shadowBlur = r * 0.35; x.strokeStyle = rgba(lite, 1); x.lineWidth = Math.max(1.5, r * 0.07); x.beginPath(); x.arc(s, s, r * 0.96, 0, TAU); x.stroke(); x.lineWidth = Math.max(1, r * 0.035); x.globalAlpha = 0.6; x.beginPath(); x.arc(s, s, r * 0.78, 0, TAU); x.stroke(); x.restore(); }
  else if (fx === 'rings') { x.save(); x.translate(s, s); x.rotate(-0.38); for (const [k, w, al] of [[1.26, 0.07, 0.9], [1.14, 0.04, 0.55]]) { x.strokeStyle = rgba(lite, al); x.lineWidth = r * w; x.beginPath(); x.ellipse(0, 0, r * k, r * k * 0.28, 0, 0, TAU); x.stroke(); } x.restore(); }
  else if (fx === 'lava') { clip(); const P = [[-0.7, -0.5], [-0.3, -0.15], [0.05, -0.3], [0.35, 0.1], [0.7, 0.3]].map(([px, py], i) => [s + px * r + (rnd(i * 3.1) - 0.5) * r * 0.2, s + py * r + (rnd(i * 5.9) - 0.5) * r * 0.2]); const path = (ox = 0) => { x.beginPath(); P.forEach((p, i) => (i ? x.lineTo(p[0] + ox, p[1] + ox * 1.5) : x.moveTo(p[0] + ox, p[1] + ox * 1.5))); }; x.lineJoin = x.lineCap = 'round'; x.globalCompositeOperation = 'lighter'; for (const ox of [0, r * 0.35]) { path(ox); x.strokeStyle = rgba(col, 0.5); x.lineWidth = r * 0.16; x.stroke(); path(ox); x.strokeStyle = rgba(lite, 0.95); x.lineWidth = r * 0.06; x.stroke(); } soft(x, s, s, r, col, 0.25); x.restore(); }
  else if (fx === 'crystal') { clip(); const N = 9, ctr = [s - r * 0.1, s - r * 0.12], P = []; for (let i = 0; i < N; i++) { const a = (i / N) * TAU + 0.2; P.push([s + Math.cos(a) * r * 1.05, s + Math.sin(a) * r * 1.05]); } for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N], l = Math.cos((i / N) * TAU + 2.2); x.fillStyle = l > 0 ? `rgba(255,255,255,${l * 0.3})` : `rgba(0,0,30,${-l * 0.28})`; x.beginPath(); x.moveTo(ctr[0], ctr[1]); x.lineTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.closePath(); x.fill(); x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = Math.max(1, r * 0.02); x.beginPath(); x.moveTo(ctr[0], ctr[1]); x.lineTo(a[0], a[1]); x.stroke(); } x.restore(); x.strokeStyle = rgba(lite, 0.9); x.lineWidth = Math.max(1.5, r * 0.05); x.beginPath(); x.arc(s, s, r - 0.5, 0, TAU); x.stroke(); }
  else if (fx === 'const') { clip(); const P = Array.from({ length: 9 }, (_, i) => [s + (rnd(i * 4.3 + 1) - 0.5) * r * 1.7, s + (rnd(i * 6.1 + 2) - 0.5) * r * 1.7]); x.fillStyle = 'rgba(0,0,25,.3)'; x.fillRect(0, 0, s * 2, s * 2); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = Math.max(1, r * 0.025); x.beginPath(); P.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.stroke(); for (const p of P) { soft(x, p[0], p[1], r * 0.16, lite, 0.8); x.fillStyle = '#fff'; x.beginPath(); x.arc(p[0], p[1], Math.max(1, r * 0.04), 0, TAU); x.fill(); } x.restore(); }
  else if (fx === 'holo') { clip(); const g = x.createConicGradient ? x.createConicGradient(0.7, s, s) : null; if (g) { for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i * 60) % 360},100%,65%)`); x.globalCompositeOperation = 'color'; x.globalAlpha = 0.5; x.fillStyle = g; x.fillRect(0, 0, s * 2, s * 2); x.globalAlpha = 1; x.globalCompositeOperation = 'lighter'; } const sh = x.createLinearGradient(s - r, s - r, s + r, s + r); sh.addColorStop(0.3, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.45)'); sh.addColorStop(0.7, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.fillRect(0, 0, s * 2, s * 2); x.restore(); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = Math.max(1, r * 0.04); x.beginPath(); x.arc(s, s, r - 0.5, 0, TAU); x.stroke(); }
  else if (fx === 'inner') { clip(); x.fillStyle = 'rgba(0,0,22,.55)'; x.fillRect(0, 0, s * 2, s * 2); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 160; i++) { const t = rnd(i * 1.3) ** 0.8, a = (i % 3) * 2.094 + t * 4.4 + (rnd(i * 7.7) - 0.5) * 0.5, d = r * (0.08 + t * 0.9); soft(x, s + Math.cos(a) * d, s + Math.sin(a) * d * 0.94, r * (0.03 + rnd(i * 3.1) * 0.06), i % 4 ? lite : [255, 255, 255], 0.35 + rnd(i) * 0.5); } soft(x, s, s, r * 0.4, [255, 255, 255], 0.9); x.restore(); x.strokeStyle = rgba(lite, 0.85); x.lineWidth = Math.max(1.5, r * 0.05); x.beginPath(); x.arc(s, s, r - 0.5, 0, TAU); x.stroke(); }
  else if (fx === 'aurora') { clip(); x.globalCompositeOperation = 'lighter'; for (let k = 0; k < 3; k++) { x.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20, px = s - r + t * r * 2, py = s + (k - 1) * r * 0.42 + Math.sin(t * 7 + k * 2) * r * 0.16; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.strokeStyle = rgba(k === 1 ? lite : col, 0.45); x.lineWidth = r * 0.3; x.lineCap = 'round'; x.stroke(); } x.restore(); x.strokeStyle = rgba(lite, 0.7); x.lineWidth = Math.max(1, r * 0.04); x.beginPath(); x.arc(s, s, r - 0.5, 0, TAU); x.stroke(); }
  else if (fx === 'flame') { x.save(); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU + rnd(i) * 0.3, l = r * (1.1 + rnd(i * 2.9) * 0.2), g = x.createRadialGradient(s, s, r * 0.9, s, s, l); g.addColorStop(0, rgba(lite, 0.85)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.beginPath(); x.moveTo(s + Math.cos(a - 0.14) * r * 0.95, s + Math.sin(a - 0.14) * r * 0.95); x.lineTo(s + Math.cos(a) * l, s + Math.sin(a) * l); x.lineTo(s + Math.cos(a + 0.14) * r * 0.95, s + Math.sin(a + 0.14) * r * 0.95); x.closePath(); x.fill(); } x.restore(); }
}
function build(tier, r, v) {
  const kind = KIND[tier], s = r * 1.3;
  if (kind === 'galaxy') return galaxy(r, v);
  let A;
  if (kind === 'dust') { // poussière d'étoile : un éclat qui scintille
    const [c, x] = mk(s * 2, s * 2); soft(x, s, s, r * 1.25, [255, 236, 190], 0.9); soft(x, s, s, r * 0.55, [255, 255, 255], 1);
    x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = Math.max(1, r * 0.12); x.lineCap = 'round'; x.beginPath(); x.moveTo(s - r, s); x.lineTo(s + r, s); x.moveTo(s, s - r); x.lineTo(s, s + r); x.stroke();
    return { spr: c, spin: 1.1 };
  }
  if (kind === 'orb') { // débris : un éclat de roche sombre, facetté, fissuré ; la lueur de la fissure prend la couleur du niveau du joueur
    const [c, x] = mk(s * 2, s * 2), L = lvCol(), N = 9, P = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU + 0.35, rr = r * (0.93 + rnd(i * 4.1 + 1) * 0.07); P.push([s + Math.cos(a) * rr, s + Math.sin(a) * rr]); }
    const poly = () => { x.beginPath(); P.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); };
    poly(); const g = x.createLinearGradient(s - r, s - r, s + r, s + r); g.addColorStop(0, '#4a4658'); g.addColorStop(1, '#14121c'); x.fillStyle = g; x.fill();
    x.save(); poly(); x.clip();
    for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N], mid = Math.atan2((a[1] + b[1]) / 2 - s, (a[0] + b[0]) / 2 - s), lit = Math.cos(mid + 2.35); x.fillStyle = lit > 0 ? `rgba(255,255,255,${lit * 0.16})` : `rgba(0,0,0,${-lit * 0.3})`; x.beginPath(); x.moveTo(s - r * 0.1, s - r * 0.1); x.lineTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.closePath(); x.fill(); }
    const cr = [[-0.78, -0.5], [-0.42, -0.2], [-0.12, 0.12], [0.2, 0.05], [0.42, 0.35], [0.8, 0.62]].map(([px, py], i) => [s + px * r + (rnd(i * 3.3) - 0.5) * r * 0.16, s + py * r + (rnd(i * 5.7) - 0.5) * r * 0.16]); // fissure en zigzag, d'un bord à l'autre
    const path = () => { x.beginPath(); cr.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); };
    x.lineJoin = 'round'; x.lineCap = 'round';
    soft(x, s, s, r * 0.95, L, 0.22); // la lumière déborde sur la roche
    path(); x.strokeStyle = 'rgba(0,0,0,.7)'; x.lineWidth = r * 0.3; x.stroke();
    x.globalCompositeOperation = 'lighter'; path(); x.strokeStyle = rgba(L, 0.55); x.lineWidth = r * 0.2; x.stroke(); path(); x.strokeStyle = rgba(L, 0.95); x.lineWidth = r * 0.1; x.stroke();
    x.globalCompositeOperation = 'source-over'; path(); x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = Math.max(1, r * 0.04); x.stroke();
    x.restore(); poly(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 1; x.stroke();
    return { spr: c, spin: 0.2 };
  }
  if (kind === 'rock') { // astéroïde : pierre grise anguleuse, cratères nets éclairés par le haut gauche, éclats de minerai
    const [c, x] = mk(s * 2, s * 2), N = 13, P = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU, rr = r * (0.935 + rnd(i * 2.7 + 4) * 0.065); P.push([s + Math.cos(a) * rr, s + Math.sin(a) * rr]); }
    const poly = () => { x.beginPath(); P.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath(); };
    poly(); const g = x.createLinearGradient(s - r * 0.8, s - r * 0.9, s + r * 0.9, s + r); g.addColorStop(0, '#b9b4b8'); g.addColorStop(0.5, '#7c7479'); g.addColorStop(1, '#2c2730'); x.fillStyle = g; x.fill();
    x.save(); poly(); x.clip();
    for (let i = 0; i < N; i++) { const a = P[i], b = P[(i + 1) % N], mid = Math.atan2((a[1] + b[1]) / 2 - s, (a[0] + b[0]) / 2 - s), lit = Math.cos(mid + 2.35); x.fillStyle = lit > 0 ? `rgba(255,255,255,${lit * 0.13})` : `rgba(0,0,0,${-lit * 0.22})`; x.beginPath(); x.moveTo(s - r * 0.15, s - r * 0.15); x.lineTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.closePath(); x.fill(); }
    for (let i = 0; i < 6; i++) { // cratères : creux sombre + lèvre claire en bas à droite
      const cx = s + (rnd(i * 3 + 1) - 0.5) * r * 1.15, cy = s + (rnd(i * 5 + 2) - 0.5) * r * 1.15, cr = r * (0.1 + rnd(i * 7 + 3) * 0.13);
      x.fillStyle = 'rgba(20,16,24,.62)'; x.beginPath(); x.ellipse(cx, cy, cr, cr * 0.86, 0.3, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.34)'; x.lineWidth = Math.max(1, cr * 0.2); x.beginPath(); x.ellipse(cx, cy, cr, cr * 0.86, 0.3, 0.2, 1.5); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = Math.max(1, cr * 0.18); x.beginPath(); x.ellipse(cx, cy, cr, cr * 0.86, 0.3, 3.4, 4.6); x.stroke();
    }
    for (let i = 0; i < 16; i++) { const px = s + (rnd(i * 2.3 + 9) - 0.5) * r * 1.7, py = s + (rnd(i * 4.1 + 8) - 0.5) * r * 1.7; x.fillStyle = i % 4 ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.2)'; x.fillRect(px, py, Math.max(1, r * 0.035), Math.max(1, r * 0.035)); }
    for (let i = 0; i < 3; i++) { const px = s + (rnd(i * 6.1 + 2) - 0.5) * r * 1.2, py = s + (rnd(i * 8.3 + 5) - 0.5) * r * 1.2; soft(x, px, py, r * 0.12, [255, 200, 120], 0.55); x.fillStyle = '#fff1d0'; x.beginPath(); x.arc(px, py, Math.max(0.8, r * 0.03), 0, TAU); x.fill(); } // minerai qui brille
    x.restore(); poly(); x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 1; x.stroke();
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
    const [o] = light(r, r, v === 1 ? (tier === 7 ? [20, 60, 200] : [120, 70, 10]) : P[3]);
    A = { R: r, sp: 0.22, sp2: -0.3, add: true, over: o, back: halo(r, P[4], 0.7, P[5]), spinB: P[5] ? 0.12 : 0, pulse: 0.045, strip: starStrip(r, P[0], P[1], P[2], tier * 7), strip2: starStrip(r, null, P[1], [255, 255, 255], tier * 13) };
  } else if (kind === 'neutron') { // jets qui balayent, surface très rapide
    const [j, jx] = mk(s * 2, s * 2), g = jx.createLinearGradient(0, s, s * 2, s); g.addColorStop(0, 'rgba(160,210,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(160,210,255,0)');
    jx.fillStyle = g; jx.beginPath(); jx.moveTo(0, s - r * 0.02); jx.lineTo(s, s - r * 0.16); jx.lineTo(s * 2, s - r * 0.02); jx.lineTo(s * 2, s + r * 0.02); jx.lineTo(s, s + r * 0.16); jx.lineTo(0, s + r * 0.02); jx.fill();
    const [o] = light(r, r, [40, 80, 220]);
    A = { R: r, sp: 1.6, sp2: -1.1, add: true, over: o, back: halo(r, [150, 200, 255], 0.85), pulse: 0.07, disc: j, spinD: 2.4, strip: starStrip(r, '#a9d0ff', [255, 255, 255], [60, 100, 255], 71), strip2: starStrip(r, null, [255, 255, 255], [140, 180, 255], 83) };
  } else if (kind === 'hole') { // le disque tourne autour d'un horizon immobile ; variante rare : trou blanc, cœur de lumière
    const [o, ox] = mk(s * 2, s * 2); ox.fillStyle = v === 1 ? '#fff' : '#000'; ox.beginPath(); ox.arc(s, s, r * 0.6, 0, TAU); ox.fill(); if (v === 1) soft(ox, s, s, r * 0.9, [255, 255, 255], 0.9);
    ox.strokeStyle = 'rgba(255,255,255,.95)'; ox.lineWidth = Math.max(1.5, r * 0.03); ox.beginPath(); ox.arc(s, s, r * 0.61, 0, TAU); ox.stroke();
    ox.strokeStyle = 'rgba(255,210,140,.9)'; ox.lineWidth = r * 0.06; ox.beginPath(); ox.ellipse(s, s, r * 1.14, r * 0.16, -0.3, 0, Math.PI); ox.stroke();
    A = { over: o, back: halo(r, [170, 90, 255], 0.8), pulse: 0.06, disc: accretion(r, 0.55), spinD: 0.9 };
  } else { // quasar : un trou noir si vorace que son disque éblouit et crache deux jets
    const [b, bx] = mk(s * 2, s * 2), g = bx.createLinearGradient(s, 0, s, s * 2); g.addColorStop(0, 'rgba(255,230,170,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,230,170,0)');
    soft(bx, s, s, s, [255, 200, 110], 0.55); bx.fillStyle = g; bx.beginPath(); bx.moveTo(s - r * 0.02, 0); bx.lineTo(s - r * 0.2, s); bx.lineTo(s - r * 0.02, s * 2); bx.lineTo(s + r * 0.02, s * 2); bx.lineTo(s + r * 0.2, s); bx.lineTo(s + r * 0.02, 0); bx.fill();
    const [o, ox] = mk(s * 2, s * 2); soft(ox, s, s, r * 0.62, [255, 255, 255], 1); ox.fillStyle = '#000'; ox.beginPath(); ox.arc(s, s, r * 0.3, 0, TAU); ox.fill(); ox.strokeStyle = '#fff'; ox.lineWidth = Math.max(1.5, r * 0.03); ox.stroke();
    A = { over: o, back: b, still: true, spinB: 0.25, disc: accretion(r, 0.3, true), spinD: 1.7 };
  }
  const V = v && VAR[tier] && VAR[tier][v];
  if (V && v !== 9) { for (const k of ['strip', 'strip2', 'back', 'disc']) A[k] = tint(A[k], V[1]); if (V[2] && A.over) skinFx(A, tier, r, V[1], V[2]); }
  if (v === 9) A.prism = true; // prismatique : un arc-en-ciel tourne sur l'astre (voir compose)
  return A;
}
function sprite(tier, v) {
  const key = B.u.toFixed(2) + ':' + DPR + ':' + lvStyle();
  if (key !== spriteKey) { sprites.clear(); spriteKey = key; }
  let s = sprites.get(tier * 16 + v);
  if (!s) { const r = F.TIERS[tier].r * B.u; s = build(tier, r, v); s.h = r * 1.3; sprites.set(tier * 16 + v, s); }
  return s;
}
// Performance : les calques d'un astre animé (halo, surface découpée, lumière) sont assemblés UNE fois par rang toutes les 2 images
// dans s.comp ; chaque astre de ce rang n'est plus qu'une copie d'image. Avant : découpe + 3 à 5 dessins par astre et par image.
function compose(s, tier, body) { // body : seulement la surface (le halo et la lumière sont alors des calques à part)
  const h = s.h, x = s.cx, img = (c) => x.drawImage(c, -h, -h, h * 2, h * 2);
  x.setTransform(DPR, 0, 0, DPR, 0, 0); x.clearRect(0, 0, h * 2, h * 2); x.translate(h, h);
  if (s.back && !body) { const p = 1 + (s.pulse || 0) * Math.sin(T * 2.3 + tier); x.save(); if (s.spinB) x.rotate(T * s.spinB); if (!s.still) x.scale(p, p); img(s.back); x.restore(); }
  if (s.disc) { x.save(); x.rotate(T * s.spinD); img(s.disc); x.restore(); }
  if (s.disc2) { x.save(); x.rotate(-T * s.spinD * 0.7); img(s.disc2); x.restore(); }
  if (s.strip) {
    const R = s.R, w = (h / 1.3) * 4, lay = (c, sp) => { // bande qui défile : un motif répété (pas deux images collées, dont la jointure laissait une raie sombre verticale)
      const o = ((T * sp * R) % w + w) % w, kx = w / c.width, ky = (w / 2) / c.height; if (!c.pat) c.pat = x.createPattern(c, 'repeat');
      x.save(); x.translate(-R - o, -w / 4); x.scale(kx, ky); x.fillStyle = c.pat; x.fillRect(o / kx, 0, (2 * R) / kx + 2, c.height); x.restore(); };
    x.save(); x.beginPath(); x.arc(0, 0, R, 0, TAU); x.clip(); lay(s.strip, s.sp);
    if (s.strip2) { if (s.add) x.globalCompositeOperation = 'lighter'; lay(s.strip2, s.sp2); }
    x.restore();
  }
  if (s.prism && x.createConicGradient) { x.save(); x.beginPath(); x.arc(0, 0, h / 1.3, 0, TAU); x.clip(); const g = x.createConicGradient(T * 0.9, 0, 0); for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i * 60) % 360},100%,62%)`); x.globalCompositeOperation = 'color'; x.globalAlpha = 0.72; x.fillStyle = g; x.fillRect(-h, -h, h * 2, h * 2); x.restore(); }
  if (s.over && !body) img(s.over);
}
function drawItem(it, x, y, sc = 1, ang = 0, u = B.u) {
  if (it.k === 'c') {
    const v = !it.v && !it.ns && sv.skin[it.tier] ? sv.skin[it.tier] : it.v | 0, s = sprite(it.tier, v), k = sc * (u / B.u) * (it.r ? it.r / F.TIERS[it.tier].r : 1), h = s.h * k; // it.r : la géante rouge enfle
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
const sec = (x) => x.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
// Description d'un pouvoir, construite depuis les tables du moteur (une seule source de vérité)
export function powerText(tier, v = 0) {
  const t = F.ABSORB[tier], pw = t && t[tier === F.MAX_TIER ? Math.min(v, 5) : v === 1 ? 1 : 0];
  if (pw) return `Avale tout astre jusqu'à « ${BODIES[pw[0]][0]} », un toutes les ${sec(pw[1])} s${pw[2] >= 0.5 ? ', même sans contact' : pw[2] >= 0.1 ? ', à courte distance' : ''}.`;
  if (tier === F.NEUTRON) return v === 1 ? `Impulsions bien plus fortes, toutes les ${sec(F.PULSE[1][0])} s.` : `Repousse ses voisins toutes les ${sec(F.PULSE[0][0])} s.`;
  if (tier === F.GIANT) return v === 1 ? 'Reste stable : ne gonfle jamais.' : 'Gonfle avec le temps : fusionne-la vite.';
  return v >= 2 && v < 9 ? 'Variante de style : aucun pouvoir, juste beaucoup d\'allure.' : v === 9 ? 'Astre unique obtenu par fusion : il remplace l\'apparence de ce rang quand tu l\'équipes.' : '';
}
const RNAME = ['COMMUNE', 'PEU COMMUNE', 'RARE', 'ÉPIQUE', 'LÉGENDAIRE', 'CRITIQUE'];
const odds = (p) => (p >= 0.05 ? `${(p * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % de chances` : `1 chance sur ${Math.round(1 / p).toLocaleString('fr-FR')}`);
const eo = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3, bk = (x) => { x = clamp(x, 0, 1) - 1; return 1 + 2.7 * x ** 3 + 1.7 * x ** 2; };
function spaced(str, x, y, sp) { // texte centré avec un interlettrage animé (ctx.letterSpacing n'existe pas partout)
  const w = [...str].map((c) => ctx.measureText(c).width + sp); let px = x - (w.reduce((a, b) => a + b, 0) - sp) / 2; ctx.textAlign = 'left';
  [...str].forEach((c, i) => { ctx.fillText(c, px, y); px += w[i]; }); ctx.textAlign = 'center';
}
function drawReveal() { // 1re obtention d'une variante rare : l'énergie converge, onde de choc, l'astre émerge, la rareté s'allume, le nom se resserre
  const R = reveal, t = R.l, hit = 0.75, k = t - hit, env = Math.min(1, t * 4, (R.d - t) * 3), cx = W / 2, cy = Hh * 0.36, S = Math.min(W * 0.2, 86), M = Math.max(W, Hh);
  const col = R.r === 5 ? hueC(T * 160) : RCOL[R.r], hi = [Math.min(255, col[0] + 90), Math.min(255, col[1] + 90), Math.min(255, col[2] + 90)];
  let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, M * 0.75); g.addColorStop(0, rgba(col, 0.16 * env)); g.addColorStop(0.45, `rgba(4,6,22,${0.8 * env})`); g.addColorStop(1, `rgba(1,2,10,${0.94 * env})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
  ctx.globalCompositeOperation = 'lighter';
  if (k < 0) { // énergie qui converge vers le centre
    const p = eo(t / hit); ctx.strokeStyle = rgba(hi, 0.75 * env); ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0, n = lowFx ? 18 : 34; i < n; i++) { const a = i * 2.399, d0 = M * (0.3 + 0.5 * ((i * 0.618) % 1)), d = d0 * (1 - p), tr = 22 + 30 * p; ctx.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); ctx.lineTo(cx + Math.cos(a) * (d + tr), cy + Math.sin(a) * (d + tr)); }
    ctx.stroke(); g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.9 * p + 2); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, S * 0.9 * p + 2, 0, TAU); ctx.fill();
  } else {
    const e1 = eo(k / 0.8), pulse = 1 + 0.06 * Math.sin(T * 2.4);
    g = ctx.createRadialGradient(cx, cy, S * 0.3, cx, cy, S * 3.4 * e1 * pulse); g.addColorStop(0, rgba(col, 0.6 * env)); g.addColorStop(0.35, rgba(col, 0.2 * env)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, S * 3.4 * e1 * pulse, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); // rayons fins, deux jeux qui tournent en sens contraire
    for (let s = 0; s < 2; s++) { const n = 5 + R.r + s * 2, L = M * (0.4 + 0.08 * R.r) * e1; ctx.save(); ctx.rotate(T * (0.12 + 0.03 * R.r) * (s ? -1.3 : 1) + s);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU, w = 0.012 + 0.008 * Math.sin(T * 2 + i * 2 + s); ctx.fillStyle = rgba(R.r >= 4 ? hueC(i * 360 / n + T * 60) : col, (s ? 0.06 : 0.1) * env); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a - w) * L, Math.sin(a - w) * L); ctx.lineTo(Math.cos(a + w) * L, Math.sin(a + w) * L); ctx.fill(); }
      ctx.restore(); }
    ctx.restore();
    if (R.r >= 3) { ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.035); g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.6); g.addColorStop(0, `rgba(255,255,255,${0.9 * env})`); g.addColorStop(0.25, rgba(hi, 0.5 * env)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, W * 0.6 * eo(k / 0.5), 0, TAU); ctx.fill(); ctx.restore(); }
    if (k < 0.8) { ctx.strokeStyle = rgba(hi, (1 - k / 0.8) * 0.9 * env); ctx.lineWidth = 2 + 10 * (1 - k / 0.8); ctx.beginPath(); ctx.arc(cx, cy, eo(k / 0.8) * M * 0.62, 0, TAU); ctx.stroke(); }
    for (let i = 0, n = lowFx ? 10 : 22; i < n && k < 1.6; i++) { const a = i * 2.399 + 1, v = M * (0.25 + 0.35 * ((i * 0.37) % 1)), d = eo(k / 1.6) * v * 0.55; ctx.fillStyle = rgba(hi, (1 - k / 1.6) * env); ctx.fillRect(cx + Math.cos(a) * d - 1.5, cy + Math.sin(a) * d - 1.5, 3, 3); } // étincelles
    if (k < 0.25) { ctx.fillStyle = `rgba(255,255,255,${0.6 * (1 - k / 0.25) * env})`; ctx.fillRect(0, 0, W, Hh); }
  }
  ctx.globalCompositeOperation = 'source-over';
  if (k < 0) { ctx.globalAlpha = 1; return; }
  const bob = Math.sin(T * 1.7) * 3; ctx.globalAlpha = env;
  drawItem({ k: 'c', tier: R.tier, v: R.v }, cx, cy + bob, bk(k / 0.55), T * 0.3, S / F.TIERS[R.tier].r / 1.3);
  const A_ = (t0) => clamp((k - t0) * 3.5, 0, 1) * env; ctx.textAlign = 'center'; let y = cy + S + 34;
  for (let i = 0; i < 6; i++) { const on = i <= R.r && k > 0.5 + i * 0.13, px = cx + (i - 2.5) * 22, pop = on ? 1 + 0.5 * Math.max(0, 1 - (k - 0.5 - i * 0.13) * 5) : 1; ctx.globalAlpha = A_(0.4); ctx.fillStyle = on ? rgba(col, 1) : 'rgba(255,255,255,.16)'; if (on && !lowFx) { ctx.shadowColor = rgba(col, 1); ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.moveTo(px, y - 6 * pop); ctx.lineTo(px + 4.5 * pop, y); ctx.lineTo(px, y + 6 * pop); ctx.lineTo(px - 4.5 * pop, y); ctx.fill(); ctx.shadowBlur = 0; }
  y += 30; ctx.globalAlpha = A_(0.55); ctx.font = '700 11px Orbitron,sans-serif'; ctx.fillStyle = rgba(col, 1); spaced((R.tier === F.MAX_TIER ? 'GALAXIE ' : 'VARIANTE ') + RNAME[R.r], cx, y, 3);
  y += 34; ctx.globalAlpha = A_(0.7); ctx.font = `900 ${Math.min(30, W * 0.07)}px Orbitron,sans-serif`; ctx.shadowColor = rgba(col, 0.9); ctx.shadowBlur = lowFx ? 0 : 22; ctx.fillStyle = '#fff'; spaced(nameOf(R.tier, R.v).toUpperCase(), cx, y, 14 * (1 - eo((k - 0.7) / 1)) + 1); ctx.shadowBlur = 0;
  y += 26; ctx.globalAlpha = A_(1); ctx.font = '700 11px Orbitron,sans-serif'; const ot = odds(R.p).toUpperCase(), ow = ctx.measureText(ot).width + 28;
  ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.strokeStyle = rgba(col, 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(cx - ow / 2, y - 14, ow, 24, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillText(ot, cx, y + 2);
  y += 34; ctx.globalAlpha = A_(1.2);
  if (R.pw) { ctx.font = '600 12px system-ui,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)'; let line = ''; for (const w of R.pw.split(' ')) { if ((line + ' ' + w).length > 36 && line) { ctx.fillText(line, cx, y); y += 17; line = w; } else line = line ? line + ' ' + w : w; } ctx.fillText(line, cx, y); y += 28; }
  ctx.font = '700 10px Orbitron,sans-serif'; ctx.fillStyle = '#5dffc0'; spaced('NOUVELLE DÉCOUVERTE · AJOUTÉE AU CODEX', cx, y, 1.5);
  if (t > 1.6) { ctx.globalAlpha = (0.35 + 0.25 * Math.sin(T * 3)) * env; ctx.font = '600 10px system-ui,sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('touche pour continuer', cx, Hh - SAB - 40); }
  ctx.globalAlpha = 1;
}
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, lowFx ? 1.5 : 2); W = window.innerWidth; Hh = window.innerHeight;
  cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(Hh * DPR);
  SAT = $('#probe-t') ? $('#probe-t').offsetHeight : 0; SAB = $('#probe-b') ? $('#probe-b').offsetHeight : 0;
  const top = SAT + 104, bar = 86, availH = Hh - top - bar - SAB - 30;
  const ht = (G && G.ht) || F.HT, u = Math.min((W - 28) / F.W, availH / ht, 60);
  B = { u, w: u * F.W, h: u * ht, x: (W - u * F.W) / 2, y: top + (availH - u * ht) / 2 };
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
  ctx.setTransform(cv.width / W, 0, 0, cv.height / Hh, 0, 0); // idem : pas de bord à demi couvert
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
  if (dg > 0) { const g = ctx.createLinearGradient(0, B.y - 40, 0, ly + B.u * 2); g.addColorStop(0, rgba([255, 50, 90], 0.36 * dg)); g.addColorStop(1, 'rgba(255,50,90,0)'); ctx.fillStyle = g; ctx.fillRect(B.x, B.y - 36, B.w, ly + B.u * 2 - B.y + 36); }
  // visée
  if (!G.over) {
    const it = G.cur, ax = sx(F.clampX(it, aimX, G.inset)), ay = sy(F.DROP_Y), ready = G.cool <= 0;
    { // trajectoire prévue (visible aussi pendant qu'un astre tombe) : une verticale
      const tr = F.trace(G, aimX), n = tr.length; ctx.fillStyle = '#fff';
      for (let i = 2; i < n; i += 2) { ctx.globalAlpha = 0.5 * (1 - i / n) + 0.12; ctx.beginPath(); ctx.arc(sx(tr[i]), sy(tr[i + 1]), 1.8, 0, TAU); ctx.fill(); }
      if (n > 3) { ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(sx(tr[n - 2]), sy(tr[n - 1]), (it.k === 'c' ? F.TIERS[it.tier].r : F.R_SPECIAL) * B.u, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = ready ? 1 : 0.6; drawItem(it, ax, ay + (ready ? Math.sin(T * 2.6) * 2 : 0), ready ? 1 : 0.9); ctx.globalAlpha = 1;
    if (it.k === 'j' || it.k === 'b') { // astre spécial en main : halo + étiquette bien visibles ; la jauge se remplit pendant que les touches sont ignorées
      const jc = it.k === 'j' ? [190, 130, 255] : [255, 150, 70], lk = clamp((giftLock - T) / giftDur, 0, 1), r0 = B.u * 1.55; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gg = ctx.createRadialGradient(ax, ay, r0 * 0.3, ax, ay, r0 * 2.1); gg.addColorStop(0, rgba(jc, 0.45 + 0.15 * Math.sin(T * 6))); gg.addColorStop(1, rgba(jc, 0)); ctx.fillStyle = gg; ctx.fillRect(ax - r0 * 2.1, ay - r0 * 2.1, r0 * 4.2, r0 * 4.2); ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = rgba(jc, 0.9); ctx.beginPath(); ctx.arc(ax, ay, r0, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - lk)); ctx.stroke(); if (lk > 0) { ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ax, ay, r0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
      txt(it.k === 'j' ? 'MATIÈRE EXOTIQUE' : 'COMÈTE', ax, ay - r0 - 14, 10, rgba(jc, 1), 'center', 'Orbitron', 800); txt(it.k === 'j' ? 'copie l\'astre qu\'elle touche' : 'explose au contact', ax, ay - r0 - 2, 9, 'rgba(255,255,255,.75)', 'center', 'system-ui', 600); }
  }
  // astres
  for (const b of G.bodies) {
    const t0 = pops.get(b.id); let sc = 1;
    if (t0 != null) { const p = (T - t0) / 0.4; if (p >= 1) pops.delete(b.id); else sc = 1 + Math.sin(p * Math.PI * 2.2) * (1 - p) * 0.26 + (p < 0.15 ? (p / 0.15 - 1) * 0.4 : 0); }
    drawItem(b, sx(b.x), sy(b.y), sc, b.ang);
    if (G.shared && b.o != null) { ctx.strokeStyle = rgba(b.o ? MG : CY, 0.75); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), b.r * B.u * 1.04, 0, TAU); ctx.stroke(); } // couleur du joueur : cyan (créateur du salon) ou magenta
  }
  // aura des absorbeurs : jusqu'où ils avalent. Nette = prêt à avaler, discrète = en train de digérer. Les astres qui s'en approchent sont prévenus.
  for (const b of G.bodies) {
    const pw = F.absorbOf(b); if (!pw || pw[2] < 0.1) continue; const ready = !(b.et > 0), rc = b.tier === F.MAX_TIER ? RCOL[Math.min(5, b.v | 0)] : b.tier === 11 ? AM : b.tier === 7 ? [100, 170, 255] : [190, 110, 255];
    ctx.strokeStyle = rgba(rc, ready ? 0.4 + 0.18 * Math.sin(T * 4 + b.id) : 0.1); ctx.lineWidth = 1.5; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.arc(sx(b.x), sy(b.y), (b.r + pw[2]) * B.u, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const g of ghosts) { // Big Bang : les astres disparus tournent et fondent vers le point d'impact
    const p = clamp((T - g.t0) / 0.65, 0, 1), e = p * p * (3 - 2 * p), an = e * 2.2, dx = g.x0 - g.cx, dy = g.y0 - g.cy, c = Math.cos(an), sn = Math.sin(an), k = 1 - e;
    drawItem({ k: 'c', tier: g.tier, v: g.v, r: g.r }, g.cx + (dx * c - dy * sn) * k, g.cy + (dx * sn + dy * c) * k, Math.max(0.05, 1 - e * 0.9), e * 3);
  }
  const og = gh && !G.nop ? gh.G : G.duel && duel && duel.op ? duel.op.G : null;
  if (og) { ctx.lineWidth = 1.4; ctx.strokeStyle = G.duel ? 'rgba(255,170,90,.42)' : 'rgba(160,190,255,.34)'; ctx.beginPath(); for (const b of og.bodies) { const gx = sx(b.x), gy = sy(b.y), gr = b.r * B.u; ctx.moveTo(gx + gr, gy); ctx.arc(gx, gy, gr, 0, TAU); } ctx.stroke(); } // fantôme : contours des astres du rival
  // ligne de défaite, PAR-DESSUS les astres : la pile peut la dépasser (on ne perd que si un astre est entièrement au-dessus), elle doit rester visible
  if (!G.sandbox) {
  ctx.lineCap = 'round'; ctx.strokeStyle = dg > 0 ? rgba([255, 80, 110], 0.8 + 0.2 * Math.sin(T * 14)) : G.near ? rgba([255, 194, 71], 0.75 + 0.25 * Math.sin(T * 6)) : 'rgba(255,255,255,.55)';
  ctx.lineWidth = dg > 0 ? 3 : G.near ? 2.4 : 1.8; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(B.x + 6, ly); ctx.lineTo(B.x + B.w - 6, ly); ctx.stroke(); ctx.setLineDash([]); ctx.lineCap = 'butt';
  }
  // jauge de saut, sous la cuve
  const fy = B.y + B.h + 10, dp = clamp(G.drill / F.need(G.depth), 0, 1), gw = B.w - 8;
  if (!G.sandbox) {
  rr(B.x + 4, fy, gw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  if (dp > 0.01) { const hot = ctx.createLinearGradient(B.x, 0, B.x + B.w, 0); hot.addColorStop(0, '#4df3ff'); hot.addColorStop(0.6, '#ff4fd8'); hot.addColorStop(1, '#ffc247'); const gl = Math.max(8, gw * dp); if (!lowFx) { ctx.fillStyle = `rgba(255,79,216,${0.1 + 0.08 * dp})`; rr(B.x - 2, fy - 6, gl + 12, 20, 10); ctx.fill(); rr(B.x + 1, fy - 3, gl + 6, 14, 7); ctx.fill(); } rr(B.x + 4, fy, gl, 8, 4); ctx.fillStyle = hot; ctx.fill(); } // halo en deux voiles, sans shadowBlur (très coûteux sur mobile)
  }
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
  if (G.sandbox) { txt('BAC À SABLE', cx, ty + 4, 22, '#fff', 'center', 'Orbitron', 900); txt('AUCUN SCORE · AUCUNE RÉCOMPENSE', cx, ty + 22, 9.5, rgba(CY, 0.95), 'center', 'Orbitron', 700); }
  else {
  const sc = fmt(shown); // le score lumineux est dessiné dans une image, refaite seulement quand le nombre change
  if (sc !== hudKey || !hud) { hudKey = sc; if (!hud) hud = document.createElement('canvas'); hud.width = Math.ceil(W * DPR); hud.height = Math.ceil(64 * DPR); const hx = hud.getContext('2d'); hx.scale(DPR, DPR); hx.font = '900 32px Orbitron,system-ui,sans-serif'; hx.textAlign = 'center'; hx.shadowColor = 'rgba(77,243,255,.7)'; hx.shadowBlur = lowFx ? 0 : 16; hx.fillStyle = '#fff'; hx.fillText(sc, W / 2, 44); }
  ctx.drawImage(hud, 0, ty - 44, W, 64);
  if (!G.shared) txt(`SECTEUR ${G.depth + 1} · ${sectorName(G.depth).toUpperCase()}`, cx, ty + 20, 10.5, rgba(CY, 0.95), 'center', 'Orbitron', 700);
  if (G.blitz) blitzHud(cx, ty);
  else if (G.chal) { const left = Math.max(0, G.chal[2] - G.t), m = Math.floor(left / 60); txt(`DÉFI · ${m}:${String(Math.floor(left % 60)).padStart(2, '0')}`, cx, ty + 37, 13, left < 15 ? '#ff6a8a' : '#ffc247', 'center', 'Orbitron', 900); }
  else if (G.shared && duel) sharedHud(cx, ty);
  else if (G.duel && duel) txt(duel.phase === 'done' ? 'DUEL TERMINÉ' : 'DUEL · ' + fmtT(Math.max(0, duel.dur - G.n / 120)), cx, ty + 35, 11, AM, 'center', 'Orbitron', 900);
  else if (G.rep) txt('REDIFFUSION · ' + G.rep.run.name.toUpperCase(), cx, ty + 35, 9.5, AM, 'center', 'Orbitron', 700);
  else if (G.mod.n) txt(G.mod.n.toUpperCase(), cx, ty + 35, 9.5, rgba(MG, 1), 'center', 'Orbitron', 700);
  else if (sv.best) txt(G.score > sv.best ? 'NOUVEAU RECORD' : 'RECORD ' + fmt(sv.best), cx, ty + 35, 9.5, G.score > sv.best ? '#5dffc0' : 'rgba(255,255,255,.5)', 'center', 'Orbitron', 700);
  }
  if (G.duel && duel && duel.op) { const o = duel.op, os = o.final != null ? o.final : o.G.score, d = G.score - os; txt(`VS ${duel.oppName.toUpperCase()} · ${fmt(os)} · ${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}`, cx, ty + 52, 9.5, d >= 0 ? '#5dffc0' : '#ff6a8a', 'center', 'Orbitron', 700); }
  else if (!G.nop && !G.chal && !G.blitz && tut < 0) { // cible : le rival juste au-dessus de moi (vrai joueur du classement)
    if (gh) { const d = G.score - gh.G.score; txt(`FANTÔME ${gh.name.toUpperCase()} · ${fmt(gh.G.score)} · ${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))}`, cx, ty + 52, 9.5, d >= 0 ? '#5dffc0' : '#ff6a8a', 'center', 'Orbitron', 700); }
    else if (rv && !rvDone) txt(`CIBLE · ${rv.name.toUpperCase()} · encore ${fmt(rv.score - G.score)}`, cx, ty + 52, 9.5, '#ffc247', 'center', 'Orbitron', 700);
  }
  // barre du bas : réserve à gauche, suivants à droite
  if (!(G.sandbox || G.rep)) {
  const hr = holdR, by = hr.y;
  txt('RÉSERVE', hr.x + hr.w / 2, by - 6, 9, 'rgba(255,255,255,.6)', 'center', 'Orbitron', 700);
  glassBox(hr.x, by, hr.w, hr.h, 20, G.swapped ? 0.14 : 0.45);
  if (tut === 3) { ctx.strokeStyle = rgba(CY, 0.55 + 0.45 * Math.sin(T * 6)); ctx.lineWidth = 3; rr(hr.x - 4, by - 4, hr.w + 8, hr.h + 8, 24); ctx.stroke(); } // étape « réserve » : la boîte à toucher clignote
  if (G.hold) { ctx.globalAlpha = G.swapped ? 0.4 : 1; drawItem(G.hold, hr.x + hr.w / 2, by + hr.h / 2, 1, 0, miniU(G.hold)); ctx.globalAlpha = 1; } else txt('⇄', hr.x + hr.w / 2, by + hr.h / 2 + 8, 22, 'rgba(255,255,255,.3)', 'center', 'system-ui', 400);
  const nx = B.x + B.w; txt('SUIVANT', nx - 62, by - 6, 9, 'rgba(255,255,255,.6)', 'center', 'Orbitron', 700);
  glassBox(nx - 124, by, 124, hr.h, 20);
  const gp = clamp(1 - (T - giftT) * 2, 0, 1);
  drawItem(G.queue[0], nx - 84, by + hr.h / 2, 1 + gp * 0.5, 0, miniU(G.queue[0])); ctx.globalAlpha = 0.55; drawItem(G.queue[1], nx - 32, by + hr.h / 2, 0.7, 0, miniU(G.queue[1])); ctx.globalAlpha = 1;
  }
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
  if (hitstop > 0) hitstop -= dt; else if (!ended && !paused) { if (G.rep) driveReplay(dt); else if (G.duel) duelTick(dt); else { F.tick(G, slow > 0 ? dt * 0.3 : dt); if (gh) stepGhost(); } onEvents(); }
  if (slow > 0) slow -= dt;
  if (warp > 0) { const w0 = warp; warp = Math.max(0, warp - dt / 1.8); if (w0 > 1 - BANG && warp <= 1 - BANG) bang(); }
  if (G.danger > 0 && !ended && !paused && T - beatT > 0.62 - 0.3 * G.danger) { beatT = T; A.chestBeat(G.danger); H.vib(6); } // le cœur s'emballe près de la ligne
  shake *= Math.exp(-dt * 9); flash *= Math.exp(-dt * 7);
  shown += (G.score - shown) * Math.min(1, dt * 10); if (G.score - shown < 1) shown = G.score;
  for (const p of parts) { p.l += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; }
  for (const r of rings) r.l += dt; for (const l of labels) l.l += dt;
  parts = parts.filter((p) => p.l < p.m); rings = rings.filter((r) => r.l < r.m); labels = labels.filter((l) => l.l < 0.9);
  if (rv && !rvDone && !ended && G.score > rv.score) { rvDone = true; say('RIVAL DÉPASSÉ', rv.name.toUpperCase(), AM); ring(W / 2, B.y + B.h * 0.4, 8, W * 0.7, 0.8, AM, 6); A.win(); H.vib([20, 30, 20]); }
  if (callout && (callout.l += dt) > 1.2) callout = null;
  if (reveal && (reveal.l += dt) > reveal.d) reveal = null;
  if (ghosts.length) ghosts = ghosts.filter((g) => T - g.t0 < 0.65);
  if (!G.nop && !ended && !paused && !document.hidden) { sv.time += dt; tAcc += dt; if (tAcc >= 10) { tAcc = 0; save(); H.time(sv.time); } } // temps de jeu : seulement quand on joue vraiment (ni pause, ni écran de fin, ni arrière-plan)
  if (tut >= 0) tutorial();
  if (G.chal && !ended) { // défi du jour : objectif atteint avant la fin du chrono ?
    const c = G.chal, val = c[0] === 'tier' ? G.maxTier : c[0] === 'chain' ? G.maxChain : c[0] === 'depth' ? G.depth : G.score;
    if (val >= c[1]) { G.won = true; endRun(); } else if (G.t >= c[2]) endRun();
  }
  aimX += (aimT - aimX) * Math.min(1, dt * 26); // l'astre suit le doigt en douceur
  if (G.cur !== lastCur) { lastCur = G.cur; if (G.cur && (G.cur.k === 'j' || G.cur.k === 'b') && !G.rep && !G.nop && tut < 0) { giftDur = G.cur.k === 'j' ? 1.3 : 0.8; giftLock = T + giftDur; H.vib([10, 30, 10]); } }
  if (want && T < giftLock) want = false; // touches de réflexe ignorées pendant le verrou
  const turnOk = !G.shared || (duel && duel.phase === 'play' && G.shared.turn === duel.my && G.shared.sim <= 0); // duel de cuve : seulement à mon tour, une fois les astres posés
  if (want && G.cool <= 0 && !ended && !paused) { want = false; if (!(G.duel && duel.phase !== 'play') && turnOk && F.drop(G, aimT)) { aimX = aimT; A.release(); H.vib(6); saveRun(); if (G.duel) dsendDrop(); } } if (G.duel && (duel.phase !== 'play' || !turnOk)) want = false; // un relâché pendant le temps de recharge est mémorisé
}
function driveReplay(dt) { // rejoue le journal pas à pas, à la vitesse choisie ; les lâchers tombent exactement au pas où ils ont eu lieu
  const R = G.rep; if (R.done) return;
  R.acc = Math.min(R.acc + dt * 120 * R.speed, 240);
  while (R.acc >= 1 && !R.done) {
    R.acc--;
    if (R.i < R.log.length && G.n >= R.log[R.i]) { const x = R.log[R.i + 1]; if (x < 0) F.act(G, x); else { aimT = aimX = x / 1000; if (F.drop(G, x / 1000)) A.release(); } R.i += 2; }
    else if (G.n < R.steps && !G.over) F.step(G); else R.done = true;
  }
  if (R.done) $('#mn-rpp').textContent = '↻';
}
export function openReplay(run) { // revoir la meilleure partie d'un joueur : même graine, mêmes lâchers, vitesse réglable
  open(true); newRun(run.seed, true, { rep: true }); G.rep = { log: run.log, steps: run.steps || 0, i: 0, acc: 0, speed: 2, done: false, run };
  $('#mn-rp').style.top = holdR.y - 4 + 'px'; rpSpeed(2); say('REDIFFUSION', run.name.toUpperCase(), CY);
}
const rpSpeed = (v) => { G.rep.speed = v; $('#mn-rpp').textContent = '❚❚'; document.querySelectorAll('#mn-rp [data-s]').forEach((b) => b.classList.toggle('on', +b.dataset.s === v)); };
function sharedHud(cx, ty) { // à qui de jouer, temps restant, couleurs des joueurs
  const d = duel, S = G.shared, nm = d.names || ['', ''], mine = S.turn === d.my, col = (i) => (i ? MG : CY);
  txt(nm[0].toUpperCase().slice(0, 10), B.x + 8, ty + 20, 10, rgba(CY, 1), 'left', 'Orbitron', 800); txt(nm[1].toUpperCase().slice(0, 10), B.x + B.w - 8, ty + 20, 10, rgba(MG, 1), 'right', 'Orbitron', 800);
  if (d.phase === 'done') return txt('DUEL TERMINÉ', cx, ty + 38, 12, AM, 'center', 'Orbitron', 900);
  if (S.sim > 0) txt('LES ASTRES SE POSENT…', cx, ty + 38, 10.5, 'rgba(255,255,255,.55)', 'center', 'Orbitron', 700);
  else { const left = Math.max(0, d.tleft), low = left < 3; txt(mine ? 'À TOI · ' + Math.ceil(left) + ' s' : 'AU TOUR DE ' + (nm[S.turn] || '').toUpperCase().slice(0, 10), cx, ty + 38, 12.5, mine ? (low ? '#ff6a8a' : '#5dffc0') : rgba(col(S.turn), 1), 'center', 'Orbitron', 900); }
  const x0 = B.x + 8, w = B.w - 16, y0 = ty + 46, k = S.sim > 0 ? 1 - S.sim / F.SHARED.steps : clamp(d.tleft / F.SHARED.turn, 0, 1); ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(x0, y0, w, 6, 3); ctx.fill(); if (k > 0.01) { ctx.fillStyle = S.sim > 0 ? 'rgba(255,255,255,.4)' : rgba(col(S.turn), 0.9); rr(x0, y0, Math.max(6, w * k), 6, 3); ctx.fill(); }
}
function blitzHud(cx, ty) { // chrono (barre + secondes) et tempo
  const b = G.blitz, left = b.left, low = b.started && left < 3, pulse = low ? 0.5 + 0.5 * Math.sin(T * 14) : 0;
  txt(b.started ? left.toFixed(1) + ' s' : 'LÂCHE POUR LANCER', cx, ty + 38, b.started ? 17 : 11, low ? `rgb(255,${(106 + pulse * 90) | 0},138)` : '#fff', 'center', 'Orbitron', 900);
  const x0 = B.x + 8, w = B.w - 16, y0 = ty + 46, k = clamp(left / F.BLITZ.max, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; rr(x0, y0, w, 7, 3.5); ctx.fill();
  if (k > 0.01) { const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, low ? '#ff6a8a' : rgba(CY, 1)); g.addColorStop(1, low ? '#ffb347' : rgba(MG, 1)); ctx.fillStyle = g; rr(x0, y0, Math.max(7, w * k), 7, 3.5); ctx.fill(); }
  if (b.mult > 1 || b.combo > 0) { txt('TEMPO ×' + b.mult, B.x + B.w - 8, ty + 38, 12 + (b.mult > 1 ? 1 : 0), AM, 'right', 'Orbitron', 900); for (let i = 0; i < 3; i++) { ctx.fillStyle = i < b.combo % 3 ? rgba(AM, 1) : 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(B.x + B.w - 12 - (2 - i) * 11, ty + 54, 3, 0, TAU); ctx.fill(); } }
}
function bang() { // milieu du saut : le nouveau secteur naît
  const m = warpMsg || ['', '', 0], cx = W / 2, cy = B.y + B.h * 0.5;
  flash = 0.95; flashC = [255, 255, 255]; shake = 24; hitstop = 0.08;
  [CY, MG, AM].forEach((c, k) => ring(cx, cy, 8, Math.max(W, Hh) * (0.55 + k * 0.25), 0.8 + k * 0.2, c, 10 - k * 3));
  burst(cx, cy, 70, [220, 240, 255], B.u * 18, 1.1, 3.5); say(m[0], m[1], CY);
  A.rumble(); A.mult(Math.min(8, m[2])); H.vib([30, 40, 70]);
}
const land = window.matchMedia('(orientation: landscape) and (max-height: 520px)');
function frame(now) {
  raf = 0; if (!isOpen) return; FN++;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!land.matches) { update(dt); draw(); } // en paysage (téléphone) le jeu se fige derrière la consigne « tourne ton téléphone »
  raf = requestAnimationFrame(frame);
}

/* ============================== entrées ============================== */
const pt = (e) => ({ x: e.clientX, y: e.clientY }); // le canvas couvre tout l'écran
const inZone = (p) => p.x > B.x - 18 && p.x < B.x + B.w + 18 && p.y > B.y - 60 && p.y < B.y + B.h + 20; // la cuve, avec une petite marge
function onDown(e) { // appuie dans la cuve (même pendant qu'un astre tombe), glisse, relâche ; sortir de la cuve annule
  if (!G || G.over || G.rep) return; if (reveal) { if (reveal.l > 1.6) { reveal.l = reveal.d; slow = 0; } return; } const p = pt(e);
  if (!G.sandbox && p.y > holdR.y - 14 && p.x < holdR.x + holdR.w + 14) { if (!(G.duel && duel.phase !== 'play') && F.swapHold(G)) { A.select(); H.vib(8); if (!G.nop) H.goal('hold'); if (G.duel) dsendDrop(); } return; }
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
#mn-tut{position:absolute;left:18px;right:18px;top:calc(env(safe-area-inset-top,0px) + 112px);padding:12px 16px 14px;border-radius:24px;display:none;pointer-events:none;z-index:2}#mn.tut #mn-tut{display:block;animation:fade .3s}
#mn-tut p{margin:8px 0 0;text-align:center;font-size:15px;font-weight:600;line-height:1.4}.tut-h{display:flex;align-items:center;gap:10px}.tut-h span{font:800 11px Orbitron,system-ui,sans-serif;color:#4df3ff;letter-spacing:.1em}.tut-h em{flex:1;display:flex;gap:5px}.tut-h i{flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.18);transition:background .3s}.tut-h i.ok{background:#5dffc0}.tut-h i.on{background:linear-gradient(90deg,#4df3ff,#ff4fd8)}
#mn-tutx{pointer-events:auto;height:30px;padding:0 12px;border-radius:15px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:rgba(255,255,255,.8);font:600 12px system-ui,sans-serif}
#mn-fg{position:absolute;left:0;top:0;width:0;height:0;display:none;pointer-events:none;z-index:2;transition:opacity .25s}#mn.tut #mn-fg{display:block}
#mn-fg i{position:absolute;left:-24px;top:-24px;width:48px;height:48px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.55),rgba(255,255,255,.15));border:2px solid rgba(255,255,255,.9);box-shadow:0 0 22px rgba(77,243,255,.8);animation:fgt 1.5s ease-in-out infinite}
#mn-fg.drag i{animation:fgd 2.4s ease-in-out infinite}@keyframes fgt{0%,100%{transform:scale(.85);opacity:.7}50%{transform:scale(1.1);opacity:1}}@keyframes fgd{0%,100%{transform:translateX(-58px) scale(.9)}50%{transform:translateX(58px) scale(1.05)}}
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
#mn-cxd{min-height:34px;font-size:12.5px;line-height:1.4;color:rgba(255,255,255,.85);text-align:center}
#mn-sb{position:absolute;left:12px;right:12px;display:none;gap:8px;align-items:center}#mn.sbx #mn-sb{display:flex}#mn-sbl{flex:1;display:flex;gap:6px;overflow-x:auto;padding:4px 2px;scrollbar-width:none}#mn-sbl::-webkit-scrollbar{display:none}
#mn-sbl button{flex:none;width:54px;height:54px;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);display:grid;place-items:center;padding:0}#mn-sbl button.on{border-color:#4df3ff;background:rgba(77,243,255,.16);box-shadow:0 0 14px rgba(77,243,255,.4)}#mn-sbc{flex:none;height:54px;padding:0 14px;border-radius:18px;color:#fff;font:700 12px Orbitron,system-ui,sans-serif;border:1px solid rgba(255,255,255,.14)}
#mn-rp{position:absolute;left:12px;right:12px;display:none;align-items:center;gap:8px;justify-content:center}#mn.rpl #mn-rp{display:flex}#mn-rpn{display:none;flex:1;font:700 12px Orbitron,system-ui,sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mn-rp button{height:44px;min-width:44px;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;font:700 12px Orbitron,system-ui,sans-serif}#mn-rp div{display:flex;gap:6px}#mn-rp div button.on{border-color:#4df3ff;background:rgba(77,243,255,.18)}
#dl-code{font:900 44px Orbitron,system-ui,sans-serif;letter-spacing:.16em;text-align:center;min-height:0;color:#4df3ff}#dl-code:empty{display:none}#dl-in{width:100%;height:52px;border-radius:18px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#fff;font:700 20px Orbitron,system-ui,sans-serif;text-align:center;letter-spacing:.2em;text-transform:uppercase;outline:none;user-select:text;-webkit-user-select:text}
#mn-m-duel:not([data-s=menu]) #dl-sh,#mn-m-duel:not([data-s=menu]) #dl-in,#mn-m-duel:not([data-s=menu]) #dl-join,#mn-m-duel[data-s=wait] #dl-new,#mn-m-duel[data-s=end] #dl-code{display:none}#mn-m-duel[data-s=end] #dl-new{display:block}
#mn-xp{width:100%;display:flex;flex-direction:column;gap:5px}#mn-xp span{font:800 11px Orbitron,system-ui,sans-serif;letter-spacing:.1em;color:#fff}#mn-xp i{display:block;height:8px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden}#mn-xp b{display:block;height:100%;border-radius:4px;box-shadow:0 0 12px currentColor}#mn-xp small{font-size:12px;color:rgba(255,255,255,.7)}
#mn-ht{font-size:13px;color:rgba(255,255,255,.7);text-align:center;margin:0}#mn-lad{display:flex;flex-wrap:wrap;gap:2px;justify-content:center;margin:6px 0 4px}#mn-lad canvas{opacity:.92}
`;
const HTML = `
<div id="mn"><canvas id="mn-cv"></canvas>
<button class="icon glass" id="mn-back" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button>
<button class="icon glass" id="mn-help" aria-label="Règles"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></svg></button><div class="glass" id="mn-tut"></div><div id="mn-fg"><i></i></div><div id="mn-rp"><button class="glass" id="mn-rpp">❚❚</button><span id="mn-rpn"></span><div><button data-s="1">×1</button><button data-s="2">×2</button><button data-s="4">×4</button><button data-s="8">×8</button><button data-s="16">×16</button></div></div><div id="mn-sb"><div id="mn-sbl"></div><button class="glass" id="mn-sbc">Vider</button></div></div>
<div class="modal" id="mn-m-over"><div class="card glass"><h2 id="mn-ot">Effondrement</h2><p id="mn-os"></p><div id="mn-xp"></div>
<div class="stats"><div id="mn-c1"><b id="mn-o1">0</b><span>points</span></div><div id="mn-c2"><b id="mn-o2">0</b><span>secteur</span></div><div id="mn-c3"><b id="mn-o3">0</b><span>chaîne max</span></div><div id="mn-c4"><b id="mn-o4" style="font-size:15px">–</b><span>plus gros astre</span></div></div>
<p id="mn-rk"></p><div class="fg-q" id="mn-q"></div>
<div class="btns"><button class="big primary" id="mn-again">Rejouer</button><button class="big glass" id="mn-rkb">Classement mondial</button><button class="big glass" id="mn-share" hidden>Partager mon score</button><button class="big glass" id="mn-menu">Menu</button></div></div></div>
<div class="modal" id="mn-m-help"><div class="card glass"><h2>Pause</h2><p class="sub" id="mn-ht">Deux astres identiques qui se touchent fusionnent.</p><div id="mn-lad"></div><div class="btns"><button class="big glass" id="mn-cxb">Codex des astres</button><button class="big glass danger" id="mn-quit">Abandonner la partie</button><button class="big primary" id="mn-hok">C'est parti</button></div></div></div>`;
const HTML2 = `<div class="modal" id="mn-m-duel"><div class="card glass"><h2 id="dl-t">Duel 1v1</h2><p id="dl-s"></p><div id="dl-code"></div><input id="dl-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="CODE"><div class="btns"><button class="big primary" id="dl-new">Créer un salon</button><button class="big primary" id="dl-sh">Duel de cuve · classé Elo</button><button class="big glass" id="dl-join">Rejoindre avec le code</button><button class="big glass" id="dl-x">Fermer</button></div></div></div>
<div class="modal" id="mn-m-themes"><div class="card glass"><h2>Thèmes</h2><p id="mn-ths"></p><div id="mn-th"></div><div class="btns"><button class="big primary" id="mn-thok">Fermer</button></div></div></div><div class="modal" id="mn-m-codex"><div class="card glass"><h2>Codex</h2><p id="mn-cxs"></p><div id="mn-cx"></div><p id="mn-cxd"></p><button class="big glass" id="mn-cxe" hidden></button><div class="btns"><button class="big primary" id="mn-cxok">Fermer</button></div></div></div>`;
// Toutes les entrées du codex, découvertes ou non. key = identifiant public (« rang » ou « rang:variante »), le même que celui des profils.
const entries = () => [
  ...BODIES.slice(0, F.MAX_TIER).map((b, i) => ({ key: String(i), name: b[0], tier: i, v: 0, ok: !!sv.cx[i], sub: '', info: powerText(i, 0) })),
  ...GAL.map((g, v) => ({ key: F.MAX_TIER + ':' + v, name: g.n, tier: F.MAX_TIER, v, p: F.GALAXY[v], ok: !!sv.cx[F.MAX_TIER + ':' + v], sub: odds(F.GALAXY[v]), info: powerText(F.MAX_TIER, v) })),
  ...Object.keys(VAR).flatMap((t) => Object.keys(VAR[t]).map(Number).sort().map((v) => ({ key: t + ':' + v, name: VAR[t][v][0], tier: +t, v, p: vOdds(+t, v) || undefined, ok: !!sv.cx[t + ':' + v], sub: v === 9 ? 'Fusion' : vOdds(+t, v) ? odds(vOdds(+t, v)) : 'Pack · ' + RAR[CAT[t][v].r], r: catR(+t, v), info: powerText(+t, v) }))),
  ...Object.keys(SECRETS).map((id) => ({ key: id, name: SECRETS[id][0], tier: -1, v: 0, ok: !!sv.cx[id], sub: SECRETS[id][1], info: '' })),
];
const parseKey = (k) => { const m = /^(\d{1,2})(?::(\d))?$/.exec(String(k)); return m && +m[1] <= F.MAX_TIER ? { tier: +m[1], v: +(m[2] || 0) } : null; };
export const codexN = () => entries().filter((e) => e.ok).length;
export const playtime = () => Math.floor(sv.time);
export const themeName = (id) => (THEMES.find((t) => t.id === id) || { n: id }).n;
export const localStats = () => ({ score: sv.best || null, sector: sv.depth || null, tier: sv.tier ? sv.tier - 1 : null, playtime: Math.floor(sv.time) }); // pour le profil quand le serveur ne répond pas
export const tierName = (t) => (t === F.MAX_TIER ? 'Galaxie' : (BODIES[t] || ['?'])[0]);
// Astres que le joueur peut exposer sur son profil (découverts, hors secrets), du plus rare au plus courant
export const astres = () => entries().filter((e) => e.ok && e.tier >= 0).map((e) => ({ ...e, r: e.p ? -Math.log(e.p) : e.tier / 20 })).sort((a, b) => b.r - a.r);
export function astreInfo(key) { // nom, rareté (-1 = courant) et couleur d'un astre, pour l'affichage d'un profil
  const k = parseKey(key); if (!k) return null;
  const p = k.tier === F.MAX_TIER ? F.GALAXY[k.v] : k.v ? vOdds(k.tier, k.v) : 0, rar = k.v || k.tier === F.MAX_TIER ? catR(k.tier, k.v) : -1;
  return { name: k.tier === F.MAX_TIER ? GAL[k.v].n : nameOf(k.tier, k.v), rar, col: rar >= 0 ? RCOL[rar] : [160, 185, 225], sub: p ? odds(p) : k.v === 9 ? 'Fusion' : k.v ? 'Pack · ' + RAR[Math.max(0, rar)] : '' };
}
// Dessine un astre dans une vignette carrée de px pixels (profil, classement). live : astre animé, à repeindre régulièrement.
export function paintAstre(c, key, px, live) {
  const k = parseKey(key); if (!k) return;
  const d = Math.min(window.devicePixelRatio || 1, 2); c.width = c.height = Math.round(px * d); c.style.width = c.style.height = px + 'px';
  const keep = ctx, t0 = T; ctx = c.getContext('2d'); ctx.scale(d, d); if (live) { T = performance.now() / 1000; FN += 2; }
  drawItem({ k: 'c', tier: k.tier, v: k.v, ns: true }, px / 2, px / 2, 1, 0, Math.min(B.u, px * 0.36 / F.TIERS[k.tier].r)); // jamais plus grand que le sprite : pas de flou
  ctx = keep; T = t0;
}
function showCodex() {
  const g = $('#mn-cx'); g.innerHTML = ''; const all = entries(); let n = 0;
  for (const e of all) {
    const d = document.createElement('div'); d.className = 'cx' + (e.ok ? ' ok' : ''); if (e.ok) n++;
    if (e.ok && e.tier >= 0) { const c = document.createElement('canvas'); paintAstre(c, e.key, 64); d.append(c); }
    else d.insertAdjacentHTML('beforeend', `<i>${e.ok ? '★' : '?'}</i>`);
    d.insertAdjacentHTML('beforeend', `<b>${e.ok ? e.name : '???'}</b>` + (e.sub ? `<small>${e.sub}</small>` : '')); g.append(d);
    d.addEventListener('click', () => {
      $('#mn-cxd').textContent = e.ok ? `${e.name}${e.sub && e.tier >= 0 ? ' · ' + e.sub : ''}. ${e.info || (e.tier < 0 ? e.sub : 'Aucun pouvoir particulier.')}` : 'Pas encore découvert.';
      if (e.ok && e.tier >= 0) viewCard(e.key); // un clic = la carte immersive (le pouvoir et l'équipement restent sous la grille)
      const pb = e.ok && e.tier >= 0 && e.tier < F.MAX_TIER && e.v === 1 && F.RARE[e.tier]; // variante à pouvoir : équipable comme pouvoir
      if (pb) { const b = $('#mn-cxe'), on = hasPower(e.tier); b.hidden = false; b.textContent = on ? 'Retirer ce pouvoir' : 'Équiper ce pouvoir'; b.onclick = () => { equipPower(e.tier, !on); showCodex(); $('#mn-cxd').textContent = on ? 'Pouvoir retiré.' : `${e.name} équipé : chaque fusion de ce rang donnera cet astre et son pouvoir (sans le bonus de points d'un tirage rare). Pas actif en duel, défi du jour ni bac à sable.`; }; return; }
      const b = $('#mn-cxe'); b.hidden = !(e.ok && e.tier >= 0 && equipable(e.tier, e.v)); if (!b.hidden) { const on = sv.skin[e.tier] === e.v; b.textContent = on ? 'Retirer cette apparence' : 'Équiper cette apparence'; b.onclick = () => { equip(e.tier, on ? 0 : e.v); showCodex(); $('#mn-cxd').textContent = on ? 'Apparence d\'origine rétablie.' : `${e.name} équipé : tous les astres de ce rang l'afficheront.`; }; }
    });
  }
  $('#mn-cxd').textContent = 'Touche un astre pour voir son pouvoir.'; $('#mn-cxe').hidden = true;
  $('#mn-cxs').textContent = `${n}/${all.length} découvertes. Les variantes rares triplent les points et rapportent des Éclats.`;
  $('#mn-m-codex').classList.add('on');
}
export function grant(n, label = '') { if (n > 0) { sv.dust += n; save(); H.toast(`+${fmt(n)} Éclats${label ? ' · ' + label : ''}`); H.refresh(); } } // poussière d'étoile : la monnaie des thèmes
/* ============================== niveaux, expérience, fusion de collection ============================== */
const LV_COL = [[77, 243, 255], [93, 255, 192], [180, 255, 90], [255, 226, 90], [255, 160, 60], [255, 96, 96], [255, 79, 216], [170, 110, 255], [255, 255, 255]]; // la fissure du débris change de couleur tous les 5 niveaux
const xpNeed = (l) => 100 + 40 * (l - 1); // expérience pour passer du niveau l au suivant
function levelOf(xp) { let l = 1; while (xp >= xpNeed(l)) { xp -= xpNeed(l); l++; } return { level: l, cur: xp, need: xpNeed(l) }; }
const colIdx = () => Math.min(LV_COL.length - 1, Math.floor((levelOf(sv.xp).level - 1) / 5));
const lvCol = () => LV_COL[colIdx()];
function lvStyle() { return colIdx(); }
export const levelInfo = () => { const L = levelOf(sv.xp); return { ...L, pct: L.cur / L.need, col: LV_COL[colIdx()], next: colIdx() < LV_COL.length - 1 ? (colIdx() + 1) * 5 + 1 : 0 }; };
function addXp(n, force) { // aucune expérience dans le bac à sable, les rediffusions ni les duels (sauf récompense de défi : force)
  if (!(n > 0) || (G && G.nop && !force)) return; const before = levelOf(sv.xp).level; sv.xp += Math.round(n); if (G) G.xpGain = (G.xpGain || 0) + Math.round(n);
  const now = levelOf(sv.xp).level; for (let l = before + 1; l <= now; l++) { grant(100 + 50 * l, 'Niveau ' + l); if (l % 5 === 0) { sv.pk.nebuleuse = (sv.pk.nebuleuse | 0) + 1; H.toast(`Niveau ${l} : un Pack Nébuleuse offert !`); } if (isOpen && G && !ended) { say('NIVEAU ' + l, '+' + fmt(100 + 50 * l) + ' ÉCLATS', LV_COL[colIdx()]); A.win(); H.vib([20, 40, 20]); } }
  save(); H.refresh(); H.goal('xp');
}
export const giveXp = (n) => addXp(n, true);
/* ============================== packs d'astres ============================== */
export const packInfo = () => ({ stock: { ...sv.pk }, pity: sv.pity, free: sv.pkDay !== H.today(), dust: sv.dust });
export function packAdd(id, n = 1) { if (!PACKS[id] || !(n > 0)) return; sv.pk[id] = (sv.pk[id] | 0) + Math.round(n); save(); H.refresh(); }
export function packFree() { if (sv.pkDay === H.today()) return false; sv.pkDay = H.today(); packAdd('etoile', 1); return true; }
// Ouvre un pack : prend un exemplaire en stock, sinon paie en Éclats. Le tirage est appliqué tout de suite (rien ne se perd si on quitte en route).
// preview : aperçu administrateur (rareté forcée), n'enregistre rien.
export function packOpen(id, preview = false, force = null) {
  const pk = PACKS[id]; if (!pk) return null;
  if (!preview) { if ((sv.pk[id] | 0) > 0) sv.pk[id]--; else if (sv.dust >= pk.cost) sv.dust -= pk.cost; else return null; }
  const res = drawPack(id, preview ? {} : sv.pity[id] || {}, undefined, force);
  res.cards = res.cards.map((c) => ({ ...c, n: astreInfo(c.key).name, isNew: !sv.cx[c.key] }));
  if (!preview) {
    sv.pity[id] = res.pity; sv.pkN++;
    for (const c of res.cards) { sv.inv[c.key] = (sv.inv[c.key] | 0) + 1; sv.cx[c.key] = 1; }
    addXp(8 + 6 * res.cards.filter((c) => c.isNew).length, true); save(); H.refresh(); H.goal('pack', { best: res.tell.best });
  }
  return res;
}
export const adminLocal = { // outils de l'administrateur, sur cet appareil seulement
  eclats: (n) => grant(n, 'Admin'), xp: (n) => addXp(n || 1000, true),
  packs: (n) => { for (const id of Object.keys(PACKS)) packAdd(id, n); },
  unlock: () => { for (const e of entries()) if (e.tier >= 0) { sv.cx[e.key] = 1; if (e.v >= 1 && e.v < 9 && e.tier < F.MAX_TIER) sv.inv[e.key] = Math.max(sv.inv[e.key] | 0, 10); } save(); H.refresh(); },
};
const FORGE_COPIES = (t) => (t <= 5 ? 6 : t <= 8 ? 4 : 3); // exemplaires de variantes d'un rang à réunir pour fabriquer son prismatique
const copiesOf = (t) => Object.keys(VAR[t]).map(Number).filter((v) => v < 9).reduce((a, v) => a + (sv.inv[t + ':' + v] | 0), 0);
export const forgeInfo = () => Object.keys(VAR).map((t) => ({ tier: +t, name: BODIES[t][0], key: t + ':9', copies: copiesOf(t), need: FORGE_COPIES(+t), own: !!sv.inv[t + ':9'], equipped: sv.skin[t] === 9 }));
export function forge(t) { // consomme d'abord les variantes les plus courantes, jamais le prismatique ; renvoie la clé obtenue
  const i = forgeInfo().find((f) => f.tier === +t); if (!i || i.own || i.copies < i.need) return null;
  let need = i.need; for (const v of Object.keys(VAR[t]).map(Number).filter((v) => v < 9).sort((a, b) => b - a)) { const k = t + ':' + v, n = Math.min(need, sv.inv[k] | 0); if (n) { sv.inv[k] -= n; need -= n; } }
  sv.inv[t + ':9'] = 1; sv.cx[t + ':9'] = 1; sv.skin[t] = 9; sprites.clear(); addXp(60, true); save(); H.refresh(); H.goal('forge'); return t + ':9';
}
export const hasPower = (t) => !!(sv.power && sv.power[t]);
export function equipPower(t, on) { sv.power = sv.power || {}; if (on && sv.cx[t + ':1']) sv.power[t] = 1; else delete sv.power[t]; save(); H.refresh(); } // pouvoir : la variante rare de ce rang à chaque fusion (hors duel, défi du jour, bac à sable)
export function equip(t, v) { if (v && sv.cx[t + ':' + v]) sv.skin[t] = v; else delete sv.skin[t]; sprites.clear(); save(); H.refresh(); } // v : 0 = apparence d'origine
export const dust = () => sv.dust;
export const themeStat = () => [Object.keys(sv.themes).length, THEMES.length];
// Récompense de mission : un thème offert ; si on le possède déjà, la moitié de son prix en poussière d'étoile
export function giveTheme(id) {
  const t = THEMES.find((x) => x.id === id); if (!t) return '';
  if (!sv.themes[id]) { sv.themes[id] = 1; save(); H.refresh(); return `Thème « ${t.n} » débloqué`; }
  const back = Math.round(t.cost / 2); grant(back, 'Thème déjà possédé'); return `Thème déjà possédé : +${fmt(back)} Éclats`;
}
const todayChal = () => CHAL[hash('critical:defi:' + H.today()) % CHAL.length];
export const daily = () => ({ txt: todayChal()[3], done: sv.daily.day === H.today() && sv.daily.done });
const bacOk = (e) => e.tier >= 0 && (e.ok || (!e.v && e.tier <= 4)); // les astres de base, plus tout ce qui est dans le codex
export function openSandbox() { // tous les astres débloqués en illimité ; ni mort, ni score, ni déblocage
  open(true); newRun(hash('bac:' + Date.now()), true, { sandbox: true }); G.cur = { k: 'c', tier: 0, v: 0 };
  const l = $('#mn-sbl'); l.textContent = ''; $('#mn-sb').style.top = holdR.y - 8 + 'px';
  entries().filter(bacOk).sort((a, b) => a.tier - b.tier || a.v - b.v).forEach((e, i) => {
    const b = document.createElement('button'), c = document.createElement('canvas'); b.title = e.name; paintAstre(c, e.key, 44); b.append(c); if (!i) b.className = 'on';
    b.onclick = () => { G.cur = { k: 'c', tier: e.tier, v: e.v }; l.querySelectorAll('.on').forEach((o) => o.classList.remove('on')); b.classList.add('on'); A.select(); H.vib(6); };
    l.append(b);
  });
  say('BAC À SABLE', 'TOUT EN ILLIMITÉ', CY);
}
export function openBlitz() { // cuve resserrée, chrono, tempo : même moteur, autre rythme
  open(true); blitzMult = 1; newRun((Math.random() * 2 ** 32) >>> 0, true, { blitz: true }); say('BLITZ', 'LÂCHE VITE · LE TEMPS FILE', MG);
}
export function openDaily() { // même tirage pour tout le monde ; on peut retenter, la récompense tombe une fois par jour
  open(true); const d = H.today(); newRun(hash('critical:defi:seed:' + d), true, { daily: true }); G.chal = todayChal(); G.day = d; say('DÉFI DU JOUR', G.chal[3].toUpperCase(), AM);
}
function share() {
  const t = `Critical — défi du jour réussi avec ${sv.daily.best.toLocaleString('fr-FR')} s d'avance : « ${todayChal()[3]} ». À toi !`;
  if (navigator.share) navigator.share({ text: t }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => H.toast('Résultat copié'), () => {});
}
export function openThemes() {
  const g = $('#mn-th'); g.innerHTML = ''; $('#mn-ths').textContent = `Tu as ${fmt(sv.dust)} Éclats. Ils se gagnent en jouant, avec les missions, le défi du jour et le temps de jeu.`;
  for (const t of THEMES) {
    const own = !!sv.themes[t.id], b = document.createElement('button'); b.className = 'th' + (sv.theme === t.id ? ' on' : own ? '' : ' lock');
    b.append(makeTex(1, t, 160, 84)); b.insertAdjacentHTML('beforeend', `<b>${t.n}</b><small>${sv.theme === t.id ? 'Équipé' : own ? 'Équiper' : fmt(t.cost) + ' Éclats'}</small>`);
    b.addEventListener('click', () => {
      if (!own) { if (sv.dust < t.cost) return H.toast(`Il te manque ${fmt(t.cost - sv.dust)} Éclats`); sv.dust -= t.cost; sv.themes[t.id] = 1; A.rare(2); H.vib([20, 40, 40]); }
      sv.theme = t.id; save(); H.refresh(); if (G && W) texB = makeTex(G.depth); openThemes();
    });
    g.append(b);
  }
  $('#mn-m-themes').classList.add('on');
}
// Première partie guidée : chaque étape attend que le joueur fasse le geste demandé.
function tutEnd(win) {
  tut = -1; tutShown = -1; sv.tut = 1; save(); $('#mn').classList.remove('tut');
  if (win) { grant(500, 'Cadeau de bienvenue'); say('BIEN JOUÉ !', '+500 ÉCLATS OFFERTS', AM); A.win(); H.vib([20, 40, 20]); } else H.toast('Tu peux jouer librement');
}
function tutorial() {
  const orb = () => ({ k: 'c', tier: 1 });
  if (tut <= 2) { G.cur = orb(); G.queue = [orb(), orb()]; } // tirage imposé : des orbes, pour que les fusions soient certaines
  const done = [G.drops >= 1, G.fusions >= 1, G.fusions >= 3, !!G.hold, !$('#rk-ask').classList.contains('on')][tut];
  if (done) { tut++; if (tut < 5) { A.star(2); H.vib(10); } if (tut === 4) { if (H.online() && !H.named()) H.askName(); else tut = 5; } }
  if (tut >= 5) return tutEnd(true);
  if (tutShown !== tut) { // nouvelle étape : carte, indicateur, doigt animé
    tutShown = tut; $('#mn-tut').innerHTML = `<div class="tut-h"><span>${tut + 1}/5</span><em>${[0, 1, 2, 3, 4].map((i) => `<i class="${i < tut ? 'ok' : i === tut ? 'on' : ''}"></i>`).join('')}</em><button id="mn-tutx">Passer</button></div><p>${TUT[tut]}</p>`;
    $('#mn-fg').className = tut === 0 ? 'drag' : '';
    $('#mn-tut').style.top = (tut === 3 ? B.y + B.h * 0.38 : B.y + B.h * 0.5) + 'px'; // la carte reste dans le vide de la cuve, loin de l'astre qui tombe
  }
  const fg = $('#mn-fg'), b0 = G.bodies.find((b) => !b.dead);
  const [fx, fy] = tut === 0 ? [B.x + B.w / 2, B.y + B.h * 0.3] : tut <= 2 ? [b0 ? sx(b0.x) : B.x + B.w / 2, B.y + B.h * 0.3] : tut === 3 ? [holdR.x + holdR.w / 2, holdR.y + holdR.h / 2] : [-99, -99];
  fg.style.transform = `translate(${fx.toFixed(0)}px,${fy.toFixed(0)}px)`; fg.style.opacity = aiming || fx < 0 ? 0 : 1;
}

function saveRun() { try { if (G && !G.nop && !ended && !G.over && G.drops > 0 && !G.chal && !G.blitz && tut < 0) localStorage.setItem(RUN, JSON.stringify(G)); } catch (e) { /* stockage plein : tant pis */ } }
const dropRun = () => { try { localStorage.removeItem(RUN); } catch (e) { /* ignore */ } };
function rankLine(r) { const e = $('#mn-rk'); if (e) e.textContent = r ? `${G && G.blitz ? 'Classement Blitz' : 'Classement mondial'} : n° ${fmt(r.rank)} sur ${fmt(r.total)}` : H.online() && !H.named() ? 'Choisis un pseudo pour entrer dans le classement mondial.' : ''; }
function endRun() {
  if (ended || !G) return; ended = true; const c = G.chal;
  if (!c && !G.blitz) dropRun(); // un défi ou un Blitz ne touche pas à la partie normale en attente
  if (c) return endChal(c);
  if (G.blitz) return endBlitz();
  rankLine(null); H.submit({ score: G.score, sector: G.depth + 1, tier: G.maxTier, seed: G.seed, log: G.log, steps: G.n }).then(rankLine, () => {});
  const rec = { s: G.score > sv.best, d: G.depth + 1 > sv.depth, c: G.maxChain > sv.chain };
  sv.runs++; if (rec.s) sv.best = G.score; if (rec.d) sv.depth = G.depth + 1; if (rec.c) sv.chain = G.maxChain; sv.tier = Math.max(sv.tier, G.maxTier + 1); save();
  H.track('score', G.score, true); H.track('runs', 1); H.goal('run', { score: G.score, sector: G.depth + 1, over: G.over, drops: G.drops, chain: G.maxChain, tier: G.maxTier });
  const gain = Math.min(800, Math.round(G.depth * 50 + G.score / 200)) + G.bonus * 10, lv0 = levelOf(sv.xp).level; addXp(Math.min(300, Math.round(G.depth * 25 + G.score / 400))); // proportionnel au jeu réel : rien à gagner à saborder une partie
  if (G.over) A.fail();
  const rvTxt = rvDone ? `Tu as dépassé ${rv.name} !` : rv ? `À ${fmt(rv.score - G.score)} points de ${rv.name}.` : '';
  setTimeout(() => {
    grant(gain); const L = levelInfo(), gx = G.xpGain | 0; $('#mn-xp').innerHTML = `<span>NIVEAU ${L.level}${L.level > lv0 ? ' · NIVEAU SUPÉRIEUR !' : ''}</span><i><b style="width:${Math.round(L.pct * 100)}%;background:${rgba(L.col, 1)}"></b></i><small>+${fmt(gx)} XP · ${fmt(L.cur)} / ${fmt(L.need)}</small>`;
    $('#mn-ot').textContent = rec.s && sv.runs > 1 ? 'Nouveau record !' : 'Effondrement'; $('#mn-share').hidden = true; $('#mn-again').textContent = 'Rejouer';
    $('#mn-os').textContent = rvTxt || rec.s ? rvTxt || 'Ton plus bel univers jusqu\'ici.' : G.score > sv.best * 0.8 ? `À ${fmt(sv.best - G.score)} points de ton record.` : `Record : ${fmt(sv.best)} · secteur ${sv.depth}`;
    overPanel(rec);
  }, G.over ? 900 : 0);
  refreshTitle();
}
function endBlitz() { // fin d'un Blitz : record propre au mode, classement Blitz, récompenses proportionnelles
  const B2 = G.blitz, rec = G.score > (sv.blitz | 0), lv0 = levelOf(sv.xp).level; sv.blitzRuns = (sv.blitzRuns | 0) + 1; if (rec) sv.blitz = G.score; save();
  rankLine(null); H.submit({ blitz: true, score: G.score, sector: G.depth + 1, tier: G.maxTier, seed: G.seed, log: G.log, steps: G.n }).then(rankLine, () => {});
  H.track('runs', 1); addXp(Math.min(200, Math.round(G.score / 300))); const gain = Math.min(500, Math.round(G.score / 150)); if (G.over) A.fail();
  setTimeout(() => {
    grant(gain); const L = levelInfo(); $('#mn-xp').innerHTML = `<span>NIVEAU ${L.level}${L.level > lv0 ? ' · NIVEAU SUPÉRIEUR !' : ''}</span><i><b style="width:${Math.round(L.pct * 100)}%;background:${rgba(L.col, 1)}"></b></i><small>+${fmt(G.xpGain | 0)} XP · ${fmt(L.cur)} / ${fmt(L.need)}</small>`;
    $('#mn-ot').textContent = rec && sv.blitzRuns > 1 ? 'Nouveau record Blitz !' : G.timeout ? 'Temps écoulé' : 'Effondrement'; $('#mn-share').hidden = true; $('#mn-again').textContent = 'Rejouer le Blitz';
    $('#mn-os').textContent = `Tempo max ×${B2.maxMult} · record Blitz ${fmt(sv.blitz | 0)}`; overPanel({ s: rec }); refreshTitle();
  }, G.over ? 900 : 0);
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
    if (first) { grant(1500, 'Défi du jour'); addXp(100); H.track('daily', 1); H.goal('daily'); }
    $('#mn-xp').innerHTML = '';
    $('#mn-ot').textContent = won ? 'Défi réussi !' : 'Défi manqué'; $('#mn-share').hidden = !won; $('#mn-again').textContent = won ? 'Rejouer le défi' : 'Réessayer';
    $('#mn-os').textContent = won ? `Il te restait ${left.toLocaleString('fr-FR')} s. ${first ? '' : 'Récompense déjà reçue aujourd\'hui.'}` : c[3] + '.';
    overPanel({}); H.refresh();
  }, 900);
}
function newRun(seed, keep, opt) {
  if (!keep) dropRun(); G = F.newGame(seed, opt); G.nop = !!(opt && (opt.sandbox || opt.rep || opt.duel)); G.duel = !!(opt && opt.duel); $('#mn').classList.toggle('sbx', !!G.sandbox); $('#mn').classList.toggle('rpl', !!(opt && opt.rep)); G.bonus = 0; warp = slow = 0; want = false; reveal = null; aimT = F.W / 2; A.setMood(0); ended = false; parts = []; rings = []; labels = []; pops.clear(); callout = null; shown = 0; ghosts = []; shake = flash = 0; aimX = F.W / 2; aiming = false;
  resize(); // la hauteur de la cuve dépend du mode (Blitz : plus basse)
  if (!(opt && (opt.sandbox || opt.rep || opt.duel || opt.daily)) && Object.keys(sv.power || {}).some((t) => sv.power[t] && sv.cx[t + ':1'])) { const pw = {}; for (const t of Object.keys(sv.power)) if (sv.power[t] && sv.cx[t + ':1']) pw[t] = 1; G.powers = pw; G.log.push(0, -1e6 - F.maskOf(pw)); } // l'en-tête consigne les pouvoirs équipés
  texB = makeTex(0); texA = null; $('#mn-m-over').classList.remove('on');
  rv = null; rvDone = false; gh = null; const tok = ++runTok;
  if (!opt && H.online()) H.rival(sv.best).then((r) => {
    if (tok !== runTok || !r || !r.name || G.chal || tut >= 0) return; rv = r;
    if (sv.ghost) H.runOf(r.name).then((run) => { if (tok === runTok && run && Array.isArray(run.log)) gh = { G: F.newGame(run.seed), log: run.log, steps: run.steps || 0, i: 0, done: false, name: r.name }; }).catch(() => {});
  }).catch(() => {});
}
function stepGhost() { // le fantôme rejoue la partie du rival, calée sur le temps de la mienne (même nombre de pas)
  const R = gh; if (R.done) return; let k = 0;
  while (R.G.n < G.n && k++ < 800 && !R.done) {
    if (R.i < R.log.length && R.G.n >= R.log[R.i]) { const x = R.log[R.i + 1]; if (x < 0) F.act(R.G, x); else F.drop(R.G, x / 1000); R.i += 2; }
    else if (R.G.n < R.steps && !R.G.over) F.step(R.G); else R.done = true;
  }
  R.G.ev.length = 0;
}
/* ============================== duel 1v1 (salon par code, Supabase Realtime) ============================== */
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const dsend = (m) => { if (duel && duel.ch) duel.ch.send({ ...m, id: duel.id }); };
function dsendDrop() { const L = G.log; if (G.shared) dsend({ e: 'sd', x: L[L.length - 1] }); else dsend({ e: 'd', n: L[L.length - 2], x: L[L.length - 1] }); }
function dview(state, title, sub) { // une seule fenêtre : salon, attente, résultat
  const m = $('#mn-m-duel'); m.classList.add('on'); m.dataset.s = state; $('#dl-t').textContent = title; $('#dl-s').textContent = sub || ''; $('#dl-new').textContent = state === 'end' ? 'Nouveau duel' : 'Créer un salon'; if (state === 'menu') $('#dl-code').textContent = '';
}
export function openDuel() {
  if (!H.online()) return H.toast('Le duel demande une connexion');
  duelClose(); dview('menu', 'Duel 1v1', 'Classique : même graine, 2 minutes, le meilleur score gagne. Duel de cuve : une seule cuve, un astre chacun, celui qui fait déborder perd (Elo).'); $('#dl-code').textContent = ''; $('#dl-in').value = '';
}
function duelClose() { if (duel && duel.invited && !duel.guest) H.challengeCancel(); if (duel) { clearInterval(duel.tm); if (duel.ch) { try { duel.ch.send({ e: 'bye', id: duel.id }); } catch (e) { /* ignore */ } const c = duel.ch; setTimeout(() => c.close(), 300); } } duel = null; }
function duelNew(role, code) {
  duelClose(); duel = { mode: code[0] === 'Z' ? 'shared' : 'classic', role, code, id: Math.random().toString(36).slice(2, 8), name: H.name() || 'Invité', oppName: '', dur: 120, phase: 'lobby', op: null, me: null, lastMsg: 0, ch: null };
  duel.ch = channel('duel-' + code, duelMsg, () => { if (duel && duel.phase !== 'done') { const was = duel.phase; if (was === 'lobby') dview('menu', 'Connexion impossible', 'Vérifie ta connexion puis réessaie.'); else if (was === 'play' || was === 'count') duelResult('forfait'); } });
  return duel;
}
function duelHost(mode) {
  let code = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b & 31]).join(''); code = (mode === 'shared' ? 'Z' : code[0] === 'Z' ? 'Y' : code[0]) + code.slice(1); // le code dit le mode : « Z… » = duel de cuve
  const d = duelNew('host', code);
  d.seed = (Math.random() * 2 ** 32) >>> 0; dview('wait', 'Salon créé', 'Donne ce code à ton adversaire :'); $('#dl-code').textContent = code;
  d.tm = setInterval(() => dsend({ e: 'hello', name: d.name }), 1500); dsend({ e: 'hello', name: d.name });
}
function duelJoin(code) {
  code = code.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 4) return H.toast('Le code a 4 caractères');
  const d = duelNew('guest', code); dview('wait', 'Connexion au salon…', 'Code ' + code); $('#dl-code').textContent = code;
  dsend({ e: 'join', name: d.name }); d.tm = setTimeout(() => { if (duel === d && d.phase === 'lobby') { duelClose(); dview('menu', 'Salon introuvable', 'Aucun joueur n\'attend avec ce code.'); } }, 12000);
}
export const canNotify = () => !isOpen && !duel && !$('#mn-m-duel').classList.contains('on'); // pas d'invitation pendant une partie ni un duel
export const joinDuel = (code) => { $('#dl-in').value = code; duelJoin(code); };
export function inviteDuel(name, mode) { // salon créé pour toi + invitation envoyée au joueur (en ligne) depuis son profil
  duelHost(mode); const d = duel; d.invited = true;
  H.challenge(name, d.code).then(() => { if (duel === d) dview('wait', 'Invitation envoyée', `${name} a 2 minutes pour répondre. Code du salon :`); }).catch((e) => { if (duel === d) { duelClose(); dview('menu', 'Invitation impossible', e.message); } });
}
function sharedMsg(m) { // duel de cuve : les lâchers de l'adversaire, sa visée, la fin
  const d = duel; d.lastMsg = performance.now();
  if (m.e === 'sd' && G && G.shared && G.shared.turn !== d.my && d.q.length < 3) d.q.push(m.x | 0);
  else if (m.e === 'sa') d.oppAim = Math.max(0.5, Math.min(F.W - 0.5, (m.x | 0) / 1000));
  else if (m.e === 'end') { if (G && G.over && G.shared.loser !== (m.loser | 0)) d.desync = true; }
  else if (m.e === 'bye' && d.phase !== 'done') sharedResult('forfait');
}
function duelMsg(m) {
  if (!duel || !m || m.id === duel.id) return; const d = duel;
  if (d.phase === 'lobby') {
    if (d.role === 'host' && m.e === 'join' && !d.guest) { d.guest = m.id; d.oppName = String(m.name || 'Joueur').slice(0, 16); dsend({ e: 'go', to: m.id, seed: d.seed, dur: d.dur, name: d.name, mode: d.mode }); duelStart(); }
    else if (d.role === 'guest' && m.e === 'hello' && !d.helloSeen) { d.helloSeen = true; dsend({ e: 'join', name: d.name }); }
    else if (d.role === 'guest' && m.e === 'go' && m.to === d.id) { d.oppName = String(m.name || 'Joueur').slice(0, 16); d.seed = m.seed >>> 0; d.dur = Math.min(300, Math.max(30, +m.dur || 120)); duelStart(); }
    else if (d.role === 'guest' && m.e === 'go' && m.to !== d.id) { duelClose(); dview('menu', 'Salon complet', 'Cet adversaire a déjà quelqu\'un.'); }
    return;
  }
  if (d.mode === 'shared') return sharedMsg(m);
  d.lastMsg = performance.now(); const o = d.op; if (!o) return;
  if (m.e === 'd') { o.ev.push([m.n | 0, m.x | 0]); o.known = Math.max(o.known, m.n | 0); }
  else if (m.e === 's') { o.known = Math.max(o.known, m.n | 0); if (m.ov) o.over = true; }
  else if (m.e === 'f') { o.final = m.sc | 0; o.known = Math.max(o.known, m.n | 0); duelCheck(); }
  else if (m.e === 'bye' && o.final == null && d.phase !== 'done') duelResult('forfait');
}
function duelStart() {
  const d = duel; clearInterval(d.tm); d.phase = 'count'; d.cd = 3.2; d.lastCd = 4; d.hb = 0; d.lastMsg = performance.now();
  $('#mn-m-duel').classList.remove('on'); open(true); ended = false;
  if (d.mode === 'shared') { newRun(d.seed, true, { duel: true, shared: true }); d.my = d.role === 'host' ? 0 : 1; d.names = d.role === 'host' ? [d.name, d.oppName] : [d.oppName, d.name]; d.q = []; d.oppAim = F.W / 2; d.tleft = F.SHARED.turn; d.aimSent = 0; d.lastAim = -1; d.op = null; return; }
  newRun(d.seed, true, { duel: true }); d.op = { G: F.newGame(d.seed), ev: [], i: 0, known: 0, final: null, over: false };
}
function stepOpp() { // l'adversaire rejoue ses lâchers, calé sur mon nombre de pas (jamais plus loin que ce qu'il m'a annoncé)
  const o = duel.op, tgt = Math.min(duel.me != null ? o.known : G.n, o.known); let k = 0;
  while (o.G.n < tgt && k++ < 800 && !o.G.over) { const ev = o.ev[o.i]; if (ev && o.G.n >= ev[0]) { if (ev[1] < 0) F.swapHold(o.G); else F.drop(o.G, ev[1] / 1000); o.i++; } else F.step(o.G); }
  o.G.ev.length = 0;
}
function duelTick(dt) {
  const d = duel; if (!d) return;
  if (d.phase === 'count') { d.cd -= dt; const c = Math.ceil(d.cd); if (c !== d.lastCd && c >= 1) { d.lastCd = c; say(String(c), 'DUEL · ' + d.oppName.toUpperCase(), CY); A.select(); } if (d.cd <= 0) { d.phase = 'play'; d.lastMsg = performance.now(); say('GO !', '', AM); A.win(); } return; }
  if (d.mode === 'shared') return sharedTick(dt);
  if (d.phase !== 'play') { if (d.phase === 'done') stepOpp(); return; }
  F.tick(G, slow > 0 ? dt * 0.3 : dt); stepOpp();
  if ((d.hb += dt) >= 1) { d.hb = 0; dsend({ e: 's', n: G.n, sc: G.score, ov: G.over }); }
  if (G.n >= d.dur * 120) duelFinish();
  if (d.me == null && performance.now() - d.lastMsg > 15000) duelResult('forfait'); // plus aucun signe de l'adversaire
}
function sharedTick(dt) {
  const d = duel; if (d.phase !== 'play' || ended) return; const S = G.shared, mine = S.turn === d.my;
  F.tick(G, slow > 0 ? dt * 0.3 : dt); if (G.over) return;
  if ((d.hb = (d.hb || 0) + dt) >= 1) { d.hb = 0; dsend({ e: 's', n: G.n }); }
  if (performance.now() - d.lastMsg > 15000) return sharedResult('forfait'); // plus aucun signe de l'adversaire
  if (S.sim > 0) { d.tleft = F.SHARED.turn; return; }
  if (mine) {
    d.tleft -= dt; const now = performance.now(); if (now - d.aimSent > 100 && Math.abs(aimT - d.lastAim) > 0.01) { d.aimSent = now; d.lastAim = aimT; dsend({ e: 'sa', x: Math.round(aimT * 1000) }); } // l'adversaire voit où je vise
    if (d.tleft <= 0 && G.cool <= 0 && F.drop(G, aimT)) { aimX = aimT; A.release(); H.vib(8); dsendDrop(); } // temps écoulé : lâcher automatique
  } else {
    aimT = aimX = d.oppAim; d.tleft -= dt; // je vois où il vise
    if (d.q.length && G.cool <= 0) { const x = d.q.shift(); aimT = aimX = x / 1000; if (F.drop(G, x / 1000)) { A.release(); d.tleft = F.SHARED.turn; } }
    else if (d.tleft < -7) sharedResult('forfait'); // il n'a pas joué, même après le délai
  }
}
function sharedFinish() { const d = duel; if (!d || d.phase === 'done') return; dsend({ e: 'end', loser: G.shared.loser }); sharedResult(G.shared.loser === d.my ? 'lose' : 'win'); }
function sharedResult(r) {
  const d = duel; if (!d || d.phase === 'done') return; d.phase = 'done'; ended = true; const won = r === 'win' || r === 'forfait'; if (won) H.goal('duelwin');
  setTimeout(() => {
    if (duel !== d) return; (won ? A.win : A.fail)();
    dview('end', r === 'win' ? 'Victoire !' : r === 'forfait' ? 'Victoire par forfait' : 'Défaite', r === 'lose' ? 'Ton astre a fait déborder la cuve.' : r === 'win' ? `${d.oppName} a fait déborder la cuve.` : `${d.oppName} a quitté la partie.`);
    if (d.desync) { $('#dl-s').textContent += ' · Les deux écrans ne sont pas d\'accord : match sans Elo.'; return; }
    if (H.eloReport) H.eloReport(d.code + ':' + d.seed, won, d.oppName).then((x) => { if (duel === d && x) $('#dl-s').textContent += x.settled ? ` · Elo ${x.delta >= 0 ? '+' : ''}${x.delta} (${x.elo})` : ' · Elo mis à jour dès que ton adversaire confirme'; }).catch(() => {});
  }, 1300);
}
function duelFinish() {
  const d = duel; if (d && d.mode === 'shared') return sharedFinish(); if (!d || d.me != null) return; d.me = G.score; dsend({ e: 'f', sc: G.score, n: G.n });
  if (d.op.final == null) say('EN ATTENTE…', 'LA PARTIE DE L\'ADVERSAIRE SE TERMINE', CY); duelCheck();
  d.wait = setTimeout(() => { if (duel === d && d.phase !== 'done') duelResult('forfait'); }, 20000);
}
function duelCheck() { const d = duel; if (d && d.me != null && d.op.final != null && d.phase !== 'done') duelResult(d.me > d.op.final ? 'win' : d.me < d.op.final ? 'lose' : 'draw'); }
function duelResult(r) {
  const d = duel; if (!d || d.phase === 'done') return; d.phase = 'done'; clearTimeout(d.wait); ended = true;
  if (r === 'win' || r === 'forfait') H.goal('duelwin');
  const mine = d.me != null ? d.me : G.score, theirs = d.op.final != null ? d.op.final : d.op.G.score;
  setTimeout(() => { if (duel !== d) return; (r === 'win' || r === 'forfait' ? A.win : A.fail)(); dview('end', r === 'win' ? 'Victoire !' : r === 'forfait' ? 'Victoire par forfait' : r === 'lose' ? 'Défaite' : 'Égalité', `Toi ${fmt(mine)} · ${d.oppName} ${fmt(theirs)}`); }, 500);
}
export const isNew = () => !sv.tut; // personne n'a encore fini (ou passé) la partie guidée
// Calques d'un astre pour la carte immersive : halo, surface animée (frame), lumière fixe, chacun à sa propre profondeur
export function astreRig(key) {
  const k = parseKey(key); if (!k) return null;
  const U = 64, r = F.TIERS[k.tier].r * U, s = build(k.tier, r, k.v); s.h = r * 1.3; // construit à grande échelle, hors du cache du jeu
  const size = s.h * 2; let comp = null;
  return {
    size, tier: k.tier, v: k.v, color: BODIES[k.tier][1], halo: s.back || null, haloSpin: s.spinB || 0, over: s.over || null,
    frame(x, tNow) { // dessine la surface (centre en 0,0, côté = size) à l'instant tNow, sans toucher à l'horloge du jeu
      const keep = T; T = tNow;
      try {
        if (s.spr) { x.save(); x.rotate(tNow * (s.spin || 0)); x.drawImage(s.spr, -size / 2, -size / 2, size, size); x.restore(); }
        else { if (!comp) { comp = document.createElement('canvas'); comp.width = comp.height = Math.ceil(size * DPR); s.comp = comp; s.cx = comp.getContext('2d'); } compose(s, k.tier, true); x.drawImage(comp, -size / 2, -size / 2, size, size); }
      } finally { T = keep; }
    },
  };
}
export function cardSpec(key) { // données d'une carte immersive (Codex, packs)
  const rig = astreRig(key); if (!rig) return null; const info = astreInfo(key), k = parseKey(key), e = entries().find((x) => x.key === key);
  return { rig, name: info.name, rar: Math.max(0, info.rar), rname: k.tier === F.MAX_TIER ? 'Galaxie · ' + RAR[Math.max(0, info.rar)] : RAR[Math.max(0, info.rar)], sub: info.sub, info: e && e.info ? e.info : '' };
}
export function viewCard(key) { const sp = cardSpec(key); if (sp) IM.show(sp); }
export const buildCard = (key, host, aim, hmax) => { const sp = cardSpec(key); return sp && IM.show({ ...sp, host, aim, hmax }); }; // carte intégrée (ouverture de pack)
export function paintCard(c, key, px) { // astre net à grande taille (cartes de pack) : on agrandit l'échelle de dessin le temps de la vignette
  const keep = B.u; B.u = 56; try { paintAstre(c, key, px, false); } finally { B.u = keep; }
}
export const ghostOn = () => !!sv.ghost;
export const setGhost = (v) => { sv.ghost = !!v; save(); };
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
function close() { if (duel) duelClose(); H.back(); save(); H.time(sv.time); A.setMood(0); isOpen = false; document.documentElement.classList.remove('mn-open'); $('#mn').classList.remove('on'); $('#mn-m-over').classList.remove('on'); refreshTitle(); }
export function init(opts) {
  Object.assign(H, opts); DPR = Math.min(window.devicePixelRatio || 1, 2); // pour les vignettes dessinées avant la première partie
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const d = document.createElement('div'); d.innerHTML = HTML + HTML2; document.body.append(...d.children);
  cv = $('#mn-cv'); ctx = cv.getContext('2d', { alpha: false });
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', () => { aiming = false; });
  window.addEventListener('resize', () => { if (isOpen) resize(); });
  document.addEventListener('visibilitychange', () => { last = performance.now(); if (document.hidden && isOpen) saveRun(); }); window.addEventListener('pagehide', () => { if (isOpen) saveRun(); });
  const click = (el, f) => $(el).addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  document.querySelectorAll('#mn-rp [data-s]').forEach((b) => b.addEventListener('click', () => { if (G && G.rep) { rpSpeed(+b.dataset.s); A.select(); } }));
  click('#mn-rpp', () => { const R = G && G.rep; if (!R) return; if (R.done) { const run = R.run; openReplay(run); } else { R.speed = R.speed ? 0 : +(document.querySelector('#mn-rp [data-s].on') || { dataset: { s: 2 } }).dataset.s; $('#mn-rpp').textContent = R.speed ? '❚❚' : '▶'; } });
  $('#mn-tut').addEventListener('click', (e) => { if (e.target.id === 'mn-tutx') tutEnd(false); });
  click('#dl-sh', () => duelHost('shared'));
  click('#dl-new', () => { if ($('#mn-m-duel').dataset.s === 'end') { duelClose(); close(); openDuel(); } else duelHost(); });
  click('#dl-join', () => duelJoin($('#dl-in').value));
  click('#dl-x', () => { $('#mn-m-duel').classList.remove('on'); if (isOpen && G && G.duel) close(); else duelClose(); });
  click('#mn-sbc', () => { if (G && G.sandbox) { G.bodies.length = 0; A.select(); } });
  click('#mn-back', () => { saveRun(); close(); }); // la partie est gardée : on la reprend en revenant
  click('#mn-quit', () => { $('#mn-m-help').classList.remove('on'); paused = false; if (G && !G.nop && !ended && G.drops > 0) endRun(); else close(); });
  click('#mn-rkb', () => (H.online() && !H.named() ? H.askName() : H.rank()));
  click('#mn-help', () => { $('#mn-quit').textContent = G && G.nop ? 'Quitter' : 'Abandonner la partie'; const l = $('#mn-lad'); if (!l.firstChild) BODIES.forEach((b, i) => { const c = document.createElement('canvas'); c.title = b[0]; paintAstre(c, i + ':0', 34); l.append(c); }); $('#mn-m-help').classList.add('on'); paused = true; });
  click('#mn-hok', () => { $('#mn-m-help').classList.remove('on'); paused = false; }); click('#mn-again', () => (G && G.blitz ? openBlitz() : G && G.chal ? openDaily() : newRun())); click('#mn-share', share); click('#mn-thok', () => $('#mn-m-themes').classList.remove('on')); click('#mn-cxb', showCodex); click('#mn-cxok', () => $('#mn-m-codex').classList.remove('on')); click('#mn-menu', close);
  // bouton principal de l'accueil (home.js le transforme en héros) ; Cascade devient un lien discret
  const menu = $('#s-title .menu');
  if (menu && !$('#b-mine')) { const b = document.createElement('button'); b.className = 'big primary hero'; b.id = 'b-mine'; b.innerHTML = '<span>Jouer</span><small id="b-mine-s"></small>'; menu.insertBefore(b, menu.firstChild); b.addEventListener('click', () => { A.ui(); H.vib(9); open(); }); }
  refreshTitle();
  window.__mine = { get G() { return G; }, get B() { return B; }, F };
}
export const dbg = () => G && ({ n: G.n, drops: G.drops, turn: G.shared ? G.shared.turn : -1, sim: G.shared ? G.shared.sim : -1, score: G.score, nb: G.bodies.length, over: G.over, loser: G.shared ? G.shared.loser : -1, hash: Math.round(G.bodies.reduce((s, b) => s + b.x * 7 + b.y * 13 + b.tier, 0) * 1e6) }); // état résumé (tests de synchronisation)
