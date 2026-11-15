// Critical — classement mondial de Genèse (Supabase, sans connexion : un pseudo demandé une seule fois).
// Tout passe par les fonctions SQL de supabase/schema.sql ; l'appareil est identifié par un secret aléatoire local.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const KEY = 'critical.rank.v1', PAGE = 50;
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); // les pseudos viennent d'autres joueurs
const H = { toast: () => {}, vib: () => {}, today: () => '' };
const st = { secret: '', name: '', pending: [] }; // pending : scores pas encore envoyés (pas de pseudo, ou hors connexion)
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const ERR = { name_taken: 'Ce pseudo est déjà pris.', invalid_name: '3 à 16 caractères : lettres, chiffres, espace, point, tiret.', too_fast: 'Deux envois trop rapprochés, réessaie dans un instant.', implausible: 'Score refusé par le serveur.', network: 'Connexion impossible. Réessaie plus tard.' };
export const ready = () => !!(SUPABASE_URL && SUPABASE_KEY);
export const name = () => st.name;

async function rpc(fn, args) {
  let r, j = null;
  try { r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); j = await r.json(); }
  catch (e) { throw new Error('network'); }
  if (!r.ok) throw new Error((j && j.message) || 'network');
  return j;
}
const secret = () => { if (!st.secret) { st.secret = (crypto.randomUUID ? crypto.randomUUID() : '') + Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join(''); save(); } return st.secret; };

// Envoie les scores en attente (un par tableau, le meilleur). Renvoie le rang mondial, ou null si rien n'a pu partir.
async function flush() {
  if (!ready() || !st.name || !st.pending.length) return null;
  let out = null;
  for (const p of st.pending.slice()) {
    try { const r = await rpc('submit_score', { p_secret: secret(), p_board: p.board, p_score: p.score, p_sector: p.sector, p_tier: p.tier, p_seed: p.seed, p_log: p.log, p_steps: p.steps }); if (p.board === 'all') out = r; }
    catch (e) { if (e.message === 'network' || e.message === 'too_fast') continue; } // on réessaiera ; tout autre refus est définitif
    st.pending = st.pending.filter((q) => q !== p);
  }
  save(); return out;
}
// Appelé en fin de partie. run = { score, sector, tier, seed, log, steps } ; avec daily = date, c'est un défi du jour (score = centièmes de seconde restants)
export function submit(run) {
  if (!ready() || run.score <= 0) return Promise.resolve(null);
  for (const board of [run.daily ? 'day:' + run.daily : 'all']) {
    const old = st.pending.find((p) => p.board === board);
    if (old && old.score >= run.score) continue;
    st.pending = st.pending.filter((p) => p.board !== board).concat({ board, score: run.score, sector: run.sector, tier: run.tier, seed: run.seed, log: run.log, steps: run.steps });
  }
  save(); return flush();
}

/* ============================== interface ============================== */
const CSS = `
#rk .card{max-width:420px;gap:10px}
.rk-tabs{display:flex;gap:8px;width:100%}.rk-tabs button{flex:1;height:38px;border-radius:19px;font:700 12px var(--disp);letter-spacing:.8px;color:rgba(255,255,255,.6);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}
.rk-tabs button.on{color:#fff;background:linear-gradient(135deg,rgba(77,243,255,.34),rgba(255,79,216,.3));border-color:rgba(255,255,255,.4)}
#rk-list{width:100%;height:46vh;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;scrollbar-width:none;border-radius:16px;background:rgba(0,0,0,.22)}
.rk-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid rgba(255,255,255,.07);font-size:14px}
.rk-row i{flex:none;width:34px;font:900 13px var(--disp);font-style:normal;color:rgba(255,255,255,.55);text-align:right}
.rk-row:nth-child(1) i{color:#ffc247}.rk-row:nth-child(2) i{color:#dfe7f5}.rk-row:nth-child(3) i{color:#e0a070}
.rk-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}.rk-row b{font:700 13px var(--disp)}.rk-row small{flex:none;width:34px;text-align:right;font-size:11px;color:rgba(255,255,255,.5)}
.rk-row.me{background:linear-gradient(90deg,rgba(77,243,255,.2),rgba(255,79,216,.16))}
#rk-me{width:100%;min-height:20px;font-size:13px;color:#fff;text-align:center}#rk-me b{color:#5dffc0}
#rk-msg{padding:40px 16px;text-align:center;color:rgba(255,255,255,.6);font-size:14px;line-height:1.5}
#rk-in{width:100%;height:52px;border-radius:18px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#fff;font:700 18px var(--font);text-align:center;outline:none;user-select:text;-webkit-user-select:text}
#rk-err{min-height:18px;color:#ff8aa0;font-size:13px}`;
const HTML = `
<div class="modal" id="rk"><div class="card glass"><h2>Classement</h2>
<div class="rk-tabs"><button data-b="all" class="on">Mondial</button><button data-b="day">Défi du jour</button></div>
<div id="rk-list"></div><p id="rk-me"></p>
<div class="btns"><button class="big glass" id="rk-name"></button><button class="big primary" id="rk-close">Fermer</button></div></div></div>
<div class="modal" id="rk-ask"><div class="card glass"><h2>Ton pseudo</h2><p>Il apparaîtra dans le classement mondial. Demandé une seule fois, modifiable ensuite.</p>
<input id="rk-in" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pseudo" enterkeyhint="done">
<p id="rk-err"></p><div class="btns"><button class="big primary" id="rk-ok">Valider</button><button class="big glass" id="rk-later">Plus tard</button></div></div></div>`;
const pts = (v) => (board === 'all' ? fmt(v) : (v / 100).toLocaleString('fr-FR') + ' s d\'avance'); // défi : temps restant
let board = 'all', off = 0, done = false, busy = false, token = 0;
const boardId = () => (board === 'all' ? 'all' : 'day:' + H.today());

async function more() { // charge la page suivante (défilement infini)
  if (busy || done) return; busy = true; const t = token, list = $('#rk-list');
  try {
    const rows = await rpc('leaderboard', { p_board: boardId(), p_offset: off, p_limit: PAGE });
    if (t !== token) return;
    if (!off && !rows.length) list.innerHTML = '<div id="rk-msg">Personne ici pour l\'instant.<br>Sois le premier à y entrer.</div>';
    list.insertAdjacentHTML('beforeend', rows.map((r) => `<div class="rk-row${r.name === st.name ? ' me' : ''}"><i>${r.rank}</i><span>${esc(r.name)}</span><b>${pts(r.score)}</b><small>${board === 'all' ? 'S' + r.sector : ''}</small></div>`).join(''));
    off += rows.length; done = rows.length < PAGE;
  } catch (e) { if (t === token && !off) list.innerHTML = `<div id="rk-msg">${ERR.network}</div>`; done = true; }
  finally { if (t === token) busy = false; }
}
async function show(b) {
  board = b; off = 0; done = false; busy = false; token++; const t = token;
  document.querySelectorAll('.rk-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.b === b));
  $('#rk-list').innerHTML = ''; $('#rk-list').scrollTop = 0; $('#rk-me').textContent = '';
  $('#rk-name').textContent = st.name ? 'Changer de pseudo (' + st.name + ')' : 'Choisir un pseudo pour participer';
  more();
  if (!st.name) return;
  try { await flush(); const me = await rpc('my_rank', { p_secret: secret(), p_board: boardId() }); if (t === token) $('#rk-me').innerHTML = me ? `Toi : <b>n° ${fmt(me.rank)}</b> sur ${fmt(me.total)} · ${pts(me.score)}${board === 'all' ? ' points' : ''}` : 'Tu n\'as pas encore de score ici.'; } catch (e) { /* le classement s'affiche quand même */ }
}
export function open() {
  if (!ready()) return H.toast('Le classement en ligne n\'est pas encore activé');
  $('#rk').classList.add('on'); show('all');
}
export function askName() {
  if (!ready()) return H.toast('Le classement en ligne n\'est pas encore activé');
  $('#rk-in').value = st.name; $('#rk-err').textContent = ''; $('#rk-ask').classList.add('on'); setTimeout(() => $('#rk-in').focus(), 50);
}
async function confirmName() {
  const v = $('#rk-in').value.trim(), ok = $('#rk-ok'); if (ok.disabled) return;
  if (!/^[\p{L}\p{N} ._-]{3,16}$/u.test(v)) { $('#rk-err').textContent = ERR.invalid_name; return; }
  ok.disabled = true; $('#rk-err').textContent = '';
  try { await rpc('register', { p_secret: secret(), p_name: v }); st.name = v; save(); $('#rk-ask').classList.remove('on'); H.toast('Bienvenue dans le classement, ' + v); const r = await flush(); onName(r); if ($('#rk').classList.contains('on')) show(board); }
  catch (e) { $('#rk-err').textContent = ERR[e.message] || ERR.network; }
  finally { ok.disabled = false; }
}
let onName = () => {};
export const whenNamed = (f) => { onName = f; };

export function init(opts) {
  Object.assign(H, opts);
  const css = document.createElement('style'); css.textContent = CSS; document.head.appendChild(css);
  const d = document.createElement('div'); d.innerHTML = HTML; document.body.append(...d.children);
  const menu = $('#s-title .menu');
  if (menu) { const b = document.createElement('button'); b.className = 'big glass'; b.id = 'b-rank'; b.innerHTML = '<span>Classement</span>'; menu.appendChild(b); b.addEventListener('click', open); } // home.js le range dans la barre du bas
  $('#rk-close').addEventListener('click', () => $('#rk').classList.remove('on'));
  $('#rk-name').addEventListener('click', askName); $('#rk-ok').addEventListener('click', confirmName); $('#rk-later').addEventListener('click', () => $('#rk-ask').classList.remove('on'));
  $('#rk-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmName(); });
  document.querySelectorAll('.rk-tabs button').forEach((x) => x.addEventListener('click', () => show(x.dataset.b)));
  $('#rk-list').addEventListener('scroll', (e) => { const l = e.currentTarget; if (l.scrollTop + l.clientHeight > l.scrollHeight - 120) more(); }, { passive: true });
  flush(); // scores restés en attente (hors connexion la dernière fois)
}
