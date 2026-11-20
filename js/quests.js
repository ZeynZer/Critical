// Critical — centre de missions : missions du jour, jours de connexion, paliers de temps de jeu.
//  • Missions du jour : trois missions tirées de la date (les mêmes pour tous), payées en Voidium ; les trois = 1 000 Voidium en plus.
//  • Connexion : « Jour N » = le N-ᵉ jour où tu as lancé le jeu. Pas de série à ne pas casser : sauter un jour ne fait rien perdre.
//  • Temps de jeu : paliers de jeu réellement actif (20 min, 1 h, 5 h…).
// Toute récompense reste récupérable sans limite de temps. Un thème déjà possédé est converti en poussière (moitié de son prix).
// Styles : .fg-q défini par mine.js, .rk-tabs par rank.js, le reste vient du verre commun (.modal .card .big).
// shortcut: tout est local (localStorage, horloge de l'appareil) donc falsifiable ; à valider côté serveur quand il faudra protéger la valeur des récompenses.
import { mulberry32 } from './fusion.js';

const KEY = 'critical.quests.v1';
const $ = (s, r = document) => r.querySelector(s);
const H = { today: () => '', grant: () => {}, toast: () => {}, vib: () => {}, playtime: () => 0, giveTheme: () => '', themeName: (id) => id };
// [type, cible, récompense, libellé]
const POOL = [
  ['fusions', 80, 200, 'Réalise 80 fusions'], ['fusions', 160, 350, 'Réalise 160 fusions'],
  ['depth', 4, 250, 'Atteins le secteur 4'], ['depth', 7, 400, 'Atteins le secteur 7'],
  ['chain', 4, 200, 'Déclenche une chaîne ×4'], ['chain', 6, 350, 'Déclenche une chaîne ×6'],
  ['score', 15000, 250, 'Marque 15 000 points en une partie'], ['score', 40000, 400, 'Marque 40 000 points en une partie'],
  ['tier', 9, 250, 'Crée une Géante rouge'], ['tier', 11, 450, 'Crée un Trou noir'],
  ['runs', 3, 200, 'Termine 3 parties'], ['likes', 1, 200, 'Like le profil d\'un joueur'], ['daily', 1, 300, 'Réussis le défi du jour'],
];
// Récompenses : { d: Voidium } ou { t: identifiant de thème }
const DAY_REWARDS = { 1: { d: 500 }, 2: { d: 600 }, 3: { t: 'aurore' }, 4: { d: 800 }, 5: { d: 1000 }, 6: { d: 1200 }, 7: { t: 'braise' }, 10: { d: 1500 }, 14: { t: 'abysse' }, 21: { d: 3000 }, 30: { t: 'quartz' }, 50: { d: 5000 }, 75: { d: 7000 }, 100: { t: 'or' } };
export const dayReward = (n) => DAY_REWARDS[n] || { d: n % 7 === 0 ? 1000 : 250 };
export const TIME = [[1200, { d: 600 }], [3600, { d: 1200 }], [7200, { d: 2500 }], [18000, { t: 'prisme' }], [36000, { d: 8000 }], [86400, { d: 15000 }], [180000, { d: 30000 }], [360000, { d: 50000 }]]; // [secondes de jeu, récompense]
const st = { day: '', q: [], bonus: false, days: 0, dc: [], tc: [] }; // days : jours de jeu ; dc : jours récupérés ; tc : paliers de temps récupérés
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const duration = (sec) => (sec >= 3600 ? `${sec / 3600 | 0} h${sec % 3600 ? ' ' + String(Math.round((sec % 3600) / 60)).padStart(2, '0') : ''}` : `${Math.round(sec / 60)} min`);

export function pick(day) { // 3 missions de types différents, déterministes pour une date
  const r = mulberry32(hash('critical:quests:' + day)), out = [], types = new Set();
  while (out.length < 3) { const i = (r() * POOL.length) | 0; if (!types.has(POOL[i][0])) { types.add(POOL[i][0]); out.push({ i, p: 0, done: false }); } }
  return out;
}
function roll() {
  const d = H.today(); if (!d || st.day === d) return;
  st.days = (st.days || 0) + 1; st.day = d; st.q = pick(d); st.bonus = false; save(); // un nouveau jour de jeu
}
const dayClaimable = () => { let n = 0; for (let k = 1; k <= st.days; k++) if (!st.dc.includes(k)) n++; return n; };
const timeClaimable = () => TIME.filter(([s]) => H.playtime() >= s && !st.tc.includes(s)).length;
export const claimable = () => dayClaimable() + timeClaimable();

export function track(type, n, max = false) {
  roll(); let ch = false;
  for (const q of st.q) {
    const [ty, goal, e, lbl] = POOL[q.i]; if (ty !== type || q.done) continue;
    const p = Math.min(goal, max ? Math.max(q.p, n) : q.p + n); if (p === q.p) continue;
    q.p = p; ch = true;
    if (p >= goal) { q.done = true; H.toast('Mission accomplie : ' + lbl); H.vib([12, 40, 12]); const all = st.q.every((x) => x.done) && !st.bonus; if (all) st.bonus = true; H.grant(e + (all ? 1000 : 0), all ? 'Trois missions terminées' : 'Mission'); }
  }
  if (ch) { save(); refresh(); }
}
export function html() { // missions du jour (aussi affichées sur l'écran de fin de partie)
  roll();
  return st.q.map((q) => { const [, goal, e, lbl] = POOL[q.i]; return `<div class="q${q.done ? ' ok' : ''}"><i style="--p:${Math.round((q.p / goal) * 100)}%"></i><span>${lbl}</span><em>${q.done ? 'fait' : '+' + e + ' Voidium'}</em></div>`; }).join('');
}
const rewardText = (r) => (r.t ? `Thème « ${H.themeName(r.t)} »` : `${r.d.toLocaleString('fr-FR')} Voidium`);
export function data() { // missions du jour et récompenses de connexion / temps de jeu, pour la page Défis
  roll(); const t = H.playtime();
  return { quests: st.q.map((x) => { const [, goal, e, lbl] = POOL[x.i]; return { lbl, p: x.p, goal, done: x.done, e }; }), bonus: !!st.bonus, days: st.days,
    dayRows: Array.from({ length: st.days }, (_, i) => i + 1).filter((k) => !st.dc.includes(k)).map((k) => ({ k, text: rewardText(dayReward(k)) })), nextDay: { k: st.days + 1, text: rewardText(dayReward(st.days + 1)) },
    timeRows: TIME.map(([s, r]) => ({ s, text: rewardText(r), label: 'Joue ' + duration(s), can: t >= s && !st.tc.includes(s), done: st.tc.includes(s), pct: Math.min(100, Math.round((t / s) * 100)) })), claimable: claimable() };
}
export const claimReward = (kind, key) => claim(kind, key);
export function claimAll() { // toutes les récompenses de connexion et de temps de jeu prêtes
  let v = 0, n = 0; const themes = []; const t = H.playtime();
  for (let k = 1; k <= st.days; k++) if (!st.dc.includes(k)) { const r = dayReward(k); st.dc.push(k); n++; if (r.t) themes.push(r.t); else v += r.d; }
  for (const [s, r] of TIME) if (t >= s && !st.tc.includes(s)) { st.tc.push(s); n++; if (r.t) themes.push(r.t); else v += r.d; }
  if (!n) return 0; save(); if (v) H.grant(v, 'Récompenses'); for (const id of themes) H.toast(H.giveTheme(id)); H.vib([14, 40, 14]); refresh(); return n;
}
let tab = 'day';
function claim(kind, key) {
  const r = kind === 'd' ? dayReward(key) : (TIME.find(([s]) => s === key) || [])[1]; if (!r) return;
  if (kind === 'd' ? (key > st.days || st.dc.includes(key)) : (H.playtime() < key || st.tc.includes(key))) return; // pas encore atteint, ou déjà pris
  (kind === 'd' ? st.dc : st.tc).push(key); save();
  if (r.t) H.toast(H.giveTheme(r.t)); else H.grant(r.d, kind === 'd' ? `Jour ${key}` : 'Temps de jeu');
  H.vib([14, 40, 14]); refresh();
}
function rows() {
  if (tab === 'day') return html();
  const btn = (kind, key) => `<button class="mini" data-k="${kind}" data-v="${key}">Récupérer</button>`;
  if (tab === 'days') {
    const first = (() => { for (let k = 1; k <= st.days; k++) if (!st.dc.includes(k)) return k; return st.days + 1; })(), out = [];
    for (let k = Math.max(1, Math.min(first, st.days)); k <= Math.max(st.days + 6, first + 6); k++) {
      const done = st.dc.includes(k), can = k <= st.days && !done, now = k === st.days;
      out.push(`<div class="q${done ? ' done' : ''}${can ? ' claimable' : ''}"><span>${now ? 'Aujourd\'hui · ' : ''}Jour ${k}</span><em>${rewardText(dayReward(k))}</em>${can ? btn('d', k) : done ? '<b>✓</b>' : ''}</div>`);
    }
    const next = Object.keys(DAY_REWARDS).map(Number).filter((k) => k > st.days + 6 && DAY_REWARDS[k].t).slice(0, 3).map((k) => `jour ${k} : ${rewardText(DAY_REWARDS[k])}`).join(' · ');
    return out.join('') + (next ? `<p class="qnote">Plus tard : ${next}</p>` : '');
  }
  const t = H.playtime();
  return TIME.map(([s, r]) => { const done = st.tc.includes(s), can = t >= s && !done; return `<div class="q${done ? ' done' : ''}${can ? ' claimable' : ''}"><i style="--p:${Math.min(100, Math.round((t / s) * 100))}%"></i><span>Joue ${duration(s)}</span><em>${rewardText(r)}</em>${can ? btn('t', s) : done ? '<b>✓</b>' : ''}</div>`; }).join('');
}
function refresh() {
  const b = $('#b-quests'); if (!b) return;
  const n = st.q.filter((q) => q.done).length, c = claimable();
  b.innerHTML = `<span>Missions</span><em>${c ? `<u>${c} à récupérer</u> · ` : ''}${n}/3</em>`;
  const p = $('#qs-list'); if (!p || !$('#qs').classList.contains('on')) return;
  p.innerHTML = rows(); document.querySelectorAll('#qs .rk-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.t === tab));
  $('#qs-sub').textContent = tab === 'day' ? 'Trois missions par jour, les mêmes pour tout le monde. Les trois terminées : 1 000 Voidium en plus.' : tab === 'days' ? `Tu as joué ${st.days} jour${st.days > 1 ? 's' : ''}. Aucune série à garder : chaque récompense t'attend sans limite de temps.` : `Temps de jeu actif : ${duration(Math.max(60, Math.round(H.playtime() / 60) * 60))}. Ni la pause, ni l'écran de fin, ni l'arrière-plan ne comptent.`;
}
export const time = () => refresh(); // appelé régulièrement par le jeu : met à jour le badge et la liste
export function init(opts) {
  Object.assign(H, opts); roll();
  const menu = $('#s-title .menu'); if (!menu) return;
  const css = document.createElement('style');
  css.textContent = '#b-quests{display:flex;justify-content:space-between;align-items:center;width:100%;height:46px;padding:0 18px;border-radius:23px;font:700 12px var(--disp);letter-spacing:1.2px;text-transform:uppercase;color:#fff;transition:transform .55s cubic-bezier(.2,1.6,.4,1)}#b-quests em{font-style:normal;color:#ffc247}#b-quests u{text-decoration:none;color:#5dffc0}#b-quests:active{transform:scale(.955)}' +
    '#qs .card{max-width:420px}#qs-list{width:100%;max-height:42vh;overflow-y:auto;touch-action:pan-y;scrollbar-width:none}#qs-sub{font-size:12.5px!important;min-height:0!important}' +
    '#qs .rk-tabs button{font-size:10.5px;letter-spacing:.3px;padding:0 4px;white-space:nowrap}.qnote{margin:8px 2px 2px;font-size:11.5px;line-height:1.4;color:rgba(255,255,255,.55);text-align:left}' +
    '.q.claimable{background:linear-gradient(90deg,rgba(93,255,192,.16),transparent)}.q.done{opacity:.45}.q b{color:#5dffc0;font-size:14px}' +
    '.q button.mini{flex:none;height:30px;padding:0 12px;border-radius:15px;font:700 11px var(--disp);letter-spacing:.6px;color:#06231a;background:#5dffc0;box-shadow:0 0 14px rgba(93,255,192,.4)}.q button.mini:active{transform:scale(.94)}';
  document.head.appendChild(css);
  const b = document.createElement('button'); b.id = 'b-quests'; b.className = 'glass';
  const hero = $('#b-mine'); if (hero && hero.parentNode === menu) hero.after(b); else menu.prepend(b);
  const d = document.createElement('div');
  d.innerHTML = '<div class="modal" id="qs"><div class="card glass"><h2>Missions</h2><div class="rk-tabs"><button data-t="day" class="on">Aujourd\'hui</button><button data-t="days">Connexion</button><button data-t="time">Temps de jeu</button></div><p id="qs-sub"></p><div class="fg-q" id="qs-list"></div><div class="btns"><button class="big glass" id="qs-close">Fermer</button></div></div></div>';
  document.body.append(d.firstChild);
  b.addEventListener('click', () => { roll(); $('#qs').classList.add('on'); refresh(); });
  $('#qs-close').addEventListener('click', () => $('#qs').classList.remove('on'));
  $('#qs').addEventListener('click', (e) => { if (e.target.id === 'qs') e.currentTarget.classList.remove('on'); });
  document.querySelectorAll('#qs .rk-tabs button').forEach((x) => x.addEventListener('click', () => { tab = x.dataset.t; $('#qs-list').scrollTop = 0; refresh(); }));
  $('#qs-list').addEventListener('click', (e) => { const k = e.target.closest('button.mini'); if (k) claim(k.dataset.k, +k.dataset.v); });
  refresh();
}
