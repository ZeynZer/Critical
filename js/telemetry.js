// Critical — statistiques ANONYMES d'utilisation (pour la console admin › Analyse). Aucun pseudo, aucun texte libre : un identifiant d'appareil aléatoire,
// le temps réellement joué (écran visible + action récente), les fins de partie, des compteurs d'usage (écrans ouverts, packs…) et les erreurs JavaScript.
// Coupé en un geste : réglages › Statistiques anonymes. Hors ligne : les envois attendent (liste bornée), rien n'est écrit sur le serveur sans réseau.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
const KEY = 'critical.tele.v1', IDLE = 90, EVERY = 30000, MAXQ = 60;
let st = { did: '', off: false }; try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* stockage indisponible */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
let acc = 0, runs = [], evs = [], lastAct = Date.now(), first = true, ver = '', started = false, errs = 0, sentEv = 0, busy = false;
export const enabled = () => !st.off;
export function setEnabled(v) { st.off = !v; if (!v) { runs = []; evs = []; acc = 0; } save(); }
const platform = () => { const u = navigator.userAgent || ''; return /iPhone|iPad|iPod/.test(u) ? 'ios' : /Android/.test(u) ? 'android' : /Windows/.test(u) ? 'windows' : /Mac/.test(u) ? 'mac' : /Linux/.test(u) ? 'linux' : 'autre'; };
const standalone = () => { try { return !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone); } catch (e) { return false; } };
const info = () => ({ pf: platform(), sa: standalone(), lg: (navigator.language || '').slice(0, 5), sc: `${screen.width}x${screen.height}`, v: ver, ns: first });
// ev(nom, valeur) : compteur d'usage ; nom en minuscules (a-z 0-9 _ : . -), 40 caractères au plus. Les erreurs : err(message).
export function ev(name, val) { if (st.off || !started || sentEv > 400) return; sentEv++; evs.push({ n: String(name).toLowerCase().replace(/[^a-z0-9_:.-]/g, '_').slice(0, 40), v: Math.round(Number(val) || 0) }); if (evs.length > MAXQ) evs.shift(); }
export function err(msg) { if (errs++ > 4) return; ev('js_error', 1); if (evs.length) evs[evs.length - 1].i = String(msg).replace(/https?:\/\/\S+/g, '').slice(0, 120); }
export function run(r) { if (st.off || !started) return; runs.push(r); if (runs.length > 10) runs.shift(); setTimeout(flush, 1500); } // une fin de partie part vite : on peut fermer l'appli juste après
export function goal(n, d) { if (n === 'pack') ev('pack', d && d.best); else if (n === 'rare') ev('rare:' + (d && d.tier)); else if (['nova', 'forge', 'swallow', 'duelwin', 'daily', 'like'].includes(n)) ev(n, 1); else if (n === 'sector') ev('sector', d && d.n); }
async function flush(hide) {
  if (st.off || !started || busy || !SUPABASE_URL || !SUPABASE_KEY) return; const secs = Math.min(120, Math.round(acc)); if (!secs && !runs.length && !evs.length && !first) return;
  busy = true; const r = runs.slice(), e = evs.slice(), a = acc;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tele`, { method: 'POST', keepalive: !!hide, headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_did: st.did, p_secs: secs, p_info: info(), p_runs: r.length ? r : null, p_events: e.length ? e : null }) });
    if (res.ok) { acc = Math.max(0, a - secs); runs = runs.slice(r.length); evs = evs.slice(e.length); first = false; }
  } catch (x) { /* hors ligne : on réessaie au prochain envoi */ }
  busy = false;
}
export function init() {
  if (started) return; started = true; if (!st.did) { st.did = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64); save(); }
  const act = () => { lastAct = Date.now(); }; for (const t of ['pointerdown', 'keydown', 'touchstart', 'wheel']) addEventListener(t, act, { passive: true, capture: true });
  setInterval(() => { if (!document.hidden && (Date.now() - lastAct) / 1000 < IDLE) acc += 5; }, 5000);
  setInterval(() => flush(), EVERY); addEventListener('pagehide', () => flush(true)); document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
  addEventListener('error', (e) => err((e.message || 'erreur') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0)));
  addEventListener('unhandledrejection', (e) => err('promesse : ' + String((e.reason && e.reason.message) || e.reason || '')));
  addEventListener('appinstalled', () => ev('installed', 1));
  try { if (self.caches) caches.keys().then((k) => { const v = k.find((x) => /^critical-v/.test(x)); if (v) ver = v.replace('critical-', ''); }).catch(() => {}); } catch (e) { /* ignore */ }
  // écrans ouverts : un seul écouteur sur la page, aucun module à modifier
  const MAP = [['.hm-tab', (b) => 'tab:' + (b.textContent || '').trim().toLowerCase()], ['.hub-tabs [data-b]', (b) => 'hub:' + b.dataset.b], ['.co-tabs button', (b) => 'coll:' + (b.textContent || '').trim().toLowerCase()], ['.hm-ev', () => 'event_open'], ['#ev-cl', () => 'event_claim'],
    ['.hm-pf', () => 'profile_open'], ['.hm-pill', () => 'voidium_open'], ['#b-set2', () => 'settings_open'], ['#o-install', () => 'install_guide'], ['.id-send', () => 'idea_send'], ['.ad-tabs button', () => '']];
  document.addEventListener('click', (e) => { for (const [sel, f] of MAP) { const b = e.target.closest && e.target.closest(sel); if (b) { const n = f(b); if (n) ev(n.replace(/\s+/g, '_').slice(0, 40), 1); return; } } }, true);
  setTimeout(() => flush(), 2500);
}
