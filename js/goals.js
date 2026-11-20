// Critical — Défis : objectifs permanents, du très facile à l'improbable. Ils se valident tout seuls pendant qu'on joue ;
// la récompense (Voidium + XP) n'est encaissée que par un appui volontaire sur « Valider ».
const KEY = 'critical.goals.v1';
const $ = (s, r = document) => r.querySelector(s);
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const st = { done: {}, claimed: {}, ctr: {} };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const api = { pack: () => {}, grant: () => {}, xp: () => {}, level: () => 1, toast: () => {}, vib: () => {}, sfx: () => {}, changed: () => {} };

const LV = ['Facile', 'Moyen', 'Difficile', 'Légendaire'], COL = ['#5dffc0', '#4df3ff', '#ff4fd8', '#ffc247'], RW = [[150, 20], [400, 50], [1000, 120], [3000, 300]];
// c : compteur cumulé · m : meilleur résultat · l : niveau du joueur · e : événement ponctuel (when(type, données))
const c = (id, l, t, d, ctr, n, r) => ({ id, l, t, d, k: 'c', ctr, n, r });
const e = (id, l, t, d, when, r) => ({ id, l, t, d, k: 'e', when, n: 1, r });
const lvl = (id, l, t, n, r) => ({ id, l, t, d: `Atteins le niveau ${n}.`, k: 'l', n, r });
const DEFS = [
  // — Facile
  c('fus1', 0, 'Première fusion', 'Fais fusionner deux astres.', 'fusions', 1),
  e('lose20k', 0, 'Chute libre', 'Perds une partie avec moins de 20 000 points.', (t, x) => t === 'run' && x.over && x.drops >= 8 && x.score < 20000, [200, 20]),
  c('chain3', 0, 'Réaction en chaîne', 'Déclenche une chaîne ×3.', 'chain', 3),
  c('sec2', 0, 'Changement d\'air', 'Atteins le secteur 2.', 'sector', 2),
  c('runs5', 0, 'Habitué', 'Joue 5 parties.', 'runs', 5),
  c('hold10', 0, 'Mise en réserve', 'Utilise la réserve 10 fois.', 'holds', 10),
  c('moon', 0, 'Au clair de lune', 'Crée une Lune.', 'tier', 3),
  c('sc5k', 0, 'Premiers points', 'Marque 5 000 points en une partie.', 'score', 5000),
  lvl('lv3', 0, 'Niveau 3', 3),
  c('like1', 0, 'Sympa', 'Like le profil d\'un joueur.', 'likes', 1),
  // — Moyen
  c('chain5', 1, 'Chaîne ×5', 'Déclenche une chaîne ×5.', 'chain', 5),
  c('sec4', 1, 'Secteur 4', 'Atteins le secteur 4.', 'sector', 4),
  c('sun', 1, 'Lumière !', 'Crée un Soleil.', 'tier', 7),
  c('sc20k', 1, '20 000 points', 'Marque 20 000 points en une partie.', 'score', 20000),
  c('fus200', 1, 'Fusionneur', 'Réalise 200 fusions au total.', 'fusions', 200),
  c('runs25', 1, 'Accro', 'Joue 25 parties.', 'runs', 25),
  c('swal20', 1, 'Gloutons', 'Fais avaler 20 astres par un trou noir, un quasar ou une galaxie.', 'swallow', 20),
  c('style1', 1, 'Un peu de style', 'Obtiens une variante de style.', 'styles', 1),
  c('rare1', 1, 'Chanceux', 'Obtiens une variante rare à pouvoir.', 'rares', 1),
  lvl('lv10', 1, 'Niveau 10', 10),
  c('daily1', 1, 'Défi relevé', 'Réussis le défi du jour.', 'daily', 1),
  c('sec6', 1, 'Secteur 6', 'Atteins le secteur 6.', 'sector', 6),
  c('lose2k', 1, 'Chute très libre', 'Perds une partie avec moins de 2 000 points.', 'lose2k', 1),
  // — Difficile
  c('hole', 2, 'L\'abîme', 'Crée un Trou noir.', 'tier', 10),
  e('2holes', 2, 'Deux trous noirs', 'Fusionne deux trous noirs.', (t, x) => t === 'merge' && x.tier === 11, [1200, 140]),
  e('2holes5', 2, 'Deux trous noirs en ×5', 'Fusionne deux trous noirs alors que ta chaîne est à ×5.', (t, x) => t === 'merge' && x.tier === 11 && x.chain >= 5, [2000, 220]),
  c('sec10', 2, 'Secteur 10', 'Atteins le secteur 10.', 'sector', 10),
  c('sc100k', 2, '100 000 points', 'Marque 100 000 points en une partie.', 'score', 100000),
  c('chain8', 2, 'Chaîne ×8', 'Déclenche une chaîne ×8, le maximum.', 'chain', 8),
  c('fus2000', 2, 'Machine', 'Réalise 2 000 fusions au total.', 'fusions', 2000),
  c('forge1', 2, 'Alchimiste', 'Fabrique un astre prismatique.', 'forges', 1),
  c('nova1', 2, 'Big Bang', 'Fais fusionner deux galaxies.', 'novas', 1),
  c('duel1', 2, 'Duelliste', 'Gagne un duel 1v1.', 'duelwins', 1),
  lvl('lv20', 2, 'Niveau 20', 20),
  // — Légendaire
  e('2quasars', 3, 'Deux quasars', 'Fusionne deux quasars.', (t, x) => t === 'merge' && x.tier === 12, [3000, 300]),
  e('2quasars5', 3, 'Deux quasars en ×5', 'Fusionne deux quasars alors que ta chaîne est à ×5.', (t, x) => t === 'merge' && x.tier === 12 && x.chain >= 5, [6000, 600]),
  c('crit', 3, 'Critique', 'Obtiens une galaxie critique.', 'crit', 1, [5000, 500]),
  c('sec15', 3, 'Secteur 15', 'Atteins le secteur 15.', 'sector', 15),
  c('sc500k', 3, '500 000 points', 'Marque 500 000 points en une partie.', 'score', 500000),
  c('forge5', 3, 'Collectionneur prismatique', 'Fabrique 5 astres prismatiques.', 'forges', 5, [5000, 500]),
  c('duel10', 3, 'Champion', 'Gagne 10 duels.', 'duelwins', 10),
  lvl('lv40', 3, 'Niveau 40', 40, [6000, 600]),
  // — Packs
  c('pack1', 0, 'Premier pack', 'Ouvre un pack d\'astres.', 'packs', 1),
  c('pack25', 1, 'Pluie d\'étoiles', 'Ouvre 25 packs.', 'packs', 25),
  c('pack100', 2, 'Chasseur de raretés', 'Ouvre 100 packs.', 'packs', 100),
  c('leg1', 2, 'Du lourd !', 'Obtiens un astre légendaire dans un pack.', 'legend', 1),
  c('cosmic1', 3, 'Singularité', 'Obtiens un astre cosmique dans un pack.', 'cosmic', 1, [8000, 800]),
];
const rw = (g) => g.r || RW[g.l];
const PKR = [null, 'etoile', 'nebuleuse', 'galaxie'], PKN = { etoile: 'Pack Étoile', nebuleuse: 'Pack Nébuleuse', galaxie: 'Pack Galaxie' }; // Moyen et au-dessus : un pack en plus
const prog = (g) => (g.k === 'l' ? Math.min(g.n, api.level()) : g.k === 'e' ? (st.done[g.id] ? 1 : 0) : Math.min(g.n, st.ctr[g.ctr] | 0));
const isDone = (g) => !!st.done[g.id];
const max = (k, v) => { st.ctr[k] = Math.max(st.ctr[k] | 0, v | 0); };
let pending = [], toastT = 0;
function check(type, x) {
  for (const g of DEFS) {
    if (st.done[g.id]) continue;
    if (g.k === 'e' ? g.when(type, x || {}) : prog(g) >= g.n) { st.done[g.id] = Date.now(); pending.push(g.t); }
  }
  if (pending.length) { save(); clearTimeout(toastT); toastT = setTimeout(() => { api.toast(pending.length > 1 ? `${pending.length} défis accomplis : valide-les dans Collection › Défis` : `Défi accompli : ${pending[0]}. Valide-le dans Collection › Défis`); pending = []; }, 700); api.changed(); }
}
// Appelé par le jeu. type : merge · swallow · hold · sector · run · rare · nova · daily · duelwin · forge · like · xp
export function event(type, x = {}) {
  const k = st.ctr;
  if (type === 'merge') { k.fusions = (k.fusions | 0) + 1; max('chain', x.chain); max('tier', x.tier); }
  else if (type === 'swallow') k.swallow = (k.swallow | 0) + 1;
  else if (type === 'hold') k.holds = (k.holds | 0) + 1;
  else if (type === 'sector') max('sector', x.n);
  else if (type === 'run') { k.runs = (k.runs | 0) + 1; max('score', x.score); max('sector', x.sector); max('chain', x.chain); max('tier', x.tier); if (x.over && x.drops >= 8 && x.score < 2000) k.lose2k = 1; }
  else if (type === 'rare') { if (x.v === 1) k.rares = (k.rares | 0) + 1; else if (x.v >= 2 && x.v < 9 && x.tier < 12) k.styles = (k.styles | 0) + 1; if (x.tier === 12 && x.v === 5) k.crit = 1; }
  else if (type === 'nova') k.novas = (k.novas | 0) + 1;
  else if (type === 'daily') k.daily = (k.daily | 0) + 1;
  else if (type === 'duelwin') k.duelwins = (k.duelwins | 0) + 1;
  else if (type === 'forge') k.forges = (k.forges | 0) + 1;
  else if (type === 'like') k.likes = (k.likes | 0) + 1;
  else if (type === 'pack') { k.packs = (k.packs | 0) + 1; if (x.best >= 4) k.legend = 1; if (x.best >= 5) k.cosmic = 1; }
  save(); check(type, x);
}
export const list = () => DEFS.map((d) => ({ id: d.id, l: d.l, t: d.t, d: d.d, n: d.n, k: d.k, prog: prog(d), done: isDone(d), claimed: !!st.claimed[d.id], v: rw(d)[0], xp: rw(d)[1], pack: PKR[d.l] ? PKN[PKR[d.l]] : '', diff: LV[d.l], col: COL[d.l] }));
export function claimAll() { // tous les défis accomplis d'un coup : une seule récompense cumulée
  let v = 0, xp = 0; const packs = {}; for (const d of DEFS) { if (!isDone(d) || st.claimed[d.id]) continue; st.claimed[d.id] = Date.now(); const [a, b] = rw(d); v += a; xp += b; if (PKR[d.l]) packs[PKR[d.l]] = (packs[PKR[d.l]] | 0) + 1; }
  if (!v && !xp) return null; save(); api.grant(v, 'Défis'); api.xp(xp); for (const p of Object.keys(packs)) api.pack(p, packs[p]); api.vib([12, 30, 12, 30, 12]); api.sfx(); api.changed(); return { v, xp, packs };
}
export const claimGoal = (id) => claim(id);
export const summary = () => ({ claimable: DEFS.filter((g) => isDone(g) && !st.claimed[g.id]).length, claimed: DEFS.filter((g) => st.claimed[g.id]).length, total: DEFS.length });

const CSS = `
#gl-m .card{max-width:430px;align-items:stretch}#gl-m h2{text-align:center;margin:0}#gl-sub{margin:0;text-align:center;font-size:13px;color:rgba(255,255,255,.65)}
.gl-tabs{display:flex;gap:6px}.gl-tabs button{flex:1;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);font:700 11px var(--disp);letter-spacing:.04em}.gl-tabs button.on{background:linear-gradient(135deg,rgba(77,243,255,.35),rgba(255,79,216,.3));color:#fff;border-color:rgba(255,255,255,.4)}
#gl-list{display:flex;flex-direction:column;gap:8px;max-height:48vh;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain;touch-action:pan-y}#gl-list::-webkit-scrollbar{display:none}
.gl-it{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-left:4px solid var(--c)}
.gl-it .gl-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.gl-it b{font:700 14px/1.2 var(--font)}.gl-it small{font-size:12px;line-height:1.35;color:rgba(255,255,255,.65)}
.gl-bar{height:5px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:2px}.gl-bar i{display:block;height:100%;background:var(--c);border-radius:3px}.gl-it em{font:700 10px var(--disp);font-style:normal;color:rgba(255,255,255,.55)}
.gl-rw{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:5px;font:700 11px var(--disp);color:rgba(255,255,255,.85);text-align:right}.gl-rw span{color:rgba(255,255,255,.55);font-size:10px}
.gl-ok{height:34px;padding:0 14px;border-radius:17px;border:0;background:#5dffc0;color:#06231a;font:800 12px var(--disp);letter-spacing:.04em;box-shadow:0 0 16px rgba(93,255,192,.45);transition:opacity .25s}.gl-ok:disabled{opacity:.35;box-shadow:none}.gl-ok:not(:disabled):active{transform:scale(.94)}
.gl-it.ready{background:linear-gradient(90deg,rgba(93,255,192,.14),rgba(255,255,255,.04))}.gl-it.claimed{opacity:.5}
.gl-empty{text-align:center;color:rgba(255,255,255,.55);padding:18px 0;font-size:14px}
`;
let tab = 'ready', mod = null;
const render = () => {
  const s = summary(); $('#gl-sub').textContent = `${s.claimed} validés sur ${s.total}${s.claimable ? ` · ${s.claimable} à valider` : ''}`;
  $('#gl-m').querySelectorAll('.gl-tabs button').forEach((b) => { b.classList.toggle('on', b.dataset.t === tab); if (b.dataset.t === 'ready') b.textContent = `À valider${s.claimable ? ' (' + s.claimable + ')' : ''}`; });
  const list = $('#gl-list'); list.textContent = '';
  const rows = DEFS.filter((g) => (tab === 'ready' ? isDone(g) && !st.claimed[g.id] : tab === 'todo' ? !isDone(g) : !!st.claimed[g.id])).sort((a, b) => a.l - b.l);
  if (!rows.length) list.append(make('div', 'gl-empty', tab === 'ready' ? 'Rien à valider pour l\'instant. Joue : les défis se cochent tout seuls.' : tab === 'todo' ? 'Tout est accompli !' : 'Aucun défi validé pour l\'instant.'));
  for (const g of rows) {
    const [d, x] = rw(g), p = prog(g), it = make('div', 'gl-it' + (isDone(g) && !st.claimed[g.id] ? ' ready' : '') + (st.claimed[g.id] ? ' claimed' : '')); it.style.setProperty('--c', COL[g.l]);
    it.append(make('div', 'gl-tx', `<b>${g.t}</b><small>${g.d}</small>` + (g.k !== 'e' && !isDone(g) ? `<div class="gl-bar"><i style="width:${(p / g.n) * 100}%"></i></div><em>${fmt(p)} / ${fmt(g.n)}</em>` : `<em style="color:${COL[g.l]}">${LV[g.l].toUpperCase()}</em>`)));
    const r = make('div', 'gl-rw', `+${fmt(d)} Voidium<br>+${fmt(x)} XP` + (PKR[g.l] ? `<br>+1 ${PKN[PKR[g.l]]}` : ''));
    if (isDone(g) && !st.claimed[g.id]) { const b = make('button', 'gl-ok', 'Valider'); b.disabled = true; setTimeout(() => { b.disabled = false; }, 800); b.addEventListener('click', () => claim(g.id)); r.append(b); } // inerte un instant : pas d'appui involontaire
    else if (st.claimed[g.id]) r.append(make('span', '', '✓ validé'));
    it.append(r); list.append(it);
  }
};
function claim(id) {
  const g = DEFS.find((x) => x.id === id); if (!g || !isDone(g) || st.claimed[id]) return;
  const [d, x] = rw(g); st.claimed[id] = Date.now(); save(); api.grant(d, g.t); api.xp(x); if (PKR[g.l]) api.pack(PKR[g.l], 1); api.vib([12, 30, 12]); api.sfx(); api.changed(); render();
}
export function open() { check('xp'); if (!summary().claimable && tab === 'ready') tab = 'todo'; mod.classList.add('on'); render(); }
export function init(a) {
  Object.assign(api, a); const css = make('style'); css.textContent = CSS; document.head.appendChild(css);
  mod = make('div', 'modal', '<div class="card glass"><h2>Défis</h2><p id="gl-sub"></p><div class="gl-tabs"><button data-t="ready">À valider</button><button data-t="todo">En cours</button><button data-t="done">Validés</button></div><div id="gl-list"></div><div class="btns"><button class="big primary" id="gl-x">Fermer</button></div></div>'); mod.id = 'gl-m'; document.body.append(mod);
  mod.querySelectorAll('.gl-tabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; api.sfx(); render(); }));
  $('#gl-x').addEventListener('click', () => mod.classList.remove('on'));
  check('xp');
}
