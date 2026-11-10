// Critical — « Forage » : logique pure du mode principal (aucun DOM, testable dans Node).
// Règle : on pose des NOYAUX sur les cases libres. Trois noyaux identiques alignés selon la géométrie de leur type
// (croix : horizontale/verticale · pulsar : diagonales · étoile : les 8 directions) explosent et creusent les blocs.
// Les blocs détruits peuvent libérer d'autres noyaux ; un noyau touché par un tir explose à son tour (chaîne).
import { mulberry32 } from './gen.js';

export const COLS = 7, ROWS = 9, N = COLS * ROWS;
export const BIOMES = [
  { at: 0, n: 'Terre', hue: 28 }, { at: 40, n: 'Roche', hue: 215 }, { at: 100, n: 'Minerai', hue: 170 },
  { at: 190, n: 'Cristal', hue: 295 }, { at: 320, n: 'Obsidienne', hue: 262 }, { at: 500, n: 'Magma', hue: 8 },
];
export const HP = { dirt: 1, rock: 2, ore: 1, dyn: 1, gem: 1, obs: 3 };
export const SCORE = { dirt: 10, rock: 20, ore: 30, dyn: 25, gem: 60, obs: 50 };
const AX = { 1: [[1, 0], [0, 1]], 2: [[1, 1], [1, -1]], 3: [[1, 0], [0, 1], [1, 1], [1, -1]] };
const O4 = [[0, -1], [1, 0], [0, 1], [-1, 0]], D4 = [[1, -1], [1, 1], [-1, 1], [-1, -1]];
export const DIRS = { 1: O4, 2: D4, 3: [...O4, ...D4] };

export const biomeIdx = (d) => { let k = 0; BIOMES.forEach((b, i) => { if (d >= b.at) k = i; }); return k; };
export const pressureLimit = (d) => Math.max(3, 9 - Math.floor(d / 100)); // éboulement toutes les N poses sans chaîne : 9 au début, 3 en profondeur
export const typesAt = (d) => (d < 30 ? [[1, 1]] : d < 90 ? [[1, 0.6], [2, 0.4]] : [[1, 0.4], [2, 0.3], [3, 0.3]]);

function pickW(list, r) { let t = 0; for (const [, w] of list) t += w; let x = r * t; for (const [v, w] of list) { x -= w; if (x < 0) return v; } return list[0][0]; }
function blockKind(d, rng) {
  const w = [['dirt', Math.max(3, 10 - d / 60)], ['ore', 1.1]];
  if (d >= 40) w.push(['rock', 3]); if (d >= 70) w.push(['dyn', 1]); if (d >= 100) w.push(['gem', 0.8]); if (d >= 190) w.push(['obs', 2.2]);
  return pickW(w, rng());
}
const mkBlock = (b) => ({ k: 'b', b, hp: HP[b], max: HP[b] });

export function newGame(seed = (Math.random() * 1e9) | 0) {
  const rng = mulberry32(seed);
  const G = { seed, rng, cells: Array(N).fill(null), tray: [1, 1, 1], depth: 0, score: 0, gems: 0, pressure: 0, chain: 0, wave: 0, maxChain: 0, turns: 0, gain: 0, over: null, phase: 'idle', groups: [], rays: [], biome: 0 };
  for (let y = ROWS - 4; y < ROWS; y++) for (let x = 0; x < COLS; x++) G.cells[y * COLS + x] = mkBlock(blockKind(0, rng));
  G.cells[(ROWS - 5) * COLS + 2] = { k: 'n', ty: 1 }; G.cells[(ROWS - 5) * COLS + 3] = { k: 'n', ty: 1 }; // tutoriel : deux noyaux déjà alignés
  return G;
}

const noy = (G, x, y, ty) => { if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false; const c = G.cells[y * COLS + x]; return !!c && c.k === 'n' && c.ty === ty; };
// Alignements (≥3) qui contiennent le noyau i : Map case → longueur de l'alignement
export function runsAt(G, i) {
  const c = G.cells[i], out = new Map(); if (!c || c.k !== 'n') return out;
  const x0 = i % COLS, y0 = (i / COLS) | 0;
  for (const [dx, dy] of AX[c.ty]) {
    const line = [i];
    for (let s = 1; noy(G, x0 + dx * s, y0 + dy * s, c.ty); s++) line.push((y0 + dy * s) * COLS + x0 + dx * s);
    for (let s = 1; noy(G, x0 - dx * s, y0 - dy * s, c.ty); s++) line.push((y0 - dy * s) * COLS + x0 - dx * s);
    if (line.length >= 3) for (const j of line) out.set(j, Math.max(out.get(j) || 0, line.length));
  }
  return out;
}
function allRuns(G) { const out = new Map(); for (let i = 0; i < N; i++) { const c = G.cells[i]; if (c && c.k === 'n' && !out.has(i)) for (const [j, l] of runsAt(G, i)) out.set(j, Math.max(out.get(j) || 0, l)); } return out; }
const groupFrom = (runs) => [...runs].map(([i, len]) => ({ i, dmg: Math.max(1, len - 2) })); // plus l'alignement est long, plus ça tape fort

function walk(G, x0, y0, dx, dy) { // premier obstacle sur la ligne (ou sortie du plateau)
  let x = x0, y = y0, d = 0;
  for (;;) { x += dx; y += dy; d++; if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return { to: -1, dist: d }; if (G.cells[y * COLS + x]) return { to: y * COLS + x, dist: d }; }
}
function gravity(G) { // seuls les blocs tombent ; les noyaux restent ancrés
  const falls = [];
  for (let x = 0; x < COLS; x++) for (let y = ROWS - 2; y >= 0; y--) {
    const c = G.cells[y * COLS + x]; if (!c || c.k !== 'b') continue;
    let ny = y; while (ny + 1 < ROWS && !G.cells[(ny + 1) * COLS + x]) ny++;
    if (ny !== y) { G.cells[ny * COLS + x] = c; G.cells[y * COLS + x] = null; falls.push({ from: y * COLS + x, to: ny * COLS + x, rows: ny - y }); }
  }
  return falls;
}
export function helpful(G, ty) { for (let i = 0; i < N; i++) { if (G.cells[i]) continue; G.cells[i] = { k: 'n', ty }; const r = runsAt(G, i); G.cells[i] = null; if (r.size) return true; } return false; }
function genTray(G) { // équitable : au moins un noyau qui peut former une combinaison, quand c'est possible
  const list = typesAt(G.depth), tr = [0, 1, 2].map(() => pickW(list, G.rng()));
  const hp = list.map((x) => x[0]).filter((t) => helpful(G, t));
  if (hp.length && G.rng() < 0.85) tr[(G.rng() * 3) | 0] = hp[(G.rng() * hp.length) | 0];
  return tr;
}

// Aperçu (sans rien modifier) : alignement formé et tirs prévus si on pose `ty` en `i`
export function preview(G, i, ty) {
  if (G.cells[i]) return null;
  G.cells[i] = { k: 'n', ty };
  const runs = runsAt(G, i), rays = [], run = [...runs.keys()];
  if (run.length) {
    const saved = run.map((j) => [j, G.cells[j]]); for (const j of run) G.cells[j] = null;
    for (const [j, c] of saved) for (const [dx, dy] of DIRS[c.ty]) { const w = walk(G, j % COLS, (j / COLS) | 0, dx, dy); rays.push({ from: j, to: w.to, dx, dy, dist: w.dist, ty: c.ty, hit: w.to >= 0 ? G.cells[w.to].k : null }); }
    for (const [j, c] of saved) G.cells[j] = c;
  }
  G.cells[i] = null;
  return { run, rays };
}

// Fait tomber une rangée de blocs (1 ou 2 trous). Renvoie la liste des colonnes, ou null si le plafond est bouché (effondrement).
function dropRow(G) {
  const gaps = new Set(); gaps.add((G.rng() * COLS) | 0); if (G.rng() < 0.45) gaps.add((G.rng() * COLS) | 0);
  const row = []; let blocked = 0;
  for (let x = 0; x < COLS; x++) { if (gaps.has(x)) continue; if (G.cells[x]) { blocked++; continue; } G.cells[x] = mkBlock(blockKind(G.depth, G.rng)); row.push(x); }
  return blocked >= 2 ? null : row;
}
// Pose le noyau du slot dans la case i. Renvoie null si impossible. Ensuite on appelle step() jusqu'à phase 'idle' ou fin de partie.
export function place(G, slot, i) {
  if (G.phase !== 'idle' || G.over) return null;
  const ty = G.tray[slot]; if (!ty || i < 0 || i >= N || G.cells[i]) return null;
  G.cells[i] = { k: 'n', ty }; G.tray[slot] = 0; G.turns++; G.pressure++; G.chain = 0; G.wave = 0; G.gain = 0;
  const runs = runsAt(G, i); G.groups = [];
  if (runs.size) { G.groups = groupFrom(runs); G.phase = 'fire'; } else G.phase = 'after';
  return { i, ty, run: [...runs.keys()] };
}

// Avance la résolution d'une phase et renvoie un événement à animer. Phases : fire → impact → fall → auto → (fire…) → after → idle
export function step(G) {
  switch (G.phase) {
    case 'fire': {
      G.wave++; G.chain = G.wave; G.maxChain = Math.max(G.maxChain, G.chain);
      const seen = new Map(); for (const s of G.groups) { const o = seen.get(s.i); if (!o || s.dmg > o.dmg) seen.set(s.i, s); } G.groups = [];
      const src = [];
      for (const s of seen.values()) { const c = G.cells[s.i]; if (s.virtual) src.push({ i: s.i, ty: 1, dmg: s.dmg, virtual: true }); else if (c && c.k === 'n') src.push({ i: s.i, ty: c.ty, dmg: s.dmg }); }
      for (const s of src) if (!s.virtual) G.cells[s.i] = null;
      const rays = [];
      for (const s of src) for (const [dx, dy] of DIRS[s.ty]) { const w = walk(G, s.i % COLS, (s.i / COLS) | 0, dx, dy); rays.push({ from: s.i, to: w.to, dx, dy, dist: w.dist, dmg: s.dmg, ty: s.ty }); }
      G.rays = rays; G.phase = 'impact';
      return { t: 'fire', wave: G.wave, chain: G.chain, src, rays };
    }
    case 'impact': {
      const acc = new Map(); for (const r of G.rays) if (r.to >= 0) acc.set(r.to, (acc.get(r.to) || 0) + r.dmg);
      const hits = [], destroyed = [], damaged = [], spawned = [], next = []; let sc = 0;
      for (const [i, dmg] of acc) {
        const c = G.cells[i]; if (!c) continue; hits.push(i);
        if (c.k === 'n') { next.push({ i, dmg: 1 }); continue; } // un noyau touché explose à son tour
        c.hp -= dmg;
        if (c.hp > 0) { damaged.push({ i, hp: c.hp, max: c.max }); continue; }
        destroyed.push({ i, b: c.b }); G.cells[i] = null; sc += SCORE[c.b] * G.chain; G.depth++;
        if (c.b === 'gem') { G.gems++; G.depth += 2; }
        if (c.b === 'ore') { const ty = pickW(typesAt(G.depth), G.rng()); G.cells[i] = { k: 'n', ty }; spawned.push({ i, ty }); } // le minerai libère un noyau
        if (c.b === 'dyn') next.push({ i, dmg: 1, virtual: true }); // la dynamite explose en croix
      }
      G.groups.push(...next); G.score += sc; G.gain += destroyed.length; G.rays = [];
      const nb = biomeIdx(G.depth), biome = nb !== G.biome ? (G.biome = nb, BIOMES[nb]) : null;
      G.phase = 'fall';
      return { t: 'impact', wave: G.wave, chain: G.chain, hits, destroyed, damaged, spawned, score: sc, biome };
    }
    case 'fall': { const falls = gravity(G); G.phase = 'auto'; return { t: 'fall', falls }; }
    case 'auto': {
      const runs = allRuns(G); if (runs.size) G.groups.push(...groupFrom(runs));
      if (G.groups.length && G.wave < 80) { G.phase = 'fire'; return { t: 'auto', n: G.groups.length }; }
      G.phase = 'after'; return { t: 'settle', chain: G.chain, gain: G.gain };
    }
    case 'after': {
      const ch = G.chain; G.chain = 0; if (ch > 0) G.pressure = Math.max(0, G.pressure - ch); // les chaînes soulagent la pression
      let blocks = 0; for (const c of G.cells) if (c && c.k === 'b') blocks++;
      if (blocks < COLS * 3 && G.turns > 0) { // nouvelle strate : le terrain se renouvelle quand il devient trop mince (on descend)
        const row = dropRow(G); if (!row) { G.over = 'cave'; G.phase = 'over'; return { t: 'over', reason: 'cave' }; }
        G.phase = 'fall'; return { t: 'cave', cols: row, strata: true };
      }
      if (G.pressure >= pressureLimit(G.depth)) { // éboulement : une rangée de blocs tombe du plafond
        const row = dropRow(G); if (!row) { G.over = 'cave'; G.phase = 'over'; return { t: 'over', reason: 'cave' }; }
        G.pressure = 0; G.phase = 'fall';
        return { t: 'cave', cols: row };
      }
      if (G.tray.every((v) => !v)) G.tray = genTray(G);
      if (G.cells.every(Boolean)) { G.over = 'full'; G.phase = 'over'; return { t: 'over', reason: 'full' }; }
      G.phase = 'idle'; return { t: 'idle', tray: G.tray.slice(), pressure: G.pressure, limit: pressureLimit(G.depth) };
    }
    default: return { t: G.phase };
  }
}
