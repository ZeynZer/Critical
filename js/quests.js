// Critical — missions du jour + cadeau quotidien. Trois missions tirées de la date (les mêmes pour tous),
// récompensées en énergie ; les trois terminées = un noyau Rare garanti. Aucune pénalité si on saute un jour.
// Styles : .fg-q défini par mine.js, le reste vient du verre commun (.modal .card .big).
// shortcut: tout est local (localStorage, horloge de l'appareil) donc falsifiable ; à valider côté serveur quand un backend existera.
import { mulberry32 } from './gen.js';

const KEY = 'critical.quests.v1';
const $ = (s, r = document) => r.querySelector(s);
const H = { today: () => '', grant: () => {}, toast: () => {}, vib: () => {} };
// [type, cible, énergie, libellé]
const POOL = [
  ['fusions', 80, 20, 'Réalise 80 fusions'], ['fusions', 160, 35, 'Réalise 160 fusions'],
  ['depth', 4, 25, 'Atteins le secteur 4'], ['depth', 7, 40, 'Atteins le secteur 7'],
  ['chain', 4, 20, 'Déclenche une chaîne ×4'], ['chain', 6, 35, 'Déclenche une chaîne ×6'],
  ['score', 15000, 25, 'Marque 15 000 points en une partie'], ['score', 40000, 40, 'Marque 40 000 points en une partie'],
  ['tier', 9, 25, 'Crée une Géante rouge'], ['tier', 11, 45, 'Crée un Trou noir'],
  ['runs', 3, 20, 'Termine 3 parties de Genèse'], ['stars', 3, 25, 'Gagne 3 étoiles en campagne'], ['daily', 1, 30, 'Termine le défi du jour'],
];
const st = { day: '', q: [], bonus: false, gift: false, streak: 0 };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const dayNum = (s) => Math.round(Date.parse(s + 'T12:00:00Z') / 864e5);

export function pick(day) { // 3 missions de types différents, déterministes pour une date
  const r = mulberry32(hash('critical:quests:' + day)), out = [], types = new Set();
  while (out.length < 3) { const i = (r() * POOL.length) | 0; if (!types.has(POOL[i][0])) { types.add(POOL[i][0]); out.push({ i, p: 0, done: false }); } }
  return out;
}
function roll() {
  const d = H.today(); if (!d || st.day === d) return;
  st.streak = st.day && dayNum(d) - dayNum(st.day) === 1 ? st.streak + 1 : 1;
  st.day = d; st.q = pick(d); st.bonus = false; st.gift = false; save();
}
const giftValue = () => 10 + 5 * Math.min(4, st.streak - 1);

export function track(type, n, max = false) {
  roll(); let ch = false;
  for (const q of st.q) {
    const [ty, goal, e, lbl] = POOL[q.i]; if (ty !== type || q.done) continue;
    const p = Math.min(goal, max ? Math.max(q.p, n) : q.p + n); if (p === q.p) continue;
    q.p = p; ch = true;
    if (p >= goal) { q.done = true; H.toast('Mission accomplie : ' + lbl); H.vib([12, 40, 12]); const all = st.q.every((x) => x.done) && !st.bonus; if (all) st.bonus = true; H.grant(e, all ? 'Trois missions : noyau Rare garanti' : '', all ? 1 : -1); }
  }
  if (ch) { save(); refresh(); }
}
export function html() {
  roll();
  return st.q.map((q) => { const [, goal, e, lbl] = POOL[q.i]; return `<div class="q${q.done ? ' ok' : ''}"><i style="--p:${Math.round((q.p / goal) * 100)}%"></i><span>${lbl}</span><em>${q.done ? 'fait' : '+' + e + ' ⚡'}</em></div>`; }).join('');
}
function refresh() {
  const b = $('#b-quests'); if (!b) return;
  const n = st.q.filter((q) => q.done).length;
  b.innerHTML = `<span>Missions du jour</span><em>${st.gift ? '' : '<u>cadeau</u> · '}${n}/3</em>`;
  const p = $('#qs-list'); if (p) { p.innerHTML = html(); $('#qs-gift').hidden = st.gift; $('#qs-gift').textContent = `Cadeau du jour · +${giftValue()} énergie`; $('#qs-sub').textContent = `Jour ${st.streak} de suite. Les trois missions terminées : un noyau Rare garanti.`; }
}
export function init(opts) {
  Object.assign(H, opts); roll();
  const menu = $('#s-title .menu'); if (!menu) return;
  const css = document.createElement('style');
  css.textContent = '#b-quests{display:flex;justify-content:space-between;align-items:center;width:100%;height:46px;padding:0 18px;border-radius:23px;font:700 12px var(--disp);letter-spacing:1.2px;text-transform:uppercase;color:#fff;transition:transform .55s cubic-bezier(.2,1.6,.4,1)}#b-quests em{font-style:normal;color:#ffc247}#b-quests u{text-decoration:none;color:#5dffc0}#b-quests:active{transform:scale(.955)}';
  document.head.appendChild(css);
  const b = document.createElement('button'); b.id = 'b-quests'; b.className = 'glass';
  const hero = $('#b-mine'); if (hero && hero.parentNode === menu) hero.after(b); else menu.prepend(b);
  const d = document.createElement('div');
  d.innerHTML = '<div class="modal" id="qs"><div class="card glass"><h2>Missions du jour</h2><p id="qs-sub"></p><div class="fg-q" id="qs-list"></div><div class="btns"><button class="big primary" id="qs-gift"></button><button class="big glass" id="qs-close">Fermer</button></div></div></div>';
  document.body.append(d.firstChild);
  b.addEventListener('click', () => { roll(); refresh(); $('#qs').classList.add('on'); });
  $('#qs-close').addEventListener('click', () => $('#qs').classList.remove('on'));
  $('#qs').addEventListener('click', (e) => { if (e.target.id === 'qs') e.currentTarget.classList.remove('on'); });
  $('#qs-gift').addEventListener('click', () => { if (st.gift) return; st.gift = true; save(); H.grant(giftValue()); refresh(); });
  refresh();
}
