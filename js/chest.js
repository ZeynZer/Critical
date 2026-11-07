// Critical — noyaux scellés : énergie, raretés, skins de réacteurs, ouverture animée, collection, admin.
// Module autonome : il injecte son propre HTML/CSS et sa propre sauvegarde (critical.chest.v1).
import * as A from './audio.js';

export const ADMIN = true; // ← mets false avant de publier : cache le bouton « ADMIN » de l'écran titre

const KEY = 'critical.chest.v1', TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const $ = (s, r = document) => r.querySelector(s);
const hsl = (h, s, l) => {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l), f = (n) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return [f(0), f(8), f(4)];
};
const rg = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FX = (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 4) ? 0.6 : 1;

/* ============================== catalogue ============================== */
// col = couleur de rareté ; dust = poussière donnée pour un doublon ; cost = prix de fabrication
export const RAR = [
  { n: 'Commun', col: [160, 185, 225], w: 60, dust: 3, cost: 15 },
  { n: 'Rare', col: [77, 243, 255], w: 27, dust: 10, cost: 50 },
  { n: 'Épique', col: [255, 79, 216], w: 9.5, dust: 30, cost: 150 },
  { n: 'Légendaire', col: [255, 194, 71], w: 3, dust: 100, cost: 480 },
  { n: 'Critique', col: [255, 255, 255], w: 0.5, dust: 300, cost: 1400 },
];
// Intensité lumineuse par rareté : un Commun reste discret, un Critique éblouit.
import * as Skins from './skins.js';
const GL = [0.34, 0.55, 0.78, 1, 1.25];          // halo (aura, sol, texte)
const FLASH = [0.3, 0.45, 0.65, 0.85, 1];         // flash blanc plein écran à la révélation
const RAYS = [0, 0.25, 0.5, 0.85, 1];             // rayons de lumière
const BGA = [0.14, 0.22, 0.32, 0.44, 0.56];       // lueur de fond
const rarCol = (r, t) => (r === 4 ? hsl(t * 90, 100, 66) : RAR[r].col);
// c = couleurs noyau / pulsar / étoile · m = animation · b = style d'explosion · s = gamme sonore
const RAW = [
  ['default', -1, 'Néon classique', ['#4df3ff', '#ff4fd8', '#ffc247']],
  ['solar', 0, 'Solaire', ['#ff9a3d', '#ff4d4d', '#ffe066']],
  ['ocean', 0, 'Abysses', ['#3d8bff', '#19d3c5', '#9ff3ff']],
  ['toxic', 0, 'Toxique', ['#9dff3d', '#35e07a', '#e5ff5c']],
  ['sakura', 0, 'Sakura', ['#ff9ec7', '#ffd1e6', '#ffffff']],
  ['mono', 0, 'Argent', ['#ffffff', '#b9c3d6', '#8a96ad']],
  ['glace', 1, 'Glace', ['#aef4ff', '#7fb8ff', '#e8fbff'], { m: 'shimmer', v: 'crystal' }],
  ['plasma', 1, 'Plasma', ['#8a5bff', '#3d7bff', '#d36bff'], { m: 'shimmer', v: 'plasma' }],
  ['rune', 1, 'Rune', ['#ffd24a', '#4dffb0', '#fff0a8'], { m: 'shimmer', v: 'crystal' }],
  ['magma', 1, 'Magma', ['#ff5a1f', '#ffb01f', '#ff2e63'], { m: 'flicker', v: 'obsidian' }],
  ['miel', 1, 'Miel', ['#ffb300', '#ff7a00', '#ffe08a'], { v: 'honey' }],
  ['saphir', 1, 'Saphir', ['#3d8bff', '#6fb6ff', '#bfe3ff'], { v: 'sapphire' }],
  ['anneaux', 2, 'Onde de choc', ['#4df3ff', '#7a6bff', '#ffffff'], { b: 'rings', v: 'holo' }],
  ['fleur', 2, 'Floraison', ['#ff6fb5', '#ffb36f', '#fff08a'], { b: 'flower', v: 'crystal' }],
  ['rubis', 2, 'Rubis', ['#ff2e4d', '#ff6a86', '#ffb3c1'], { v: 'ruby' }],
  ['neontube', 2, 'Néon tube', ['#00f0ff', '#ff2bd6', '#fff700'], { v: 'neon', m: 'flicker' }],
  ['glitch', 2, 'Glitch', ['#00ffd5', '#ff2bd6', '#fffb3d'], { b: 'glitch', m: 'shimmer', v: 'holo' }],
  ['foudre', 2, 'Foudre', ['#f2f6ff', '#6fa8ff', '#fff27a'], { b: 'rings', m: 'flicker', v: 'plasma' }],
  ['prisme', 3, 'Prisme', ['#ffffff', '#ffffff', '#ffffff'], { m: 'prism', b: 'nova', v: 'diamond' }],
  ['vide', 3, 'Trou noir', ['#7a3dff', '#c04dff', '#3d2bff'], { m: 'void', b: 'implode', v: 'void' }],
  ['chrome', 3, 'Chrome liquide', ['#9fb8ff', '#ffb0d0', '#ffe0a0'], { v: 'chrome' }],
  ['arcenciel', 3, 'Arc-en-ciel', ['#ff4d4d', '#4dff88', '#4d8bff'], { m: 'rainbow', b: 'flower' }],
  ['aurore', 4, 'Aurore boréale', ['#4dffb0', '#8a5bff', '#4df3ff'], { m: 'aurora', b: 'nova', s: [0, 2, 3, 7, 8], v: 'nebula' }],
  ['supernova', 4, 'Supernova', ['#ffffff', '#ffd24a', '#ff6fb5'], { m: 'rainbow', b: 'nova', s: [0, 2, 4, 7, 9], v: 'plasma' }],
];
export const ITEMS = RAW.map(([id, r, n, c, o]) => ({ id, r, n, c, rgb: c.map(hex), ...(o || {}) }));
const item = (id) => ITEMS.find((i) => i.id === id) || ITEMS[0];
// Matière (rendu) de la skin équipée et intensité de halo associée — utilisées par le jeu et l'éditeur.
// Matière du rendu : choisie séparément de la skin (st.mat). 'skin' = suit la matière de la skin équipée.
// Une matière se débloque dès qu'on possède une skin qui l'utilise (mets ALL_MATS_FREE à true pour tout offrir).
const ALL_MATS_FREE = false;
let curMat = 'glass';
const matName = (id) => (Skins.MATS.find((m) => m[0] === id) || [id, id])[1];
const matUnlocked = (m) => ALL_MATS_FREE || m === 'glass' || ITEMS.some((i) => i.v === m && st.owned[i.id]);
const calcMat = () => { curMat = st.mat && st.mat !== 'skin' && matUnlocked(st.mat) ? st.mat : (item(st.eq).v || 'glass'); };
export const matOf = () => curMat;
export const matGl = () => [0.85, 0.95, 1.05, 1.15, 1.3][Math.max(0, item(st.eq).r)];
const DROPS = ITEMS.filter((i) => i.r >= 0);
const DEF_SCALE = [0, 3, 5, 7, 10];

// Couleur d'un type de réacteur (1 noyau · 2 pulsar · 3 étoile) pour une skin à l'instant T
function colorOf(it, ty, T, bump = 0) {
  const b = it.rgb[ty - 1], lum = (k) => b.map((v) => clamp(v * k + (k > 1 ? (k - 1) * 220 : 0), 0, 255) | 0);
  switch (it.m) {
    case 'shimmer': return lum(1 + 0.16 * Math.sin(T * 2.3 + ty * 1.9));
    case 'flicker': return lum(1 + 0.22 * Math.sin(T * 15 + ty * 5) * Math.sin(T * 6.1 + ty));
    case 'rainbow': return hsl(T * 55 + ty * 120, 100, 62);
    case 'prism': return hsl(bump + ty * 55 + T * 14, 100, 64);
    case 'aurora': return hsl(150 + 95 * Math.sin(T * 0.6 + ty * 1.3), 90, 62);
    case 'void': return b.map((v) => (v * (0.65 + 0.35 * Math.sin(T * 2.4 + ty))) | 0);
    default: return b;
  }
}

/* ============================== sauvegarde ============================== */
const st = { energy: 0, cores: [], owned: { default: 1 }, eq: 'default', mat: 'skin', dust: 0, opens: 0, pity: [0, 0, 0], worlds: [] };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
st.owned.default = st.owned.default || 1;
if (!ITEMS.some((i) => i.id === st.eq)) st.eq = 'default';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };

const H = { vib: () => {}, toast: () => {}, COL: null };
let T = 0, bump = 0;

/* ============================== tirage ============================== */
// Le contenu d'un noyau est décidé quand on l'obtient (fermer l'app ne permet pas de retirer).
function rollRar(minR = 0) {
  const [pr, pe, pl] = st.pity;
  let min = pl >= 60 ? 3 : pe >= 20 ? 2 : pr >= 6 ? 1 : 0;
  min = Math.max(min, minR);
  let tot = 0; for (let i = min; i < 5; i++) tot += RAR[i].w;
  let x = Math.random() * tot, r = min;
  for (let i = min; i < 5; i++) { if ((x -= RAR[i].w) < 0) { r = i; break; } }
  st.pity = [r >= 1 ? 0 : pr + 1, r >= 2 ? 0 : pe + 1, r >= 3 ? 0 : pl + 1];
  return r;
}
function pickItem(r) {
  const pool = DROPS.filter((i) => i.r === r), fresh = pool.filter((i) => !st.owned[i.id]);
  const p = fresh.length && Math.random() < 0.75 ? fresh : pool;
  return p[(Math.random() * p.length) | 0];
}
function addCore(minR = 0) { const r = rollRar(minR); st.cores.push({ r, id: pickItem(r).id }); }

/* ============================== branchement jeu ============================== */
function applyEq() {
  calcMat();
  const it = item(st.eq);
  if (H.COL) for (let ty = 1; ty <= 3; ty++) { const a = H.COL[ty], c = colorOf(it, ty, T, bump); a[0] = c[0]; a[1] = c[1]; a[2] = c[2]; }
  A.setScale(it.s || DEF_SCALE);
}
export function tick(dt) {
  T += dt;
  const it = item(st.eq);
  if (it.m && H.COL) for (let ty = 1; ty <= 3; ty++) { const a = H.COL[ty], c = colorOf(it, ty, T, bump); a[0] = c[0]; a[1] = c[1]; a[2] = c[2]; }
}
// Effets supplémentaires d'explosion selon la skin (api = { ring, burst } du jeu)
export function boom(n, api, x, y, col, cs) {
  bump += 47;
  const b = item(st.eq).b; if (!b) return;
  const later = (ms, f) => setTimeout(f, ms);
  if (b === 'rings') [80, 170, 260].forEach((d, k) => later(d, () => api.ring(x, y, cs * 0.1, cs * (1.3 + k * 0.6), 0.45, col, 0.04)));
  else if (b === 'flower') for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU, px = x + Math.cos(a) * cs * 0.55, py = y + Math.sin(a) * cs * 0.55; api.ring(px, py, cs * 0.05, cs * 0.5, 0.45, col, 0.06); }
  else if (b === 'glitch') { api.burst(x - 5, y, 10, [0, 255, 255], cs * 3, 0.5, 2.2); api.burst(x + 5, y, 10, [255, 0, 200], cs * 3, 0.5, 2.2); api.burst(x, y + 4, 8, [255, 255, 60], cs * 3, 0.5, 2.2); }
  else if (b === 'nova') { api.ring(x, y, cs * 0.1, cs * 3.2, 0.6, [255, 255, 255], 0.03); api.burst(x, y, 24, [255, 214, 120], cs * 5, 0.9, 2.6); }
  else if (b === 'implode') { api.ring(x, y, cs * 2.4, cs * 0.1, 0.35, col, 0.07); later(300, () => api.ring(x, y, cs * 0.1, cs * 1.6, 0.4, [200, 120, 255], 0.06)); }
}
export const busy = () => !!O;

export function onWin({ stars, daily, world }) {
  let g = daily ? 45 : [0, 15, 25, 40][stars] || 15, core = 0;
  if (world >= 0 && !st.worlds.includes(world)) { st.worlds.push(world); addCore(2); core++; } // monde terminé : noyau épique garanti
  const got = gain(g); showBanner(g, got + core, world >= 0 && core ? 'Monde terminé : noyau épique !' : '', 1500);
}
export function onEndless(score) {
  const g = 10 + Math.min(60, Math.round(score / 300));
  showBanner(g, gain(g), '', 1200);
}
function gain(n) { st.energy += n; let c = 0; while (st.energy >= 100) { st.energy -= 100; addCore(); c++; } save(); refresh(); return c; }

/* ============================== interface ============================== */
const CSS = `
.ch-row{display:flex;gap:12px;width:100%}.ch-row .big{flex:1;position:relative;min-height:54px}
.ch-bar{display:block;width:70%;height:5px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:3px}
.ch-bar b{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#4df3ff,#ff4fd8,#ffc247);box-shadow:0 0 10px #ff4fd8}
.ch-badge{position:absolute;right:-4px;top:-6px;min-width:22px;height:22px;border-radius:11px;padding:0 6px;background:linear-gradient(135deg,#ff4fd8,#ffc247);color:#05060f;font:900 12px/22px var(--disp);text-align:center;box-shadow:0 0 14px #ff4fd8}
.ch-ready{animation:chrb 2.4s linear infinite;border-color:rgba(255,255,255,.6)!important}
@keyframes chrb{0%{box-shadow:0 0 22px #4df3ff}33%{box-shadow:0 0 26px #ff4fd8}66%{box-shadow:0 0 26px #ffc247}100%{box-shadow:0 0 22px #4df3ff}}
.ch-adm{position:absolute;left:16px;top:calc(env(safe-area-inset-top,0px) + 12px);height:46px;padding:0 12px;border-radius:15px;font:700 11px var(--disp);letter-spacing:1px;color:#ffc247}
#ch-banner{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translate(-50%,-140%);z-index:45;padding:12px 18px;border-radius:18px;text-align:center;font-weight:700;font-size:14px;min-width:220px;transition:transform .45s cubic-bezier(.2,1.3,.3,1)}
#ch-banner.on{transform:translate(-50%,0)}#ch-banner small{display:block;font-weight:500;color:var(--dim);margin-top:2px}
#ch-banner .ch-bar{width:100%;margin:6px 0 0}
.ch-orbs{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;min-height:34px}
.ch-orb{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#4df3ff 35%,#1a2350 75%);box-shadow:0 0 16px #4df3ff,inset 0 0 0 3px #05060f,inset 0 0 0 5px #4df3ff;animation:chorb 2.6s ease-in-out infinite}
@keyframes chorb{50%{filter:hue-rotate(150deg);transform:scale(1.08)}}
#ch-coll{position:fixed;inset:0;z-index:25;display:none;flex-direction:column;align-items:center;padding:env(safe-area-inset-top,0px) 16px env(safe-area-inset-bottom,0px);background:rgba(3,4,12,.9);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
#ch-coll.on{display:flex;animation:fade .3s}
.ch-tabs{width:100%;max-width:520px;display:flex;gap:8px;padding:2px 0 10px}
.ch-tabs button{flex:1;height:42px;border-radius:21px;font:700 13px var(--disp);letter-spacing:.04em;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);transition:transform .5s cubic-bezier(.2,1.6,.4,1)}
.ch-tabs button.on{background:linear-gradient(135deg,rgba(77,243,255,.4),rgba(255,79,216,.34));border-color:rgba(255,255,255,.45);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.5),0 0 18px rgba(77,243,255,.25)}
.ch-tabs button:active{transform:scale(.95)}
.ch-prev{width:100%;max-width:520px;border-radius:26px;padding:8px 10px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:10px}
.ch-prev canvas{width:min(100%,300px);aspect-ratio:600/168;display:block}
.ch-pl{display:flex;gap:8px;width:100%}
.ch-pl button{flex:1;min-width:0;height:34px;border-radius:17px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 10px}
.ch-pl b{font-family:var(--disp)}
.ch-th{width:56px;height:56px;display:block}
.ch-it.lock .ch-th{filter:grayscale(1) brightness(.4)}
.ch-grid{width:100%;max-width:520px;flex:1;overflow-y:auto;touch-action:pan-y;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-content:start;padding:4px 0 16px;scrollbar-width:none}
.ch-grid::-webkit-scrollbar{display:none}
.ch-it{border-radius:16px;padding:10px 6px 8px;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(255,255,255,.06);border:1px solid var(--rc,rgba(255,255,255,.14));font-size:11px;font-weight:600;text-align:center;position:relative}
.ch-it.sel{box-shadow:0 0 18px var(--rc),inset 0 0 14px color-mix(in srgb,var(--rc) 30%,transparent)}
.ch-it.lock .ch-sw{filter:grayscale(1) brightness(.35)}.ch-it.lock{opacity:.7}
.ch-it i{font-style:normal;font-size:9px;letter-spacing:1px;text-transform:uppercase;color:var(--rc)}
.ch-it em{position:absolute;top:5px;right:7px;font-style:normal;color:#ffc247;font-size:12px}
.ch-sw{width:46px;height:46px;border-radius:50%;box-shadow:0 0 14px var(--rc),inset 0 0 0 3px rgba(0,0,0,.35)}
.ch-det{width:100%;max-width:520px;padding:12px 0 14px;display:flex;flex-direction:column;gap:10px}
.ch-det p{margin:0;text-align:center;font-size:13px;color:var(--dim)}.ch-det b{color:var(--ink);font-family:var(--disp)}
.ch-dust{padding:8px 14px;border-radius:14px;font-family:var(--disp);font-size:13px;color:#9be7ff}
#ch-open{position:fixed;inset:0;z-index:60;display:none;background:#02030a;touch-action:none}
#ch-open.on{display:block}#ch-open canvas{position:absolute;inset:0;width:100%;height:100%}
.co-hint{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);text-align:center;font:700 15px var(--disp);letter-spacing:1.5px;color:#fff;text-shadow:0 0 14px #4df3ff;animation:chh 1.6s ease-in-out infinite;pointer-events:none}
@keyframes chh{50%{opacity:.35}}
.co-x{position:absolute;right:16px;top:calc(env(safe-area-inset-top,0px) + 12px);width:46px;height:46px;border-radius:15px;display:grid;place-items:center;font-size:18px;z-index:2}
.co-card{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);padding:0 22px;display:flex;flex-direction:column;align-items:center;gap:8px;animation:rise .6s cubic-bezier(.2,1.2,.3,1)}
.co-card h2{margin:0;font:900 28px var(--disp);text-align:center;letter-spacing:1px}
.co-card .tag{margin:0;font:700 13px var(--disp);letter-spacing:3px;text-transform:uppercase}
.co-card p{margin:0;color:var(--dim);font-size:14px}
.co-card .btns{max-width:360px}
`;

let ui = {};
function mount() {
  const st1 = document.createElement('style'); st1.textContent = CSS; document.head.appendChild(st1);
  const menu = $('#s-title .menu');
  const row = document.createElement('div'); row.className = 'ch-row';
  row.innerHTML = '<button class="big glass" id="b-chest"><span>Noyaux</span><small id="ch-sub"></small><i class="ch-bar"><b></b></i><span class="ch-badge" hidden></span></button><button class="big glass" id="b-coll"><span>Collection</span><small id="ch-csub"></small></button>';
  menu.appendChild(row);
  if (ADMIN) { const a = document.createElement('button'); a.className = 'ch-adm glass'; a.textContent = 'ADMIN'; a.id = 'b-adm'; $('#s-title').appendChild(a); }
  const d = document.createElement('div');
  d.innerHTML = `
  <div id="ch-banner" class="glass"></div>
  <div class="modal" id="ch-main"><div class="card glass"><h2>Noyaux scellés</h2><div class="ch-orbs" id="ch-orbs"></div>
    <p id="ch-msub"></p><i class="ch-bar" style="width:100%;height:7px"><b></b></i><p style="font-size:12px">À 100 % d'énergie, un noyau apparaît. Gagne de l'énergie en finissant des niveaux et des parties.</p>
    <div class="btns"><button class="big primary" id="ch-go">Ouvrir un noyau</button><button class="big glass" id="ch-tocoll">Collection</button><button class="big glass" id="ch-mclose">Fermer</button></div></div></div>
  <div id="ch-coll"><header class="bar"><button class="icon glass" id="ch-cback" aria-label="Retour"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><h2>Collection</h2><span class="ch-dust glass" id="ch-dust"></span></header>
    <div class="ch-tabs" id="ch-tabs"></div><div class="ch-prev glass" id="ch-prev"></div><div class="ch-grid" id="ch-grid"></div><div class="ch-det glass" id="ch-det" style="border-radius:20px;padding:14px"></div></div>
  <div class="modal" id="ch-admin"><div class="card glass"><h2>Admin</h2><p>Teste tout sans jouer. Retire ce panneau en passant ADMIN à false dans chest.js.</p>
    <div class="btns" id="ch-admbtns"></div></div></div>
  <div id="ch-open"><canvas></canvas><div class="co-hint">MAINTIENS POUR LIBÉRER L'ÉNERGIE</div><button class="co-x glass" aria-label="Fermer">✕</button><div class="co-card" hidden></div></div>`;
  document.body.append(...d.children);
  ui = { sub: $('#ch-sub'), csub: $('#ch-csub'), badge: $('.ch-badge'), chest: $('#b-chest'), banner: $('#ch-banner'), main: $('#ch-main'), coll: $('#ch-coll') };
  const click = (el, f) => el.addEventListener('click', () => { A.ui(); H.vib(9); f(); });
  click($('#b-chest'), showMain); click($('#b-coll'), showColl);
  click($('#ch-mclose'), () => ui.main.classList.remove('on')); ui.main.addEventListener('click', (e) => { if (e.target === ui.main) ui.main.classList.remove('on'); });
  click($('#ch-tocoll'), () => { ui.main.classList.remove('on'); showColl(); });
  click($('#ch-go'), () => { if (st.cores.length) { ui.main.classList.remove('on'); openNext(); } });
  click($('#ch-cback'), () => ui.coll.classList.remove('on'));
  ui.banner.addEventListener('click', () => { ui.banner.classList.remove('on'); if (st.cores.length) showMain(); });
  if (ADMIN) { click($('#b-adm'), showAdmin); $('#ch-admin').addEventListener('click', (e) => { if (e.target.id === 'ch-admin') e.currentTarget.classList.remove('on'); }); }
}

function refresh() {
  if (!ui.sub) return;
  const n = st.cores.length, owned = DROPS.filter((i) => st.owned[i.id]).length + 1;
  ui.sub.textContent = n ? `${n} prêt${n > 1 ? 's' : ''} à ouvrir` : `Énergie ${st.energy} %`;
  ui.csub.textContent = `${owned}/${ITEMS.length}`;
  ui.chest.querySelector('.ch-bar b').style.width = st.energy + '%';
  ui.badge.hidden = !n; ui.badge.textContent = n; ui.chest.classList.toggle('ch-ready', n > 0);
  const m = $('#ch-main .ch-bar b'); if (m) m.style.width = st.energy + '%';
  $('#ch-msub').textContent = n ? `${n} noyau${n > 1 ? 'x' : ''} prêt${n > 1 ? 's' : ''}` : `Énergie critique : ${st.energy} %`;
  $('#ch-orbs').innerHTML = '<span class="ch-orb"></span>'.repeat(Math.min(n, 12));
  const go = $('#ch-go'); go.style.opacity = n ? 1 : 0.4; go.textContent = n ? 'Ouvrir un noyau' : 'Aucun noyau';
  if (ui.coll.classList.contains('on')) buildColl();
}
function showMain() { refresh(); ui.main.classList.add('on'); }

let bT = 0;
function showBanner(g, cores, extra, delay) {
  setTimeout(() => {
    const b = ui.banner;
    b.innerHTML = `⚡ +${g} énergie<span class="ch-bar"><b style="width:${st.energy}%"></b></span>` + (cores ? `<small>🔮 ${cores > 1 ? cores + ' noyaux obtenus' : 'Noyau scellé obtenu'} — touche pour ouvrir</small>` : '') + (extra ? `<small>${extra}</small>` : '');
    b.classList.add('on'); if (cores) H.vib([14, 60, 14, 60, 14]);
    clearTimeout(bT); bT = setTimeout(() => b.classList.remove('on'), cores ? 4200 : 2400);
  }, delay);
}

/* ---- collection : skins + matières, avec aperçus en direct ---- */
let selId = 'default', selMat = 'skin', tab = 'skins', thumbs = [], cRaf = 0, cLast = 0;
const unlockedBy = (m) => ITEMS.filter((i) => i.v === m).map((i) => i.n).join(', ') || '—';
// matière d'aperçu d'une skin : celle choisie, sinon la sienne
const previewMat = (it) => (st.mat && st.mat !== 'skin' && matUnlocked(st.mat) ? st.mat : it.v || 'glass');
function paintThumbs(t) {
  const eq = item(st.eq);
  for (const th of thumbs) {
    const cv = th.cv; if (!cv.isConnected) continue;
    const c = th.c || (th.c = cv.getContext('2d')), w = cv.width, h = cv.height, k = w / (th.css || 56);
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h); c.setTransform(k, 0, 0, k, 0, 0);
    const W = w / k, Hh = h / k;
    if (th.kind === 'prev') [1, 2, 3].forEach((ty, i) => Skins.drawOrb(c, curMat, W * (0.2 + i * 0.3), Hh / 2, ty === 1 ? 30 : 25, colorOf(eq, ty, t, t * 40), ty, t, { gl: matGl() }));
    else if (th.kind === 'skin') Skins.drawOrb(c, previewMat(th.it), W / 2, Hh / 2, 19, colorOf(th.it, 1, t, t * 40), 1, t, { gl: 0.9 });
    else Skins.drawOrb(c, th.mat === 'skin' ? eq.v || 'glass' : th.mat, W / 2, Hh / 2, 19, colorOf(eq, 1, t, t * 40), 1, t, { gl: 0.9 });
  }
}
function collLoop(now) {
  if (!ui.coll.classList.contains('on')) { cRaf = 0; return; }
  cRaf = requestAnimationFrame(collLoop);
  if (O || now - cLast < 45) return; cLast = now; paintThumbs(now / 1000);
}
function buildColl() {
  $('#ch-dust').textContent = `✦ ${st.dust}`;
  thumbs = [];
  const eq = item(st.eq), auto = !(st.mat && st.mat !== 'skin' && matUnlocked(st.mat));
  // onglets
  const tabs = $('#ch-tabs');
  tabs.innerHTML = `<button data-t="skins" class="${tab === 'skins' ? 'on' : ''}">Skins</button><button data-t="mats" class="${tab === 'mats' ? 'on' : ''}">Matières</button>`;
  tabs.querySelectorAll('button').forEach((b) => b.onclick = () => { A.select(); H.vib(8); tab = b.dataset.t; buildColl(); });
  // aperçu de ce qui est équipé + raccourcis vers les deux menus
  const pv = $('#ch-prev');
  pv.innerHTML = `<canvas width="600" height="168"></canvas><div class="ch-pl"><button data-t="skins">Skin · <b>${eq.n}</b></button><button data-t="mats">Matière · <b>${matName(curMat)}</b>${auto ? ' (auto)' : ''}</button></div>`;
  thumbs.push({ cv: pv.querySelector('canvas'), kind: 'prev', css: 300 });
  pv.querySelectorAll('button').forEach((b) => b.onclick = () => { A.select(); H.vib(8); tab = b.dataset.t; buildColl(); });
  const g = $('#ch-grid'), det = $('#ch-det');
  const addBtn = (label, cls, f) => { const b = document.createElement('button'); b.className = 'big ' + cls + ' half'; b.textContent = label; b.onclick = () => { A.ui(); H.vib(9); f(); }; $('#ch-actions', det).appendChild(b); };
  const tile = (cls, id, rc, name, sub, badge) => `<button class="ch-it ${cls}" data-id="${id}" style="--rc:${rg(rc, 1)}">${badge ? '<em>✓</em>' : ''}<canvas class="ch-th" width="112" height="112"></canvas><span>${name}</span><i>${sub}</i></button>`;
  if (tab === 'skins') {
    g.innerHTML = ITEMS.map((it) => { const own = !!st.owned[it.id]; return tile(`${own ? '' : 'lock'} ${it.id === selId ? 'sel' : ''}`, it.id, rarCol(Math.max(0, it.r), 0), own ? it.n : '???', it.r < 0 ? 'Départ' : RAR[it.r].n, st.eq === it.id); }).join('');
    g.querySelectorAll('.ch-it').forEach((b, i) => { thumbs.push({ cv: b.querySelector('canvas'), kind: 'skin', it: ITEMS[i] }); b.onclick = () => { A.select(); H.vib(8); selId = b.dataset.id; buildColl(); }; });
    const it = item(selId), own = !!st.owned[it.id], isEq = st.eq === it.id;
    const bits = [it.m && 'animée', it.b && 'explosion spéciale', it.s && 'gamme sonore unique', it.v && 'matière ' + matName(it.v).toLowerCase()].filter(Boolean).join(' · ');
    det.innerHTML = `<p><b>${own ? it.n : 'Skin inconnue'}</b> · ${it.r < 0 ? 'Départ' : RAR[it.r].n}${own && bits ? ' · ' + bits : ''}${own ? ' · ×' + st.owned[it.id] : ''}</p><div class="row" id="ch-actions"></div>`;
    if (own) addBtn(isEq ? 'Équipée ✓' : 'Équiper', isEq ? 'glass' : 'primary', () => { st.eq = it.id; applyEq(); save(); buildColl(); });
    else if (it.r >= 0) addBtn(`Fabriquer ✦ ${RAR[it.r].cost}`, st.dust >= RAR[it.r].cost ? 'primary' : 'glass', () => {
      if (st.dust < RAR[it.r].cost) { H.toast(`Il te faut ${RAR[it.r].cost} ✦ de poussière`); return; }
      st.dust -= RAR[it.r].cost; st.owned[it.id] = 1; save(); H.vib([14, 60, 14, 60, 14]); H.toast(it.n + ' débloquée'); refresh(); buildColl();
    });
    if (ADMIN && it.r >= 0) addBtn('Tester l\'ouverture', 'glass', () => startOpen({ r: it.r, id: it.id }, true));
  } else {
    const list = [['skin', 'Auto']].concat(Skins.MATS);
    g.innerHTML = list.map(([id, n]) => { const ok = id === 'skin' || matUnlocked(id); return tile(`${ok ? '' : 'lock'} ${id === selMat ? 'sel' : ''}`, id, ok ? [160, 220, 255] : [160, 170, 190], ok ? n : '???', id === 'skin' ? 'Suit la skin' : ok ? (st.mat === id ? 'Utilisée' : 'Matière') : 'Verrouillée', id === 'skin' ? auto : st.mat === id && !auto); }).join('');
    g.querySelectorAll('.ch-it').forEach((b, i) => { thumbs.push({ cv: b.querySelector('canvas'), kind: 'mat', mat: list[i][0] }); b.onclick = () => { A.select(); H.vib(8); selMat = b.dataset.id; buildColl(); }; });
    const ok = selMat === 'skin' || matUnlocked(selMat), used = selMat === 'skin' ? auto : !auto && st.mat === selMat;
    det.innerHTML = `<p><b>${selMat === 'skin' ? 'Matière de la skin' : ok ? matName(selMat) : 'Matière verrouillée'}</b> · ${selMat === 'skin' ? 'chaque skin garde sa propre matière' : ok ? 's\'applique à n\'importe quelle skin' : 'débloquée par : ' + unlockedBy(selMat)}</p><div class="row" id="ch-actions"></div>`;
    if (ok) addBtn(used ? 'Utilisée ✓' : 'Utiliser', used ? 'glass' : 'primary', () => { st.mat = selMat; applyEq(); save(); H.vib(HP_OK); buildColl(); });
  }
  if (!cRaf) cRaf = requestAnimationFrame(collLoop);
  paintThumbs(performance.now() / 1000);
}
const HP_OK = [12, 50, 12];
function showColl() { buildColl(); ui.coll.classList.add('on'); if (!cRaf) cRaf = requestAnimationFrame(collLoop); }

/* ---- admin ---- */
function showAdmin() {
  const box = $('#ch-admbtns'); box.innerHTML = '';
  const add = (label, f, cls = 'glass') => { const b = document.createElement('button'); b.className = 'big ' + cls; b.textContent = label; b.onclick = () => { A.ui(); H.vib(9); f(); }; box.appendChild(b); };
  RAR.forEach((r, i) => add(`Tester l'ouverture · ${r.n}`, () => { $('#ch-admin').classList.remove('on'); startOpen({ r: i, id: pickItem(i).id }, true); }, i >= 3 ? 'primary' : 'glass'));
  add('+1 noyau', () => { addCore(); save(); refresh(); H.toast('+1 noyau'); });
  add('+10 noyaux', () => { for (let i = 0; i < 10; i++) addCore(); save(); refresh(); H.toast('+10 noyaux'); });
  add('+100 énergie', () => { H.toast('+100 énergie'); showBanner(100, gain(100), '', 0); });
  add('+1000 poussière', () => { st.dust += 1000; save(); refresh(); H.toast('+1000 ✦'); });
  add('Tout débloquer', () => { ITEMS.forEach((i) => { st.owned[i.id] = st.owned[i.id] || 1; }); save(); refresh(); H.toast('Tout est débloqué'); });
  add('Réinitialiser le coffre', () => { Object.assign(st, { energy: 0, cores: [], owned: { default: 1 }, eq: 'default', mat: 'skin', dust: 0, opens: 0, pity: [0, 0, 0], worlds: [] }); applyEq(); save(); refresh(); H.toast('Coffre réinitialisé'); });
  add('Fermer', () => $('#ch-admin').classList.remove('on'), 'primary');
  $('#ch-admin').classList.add('on');
}

/* ============================== ouverture animée ============================== */
let O = null, ctx = null;
const openNext = () => { const c = st.cores.shift(); if (!c) return; save(); refresh(); startOpen(c, false); };

function startOpen(core, test) {
  if (O) return;
  const it = item(core.id), isNew = !st.owned[it.id];
  if (!test) { if (isNew) st.owned[it.id] = 1; else { st.owned[it.id]++; st.dust += RAR[it.r].dust; } st.opens++; save(); refresh(); }
  const root = $('#ch-open'); root.classList.add('on');
  const cv = $('canvas', root), dpr = Math.min(window.devicePixelRatio || 1, FX < 1 ? 1.5 : 2), W = root.clientWidth || innerWidth, Hh = root.clientHeight || innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); ctx = cv.getContext('2d');
  O = { it, r: core.r, test, isNew, dust: RAR[it.r].dust, W, H: Hh, dpr, cx: W / 2, cy: Hh * 0.42, R: Math.min(W, Hh) * 0.235, ph: 'idle', pt: 0, T: 0, ts: 1, charge: 0, hold: false, beat: 0, flash: 0, shake: 0, freeze: 0, raysA: 0, parts: [], rings: [], frags: [], sprites: [], links: [], k: 0, last: performance.now(), tint: [77, 243, 255], bg: [20, 40, 90], bgA: 0.25, susTick: 0, cracks: makeCracks(), bokeh: makeBokeh(W, Hh) };
  $('.co-hint', root).style.display = ''; $('.co-card', root).hidden = true; $('.co-x', root).style.display = '';
  O.raf = requestAnimationFrame(loop);
}
function closeOpen(then) {
  if (!O) return; cancelAnimationFrame(O.raf); O = null;
  $('#ch-open').classList.remove('on'); refresh(); if (then) setTimeout(then, 120);
}

function pBurst(x, y, n, col, speed, life = 1, size = 3, g = 0) {
  n = Math.round(n * FX);
  for (let i = 0; i < n && O.parts.length < 1100; i++) { const a = Math.random() * TAU, s = speed * (0.2 + Math.random() * 0.9); O.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: life * (0.5 + Math.random() * 0.8), s: size * (0.6 + Math.random()), col: col || hsl(Math.random() * 360, 100, 66), g }); }
}
const pRing = (x, y, r0, r1, max, col, w = 0.08) => O.rings.push({ x, y, r0, r1, t: 0, max, col, w });
const ticks = (n, gap = 62) => { const p = []; for (let i = 0; i < n; i++) { if (i) p.push(gap); p.push(14); } return p; };

function loop(now) {
  if (!O) return;
  O.raf = requestAnimationFrame(loop);
  const rd = Math.min(0.05, (now - O.last) / 1000); O.last = now;
  let dt = rd; if (O.freeze > 0) { O.freeze -= rd; dt = 0; }
  O.pt += rd; O.T += rd;
  O.ts += ((O.tsT == null ? 1 : O.tsT) - O.ts) * Math.min(1, rd * 8);
  dt *= O.ts;
  phase(rd, dt);
  for (const p of O.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= 1 - dt * 0.6; p.vy *= 1 - dt * 0.6 * (p.g ? 0 : 1); }
  O.parts = O.parts.filter((p) => p.t < p.max);
  for (const r of O.rings) r.t += dt; O.rings = O.rings.filter((r) => r.t < r.max);
  for (const f of O.frags) f.t += dt; O.frags = O.frags.filter((f) => f.t < f.max);
  for (const s of O.sprites) s.t += dt; O.sprites = O.sprites.filter((s) => s.t < s.max);
  for (const l of O.links) l.t += dt; O.links = O.links.filter((l) => l.t < l.max);
  O.flash = Math.max(0, O.flash - rd * 2.4); O.shake *= Math.pow(0.02, rd);
  draw();
}

function phase(rd, dt) {
  const o = O;
  if (o.ph === 'idle' || o.ph === 'charge') {
    o.charge = o.hold ? Math.min(1, o.charge + rd / 1.7) : Math.max(0, o.charge - rd * 1.6);
    o.ph = o.charge > 0.001 ? 'charge' : 'idle';
    $('.co-hint').style.display = o.charge > 0.02 ? 'none' : '';
    if (o.charge > 0) {
      o.beat -= rd;
      if (o.beat <= 0) { const p = o.charge; o.beat = 0.56 - 0.45 * p; A.chestBeat(p); H.vib(p > 0.7 ? [16, 44, 16] : 12); pRing(o.cx, o.cy, o.R * 0.9, o.R * (1.5 + p), 0.4, mix(o.tint, [255, 255, 255], p), 0.022); }
      if (Math.random() < o.charge) { const a = Math.random() * TAU, d = o.R * (2.2 + Math.random() * 2); o.parts.push({ x: o.cx + Math.cos(a) * d, y: o.cy + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.2, vy: -Math.sin(a) * d * 2.2, t: 0, max: 0.45, s: 2.2, col: hsl(a * 57 + o.T * 80, 100, 70), g: 0 }); }
    }
    o.shake = Math.max(o.shake, o.charge * o.charge * 9);
    o.tint = hsl(200 + 130 * (0.5 + 0.5 * Math.sin(o.T * 0.7)), 100, 62);
    if (o.charge >= 1) startCrack();
  } else if (o.ph === 'crack') {
    if (o.pt > 0.9) startChain();
  } else if (o.ph === 'chain') {
    while (o.k < o.N && o.pt >= o.nextT) { explode(o.k); o.k++; o.nextT += o.gap; }
    if (o.k >= o.N && o.pt > o.nextT + 0.3) startSus();
  } else if (o.ph === 'sus') {
    const p = clamp(o.pt / o.dur, 0, 1);
    const idx = p > 0.92 ? o.r : Math.floor(o.pt * (11 - 7 * p)) % 5;
    o.tint = rarCol(idx, o.T); o.bg = o.tint; o.bgA = 0.15 + 0.35 * p;
    o.susTick -= rd; if (o.susTick <= 0) { o.susTick = 0.17 - 0.12 * p; H.vib(10); }
    o.shake = Math.max(o.shake, 2 + p * 5);
    if (o.pt >= o.dur) reveal();
  } else if (o.ph === 'reveal') {
    if (o.r >= 3 && Math.random() < 0.7 && o.parts.length < 1000) o.parts.push({ x: Math.random() * o.W, y: o.H + 10, vx: (Math.random() - 0.5) * 40, vy: -(120 + Math.random() * 200), t: 0, max: 2.6, s: 2.4, col: o.r === 4 ? hsl(Math.random() * 360, 100, 66) : [255, 214, 120], g: 0 });
    if (!o.cardShown && o.pt > 0.55) showCard();
  }
}

function startCrack() {
  const o = O; o.ph = 'crack'; o.pt = 0; o.flash = 0.4 + 0.15 * o.r; o.shake = 14 + o.r * 3; o.raysA = [0.3, 0.45, 0.65, 0.85, 1][o.r]; o.tsT = 1;
  A.chestCrack(); H.vib([34, 40, 34, 40, 60, 40, 100]);
  for (let k = 0; k < 26; k++) { // éclats de verre triangulaires
    const a = Math.random() * TAU, d = Math.random() * o.R * 0.9, sz = o.R * (0.12 + Math.random() * 0.22), sp = 160 + Math.random() * 520, ang = Math.random() * TAU;
    const pts = [0, 1, 2].map((q) => { const aa = ang + q * 2.1 + Math.random() * 0.6, rr = sz * (0.55 + Math.random() * 0.7); return [Math.cos(aa) * rr, Math.sin(aa) * rr]; });
    o.frags.push({ x: o.cx + Math.cos(a) * d, y: o.cy + Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 9, t: 0, max: 0.9 + Math.random() * 0.5, pts, col: hsl(a * 57 + 180, 90, 62) });
  }
  pRing(o.cx, o.cy, o.R * 0.5, Math.max(o.W, o.H), 0.8, [255, 255, 255], 0.03);
  pRing(o.cx, o.cy, o.R * 0.5, Math.max(o.W, o.H) * 0.7, 0.6, [77, 243, 255], 0.05);
  pBurst(o.cx, o.cy, 120, null, o.R * 7, 1, 3);
  $('.co-x').style.display = 'none';
}
function startChain() {
  const o = O; o.ph = 'chain'; o.pt = 0; o.k = 0; o.N = [3, 5, 7, 10, 14][o.r]; o.gap = o.N > 7 ? 0.085 : 0.13; o.nextT = 0; o.hidden = true; o.prev = { x: o.cx, y: o.cy };
}
function explode(k) {
  const o = O, a = k * 2.399 + 0.5, rad = Math.min(Math.min(o.W, o.H) * 0.44, o.R * (1.5 + k * 0.2));
  const x = o.cx + Math.cos(a) * rad, y = o.cy + Math.sin(a) * rad * 1.1, col = hsl(k * 47 + o.T * 60, 100, 62);
  pRing(x, y, 8, o.R * (1.4 + k * 0.06), 0.55, col, 0.07); pRing(x, y, 5, o.R * 0.8, 0.3, [255, 255, 255], 0.05);
  pBurst(x, y, 26 + k * 3, col, o.R * 4.5, 0.9, 2.8);
  o.sprites.push({ x, y, r: o.R * 0.42, t: 0, max: 0.34, col, type: 1 + (k % 3) });
  o.links.push({ x1: o.prev.x, y1: o.prev.y, x2: x, y2: y, t: 0, max: 0.35, col }); o.prev = { x, y };
  o.shake = Math.max(o.shake, 6 + k * 1.4); o.flash = Math.max(o.flash, 0.25 + k * 0.03);
  A.boom(k + 1); H.vib(k % 3 === 2 ? [12, 30, 12] : 12);
}
function startSus() {
  const o = O; o.ph = 'sus'; o.pt = 0; o.dur = o.r >= 3 ? 1.5 : o.r >= 2 ? 1.15 : 0.85; o.tsT = 0.5; o.susTick = 0; o.hidden = false; o.charge = 1;
  A.chestRise(o.dur);
}
function reveal() {
  const o = O, col = rarCol(o.r, o.T); o.ph = 'reveal'; o.pt = 0; o.freeze = 0.09; o.tsT = 1; o.flash = FLASH[o.r]; o.shake = 8 + o.r * 6; o.raysA = RAYS[o.r]; o.hidden = true; o.cardShown = false;
  o.bg = col; o.bgA = BGA[o.r];
  [0, 0.08, 0.17, 0.27, 0.4].slice(0, o.r + 1).forEach((d, i) => setTimeout(() => { if (O === o) pRing(o.cx, o.cy, o.R * 0.3, Math.max(o.W, o.H) * (0.55 + i * 0.12), 0.9, i % 2 ? [255, 255, 255] : rarCol(o.r, o.T), 0.04); }, d * 1000));
  pBurst(o.cx, o.cy, 160 + o.r * 50, o.r === 4 ? null : col, o.R * 8, 1.4, 3.2);
  pBurst(o.cx, o.cy, 60, [255, 255, 255], o.R * 6, 1, 2.4);
  A.chestReveal(o.r);
  H.vib([[22], [14, 60, 14], ticks(3), ticks(5, 55), ticks(8, 50)][o.r]);
  if (o.r === 4) setTimeout(() => H.vib(ticks(4, 80)), 700);
}
function showCard() {
  const o = O, card = $('.co-card'); o.cardShown = true;
  const col = rarCol(o.r, o.T), rc = rg(col, 1), more = st.cores.length;
  card.innerHTML = `<p class="tag" style="color:${rc};text-shadow:0 0 ${Math.round(3 + GL[o.r] * 11)}px ${rc}">${RAR[o.r].n}</p><h2 style="text-shadow:0 0 ${Math.round(5 + GL[o.r] * 17)}px ${rc}">${o.it.n}</h2>
    <p>${o.test ? 'Test d\'ouverture (rien n\'est ajouté)' : o.isNew ? '✦ Nouvelle skin !' : `Doublon · +${o.dust} ✦ de poussière`}</p>
    <div class="btns"><button class="big primary" id="co-eq">${o.test ? 'Fermer' : st.eq === o.it.id ? 'Équipée ✓' : 'Équiper'}</button>${!o.test && more ? `<button class="big glass" id="co-next">Ouvrir le suivant (${more})</button>` : ''}${o.test ? '' : '<button class="big glass" id="co-close">Fermer</button>'}</div>`;
  card.hidden = false; $('.co-x').style.display = '';
  const b = (id, f) => { const e = $(id, card); if (e) e.onclick = () => { A.ui(); H.vib(9); f(); }; };
  b('#co-eq', () => { if (o.test) return closeOpen(); st.eq = o.it.id; applyEq(); save(); closeOpen(); });
  b('#co-next', () => closeOpen(openNext)); b('#co-close', () => closeOpen());
}

/* ---- rendu : sphères de verre opale (liquid glass) ---- */
const hueOf = (c) => {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return 200;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
};
const lite = (c, k) => mix(c, [255, 255, 255], k), shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
function makeCracks() {
  const out = [];
  for (let i = 0; i < 8; i++) { let a = (i / 8) * TAU + Math.random() * 0.5, rr = 0; const pts = [[0, 0]]; for (let s = 0; s < 6; s++) { rr += 0.16 + Math.random() * 0.08; a += (Math.random() - 0.5) * 0.7; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } out.push(pts); }
  return out;
}
const makeBokeh = (W, Hh) => Array.from({ length: 16 }, () => ({ x: Math.random() * W, y: Math.random() * Hh, r: 20 + Math.random() * 50, s: 6 + Math.random() * 14, ph: Math.random() * TAU, h: Math.random() * 360 }));

// Une sphère de verre : corps teinté, lueur interne, reflets opale mouvants, caustique, reflets spéculaires, bord fresnel. Aucun contour sombre.
function drawGem(x, y, r, col, type, t, o = {}) {
  if (o.v && o.v !== 'glass') { ctx.save(); if (o.a != null) ctx.globalAlpha *= o.a; Skins.drawOrb(ctx, o.v, x, y, r, col, type, t, { gl: o.gl }); ctx.restore(); return; }
  const g = ctx, seed = o.seed || 0, h0 = hueOf(col), lum = (col[0] + col[1] + col[2]) / 765, L = (k) => lite(col, k * (1 - 0.55 * lum));
  g.save(); if (o.a != null) g.globalAlpha *= o.a;
  g.globalCompositeOperation = 'lighter';
  let gr = g.createRadialGradient(x, y, r * 0.7, x, y, r * 2.5); gr.addColorStop(0, rg(col, 0.5 * (o.gl == null ? 1 : o.gl))); gr.addColorStop(1, rg(col, 0));
  g.fillStyle = gr; g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  g.globalCompositeOperation = 'source-over';
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
  // corps : centre clair, milieu saturé, bord éclairci (le verre ne finit jamais en noir)
  gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  gr.addColorStop(0, rg(L(0.8), 0.96)); gr.addColorStop(0.42, rg(L(0.25), 0.94)); gr.addColorStop(0.8, rg(shade(col, 0.72), 0.96)); gr.addColorStop(1, rg(lite(col, 0.35), 0.98));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.globalCompositeOperation = 'lighter';
  // jeu de couleurs de l'opale : taches irisées qui dérivent à l'intérieur
  for (let k = 0; k < 6; k++) {
    const a = t * (0.22 + k * 0.06) + k * 1.05 + seed, d = r * (0.12 + 0.5 * (((k * 37) % 10) / 10)), bx = x + Math.cos(a) * d, by = y + Math.sin(a * 1.3) * d * 0.9, br = r * (0.45 + 0.15 * Math.sin(t + k));
    const hc = hsl(h0 + k * 48 - 110 + 40 * Math.sin(t * 0.7 + k), 100, 62), b2 = g.createRadialGradient(bx, by, 0, bx, by, br);
    b2.addColorStop(0, rg(hc, 0.42)); b2.addColorStop(1, rg(hc, 0)); g.fillStyle = b2; g.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  // cœur lumineux + caustique de réfraction en bas
  gr = g.createRadialGradient(x, y, 0, x, y, r * 0.55); gr.addColorStop(0, rg(L(0.8), 0.6)); gr.addColorStop(0.4, rg(col, 0.3)); gr.addColorStop(1, rg(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  gr = g.createRadialGradient(x + r * 0.12, y + r * 0.92, 0, x + r * 0.12, y + r * 0.92, r * 0.75); gr.addColorStop(0, rg(lite(col, 0.6), 0.6)); gr.addColorStop(1, rg(col, 0));
  g.fillStyle = gr; g.fillRect(x - r, y, r * 2, r);
  // fissures lumineuses (charge)
  if (o.cr > 0.02 && o.cracks) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const pts of o.cracks) {
      const n = o.cr * (pts.length - 1); g.beginPath(); g.moveTo(x, y);
      for (let i = 1; i < pts.length; i++) { const f = Math.min(1, n - (i - 1)); if (f <= 0) break; const px = lerp(pts[i - 1][0], pts[i][0], f), py = lerp(pts[i - 1][1], pts[i][1], f); g.lineTo(x + px * r, y + py * r); }
      g.strokeStyle = rg(col, 0.35); g.lineWidth = r * 0.08; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = r * 0.022; g.stroke();
    }
  }
  // symbole incrusté : lueur large + trait blanc fin
  if (type) {
    const L = r * 0.34; g.lineCap = 'round';
    const sym = () => { g.beginPath(); if (type !== 2) { g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); } if (type >= 2) { const d = L * 0.72; g.moveTo(x - d, y - d); g.lineTo(x + d, y + d); g.moveTo(x + d, y - d); g.lineTo(x - d, y + d); } g.stroke(); };
    g.globalCompositeOperation = 'source-over'; g.strokeStyle = rg(shade(col, 0.5), 0.5); g.lineWidth = r * 0.22; sym();
    g.globalCompositeOperation = 'lighter'; g.strokeStyle = rg(col, 0.4); g.lineWidth = r * 0.3; sym();
    g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(255,255,255,.96)'; g.lineWidth = r * 0.1; sym();
  }
  g.globalCompositeOperation = 'source-over'; g.restore();
  // bord fresnel + reflets spéculaires
  g.lineWidth = r * 0.05; g.strokeStyle = rg(lite(col, 0.7), 0.5); g.beginPath(); g.arc(x, y, r * 0.965, 0, TAU); g.stroke();
  g.save(); g.translate(x - r * 0.33, y - r * 0.46); g.rotate(-0.62);
  const eg = g.createLinearGradient(-r * 0.45, 0, r * 0.45, 0); eg.addColorStop(0, 'rgba(255,255,255,0)'); eg.addColorStop(0.35, 'rgba(255,255,255,.78)'); eg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = eg; g.beginPath(); g.ellipse(0, 0, r * 0.46, r * 0.17, 0, 0, TAU); g.fill(); g.restore();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(x + r * 0.36, y + r * 0.52, r * 0.13, r * 0.06, 0.6, 0, TAU); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * 0.52, y - r * 0.56, r * 0.06, 0, TAU); g.fill();
  g.lineCap = 'round'; g.lineWidth = r * 0.045; g.strokeStyle = 'rgba(255,255,255,.72)'; g.beginPath(); g.arc(x, y, r * 0.88, Math.PI * 1.08, Math.PI * 1.45); g.stroke();
  g.strokeStyle = rg(lite(col, 0.5), 0.5); g.beginPath(); g.arc(x, y, r * 0.88, Math.PI * 0.1, Math.PI * 0.35); g.stroke();
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
  g.restore();
}
// Noyau scellé : sphère opale + anneaux orbitaux lumineux qui passent derrière puis devant
function drawCore(x, y, R, tint, ch, t, noCracks) {
  const g = ctx, spin = t * (0.7 + ch * 4), hc = hueOf(tint);
  const ring = (k, front) => {
    const rx = R * (1.55 + k * 0.1), ry = rx * (0.28 + k * 0.2), rot = (k - 1) * 0.55 + 0.25 * Math.sin(t * 0.5 + k), c = hsl(hc + k * 60, 100, 68);
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    const a0 = front ? 0 : Math.PI, a1 = front ? Math.PI : TAU;
    g.strokeStyle = rg(c, 0.14); g.lineWidth = R * 0.1; g.beginPath(); g.ellipse(x, y, rx, ry, rot, a0, a1); g.stroke();
    g.strokeStyle = rg(lite(c, 0.4), front ? 0.9 : 0.5); g.lineWidth = R * 0.022; g.stroke();
    const pp = spin * (1.2 + k * 0.3) + k * 2.1, sn = Math.sin(pp);
    if ((sn > 0) === front) { const ex = Math.cos(pp) * rx, ey = sn * ry, bx = x + ex * Math.cos(rot) - ey * Math.sin(rot), by = y + ex * Math.sin(rot) + ey * Math.cos(rot), bg = g.createRadialGradient(bx, by, 0, bx, by, R * 0.16); bg.addColorStop(0, 'rgba(255,255,255,1)'); bg.addColorStop(0.3, rg(c, 0.8)); bg.addColorStop(1, rg(c, 0)); g.fillStyle = bg; g.fillRect(bx - R * 0.16, by - R * 0.16, R * 0.32, R * 0.32); }
    g.globalCompositeOperation = 'source-over';
  };
  for (let k = 0; k < 3; k++) ring(k, false);
  drawGem(x, y, R, tint, 1, t, { cr: noCracks ? 0 : ch, cracks: O && O.cracks });
  for (let k = 0; k < 3; k++) ring(k, true);
}
function streak(x, y, len, col, a) { // traînée anamorphique horizontale
  const g = ctx; g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.scale(1, 0.05);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, len); gr.addColorStop(0, rg([255, 255, 255], a)); gr.addColorStop(0.25, rg(col, a * 0.5)); gr.addColorStop(1, rg(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, len, 0, TAU); g.fill(); g.restore();
}
function floorGlow(x, y, R, col, a) { // reflet de la sphère sur un sol brillant
  const g = ctx; g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.scale(1, 0.22);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.9); gr.addColorStop(0, rg(col, a)); gr.addColorStop(1, rg(col, 0));
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 1.9, 0, TAU); g.fill(); g.restore();
}
function draw() {
  const o = O, g = ctx, s = o.dpr, charging = o.ph === 'idle' || o.ph === 'charge';
  g.setTransform(s, 0, 0, s, 0, 0); g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#02030a'; g.fillRect(0, 0, o.W, o.H);
  const bgc = charging ? mix([20, 40, 90], o.tint, 0.4 + o.charge * 0.3) : o.bg, ba = charging ? 0.18 + o.charge * 0.35 : o.bgA;
  const bg = g.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, Math.max(o.W, o.H) * 0.85); bg.addColorStop(0, rg(bgc, ba)); bg.addColorStop(1, rg(bgc, 0));
  g.fillStyle = bg; g.fillRect(0, 0, o.W, o.H);
  // bokeh : disques de lumière flous qui flottent
  g.globalCompositeOperation = 'lighter';
  for (const b of o.bokeh) {
    const yy = (b.y - o.T * b.s + o.H * 4) % (o.H + 80) - 40, xx = b.x + Math.sin(o.T * 0.4 + b.ph) * 14, c = hsl(b.h + o.T * 10, 80, 60), bgr = g.createRadialGradient(xx, yy, 0, xx, yy, b.r);
    bgr.addColorStop(0, rg(c, 0.09)); bgr.addColorStop(0.7, rg(c, 0.05)); bgr.addColorStop(1, rg(c, 0)); g.fillStyle = bgr; g.fillRect(xx - b.r, yy - b.r, b.r * 2, b.r * 2);
  }
  g.globalCompositeOperation = 'source-over';
  g.save();
  if (o.shake > 0.2) g.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
  // rayons
  if (o.raysA > 0.01 && (o.ph === 'crack' || o.ph === 'chain' || o.ph === 'sus' || o.ph === 'reveal')) {
    g.globalCompositeOperation = 'lighter';
    const n = o.r >= 3 ? 28 : 18, len = Math.max(o.W, o.H) * 1.1, a0 = o.T * (o.r >= 3 ? 0.5 : 0.25);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + a0, w = 0.035 + 0.02 * Math.sin(o.T * 3 + i), c = o.r >= 3 || o.ph === 'crack' ? hsl(i * (360 / n) + o.T * 80, 100, 62) : rarCol(o.r, o.T);
      g.fillStyle = rg(c, 0.16 * o.raysA); g.beginPath(); g.moveTo(o.cx, o.cy); g.lineTo(o.cx + Math.cos(a - w) * len, o.cy + Math.sin(a - w) * len); g.lineTo(o.cx + Math.cos(a + w) * len, o.cy + Math.sin(a + w) * len); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  // noyau scellé
  if (!o.hidden && o.ph !== 'crack') {
    floorGlow(o.cx, o.cy + o.R * 1.6, o.R, o.tint, 0.55);
    const beat = o.ph === 'sus' ? 1 + 0.05 * Math.sin(o.pt * 40) : 1 + o.charge * 0.06 * Math.sin(o.T * (10 + o.charge * 30));
    const jx = (Math.random() - 0.5) * o.charge * o.charge * 7, jy = (Math.random() - 0.5) * o.charge * o.charge * 7;
    drawCore(o.cx + jx, o.cy + jy, o.R * beat, o.tint, o.ph === 'sus' ? 1 : o.charge, o.T, o.ph === 'sus');
  }
  if (o.ph === 'crack') { // sphère portée à blanc juste avant l'éclatement
    const p = clamp(o.pt / 0.9, 0, 1), R = o.R * (1 + p * 0.5);
    g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, R * 2.5); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, rg(hsl(o.T * 200, 100, 65), 0.6)); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(o.cx - R * 2.6, o.cy - R * 2.6, R * 5.2, R * 5.2); g.globalCompositeOperation = 'source-over';
  }
  // éclats de verre
  for (const f of o.frags) {
    const k = f.t / f.max, e = 1 - (1 - k) ** 2, px = f.x + f.vx * e, py = f.y + f.vy * e + 220 * k * k;
    g.save(); g.translate(px, py); g.rotate(f.rot + f.vr * k); g.globalAlpha = Math.max(0, 1 - k * k);
    g.beginPath(); g.moveTo(f.pts[0][0], f.pts[0][1]); g.lineTo(f.pts[1][0], f.pts[1][1]); g.lineTo(f.pts[2][0], f.pts[2][1]); g.closePath();
    const sg = g.createLinearGradient(f.pts[0][0], f.pts[0][1], f.pts[2][0], f.pts[2][1]); sg.addColorStop(0, rg(lite(f.col, 0.7), 0.75)); sg.addColorStop(1, rg(f.col, 0.25));
    g.fillStyle = sg; g.fill(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.3; g.stroke(); g.restore();
  }
  // liens de chaîne, éclosions, ondes (double trait : halo + cœur)
  g.globalCompositeOperation = 'lighter';
  for (const l of o.links) { const k = l.t / l.max; g.strokeStyle = rg(l.col, 0.3 * (1 - k)); g.lineWidth = 10 * (1 - k) + 2; g.beginPath(); g.moveTo(l.x1, l.y1); g.lineTo(l.x2, l.y2); g.stroke(); g.strokeStyle = rg(lite(l.col, 0.7), 0.9 * (1 - k)); g.lineWidth = 2.2 * (1 - k) + 0.6; g.stroke(); }
  g.globalCompositeOperation = 'source-over';
  for (const sp of o.sprites) { const k = sp.t / sp.max; drawGem(sp.x, sp.y, sp.r * (0.85 + k * 0.5), sp.col, sp.type, o.T, { a: 1 - k * k, seed: sp.x }); }
  g.globalCompositeOperation = 'lighter';
  for (const r of o.rings) { const k = r.t / r.max, e = 1 - (1 - k) ** 3, rad = Math.max(0.1, lerp(r.r0, r.r1, e)), w = Math.max(1.5, Math.abs(r.r1) * r.w * (1 - k)); g.strokeStyle = rg(r.col, 0.22 * (1 - k)); g.lineWidth = w * 2.6; g.beginPath(); g.arc(r.x, r.y, rad, 0, TAU); g.stroke(); g.strokeStyle = rg(lite(r.col, 0.6), 0.9 * (1 - k)); g.lineWidth = w; g.stroke(); }
  g.lineCap = 'round';
  for (const p of o.parts) {
    const k = p.t / p.max, a = 1 - k, sz = Math.max(0.8, p.s * (1 + (1 - k)) * 0.8), tl = 0.045, x2 = p.x - p.vx * tl, y2 = p.y - p.vy * tl;
    g.strokeStyle = rg(p.col, a * 0.28); g.lineWidth = sz * 3; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = rg(lite(p.col, 0.65), a); g.lineWidth = sz; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(x2, y2); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  // révélation : les trois sphères de la skin gagnée
  if (o.ph === 'reveal') {
    const k = clamp(o.pt / 0.5, 0, 1), e = 1 - (1 - k) ** 4, R = o.R * 0.8 * e, bob = Math.sin(o.T * 2) * 5, bumpP = o.T * 40, rc = rarCol(o.r, o.T);
    floorGlow(o.cx, o.cy + R * 1.9, R * 1.3, rc, 0.5 * GL[o.r]);
    for (const [dx, dy, ty, sc] of [[0, 0, 1, 1.15], [-1, 0.9, 2, 0.8], [1, 0.9, 3, 0.8]]) drawGem(o.cx + dx * R * 1.5 * (ty === 1 ? 0 : 1), o.cy + dy * R * 1.1 + bob + Math.sin(o.T * 0.8 + ty) * 4, R * sc, colorOf(o.it, ty, o.T, bumpP), ty, o.T, { seed: ty * 2, gl: GL[o.r], v: o.it.v });
    if (o.r >= 2) streak(o.cx, o.cy, o.W * 0.9, rc, 0.28 + 0.1 * Math.sin(o.T * 3));
  }
  g.restore();
  if (o.flash > 0.08) streak(o.cx, o.cy, Math.max(o.W, o.H) * 0.95, charging ? o.tint : rarCol(o.r, o.T), Math.min(1, o.flash) * 0.9);
  if (o.flash > 0.01) { g.fillStyle = `rgba(255,255,255,${Math.min(1, o.flash)})`; g.fillRect(0, 0, o.W, o.H); }
}

/* ============================== démarrage ============================== */
export function init(opts) {
  Object.assign(H, opts);
  mount(); refresh(); applyEq();
  const root = $('#ch-open');
  root.addEventListener('pointerdown', (e) => { if (!O || e.target.closest('.co-card,.co-x')) return; if (O.ph === 'idle' || O.ph === 'charge') { O.hold = true; try { root.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } } });
  const up = () => { if (O) O.hold = false; };
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up); root.addEventListener('lostpointercapture', up);
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  $('.co-x', root).addEventListener('click', () => { if (O && (O.ph === 'idle' || O.ph === 'charge' || O.ph === 'reveal')) { A.ui(); closeOpen(); } });
  if (ADMIN) window.__chest = { st, ITEMS, startOpen, addCore, gain };
}
