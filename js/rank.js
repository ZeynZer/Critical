// Critical — classement mondial de Genèse (Supabase, sans connexion : un pseudo demandé une seule fois).
// Tout passe par les fonctions SQL de supabase/schema.sql ; l'appareil est identifié par un secret aléatoire local.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const KEY = 'critical.rank.v1', PAGE = 50;
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); // les pseudos viennent d'autres joueurs
const H = { toast: () => {}, vib: () => {}, today: () => '', astres: () => [], astreInfo: () => null, paint: () => {}, codexN: () => 0, tierName: () => '?', local: () => ({}) };
const st = { secret: '', name: '', pending: [], prof: { featured: [], motto: '' }, dirty: false }; // pending : scores pas encore envoyés (pas de pseudo, ou hors connexion)
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const ERR = { name_taken: 'Ce pseudo est déjà pris.', invalid_name: '3 à 16 caractères : lettres, chiffres, espace, point, tiret.', too_fast: 'Deux envois trop rapprochés, réessaie dans un instant.', implausible: 'Score refusé par le serveur.', network: 'Connexion impossible. Réessaie plus tard.', invalid_motto: 'La devise ne peut pas contenir de < ou >.', invalid_featured: 'Vitrine invalide.' };
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
async function pushProfile() { // profil modifié hors connexion : envoyé dès que possible
  try { await rpc('set_profile', { p_secret: secret(), p_featured: st.prof.featured, p_motto: st.prof.motto, p_codex: H.codexN() }); st.dirty = false; save(); } catch (e) { if (/^invalid_/.test(e.message)) { st.dirty = false; save(); } }
}
async function flush() {
  if (ready() && st.name && st.dirty) await pushProfile();
  if (ready() && st.name) reportTime(H.local().playtime || 0, true);
  if (!ready() || !st.name || !st.pending.length) return null;
  let out = null;
  for (const p of st.pending.slice()) {
    try { const r = await rpc('submit_score', { p_secret: secret(), p_board: p.board, p_score: p.score, p_sector: p.sector, p_tier: p.tier, p_seed: p.seed, p_log: p.log, p_steps: p.steps }); if (p.board === 'all') out = r; }
    catch (e) { if (e.message === 'network' || e.message === 'too_fast') continue; } // on réessaiera ; tout autre refus est définitif
    st.pending = st.pending.filter((q) => q !== p);
  }
  save(); return out;
}
let tLast = 0, tSent = 0;
export function reportTime(sec, force) { // temps de jeu cumulé, au plus une fois toutes les 2 minutes ; le serveur borne la progression par le temps réellement écoulé
  sec = Math.floor(sec); if (!ready() || !st.name || sec <= tSent || (!force && Date.now() - tLast < 120000)) return;
  tLast = Date.now(); rpc('report_playtime', { p_secret: secret(), p_seconds: sec }).then(() => { tSent = sec; }).catch(() => {});
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
.rk-row{display:flex;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.07);font-size:14px}
.rk-row i{flex:none;width:34px;font:900 13px var(--disp);font-style:normal;color:rgba(255,255,255,.55);text-align:right}
.rk-row:nth-child(1) i{color:#ffc247}.rk-row:nth-child(2) i{color:#dfe7f5}.rk-row:nth-child(3) i{color:#e0a070}
.rk-row span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600}.rk-row b{font:700 13px var(--disp)}.rk-row small{flex:none;width:26px;text-align:right;font-size:11px;color:rgba(255,255,255,.5)}
.rk-row.me{background:linear-gradient(90deg,rgba(77,243,255,.2),rgba(255,79,216,.16))}
#rk-me{width:100%;min-height:20px;font-size:13px;color:#fff;text-align:center}#rk-me b{color:#5dffc0}
#rk-msg{padding:40px 16px;text-align:center;color:rgba(255,255,255,.6);font-size:14px;line-height:1.5}
#rk-in{width:100%;height:52px;border-radius:18px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#fff;font:700 18px var(--font);text-align:center;outline:none;user-select:text;-webkit-user-select:text}
#rk-err{min-height:18px;color:#ff8aa0;font-size:13px}
.rk-row{cursor:pointer}.rk-row:active{background:rgba(255,255,255,.1)}.rk-ic{flex:none;width:26px;height:26px;display:block}.rk-ic[data-key='']{visibility:hidden}
#rk-feed{width:100%;font-size:11.5px;line-height:1.5;color:rgba(255,255,255,.72);text-align:left}#rk-feed:empty{display:none}#rk-feed b{color:#fff}#rk-feed .rf-s{color:#ffc247;margin-bottom:3px}
#rk-hint{font-size:11px;color:rgba(255,255,255,.45);margin:-4px 0 0}
#rk-prof .card,#rk-edit .card{max-width:420px;max-height:calc(100vh - 32px);overflow-y:auto;touch-action:pan-y;scrollbar-width:none}
#pf-av{width:112px;height:112px;flex:none;border-radius:50%;display:grid;place-items:center;border:2px solid var(--c,rgba(255,255,255,.25));background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--c,#fff) 30%,transparent),rgba(255,255,255,.03));box-shadow:0 0 28px color-mix(in srgb,var(--c,#fff) 45%,transparent)}
#pf-av svg{width:52px;height:52px;opacity:.45}#pf-av canvas{display:block}
#ed-av{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;border:2px solid var(--c,rgba(255,255,255,.25));background:rgba(255,255,255,.04);flex:none}#ed-av svg{width:30px;height:30px;opacity:.4}
.pf-lab{margin:0!important;font:700 11px var(--disp);letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.5)!important;min-height:0!important}
#pf-show{display:flex;gap:10px;justify-content:center;width:100%;align-items:stretch}#pf-show:empty{display:none}.pf-load{align-self:center;color:rgba(255,255,255,.6);font-size:14px;text-align:center;padding:14px 0}
.pf-cell{flex:1;max-width:112px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 8px;border-radius:20px;text-align:center;border:1.5px solid var(--c);background:radial-gradient(120% 80% at 50% 0,color-mix(in srgb,var(--c) 28%,transparent),rgba(255,255,255,.03));box-shadow:0 0 22px color-mix(in srgb,var(--c) 40%,transparent)}
.pf-cell b{font-size:11px;line-height:1.2}.pf-cell small{font-size:9.5px;line-height:1.2;color:rgba(255,255,255,.65)}.pf-cell em{font:700 9px var(--disp);font-style:normal;letter-spacing:.8px;color:var(--c)}
#pf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}#pf-stats b{font-size:19px}#pf-stats span{font-size:10.5px}#pf-av{animation:pf-halo 4s ease-in-out infinite}@keyframes pf-halo{50%{box-shadow:0 0 44px color-mix(in srgb,var(--c,#fff) 70%,transparent)}}#pf-name{font-size:26px}#pf-name{margin:2px 0 0}#pf-motto{min-height:0;font-style:italic;color:rgba(255,255,255,.8)}#pf-motto:empty{display:none}#pf-meta{font-size:12px}
#ed-grid{width:100%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:36vh;overflow-y:auto;touch-action:pan-y}
.ed-cell{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:16px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.12);color:#fff}
.ed-cell b{font-size:10.5px;line-height:1.15}.ed-cell small{font-size:9px;color:rgba(255,255,255,.55)}.ed-cell.on{border-color:#5dffc0;background:rgba(93,255,192,.12)}
.ed-cell i{position:absolute;top:4px;right:6px;font:900 13px var(--disp);font-style:normal;color:#5dffc0}.ed-cell i.st{color:#ffc247}
#ed-motto{width:100%;height:46px;border-radius:16px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#fff;font:600 15px var(--font);text-align:center;outline:none;user-select:text;-webkit-user-select:text}
#ed-err{min-height:16px;color:#ff8aa0;font-size:13px;margin:0}`;
const HTML = `
<div class="modal" id="rk"><div class="card glass"><h2>Classement</h2>
<div class="rk-tabs"><button data-b="all" class="on">Mondial</button><button data-b="day">Défi du jour</button></div>
<div id="rk-feed"></div><div id="rk-list"></div><p id="rk-hint">Touche un joueur pour voir son profil.</p><p id="rk-me"></p>
<div class="btns"><button class="big glass" id="rk-name"></button><button class="big primary" id="rk-close">Fermer</button></div></div></div>
<div class="modal" id="rk-prof"><div class="card glass"><div id="pf-av"></div><h2 id="pf-name"></h2><p id="pf-motto"></p>
<div class="stats" id="pf-stats" hidden><div><b id="pf-rank">–</b><span>rang</span></div><div><b id="pf-score">–</b><span>meilleur score</span></div><div><b id="pf-tier" style="font-size:14px">–</b><span>plus gros astre</span></div><div><b id="pf-wins">0</b><span>défis réussis</span></div><div><b id="pf-time" style="font-size:14px">–</b><span>temps de jeu</span></div><div><b id="pf-cdx">–</b><span>découvertes</span></div></div>
<p class="pf-lab" id="pf-lab" hidden>Vitrine</p><div id="pf-show"></div>
<p id="pf-meta"></p><div class="btns"><button class="big glass" id="pf-replay" hidden>▶ Revoir sa meilleure partie</button><button class="big glass" id="pf-edit" hidden>Modifier mon profil</button><button class="big primary" id="pf-close">Fermer</button></div></div></div>
<div class="modal" id="rk-edit"><div class="card glass"><h2>Mon profil</h2><div id="ed-av"></div><p>Touche tes astres découverts : le <b>★ 1er</b> devient ton astre de profil (affiché partout), les 2 suivants vont dans ta vitrine.</p>
<div id="ed-grid"></div><input id="ed-motto" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Ta devise (facultatif)" enterkeyhint="done"><p id="ed-err"></p>
<div class="btns"><button class="big primary" id="ed-ok">Enregistrer</button><button class="big glass" id="ed-name">Changer de pseudo</button><button class="big glass" id="ed-cancel">Annuler</button></div></div></div>
<div class="modal" id="rk-ask"><div class="card glass"><h2>Ton pseudo</h2><p>Il apparaîtra dans le classement mondial. Demandé une seule fois, modifiable ensuite.</p>
<input id="rk-in" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pseudo" enterkeyhint="done">
<p id="rk-err"></p><div class="btns"><button class="big primary" id="rk-ok">Valider</button><button class="big glass" id="rk-later">Plus tard</button></div></div></div>`;
const pts = (v) => (board === 'all' ? fmt(v) : (v / 100).toLocaleString('fr-FR') + ' s d\'avance'); // défi : temps restant
const fmtTime = (sec) => (sec < 60 ? '< 1 min' : sec < 3600 ? `${Math.floor(sec / 60)} min` : `${Math.floor(sec / 3600)} h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`);
const fmtMonth = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
let board = 'all', off = 0, done = false, busy = false, token = 0;
const boardId = () => (board === 'all' ? 'all' : 'day:' + H.today());

async function more() { // charge la page suivante (défilement infini)
  if (busy || done) return; busy = true; const t = token, list = $('#rk-list');
  try {
    const rows = await rpc('leaderboard', { p_board: boardId(), p_offset: off, p_limit: PAGE });
    if (t !== token) return;
    if (!off && !rows.length) list.innerHTML = '<div id="rk-msg">Personne ici pour l\'instant.<br>Sois le premier à y entrer.</div>';
    list.insertAdjacentHTML('beforeend', rows.map((r) => `<div class="rk-row${r.name === st.name ? ' me' : ''}" data-name="${esc(r.name)}"><i>${r.rank}</i><canvas class="rk-ic" data-key="${esc(r.badge || '')}"></canvas><span>${esc(r.name)}</span><b>${pts(r.score)}</b><small>${board === 'all' ? 'S' + r.sector : ''}</small></div>`).join(''));
    list.querySelectorAll('.rk-ic:not([data-done])').forEach((c) => { c.dataset.done = 1; if (c.dataset.key) H.paint(c, c.dataset.key, 26); });
    off += rows.length; done = rows.length < PAGE;
  } catch (e) { if (t === token && !off) list.innerHTML = `<div id="rk-msg">${ERR.network}</div>`; done = true; }
  finally { if (t === token) busy = false; }
}
async function show(b) {
  board = b; off = 0; done = false; busy = false; token++; const t = token;
  document.querySelectorAll('.rk-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.b === b));
  $('#rk-list').innerHTML = ''; $('#rk-list').scrollTop = 0; $('#rk-me').textContent = '';
  $('#rk-name').textContent = st.name ? 'Mon profil (' + st.name + ')' : 'Choisir un pseudo pour participer';
  more(); feed(t);
  if (!st.name) return;
  try { await flush(); const me = await rpc('my_rank', { p_secret: secret(), p_board: boardId() }); if (t === token) $('#rk-me').innerHTML = me ? `Toi : <b>n° ${fmt(me.rank)}</b> sur ${fmt(me.total)} · ${pts(me.score)}${board === 'all' ? ' points' : ''}` : 'Tu n\'as pas encore de score ici.'; } catch (e) { /* le classement s'affiche quand même */ }
}
const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
async function feed(t) { // faits réels uniquement : dernières parties classées, part des joueurs ayant atteint les gros astres
  const box = $('#rk-feed'); box.innerHTML = ''; if (board !== 'all') return;
  try {
    const [a, r] = await Promise.all([rpc('activity', {}), rpc('rarity', {})]); if (t !== token || board !== 'all') return;
    const pc = (n) => (r.total ? Math.max(0.1, Math.round((n / r.total) * 1000) / 10).toLocaleString('fr-FR') : '0');
    box.innerHTML = (r.total >= 3 ? `<div class="rf-s">${pc(r.hole)} % des joueurs ont atteint un trou noir · ${pc(r.galaxy)} % une galaxie (sur ${fmt(r.total)})</div>` : '') + (a || []).slice(0, 3).map((x) => `<div><b>${esc(x.name)}</b> · ${fmt(x.score)} pts · ${esc(H.tierName(x.tier))} · ${ago(x.at)}</div>`).join('');
  } catch (e) { /* le fil est un bonus : pas d'erreur affichée */ }
}
export const rival = (score) => (ready() ? rpc('rival', { p_score: Math.round(score || 0) }) : Promise.resolve(null));
export const runOf = (name) => rpc('get_run', { p_name: name });
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
  try { await rpc('register', { p_secret: secret(), p_name: v }); st.name = v; save(); $('#rk-ask').classList.remove('on'); H.toast('Bienvenue dans le classement, ' + v); const r = await flush(); onName(r); if (openAfterName) { openAfterName = false; openProfile(st.name); } if ($('#rk').classList.contains('on')) show(board); }
  catch (e) { $('#rk-err').textContent = ERR[e.message] || ERR.network; }
  finally { ok.disabled = false; }
}
/* ---------- profils ---------- */
const USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4.2 4.2-6 8-6s6.8 1.8 8 6"/></svg>';
let pfTimer = 0, pfName = '', onProf = () => {}, openAfterName = false;
export const avatarKey = () => (st.prof.featured || [])[0] || '';
export const whenProfile = (f) => { onProf = f; };
const closeProfile = () => { clearInterval(pfTimer); $('#rk-prof').classList.remove('on'); pfName = ''; };
// astre dans une vignette ronde : couleur de rareté en liseré et en halo
function avatar(box, key, px) {
  const info = key && H.astreInfo(key); box.innerHTML = '';
  if (!info) { box.style.removeProperty('--c'); box.innerHTML = USER; return; }
  const c = document.createElement('canvas'); c.dataset.key = key; H.paint(c, key, px, true); box.style.setProperty('--c', `rgb(${info.col.join(',')})`); box.append(c);
}
function renderProfile(p, me, offline) {
  const keys = (p.featured || []).filter((k) => H.astreInfo(k));
  $('#pf-name').textContent = p.name; $('#pf-motto').textContent = p.motto ? '« ' + p.motto + ' »' : '';
  avatar($('#pf-av'), keys[0], 96);
  const show = $('#pf-show'); show.innerHTML = '';
  for (const key of keys.slice(1)) {
    const info = H.astreInfo(key), d = document.createElement('div'), c = document.createElement('canvas');
    d.className = 'pf-cell'; d.style.setProperty('--c', `rgb(${info.col.join(',')})`); c.dataset.key = key; H.paint(c, key, 84, true); d.append(c);
    d.insertAdjacentHTML('beforeend', (info.rar >= 3 ? `<em>${['', '', '', 'ÉPIQUE', 'LÉGENDAIRE', 'CRITIQUE'][info.rar]}</em>` : '') + `<b>${esc(info.name)}</b>` + (info.sub ? `<small>${esc(info.sub)}</small>` : ''));
    show.append(d);
  }
  $('#pf-lab').hidden = !show.children.length;
  clearInterval(pfTimer); if (keys.length) pfTimer = setInterval(() => document.querySelectorAll('#rk-prof canvas[data-key]').forEach((c) => H.paint(c, c.dataset.key, c.closest('#pf-av') ? 96 : 84, true)), 100); // astres animés
  $('#pf-rank').textContent = p.rank ? 'n° ' + fmt(p.rank) : '–'; $('#pf-score').textContent = p.score ? fmt(p.score) : '–';
  $('#pf-tier').textContent = p.tier != null ? H.tierName(p.tier) : '–'; $('#pf-wins').textContent = p.wins != null ? fmt(p.wins) : '–';
  const pt = me ? Math.max(p.playtime || 0, H.local().playtime || 0) : p.playtime || 0; $('#pf-time').textContent = pt ? fmtTime(pt) : '–'; $('#pf-cdx').textContent = p.codex != null ? fmt(p.codex) : '–'; $('#pf-stats').hidden = false;
  $('#pf-meta').textContent = offline ? 'Hors connexion : profil enregistré sur cet appareil.' : (p.since ? 'Membre depuis ' + fmtMonth(p.since) : '');
  $('#pf-edit').hidden = !me; $('#pf-replay').hidden = offline || !p.score;
}
async function openProfile(name) {
  const m = $('#rk-prof'); pfName = name; m.classList.add('on'); clearInterval(pfTimer);
  const me = !!st.name && name.toLowerCase() === st.name.toLowerCase();
  $('#pf-name').textContent = name; $('#pf-motto').textContent = ''; $('#pf-av').innerHTML = ''; $('#pf-show').innerHTML = ''; $('#pf-lab').hidden = true; $('#pf-stats').hidden = true; $('#pf-meta').textContent = 'Chargement…'; $('#pf-edit').hidden = true;
  let p = null;
  try { p = await rpc('get_profile', { p_name: name }); }
  catch (e) {
    if (pfName !== name) return;
    if (me) return renderProfile({ name: st.name, motto: st.prof.motto, featured: st.prof.featured, codex: H.codexN(), ...H.local() }, true, true); // le serveur ne répond pas : on montre le profil local
    $('#pf-meta').textContent = ERR.network; return;
  }
  if (pfName !== name) return; // fermé ou remplacé pendant le chargement
  if (!p) { $('#pf-meta').textContent = me ? '' : 'Profil introuvable.'; if (me) renderProfile({ name: st.name, motto: st.prof.motto, featured: st.prof.featured, codex: H.codexN(), ...H.local() }, true, true); return; }
  if (me && !st.dirty) { st.prof = { featured: p.featured || [], motto: p.motto || '' }; save(); onProf(); } // le serveur fait foi, sauf modification en attente d'envoi
  renderProfile(me && st.dirty ? { ...p, motto: st.prof.motto, featured: st.prof.featured } : p, me);
}
export function openMyProfile() { // bouton Profil du menu
  if (!ready()) return H.toast('Le classement en ligne n\'est pas encore activé');
  if (!st.name) { openAfterName = true; return askName(); }
  openProfile(st.name);
}
let sel = [];
function mark() {
  document.querySelectorAll('.ed-cell').forEach((b) => { const i = sel.indexOf(b.dataset.key), t = b.querySelector('i'); b.classList.toggle('on', i >= 0); t.textContent = i < 0 ? '' : i === 0 ? '★' : i + 1; t.className = i === 0 ? 'st' : ''; });
  avatar($('#ed-av'), sel[0], 56);
}
function openEditor() {
  if (!st.name) return askName();
  const list = H.astres(), g = $('#ed-grid'); g.innerHTML = '';
  sel = (st.prof.featured || []).filter((k) => list.some((a) => a.key === k)); $('#ed-motto').value = st.prof.motto || ''; $('#ed-err').textContent = '';
  if (!list.length) g.innerHTML = '<div class="pf-load" style="grid-column:1/-1">Fusionne quelques astres pour les exposer ici.</div>';
  for (const a of list) {
    const b = document.createElement('button'), c = document.createElement('canvas'); b.className = 'ed-cell'; b.dataset.key = a.key; H.paint(c, a.key, 56); b.append(c);
    b.insertAdjacentHTML('beforeend', `<b>${esc(a.name)}</b>${a.sub ? `<small>${esc(a.sub)}</small>` : ''}<i></i>`);
    b.addEventListener('click', () => { const i = sel.indexOf(a.key); if (i >= 0) sel.splice(i, 1); else if (sel.length < 3) sel.push(a.key); else return H.toast('3 astres au maximum : retire-en un d\'abord'); mark(); });
    g.append(b);
  }
  mark(); $('#rk-edit').classList.add('on');
}
async function saveProfile() {
  const motto = $('#ed-motto').value.trim(), ok = $('#ed-ok'); if (ok.disabled) return;
  if (/[<>]/.test(motto)) { $('#ed-err').textContent = ERR.invalid_motto; return; }
  ok.disabled = true; $('#ed-err').textContent = '';
  const prof = { featured: sel.slice(), motto };
  try {
    await rpc('set_profile', { p_secret: secret(), p_featured: prof.featured, p_motto: prof.motto, p_codex: H.codexN() });
    st.prof = prof; st.dirty = false; H.toast('Profil enregistré');
  } catch (e) {
    if (/^invalid_|^too_fast$/.test(e.message)) { $('#ed-err').textContent = ERR[e.message] || ERR.network; ok.disabled = false; return; }
    st.prof = prof; st.dirty = true; H.toast('Profil enregistré sur cet appareil, envoyé dès que possible'); // pas de connexion, ou serveur pas encore à jour
  }
  save(); onProf(); $('#rk-edit').classList.remove('on'); ok.disabled = false;
  if ($('#rk-prof').classList.contains('on')) openProfile(st.name); if ($('#rk').classList.contains('on')) show(board);
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
  $('#rk-name').addEventListener('click', () => (st.name ? openProfile(st.name) : askName()));
  $('#rk-list').addEventListener('click', (e) => { const r = e.target.closest('.rk-row'); if (r && r.dataset.name) { H.vib(6); openProfile(r.dataset.name); } });
  $('#pf-close').addEventListener('click', closeProfile); $('#pf-edit').addEventListener('click', openEditor);
  $('#pf-replay').addEventListener('click', async () => { const b = $('#pf-replay'); b.disabled = true; try { const run = await rpc('get_run', { p_name: pfName }); if (!run || !Array.isArray(run.log)) H.toast('Aucune rediffusion disponible'); else { closeProfile(); H.replay(run); } } catch (e) { H.toast(ERR.network); } b.disabled = false; });
  $('#ed-ok').addEventListener('click', saveProfile); $('#ed-cancel').addEventListener('click', () => $('#rk-edit').classList.remove('on')); $('#ed-name').addEventListener('click', askName);
  $('#ed-motto').addEventListener('input', () => { $('#ed-err').textContent = ''; });
  $('#ed-motto').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveProfile(); }); $('#rk-ok').addEventListener('click', confirmName); $('#rk-later').addEventListener('click', () => { openAfterName = false; $('#rk-ask').classList.remove('on'); });
  $('#rk-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmName(); });
  document.querySelectorAll('.rk-tabs button').forEach((x) => x.addEventListener('click', () => show(x.dataset.b)));
  $('#rk-list').addEventListener('scroll', (e) => { const l = e.currentTarget; if (l.scrollTop + l.clientHeight > l.scrollHeight - 120) more(); }, { passive: true });
  onProf(); flush(); // scores et profil restés en attente (hors connexion la dernière fois)
}
