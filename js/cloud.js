// Critical — sauvegarde dans le cloud (supabase/schema.sql : save_push, save_pull).
// Toute la progression (Voidium, cartes, niveau, défis, missions, réglages, profil) est recopiée en silence sur le serveur,
// rangée sous l'empreinte du secret de l'appareil. Ce secret sert aussi de code de récupération : changer de téléphone,
// passer de Safari à l'application installée, ou survivre à un effacement du navigateur.
// Jamais synchronisés : la télémétrie (anonyme, ne doit pas être reliée au joueur), le guide d'installation, la partie en cours.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SYNC = ['critical.forage.v2', 'critical.goals.v1', 'critical.quests.v1', 'critical.chp.v1', 'critical.col.v1', 'critical.v1', 'critical.intro.v1', 'critical.hint.v1', 'critical.ev.v1', 'critical.rank.v1'];
const ST = 'critical.cloud.v1', APPLY = 'critical.cloud.apply', EVERY = 60000;
const H = { secret: () => '', busy: () => false };
let st = { rev: 0, sig: '', at: 0 };
try { Object.assign(st, JSON.parse(localStorage.getItem(ST) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(ST, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const ready = () => !!(SUPABASE_URL && SUPABASE_KEY);
let staged = false, sending = false, started = false;

function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }
const xpOf = (k) => { try { return Math.max(0, Math.floor(JSON.parse(k['critical.forage.v2'] || '{}').xp || 0)); } catch (e) { return 0; } };
export function snapshot() { // { k: { clé: texte } } : le contenu exact du stockage, sans le secret ni les scores en attente
  const k = {};
  for (const key of SYNC) {
    let v = null; try { v = localStorage.getItem(key); } catch (e) { /* ignore */ }
    if (v == null) continue;
    if (key === 'critical.rank.v1') { try { const o = JSON.parse(v); delete o.secret; delete o.pending; v = JSON.stringify(o); } catch (e) { continue; } }
    k[key] = v;
  }
  const data = { v: 1, k };
  return { data, xp: xpOf(k), sig: hash(JSON.stringify(k)) };
}

async function rpc(fn, args, keepalive) {
  let r, j = null;
  try { r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', keepalive: !!keepalive, headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); j = await r.json(); }
  catch (e) { throw new Error('network'); }
  if (!r.ok) throw new Error((j && j.message) || 'network');
  return j;
}

// Prépare l'application d'une sauvegarde : boot.js la recopie au prochain démarrage (avant que les modules ne lisent le stockage).
function stage(cloud, secret) {
  const k = (cloud.data && cloud.data.k) || {};
  try { localStorage.setItem(APPLY, JSON.stringify({ k, rev: cloud.rev | 0, sig: hash(JSON.stringify(k)), secret })); staged = true; return true; } catch (e) { return false; }
}
// Recharger n'est discret que tant que l'écran de démarrage est affiché et qu'aucune partie n'est en cours.
const quietReload = () => { if (!H.busy() && document.getElementById('splash')) { location.reload(); return true; } return false; };

export async function push(hidden) {
  if (!ready() || staged || sending || !started) return;
  const s = snapshot(); if (s.sig === st.sig) return;
  if (hidden && JSON.stringify(s.data).length > 60000) hidden = false; // au-delà, le navigateur refuse l'envoi en arrière-plan
  sending = true;
  try {
    const r = await rpc('save_push', { p_secret: H.secret(), p_data: s.data, p_xp: s.xp, p_base: st.rev | 0 }, hidden);
    if (r && r.conflict) { if (stage(r, H.secret())) quietReload(); } // un autre appareil est plus avancé : sa progression l'emporte
    else if (r && r.rev) { st = { rev: r.rev, sig: s.sig, at: Date.now() }; save(); }
  } catch (e) { /* hors connexion ou trop rapproché : on réessaiera */ }
  sending = false;
}

async function sync() { // au démarrage : récupère une progression plus avancée venue d'un autre appareil, sinon envoie la nôtre
  try {
    const c = await rpc('save_pull', { p_secret: H.secret() });
    if (c && (c.rev | 0) > (st.rev | 0)) {
      const local = snapshot(), clean = local.sig === st.sig || !st.sig && !local.xp;
      if (clean || (c.xp | 0) > local.xp) { if (stage(c, H.secret())) quietReload(); return; }
    }
  } catch (e) { /* hors connexion */ }
  push();
}

export function init(opts) {
  Object.assign(H, opts);
  if (!ready()) return;
  setTimeout(() => { started = true; sync(); }, 1200);
  setInterval(() => push(), EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(true); });
}

export const status = () => ({ at: st.at, rev: st.rev, pending: snapshot().sig !== st.sig });
export const code = () => H.secret();
export const validCode = (c) => /^[0-9a-f-]{24,128}$/i.test(String(c || '').trim());
// Restauration par code : remplace la progression de cet appareil par celle du code, puis redémarre.
export async function restore(c) {
  c = String(c || '').trim();
  if (!validCode(c)) throw new Error('Code invalide.');
  if (c === H.secret()) throw new Error('C\'est déjà le code de cet appareil.');
  await push().catch(() => {}); // la progression actuelle reste au moins sur le serveur, sous l'ancien code
  let cl; try { cl = await rpc('save_pull', { p_secret: c }); } catch (e) { throw new Error('Connexion impossible. Réessaie plus tard.'); }
  if (!cl) throw new Error('Aucune sauvegarde pour ce code.');
  if (!stage(cl, c)) throw new Error('Stockage indisponible sur cet appareil.');
  location.reload();
}

// Fenêtre Réglages › Sauvegarde : état, code de récupération (masqué, copiable), restauration.
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
const CSS = `.cl-card{max-width:420px;align-items:stretch;gap:8px;text-align:center}.cl-ok{font-size:13px;color:#5dffc0}.cl-wait{font-size:13px;color:rgba(255,255,255,.6)}
.cl-p{margin:0;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.65)}.cl-code{font:600 12px ui-monospace,monospace;word-break:break-all;padding:10px;border-radius:14px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.15);user-select:text;-webkit-user-select:text;color:#fff;filter:blur(5px);transition:filter .2s}
.cl-code.on{filter:none}.cl-row{display:flex;gap:8px}.cl-row button{flex:1}.cl-in{width:100%;min-height:70px;border-radius:14px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#fff;font:600 12px ui-monospace,monospace;padding:10px;resize:none;outline:none;user-select:text;-webkit-user-select:text;box-sizing:border-box}
.cl-err{min-height:16px;font-size:12px;color:#ff8aa0}.cl-card h3{margin:10px 0 0;font:800 11px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:#c79bff}`;
export function open(toast = () => {}) {
  if (!document.getElementById('cl-css')) { const s = document.createElement('style'); s.id = 'cl-css'; s.textContent = CSS; document.head.append(s); }
  const S = status(), m = document.createElement('div'); m.className = 'modal on';
  const state = !ready() ? '<p class="cl-wait">Sauvegarde en ligne indisponible.</p>' : S.at && (!S.pending || Date.now() - S.at < 180000) ? `<p class="cl-ok">✓ Progression sauvegardée ${ago(S.at)}</p>` : S.at ? `<p class="cl-wait">Dernière sauvegarde ${ago(S.at)} · la suite part dès que possible</p>` : '<p class="cl-wait">Première sauvegarde dès que la connexion le permet</p>';
  m.innerHTML = `<div class="card glass cl-card"><h2>Sauvegarde</h2>${state}<p class="cl-p">Ta progression (Voidium, cartes, niveau, défis, profil) est sauvegardée automatiquement. Garde ce code pour la retrouver sur un autre téléphone ou dans l'application installée. <b>Ne le donne à personne</b> : il ouvre ton compte.</p>`
    + `<div class="cl-code" id="cl-code"></div><div class="cl-row"><button class="big glass" id="cl-show">Afficher</button><button class="big glass" id="cl-copy">Copier</button></div>`
    + `<h3>Retrouver une progression</h3><textarea class="cl-in" id="cl-in" placeholder="Colle ici ton code de récupération" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea><div class="cl-err" id="cl-err"></div>`
    + `<button class="big glass" id="cl-go">Restaurer</button><div class="btns"><button class="big primary" id="cl-x">Fermer</button></div></div>`;
  document.body.append(m);
  const $ = (id) => m.querySelector('#' + id), c = code();
  $('cl-code').textContent = c;
  $('cl-show').onclick = () => { const on = $('cl-code').classList.toggle('on'); $('cl-show').textContent = on ? 'Masquer' : 'Afficher'; };
  $('cl-copy').onclick = async () => { try { await navigator.clipboard.writeText(c); toast('Code copié : range-le en lieu sûr'); } catch (e) { $('cl-code').classList.add('on'); toast('Sélectionne le code pour le copier'); } };
  let armed = 0;
  $('cl-go').onclick = async () => {
    const v = $('cl-in').value.trim(), b = $('cl-go'); $('cl-err').textContent = '';
    if (!validCode(v)) { $('cl-err').textContent = 'Ce code n\'est pas valide.'; return; }
    if (Date.now() - armed > 4000) { armed = Date.now(); b.textContent = 'Confirmer : remplace la progression de cet appareil'; return; } // deux appuis
    b.disabled = true; b.textContent = 'Restauration…';
    try { await restore(v); } catch (e) { $('cl-err').textContent = e.message; b.disabled = false; b.textContent = 'Restaurer'; armed = 0; }
  };
  $('cl-x').onclick = () => m.remove(); m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  push();
}
