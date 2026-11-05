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
const rarCol = (r, t) => (r === 4 ? hsl(t * 90, 100, 66) : RAR[r].col);
// c = couleurs noyau / pulsar / étoile · m = animation · b = style d'explosion · s = gamme sonore
const RAW = [
  ['default', -1, 'Néon classique', ['#4df3ff', '#ff4fd8', '#ffc247']],
  ['solar', 0, 'Solaire', ['#ff9a3d', '#ff4d4d', '#ffe066']],
  ['ocean', 0, 'Abysses', ['#3d8bff', '#19d3c5', '#9ff3ff']],
  ['toxic', 0, 'Toxique', ['#9dff3d', '#35e07a', '#e5ff5c']],
  ['sakura', 0, 'Sakura', ['#ff9ec7', '#ffd1e6', '#ffffff']],
  ['mono', 0, 'Argent', ['#ffffff', '#b9c3d6', '#8a96ad']],
  ['glace', 1, 'Glace', ['#aef4ff', '#7fb8ff', '#e8fbff'], { m: 'shimmer' }],
  ['plasma', 1, 'Plasma', ['#8a5bff', '#3d7bff', '#d36bff'], { m: 'shimmer' }],
  ['rune', 1, 'Rune', ['#ffd24a', '#4dffb0', '#fff0a8'], { m: 'shimmer' }],
  ['magma', 1, 'Magma', ['#ff5a1f', '#ffb01f', '#ff2e63'], { m: 'flicker' }],
  ['anneaux', 2, 'Onde de choc', ['#4df3ff', '#7a6bff', '#ffffff'], { b: 'rings' }],
  ['fleur', 2, 'Floraison', ['#ff6fb5', '#ffb36f', '#fff08a'], { b: 'flower' }],
  ['glitch', 2, 'Glitch', ['#00ffd5', '#ff2bd6', '#fffb3d'], { b: 'glitch', m: 'shimmer' }],
  ['foudre', 2, 'Foudre', ['#f2f6ff', '#6fa8ff', '#fff27a'], { b: 'rings', m: 'flicker' }],
  ['prisme', 3, 'Prisme', ['#ffffff', '#ffffff', '#ffffff'], { m: 'prism', b: 'nova' }],
  ['vide', 3, 'Trou noir', ['#7a3dff', '#c04dff', '#3d2bff'], { m: 'void', b: 'implode' }],
  ['arcenciel', 3, 'Arc-en-ciel', ['#ff4d4d', '#4dff88', '#4d8bff'], { m: 'rainbow', b: 'flower' }],
  ['aurore', 4, 'Aurore boréale', ['#4dffb0', '#8a5bff', '#4df3ff'], { m: 'aurora', b: 'nova', s: [0, 2, 3, 7, 8] }],
  ['supernova', 4, 'Supernova', ['#ffffff', '#ffd24a', '#ff6fb5'], { m: 'rainbow', b: 'nova', s: [0, 2, 4, 7, 9] }],
];
export const ITEMS = RAW.map(([id, r, n, c, o]) => ({ id, r, n, c, rgb: c.map(hex), ...(o || {}) }));
const item = (id) => ITEMS.find((i) => i.id === id) || ITEMS[0];
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
const st = { energy: 0, cores: [], owned: { default: 1 }, eq: 'default', dust: 0, opens: 0, pity: [0, 0, 0], worlds: [] };
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
    <div class="ch-grid" id="ch-grid"></div><div class="ch-det glass" id="ch-det" style="border-radius:20px;padding:14px"></div></div>
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

/* ---- collection ---- */
let selId = 'default';
const swatch = (it) => {
  const c = it.c;
  if (it.m === 'rainbow' || it.m === 'prism') return 'conic-gradient(#ff4d4d,#ffd24a,#4dff88,#4df3ff,#8a5bff,#ff4fd8,#ff4d4d)';
  if (it.m === 'aurora') return 'conic-gradient(#4dffb0,#8a5bff,#4df3ff,#4dffb0)';
  return `linear-gradient(135deg,${c[0]},${c[1]} 55%,${c[2]})`;
};
function buildColl() {
  $('#ch-dust').textContent = `✦ ${st.dust}`;
  const g = $('#ch-grid');
  g.innerHTML = ITEMS.map((it) => {
    const own = !!st.owned[it.id], rc = rarCol(Math.max(0, it.r), 0);
    return `<button class="ch-it ${own ? '' : 'lock'} ${it.id === selId ? 'sel' : ''}" data-id="${it.id}" style="--rc:${rg(rc, 1)}">${st.eq === it.id ? '<em>✓</em>' : ''}<span class="ch-sw" style="background:${swatch(it)}"></span><span>${own ? it.n : '???'}</span><i>${it.r < 0 ? 'Départ' : RAR[it.r].n}</i></button>`;
  }).join('');
  g.querySelectorAll('.ch-it').forEach((b) => b.onclick = () => { A.select(); H.vib(8); selId = b.dataset.id; buildColl(); });
  const it = item(selId), own = !!st.owned[it.id], eq = st.eq === it.id;
  const det = $('#ch-det');
  const bits = [it.m && 'animée', it.b && 'explosion spéciale', it.s && 'gamme sonore unique'].filter(Boolean).join(' · ');
  det.innerHTML = `<p><b>${own ? it.n : 'Skin inconnue'}</b> · ${it.r < 0 ? 'Départ' : RAR[it.r].n}${own && bits ? ' · ' + bits : ''}${own ? ' · ×' + st.owned[it.id] : ''}</p><div class="row" id="ch-actions"></div>`;
  const act = $('#ch-actions', det);
  const add = (label, cls, f) => { const b = document.createElement('button'); b.className = 'big ' + cls + ' half'; b.textContent = label; b.onclick = () => { A.ui(); H.vib(9); f(); }; act.appendChild(b); };
  if (own) add(eq ? 'Équipée ✓' : 'Équiper', eq ? 'glass' : 'primary', () => { st.eq = it.id; applyEq(); save(); buildColl(); });
  else if (it.r >= 0) add(`Fabriquer ✦ ${RAR[it.r].cost}`, st.dust >= RAR[it.r].cost ? 'primary' : 'glass', () => {
    if (st.dust < RAR[it.r].cost) { H.toast(`Il te faut ${RAR[it.r].cost} ✦ de poussière`); return; }
    st.dust -= RAR[it.r].cost; st.owned[it.id] = 1; save(); H.vib([14, 60, 14, 60, 14]); H.toast(it.n + ' débloquée'); refresh(); buildColl();
  });
  if (ADMIN && it.r >= 0) add('Tester l\'ouverture', 'glass', () => startOpen({ r: it.r, id: it.id }, true));
}
function showColl() { buildColl(); ui.coll.classList.add('on'); }

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
  add('Réinitialiser le coffre', () => { Object.assign(st, { energy: 0, cores: [], owned: { default: 1 }, eq: 'default', dust: 0, opens: 0, pity: [0, 0, 0], worlds: [] }); applyEq(); save(); refresh(); H.toast('Coffre réinitialisé'); });
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
  O = { it, r: core.r, test, isNew, dust: RAR[it.r].dust, W, H: Hh, dpr, cx: W / 2, cy: Hh * 0.42, R: Math.min(W, Hh) * 0.19, ph: 'idle', pt: 0, T: 0, ts: 1, charge: 0, hold: false, beat: 0, flash: 0, shake: 0, freeze: 0, raysA: 0, parts: [], rings: [], frags: [], sprites: [], links: [], k: 0, last: performance.now(), tint: [77, 243, 255], bg: [20, 40, 90], bgA: 0.25, susTick: 0 };
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
      if (o.beat <= 0) { const p = o.charge; o.beat = 0.56 - 0.45 * p; A.chestBeat(p); H.vib(p > 0.7 ? [16, 44, 16] : 12); pRing(o.cx, o.cy, o.R * 0.9, o.R * (1.5 + p), 0.4, mix(o.tint, [255, 255, 255], p), 0.05); }
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
  const o = O; o.ph = 'crack'; o.pt = 0; o.flash = 1; o.shake = 26; o.raysA = 1; o.tsT = 1;
  A.chestCrack(); H.vib([34, 40, 34, 40, 60, 40, 100]);
  for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU + Math.random() * 0.2, ring = k % 3; o.frags.push({ a, span: 0.3 + Math.random() * 0.25, rad: o.R * (1.02 - ring * 0.17), ox: Math.cos(a) * (200 + Math.random() * 400), oy: Math.sin(a) * (200 + Math.random() * 400), rot: (Math.random() - 0.5) * 3, t: 0, max: 0.9, col: hsl(k * 20, 100, 65), w: o.R * 0.09 }); }
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
  o.sprites.push({ x, y, r: o.R * 0.42, t: 0, max: 0.28, col });
  o.links.push({ x1: o.prev.x, y1: o.prev.y, x2: x, y2: y, t: 0, max: 0.35, col }); o.prev = { x, y };
  o.shake = Math.max(o.shake, 6 + k * 1.4); o.flash = Math.max(o.flash, 0.25 + k * 0.03);
  A.boom(k + 1); H.vib(k % 3 === 2 ? [12, 30, 12] : 12);
}
function startSus() {
  const o = O; o.ph = 'sus'; o.pt = 0; o.dur = o.r >= 3 ? 1.5 : o.r >= 2 ? 1.15 : 0.85; o.tsT = 0.5; o.susTick = 0; o.hidden = false; o.charge = 1;
  A.chestRise(o.dur);
}
function reveal() {
  const o = O, col = rarCol(o.r, o.T); o.ph = 'reveal'; o.pt = 0; o.freeze = 0.09; o.tsT = 1; o.flash = 1; o.shake = 18 + o.r * 5; o.raysA = o.r >= 3 ? 1 : 0.4; o.hidden = true; o.cardShown = false;
  o.bg = col; o.bgA = 0.4;
  [0, 0.08, 0.17, 0.27, 0.4].forEach((d, i) => setTimeout(() => { if (O === o) pRing(o.cx, o.cy, o.R * 0.3, Math.max(o.W, o.H) * (0.55 + i * 0.12), 0.9, i % 2 ? [255, 255, 255] : rarCol(o.r, o.T), 0.04); }, d * 1000));
  pBurst(o.cx, o.cy, 160 + o.r * 50, o.r === 4 ? null : col, o.R * 8, 1.4, 3.2);
  pBurst(o.cx, o.cy, 60, [255, 255, 255], o.R * 6, 1, 2.4);
  A.chestReveal(o.r);
  H.vib([[22], [14, 60, 14], ticks(3), ticks(5, 55), ticks(8, 50)][o.r]);
  if (o.r === 4) setTimeout(() => H.vib(ticks(4, 80)), 700);
}
function showCard() {
  const o = O, card = $('.co-card'); o.cardShown = true;
  const col = rarCol(o.r, o.T), rc = rg(col, 1), more = st.cores.length;
  card.innerHTML = `<p class="tag" style="color:${rc};text-shadow:0 0 14px ${rc}">${RAR[o.r].n}</p><h2 style="text-shadow:0 0 22px ${rc}">${o.it.n}</h2>
    <p>${o.test ? 'Test d\'ouverture (rien n\'est ajouté)' : o.isNew ? '✦ Nouvelle skin !' : `Doublon · +${o.dust} ✦ de poussière`}</p>
    <div class="btns"><button class="big primary" id="co-eq">${o.test ? 'Fermer' : st.eq === o.it.id ? 'Équipée ✓' : 'Équiper'}</button>${!o.test && more ? `<button class="big glass" id="co-next">Ouvrir le suivant (${more})</button>` : ''}${o.test ? '' : '<button class="big glass" id="co-close">Fermer</button>'}</div>`;
  card.hidden = false; $('.co-x').style.display = '';
  const b = (id, f) => { const e = $(id, card); if (e) e.onclick = () => { A.ui(); H.vib(9); f(); }; };
  b('#co-eq', () => { if (o.test) return closeOpen(); st.eq = o.it.id; applyEq(); save(); closeOpen(); });
  b('#co-next', () => closeOpen(openNext)); b('#co-close', () => closeOpen());
}

/* ---- rendu ---- */
function drawOrb(x, y, r, col, type, t) {
  const g = ctx;
  g.globalCompositeOperation = 'lighter';
  let gr = g.createRadialGradient(x, y, r * 0.3, x, y, r * 2.6); gr.addColorStop(0, rg(col, 0.55)); gr.addColorStop(1, rg(col, 0));
  g.fillStyle = gr; g.fillRect(x - r * 2.7, y - r * 2.7, r * 5.4, r * 5.4);
  g.globalCompositeOperation = 'source-over';
  gr = g.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r);
  gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.3, rg(col.map((v) => Math.min(255, v + 40)), 0.95)); gr.addColorStop(1, rg(col.map((v) => v * 0.42), 0.96));
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineCap = 'round'; g.lineWidth = Math.max(2, r * 0.16);
  const L = r * 0.48; g.beginPath();
  if (type !== 2) { g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); }
  if (type >= 2) { const d = L * 0.72; g.moveTo(x - d, y - d); g.lineTo(x + d, y + d); g.moveTo(x + d, y - d); g.lineTo(x - d, y + d); }
  g.stroke();
}
function drawCore(x, y, R, tint, ch, t) {
  const g = ctx;
  g.globalCompositeOperation = 'lighter';
  let gr = g.createRadialGradient(x, y, R * 0.4, x, y, R * (2.4 + ch * 1.6)); gr.addColorStop(0, rg(tint, 0.5 + ch * 0.35)); gr.addColorStop(1, rg(tint, 0));
  g.fillStyle = gr; g.fillRect(x - R * 4.2, y - R * 4.2, R * 8.4, R * 8.4);
  g.globalCompositeOperation = 'source-over';
  gr = g.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R); gr.addColorStop(0, '#2a3354'); gr.addColorStop(1, '#05060f');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, R * 0.98, 0, TAU); g.fill();
  for (let k = 0; k < 3; k++) {
    const rad = R * (1.0 - k * 0.17), seg = 8 + k * 2, spin = (k % 2 ? -1 : 1) * t * (0.5 + ch * (3 + k * 2));
    g.lineWidth = R * (0.1 - k * 0.02); g.strokeStyle = rg(tint, 0.95 - k * 0.15);
    g.setLineDash([(rad * TAU / seg) * 0.7, (rad * TAU / seg) * 0.3]); g.lineDashOffset = -spin * rad;
    g.beginPath(); g.arc(x, y, rad, 0, TAU); g.stroke();
  }
  g.setLineDash([]); g.lineCap = 'round';
  const L = R * (0.42 + ch * 0.06), wc = mix(tint, [255, 255, 255], 0.55 + ch * 0.4);
  g.strokeStyle = rg(tint, 0.45); g.lineWidth = R * 0.3; g.beginPath(); g.moveTo(x - L, y); g.lineTo(x + L, y); g.moveTo(x, y - L); g.lineTo(x, y + L); g.stroke();
  g.strokeStyle = rg(wc, 1); g.lineWidth = R * 0.18; g.stroke();
}
function draw() {
  const o = O, g = ctx, s = o.dpr;
  g.setTransform(s, 0, 0, s, 0, 0); g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#02030a'; g.fillRect(0, 0, o.W, o.H);
  const bgc = o.ph === 'idle' || o.ph === 'charge' ? mix([20, 40, 90], o.tint, 0.4 + o.charge * 0.3) : o.bg;
  const ba = o.ph === 'idle' || o.ph === 'charge' ? 0.18 + o.charge * 0.35 : o.bgA;
  const bg = g.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, Math.max(o.W, o.H) * 0.85); bg.addColorStop(0, rg(bgc, ba)); bg.addColorStop(1, rg(bgc, 0));
  g.fillStyle = bg; g.fillRect(0, 0, o.W, o.H);
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
    const beat = o.ph === 'sus' ? 1 + 0.05 * Math.sin(o.pt * 40) : 1 + o.charge * 0.06 * Math.sin(o.T * (10 + o.charge * 30));
    const jx = (Math.random() - 0.5) * o.charge * o.charge * 7, jy = (Math.random() - 0.5) * o.charge * o.charge * 7;
    drawCore(o.cx + jx, o.cy + jy, o.R * beat, o.tint, o.ph === 'sus' ? 1 : o.charge, o.T);
  }
  if (o.ph === 'crack') { // orbe chauffé à blanc
    const p = clamp(o.pt / 0.9, 0, 1), R = o.R * (1 + p * 0.5);
    g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(o.cx, o.cy, 0, o.cx, o.cy, R * 2.5); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, rg(hsl(o.T * 200, 100, 65), 0.6)); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(o.cx - R * 2.6, o.cy - R * 2.6, R * 5.2, R * 5.2); g.globalCompositeOperation = 'source-over';
  }
  // fragments d'anneaux
  for (const f of o.frags) {
    const k = f.t / f.max, e = 1 - (1 - k) ** 3;
    g.strokeStyle = rg(f.col, 1 - k); g.lineWidth = f.w * (1 - k * 0.5);
    g.beginPath(); g.arc(o.cx + f.ox * e, o.cy + f.oy * e, f.rad, f.a + f.rot * k, f.a + f.rot * k + f.span); g.stroke();
  }
  // liens de chaîne
  g.globalCompositeOperation = 'lighter';
  for (const l of o.links) { const k = l.t / l.max; g.strokeStyle = rg(l.col, 0.8 * (1 - k)); g.lineWidth = 5 * (1 - k) + 1; g.beginPath(); g.moveTo(l.x1, l.y1); g.lineTo(l.x2, l.y2); g.stroke(); }
  for (const sp of o.sprites) { const k = sp.t / sp.max, r = sp.r * (1 + k * 1.6), gr = g.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r); gr.addColorStop(0, rg([255, 255, 255], 1 - k)); gr.addColorStop(0.5, rg(sp.col, 0.7 * (1 - k))); gr.addColorStop(1, rg(sp.col, 0)); g.fillStyle = gr; g.fillRect(sp.x - r, sp.y - r, r * 2, r * 2); }
  // ondes
  for (const r of o.rings) { const k = r.t / r.max, e = 1 - (1 - k) ** 3, rad = lerp(r.r0, r.r1, e); g.strokeStyle = rg(r.col, 0.9 * (1 - k)); g.lineWidth = Math.max(1.5, Math.abs(r.r1) * r.w * (1 - k)); g.beginPath(); g.arc(r.x, r.y, Math.max(0.1, rad), 0, TAU); g.stroke(); }
  // particules
  for (const p of o.parts) { const k = p.t / p.max, a = 1 - k, sz = p.s * (1 + (1 - k)); g.fillStyle = rg(p.col, a); g.beginPath(); g.arc(p.x, p.y, Math.max(0.5, sz), 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  // aperçu de la skin gagnée
  if (o.ph === 'reveal') {
    const k = clamp(o.pt / 0.5, 0, 1), e = 1 - (1 - k) ** 4, R = o.R * 0.8 * e, bob = Math.sin(o.T * 2) * 5, ang = o.T * 0.8, bumpP = o.T * 40;
    const orbs = [[0, 0, 1, 1.15], [-1, 0.9, 2, 0.8], [1, 0.9, 3, 0.8]];
    for (const [dx, dy, ty, sc] of orbs) drawOrb(o.cx + dx * R * 1.9 * (ty === 1 ? 0 : 1), o.cy + dy * R * 1.1 + bob + Math.sin(ang + ty) * 4, R * sc, colorOf(o.it, ty, o.T, bumpP), ty, o.T);
  }
  g.restore();
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
