// Critical — classement mondial de Genèse (Supabase, sans connexion : un pseudo demandé une seule fois).
// Tout passe par les fonctions SQL de supabase/schema.sql ; l'appareil est identifié par un secret aléatoire local.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { avatar, accentRgb, ACCENTS, FRAMES, TITLES, titleName } from './style.js';
import { mount as mountIdeas } from './ideas.js';

const KEY = 'critical.rank.v1', PAGE = 50;
const $ = (s, r = document) => r.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); // les pseudos viennent d'autres joueurs
const H = { view: () => {}, receive: () => {}, level: () => 1, track: () => {}, invite: () => {}, joinDuel: () => {}, canNotify: () => false, toast: () => {}, vib: () => {}, today: () => '', astres: () => [], astreInfo: () => null, paint: () => {}, codexN: () => 0, tierName: () => '?', local: () => ({}) };
const st = { secret: '', name: '', pending: [], prof: { featured: [], motto: '', accent: 0, frame: 0, title: '' }, dirty: false }; // pending : scores pas encore envoyés (pas de pseudo, ou hors connexion)
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const ERR = { name_taken: 'Ce pseudo est déjà pris.', invalid_name: '3 à 16 caractères : lettres, chiffres, espace, point, tiret.', too_fast: 'Deux envois trop rapprochés, réessaie dans un instant.', implausible: 'Score refusé par le serveur.', network: 'Connexion impossible. Réessaie plus tard.', invalid_motto: 'La devise ne peut pas contenir de < ou >.', invalid_style: 'Couleur ou cadre invalide.', invalid_title: 'Titre invalide.', invalid_idea: 'Une idée fait entre 10 et 280 caractères.', too_many: 'Tu as déjà proposé 3 idées aujourd\'hui, reviens demain !', duplicate: 'Cette idée existe déjà : soutiens-la plutôt !', own_idea: 'Ton idée compte déjà pour toi.', not_found: 'Introuvable.', unknown_player: 'Choisis d\'abord un pseudo.', forbidden: 'Action refusée.', invalid_featured: 'Vitrine invalide.', no_profile: 'Choisis d\'abord un pseudo.', not_found: 'Joueur introuvable.', self: 'Impossible sur ton propre profil.', offline: 'Ce joueur n\'est plus en ligne.', no_duel: 'Ce joueur ne reçoit pas d\'invitations.', busy: 'Ce joueur a déjà une invitation en attente.', declined_recently: 'Ce joueur a refusé il y a peu : réessaie plus tard.', too_many: 'Trop d\'invitations pour le moment.', expired: 'L\'invitation a expiré.', not_claimable: 'Ce pseudo n\'est pas ouvert à la reprise (ou le délai est dépassé). Contacte l\'administrateur.' };
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
  try { await rpc('set_profile', { p_secret: secret(), p_featured: st.prof.featured, p_motto: st.prof.motto, p_codex: H.codexN(), p_level: H.level(), p_accent: st.prof.accent | 0, p_frame: st.prof.frame | 0, p_title: st.prof.title || '' }); st.dirty = false; st.lvSent = H.level(); save(); } catch (e) { if (/^invalid_/.test(e.message)) { st.dirty = false; save(); } }
}
async function flush() {
  if (ready() && st.name && st.dirty) await pushProfile();
  if (ready() && st.name) reportTime(H.local().playtime || 0, true);
  if (!ready() || !st.name || !st.pending.length) return null;
  let out = null;
  for (const p of st.pending.slice()) {
    try { const r = await rpc('submit_score', { p_secret: secret(), p_board: p.board, p_score: p.score, p_sector: p.sector, p_tier: p.tier, p_seed: p.seed, p_log: p.log, p_steps: p.steps }); if (p.board === 'all' || p.board === 'blitz') out = r; }
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
  for (const board of [run.daily ? 'day:' + run.daily : run.blitz ? 'blitz' : 'all']) {
    const old = st.pending.find((p) => p.board === board);
    if (old && old.score >= run.score) continue;
    st.pending = st.pending.filter((p) => p.board !== board).concat({ board, score: run.score, sector: run.sector, tier: run.tier, seed: run.seed, log: run.log, steps: run.steps });
  }
  save(); return flush();
}

/* ============================== interface ============================== */
const KEEPCSS = `
#rk-in{width:100%;height:52px;border-radius:18px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#fff;font:700 18px var(--font);text-align:center;outline:none;user-select:text;-webkit-user-select:text}
#rk-err{min-height:18px;color:#ff8aa0;font-size:13px}
#pf-soc{display:flex;align-items:center;justify-content:center;gap:14px;min-height:0}#pf-on{font:700 12px var(--font);color:#5dffc0;display:flex;align-items:center;gap:6px}#pf-on:empty{display:none}
.pf-like{display:flex;align-items:center;gap:8px;height:38px;padding:0 14px;border-radius:19px;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);font:800 14px var(--disp);transition:transform .4s cubic-bezier(.2,1.6,.4,1)}.pf-like svg{width:20px;height:20px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linejoin:round;transition:fill .2s,stroke .2s}
.pf-like.on{background:rgba(255,79,140,.2);border-color:rgba(255,120,170,.6)}.pf-like.on svg{fill:#ff4f8c;stroke:#ff4f8c;filter:drop-shadow(0 0 8px rgba(255,79,140,.8))}.pf-like:active{transform:scale(.9)}.pf-like:disabled{opacity:.9}
.on-dot{display:inline-block;width:8px;height:8px;margin-left:7px;border-radius:50%;background:#5dffc0;box-shadow:0 0 8px #5dffc0;vertical-align:middle}
#rk-inv{position:fixed;left:14px;right:14px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:60;display:none;justify-content:center;pointer-events:none}#rk-inv.on{display:flex;animation:invin .5s cubic-bezier(.2,1.3,.3,1)}@keyframes invin{from{transform:translateY(-120%);opacity:0}}
#rk-inv .glass{pointer-events:auto;display:flex;align-items:center;gap:12px;max-width:420px;width:100%;padding:12px 12px 12px 16px;border-radius:26px}#rk-inv b{flex:1;font:700 13px/1.3 var(--font)}#rk-inv button{height:36px;padding:0 14px;border-radius:18px;font:800 12px var(--disp);color:#fff;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1)}#rk-inv #inv-ok{background:linear-gradient(135deg,rgba(77,243,255,.5),rgba(255,79,216,.45))}
`;
const INVHTML = `<div id="rk-inv"><div class="glass"><b id="inv-t"></b><button id="inv-no">Refuser</button><button id="inv-ok">Accepter</button></div></div>
`;
const ASKHTML = `<div class="modal" id="rk-ask"><div class="card glass"><h2>Ton pseudo</h2><p>Il apparaîtra dans le classement mondial. Demandé une seule fois, modifiable ensuite.</p>
<input id="rk-in" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Pseudo" enterkeyhint="done">
<p id="rk-err"></p><div class="btns"><button class="big primary" id="rk-ok">Valider</button><button class="big glass" id="rk-later">Plus tard</button><button class="big glass" id="rk-claim">J'avais déjà un compte</button></div></div></div>`;
const NEWCSS = `
#rk{padding:0;align-items:stretch;justify-content:center;background:rgba(3,4,14,.9)}
.hub-in{position:relative;display:flex;flex-direction:column;width:100%;max-width:460px;height:100%;padding:calc(env(safe-area-inset-top,0px) + 10px) 14px 0;box-sizing:border-box}
.hub-in::before{content:'';position:absolute;left:-10%;right:-10%;top:0;height:260px;background:radial-gradient(60% 100% at 25% 0,rgba(77,243,255,.2),transparent 70%),radial-gradient(60% 100% at 80% 0,rgba(255,79,216,.18),transparent 70%);pointer-events:none}
.hub-hd{position:relative;display:flex;align-items:center;gap:10px;margin-bottom:12px}.hub-t{flex:1;min-width:0}
.hub-t h2{margin:0;font:900 26px var(--disp);letter-spacing:.02em;background:linear-gradient(90deg,#fff,#9ff9ff 45%,#ff9ae8);-webkit-background-clip:text;background-clip:text;color:transparent}.hub-t p{margin:2px 0 0;font-size:12px;color:rgba(255,255,255,.55)}
.hub-x{flex:none;width:44px;height:44px;border-radius:22px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;font-size:18px}
.hub-tabs{position:relative;display:flex;gap:4px;padding:4px;border-radius:22px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
.hub-tabs button{flex:1;height:38px;border-radius:18px;font:700 11.5px var(--disp);letter-spacing:.02em;padding:0 2px;color:rgba(255,255,255,.58);transition:background .25s,color .25s}
.hub-tabs button.on{color:#fff;background:linear-gradient(135deg,rgba(77,243,255,.36),rgba(255,79,216,.32));box-shadow:0 4px 18px rgba(120,80,255,.25)}
.hub-body{position:relative;flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;scrollbar-width:none;padding:12px 0 18px}.hub-body::-webkit-scrollbar{display:none}
.hub-dock{position:relative;flex:none;display:flex;align-items:center;gap:10px;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 12px);margin:0 -14px;background:linear-gradient(180deg,rgba(6,8,24,0),rgba(6,8,24,.97) 38%)}
#rk-me{flex:1;min-width:0;font-size:12.5px;line-height:1.35;color:rgba(255,255,255,.8)}#rk-me b{font:800 15px var(--disp);color:#5dffc0}#rk-me em{display:block;font-style:normal;font-size:11px;color:rgba(255,255,255,.5)}
#rk-name{flex:none;height:44px;padding:0 16px;border-radius:22px;font:800 12px var(--disp);letter-spacing:.05em;color:#fff;background:linear-gradient(135deg,#5b8cff,#b46bff);border:0}
#rk-feed{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}#rk-feed:empty{display:none}.rf-c{padding:9px 12px;border-radius:16px;font-size:11.5px;line-height:1.45;color:rgba(255,255,255,.72);background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}.rf-c b{color:#fff}.rf-c.s{color:#ffc247;border-color:rgba(255,194,71,.3);background:rgba(255,194,71,.07)}
#rk-pod{display:flex;align-items:flex-end;justify-content:center;gap:8px;padding:8px 0 16px}#rk-pod:empty{display:none}
.pd{flex:1;min-width:0;max-width:140px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;animation:pd-in .7s cubic-bezier(.2,1.2,.3,1) backwards}.pd.p1{animation-delay:.12s}.pd.p3{animation-delay:.24s}@keyframes pd-in{from{opacity:0;transform:translateY(24px) scale(.9)}}
.pd .crown{height:26px;width:26px;color:#ffc247;filter:drop-shadow(0 0 8px rgba(255,194,71,.8));animation:pd-fl 2.6s ease-in-out infinite}.pd .crown svg{width:100%;height:100%;fill:currentColor}@keyframes pd-fl{50%{transform:translateY(-4px)}}
.pd .nm{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:800 12.5px var(--font)}.pd .tt{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:rgba(255,255,255,.55)}.pd .sc{font:800 12.5px var(--disp);color:#fff}
.pd .blk{width:100%;margin-top:4px;border-radius:16px 16px 6px 6px;display:grid;place-items:start center;padding-top:7px;font:900 22px var(--disp);color:rgba(0,0,0,.5);background:linear-gradient(180deg,var(--g1),var(--g2));box-shadow:0 -6px 24px color-mix(in srgb,var(--g1) 35%,transparent)}
.pd.p1 .blk{height:88px;--g1:#ffd86b;--g2:#a8741c}.pd.p2 .blk{height:64px;--g1:#e6edf9;--g2:#7d889c}.pd.p3 .blk{height:48px;--g1:#f0b184;--g2:#8a5230}
.rk-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:18px;margin-bottom:6px;cursor:pointer;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);transition:background .2s,transform .15s}.rk-row:active{transform:scale(.98);background:rgba(255,255,255,.1)}
.rk-row>i{flex:none;width:28px;font:900 12.5px var(--disp);font-style:normal;color:rgba(255,255,255,.5);text-align:center}
.rk-row .who{flex:1;min-width:0;display:flex;flex-direction:column}.rk-row .who b{font:700 14px var(--font);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rk-row .who small{font-size:10.5px;color:rgba(255,255,255,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lv{flex:none;font:800 9.5px var(--disp);padding:3px 7px;border-radius:9px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.8)}.rk-row .sc{flex:none;font:800 13px var(--disp);min-width:54px;text-align:right}
.rk-row.me{background:linear-gradient(90deg,rgba(77,243,255,.2),rgba(255,79,216,.16));border-color:rgba(255,255,255,.32)}
#rk-msg{padding:40px 16px;text-align:center;color:rgba(255,255,255,.6);font-size:14px;line-height:1.5}
.on-dot{display:inline-block;width:8px;height:8px;margin-left:6px;border-radius:50%;background:#5dffc0;box-shadow:0 0 8px #5dffc0;vertical-align:middle}
/* profil */
#rk-prof .card{max-width:420px;padding:0;overflow-x:hidden;gap:0;align-items:stretch}.pf-ban{position:relative;height:104px;flex:none;background:radial-gradient(90% 140% at 20% 0,rgba(var(--a),.7),transparent 70%),radial-gradient(90% 140% at 90% 0,rgba(var(--a),.35),transparent 70%),linear-gradient(180deg,rgba(var(--a),.25),rgba(0,0,0,0))}
.pf-ban::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.05) 0 2px,transparent 2px 14px);opacity:.5}
.pf-in{display:flex;flex-direction:column;align-items:center;gap:8px;padding:0 18px 18px;margin-top:-54px}
#pf-av{--s:108px}#pf-name{margin:2px 0 0;font:900 25px var(--disp);text-align:center;text-shadow:0 0 22px rgba(var(--a),.7)}
#pf-title{margin:-2px 0 0;font:800 10.5px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--a))}#pf-title:empty{display:none}
#pf-lvl{margin:0;font:800 11px var(--disp);letter-spacing:.1em;padding:4px 12px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16)}#pf-lvl:empty{display:none}
#pf-motto{margin:0;font-size:13.5px;font-style:italic;color:rgba(255,255,255,.78);text-align:center;min-height:0}#pf-motto:empty{display:none}
#pf-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%}#pf-stats>div{padding:10px 4px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);text-align:center}#pf-stats b{display:block;font-size:17px}#pf-stats span{font-size:10px;color:rgba(255,255,255,.55)}
.pf-lab{margin:4px 0 0;align-self:flex-start;font:700 11px var(--disp);letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.5)}
#pf-show{display:flex;gap:10px;justify-content:center;width:100%;align-items:stretch}#pf-show:empty{display:none}.pf-load{align-self:center;color:rgba(255,255,255,.6);font-size:14px;text-align:center;padding:14px 0}
.pf-cell{flex:1;max-width:120px;display:flex;flex-direction:column;align-items:center;gap:3px;padding:10px 4px 8px;border-radius:20px;text-align:center;cursor:pointer;border:1.5px solid var(--c);background:radial-gradient(120% 80% at 50% 0,color-mix(in srgb,var(--c) 28%,transparent),rgba(255,255,255,.03));box-shadow:0 0 22px color-mix(in srgb,var(--c) 30%,transparent)}
.pf-cell b{font-size:11px;line-height:1.2}.pf-cell small{font-size:9.5px;line-height:1.2;color:rgba(255,255,255,.65)}.pf-cell em{font:700 9px var(--disp);font-style:normal;letter-spacing:.8px;color:var(--c)}
#pf-meta{margin:0;font-size:12px;color:rgba(255,255,255,.5);text-align:center}#pf-in-btns{width:100%}
/* éditeur */
#rk-edit{padding:0;align-items:stretch;justify-content:center;background:rgba(3,4,14,.92)}.ed-in{display:flex;flex-direction:column;width:100%;max-width:460px;height:100%;padding:calc(env(safe-area-inset-top,0px) + 8px) 0 0;box-sizing:border-box}
.ed-prev{position:relative;flex:none;margin:0 14px;border-radius:26px;overflow:hidden;border:1px solid rgba(255,255,255,.14)}.ed-prev .pf-ban{height:72px}.ed-prev .pf-in{margin-top:-40px;padding-bottom:12px;gap:4px}.ed-prev #ed-av{--s:78px}
#ed-pn{font:900 19px var(--disp);text-shadow:0 0 18px rgba(var(--a),.7)}#ed-pt{font:800 9.5px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--a))}#ed-pm{font-size:12px;font-style:italic;color:rgba(255,255,255,.75)}
.ed-body{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;scrollbar-width:none;padding:6px 14px 10px}.ed-body::-webkit-scrollbar{display:none}
.ed-body h3{margin:16px 0 8px;font:800 11px var(--disp);letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}.ed-body h3 small{font:500 11px var(--font);letter-spacing:0;text-transform:none;color:rgba(255,255,255,.4);margin-left:6px}
#ed-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}
.ed-cell{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;border-radius:16px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.12);color:#fff;transition:transform .15s,border-color .2s}.ed-cell:active{transform:scale(.94)}
.ed-cell b{font-size:9.5px;line-height:1.15;text-align:center}.ed-cell small{display:none}.ed-cell.on{border-color:#5dffc0;background:rgba(93,255,192,.13)}
.ed-cell i{position:absolute;top:3px;right:5px;font:900 12px var(--disp);font-style:normal;color:#5dffc0}.ed-cell i.st{color:#ffc247}
.ed-sw{display:grid;grid-template-columns:repeat(6,1fr);gap:9px}.ed-sw button{position:relative;aspect-ratio:1;border-radius:50%;border:2px solid rgba(255,255,255,.18);background:rgb(var(--a));box-shadow:0 0 14px rgba(var(--a),.45);transition:transform .2s cubic-bezier(.2,1.6,.4,1)}
.ed-sw button.rb{background:conic-gradient(#ff5fa8,#ffd45f,#5fffb0,#5fb8ff,#a878ff,#ff5fa8)}.ed-sw button.on{border-color:#fff;transform:scale(1.14);box-shadow:0 0 0 3px rgba(255,255,255,.25),0 0 20px rgba(var(--a),.8)}
.ed-sw button.lk{filter:grayscale(.85) brightness(.45);box-shadow:none}.ed-sw button.lk::after{content:attr(data-lv);position:absolute;inset:0;display:grid;place-items:center;font:800 11px var(--disp);color:#fff;filter:none}
.ed-fr{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.ed-fr button{display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 4px 8px;border-radius:18px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);color:#fff;font:700 11px var(--font)}.ed-fr button.on{border-color:#fff;background:rgba(255,255,255,.12)}.ed-fr button.lk{opacity:.4}.ed-fr .av{--s:46px}.ed-fr small{font-size:9.5px;color:rgba(255,255,255,.5);font-weight:600}
.ed-ti{display:flex;flex-wrap:wrap;gap:7px}.ed-ti button{padding:8px 12px;border-radius:15px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);color:#fff;font:700 12px var(--font)}.ed-ti button.on{border-color:rgb(var(--a));background:rgba(var(--a),.18);color:#fff}.ed-ti button.lk{opacity:.42}.ed-ti button small{display:block;font-size:9.5px;font-weight:500;color:rgba(255,255,255,.55)}
#ed-motto{width:100%;height:46px;border-radius:16px;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.3);color:#fff;font:600 15px var(--font);text-align:center;outline:none;user-select:text;-webkit-user-select:text;box-sizing:border-box}#ed-err{min-height:16px;color:#ff8aa0;font-size:13px;margin:6px 0 0;text-align:center}
.ed-ft{flex:none;display:flex;gap:8px;padding:10px 14px calc(env(safe-area-inset-bottom,0px) + 12px);background:linear-gradient(180deg,rgba(6,8,24,0),rgba(6,8,24,.97) 30%)}.ed-ft button{height:50px;border-radius:25px;font:800 13px var(--disp);letter-spacing:.05em;color:#fff;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08)}.ed-ft #ed-ok{flex:2;border:0;background:linear-gradient(135deg,#5b8cff,#b46bff)}.ed-ft button:not(#ed-ok){flex:1}
@media (prefers-reduced-motion:reduce){.pd,.pd .crown{animation:none}}`;
const CSS = KEEPCSS + NEWCSS;
const CROWN = '<svg viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';
const HTML = INVHTML + `
<div class="modal hub" id="rk"><div class="hub-in">
<div class="hub-hd"><div class="hub-t"><h2>Communauté</h2><p id="hub-sub"></p></div><button class="hub-x" id="rk-close" aria-label="Fermer">✕</button></div>
<div class="hub-tabs"><button data-b="all" class="on">Mondial</button><button data-b="day">Du jour</button><button data-b="blitz">Blitz</button><button data-b="elo">Duels</button><button data-b="ideas">Idées</button></div>
<div class="hub-body" id="rk-body"><div id="rk-feed"></div><div id="rk-pod"></div><div id="rk-list"></div><div id="rk-ideas" hidden></div></div>
<div class="hub-dock"><div id="rk-me"></div><button id="rk-name"></button></div></div></div>
<div class="modal" id="rk-prof"><div class="card glass"><div class="pf-ban" id="pf-ban"></div><div class="pf-in"><div id="pf-av"></div><h2 id="pf-name"></h2><p id="pf-title"></p><p id="pf-lvl"></p><p id="pf-motto"></p>
<div id="pf-soc"><button class="pf-like" id="pf-like" aria-label="Liker ce profil"><svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.4 5 6.6 5c2 0 3.6 1.1 5.4 3.2C13.8 6.100 15.400 5 17.400 5c3.200 0 4.900 3 3.800 6.200-1.700 4.700-9.200 9.300-9.200 9.300z"/></svg><b id="pf-lk">0</b></button><span id="pf-on"></span></div>
<div id="pf-stats" hidden><div><b id="pf-rank">–</b><span>rang</span></div><div><b id="pf-score">–</b><span>meilleur score</span></div><div><b id="pf-tier" style="font-size:14px">–</b><span>plus gros astre</span></div><div><b id="pf-wins">0</b><span>défis réussis</span></div><div><b id="pf-time" style="font-size:14px">–</b><span>temps de jeu</span></div><div><b id="pf-cdx">0</b><span>astres découverts</span></div></div>
<p class="pf-lab" id="pf-lab" hidden>Vitrine</p><div id="pf-show"></div><p id="pf-meta"></p>
<div class="btns" id="pf-in-btns"><button class="big primary" id="pf-duel" hidden>⚔ Défier en duel</button><button class="big primary" id="pf-duel2" hidden>💧 Duel de cuve · Elo</button><button class="big glass" id="pf-replay" hidden>▶ Revoir sa meilleure partie</button><button class="big glass" id="pf-edit" hidden>✎ Personnaliser mon profil</button><button class="big primary" id="pf-close">Fermer</button></div></div></div></div>
<div class="modal" id="rk-edit"><div class="ed-in">
<div class="ed-prev" id="ed-prev"><div class="pf-ban"></div><div class="pf-in"><div id="ed-av"></div><div id="ed-pn"></div><div id="ed-pt"></div><div id="ed-pm"></div></div></div>
<div class="ed-body"><h3>Avatar et vitrine<small>le ★ est ton avatar, 2 astres de plus en vitrine</small></h3><div id="ed-grid"></div>
<h3>Couleur</h3><div class="ed-sw" id="ed-sw"></div><h3>Cadre de l'avatar</h3><div class="ed-fr" id="ed-fr"></div><h3>Titre</h3><div class="ed-ti" id="ed-ti"></div>
<h3>Devise</h3><input id="ed-motto" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Ta devise (facultatif)" enterkeyhint="done"><p id="ed-err"></p></div>
<div class="ed-ft"><button id="ed-cancel">Annuler</button><button id="ed-name">Pseudo</button><button id="ed-ok">Enregistrer</button></div></div></div>
` + ASKHTML;
const pts = (v) => (board === 'all' || board === 'blitz' || board === 'elo' ? fmt(v) : (v / 100).toLocaleString('fr-FR') + ' s d\'avance'); // défi : temps restant
const fmtTime = (sec) => (sec < 60 ? '< 1 min' : sec < 3600 ? `${Math.floor(sec / 60)} min` : `${Math.floor(sec / 3600)} h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`);
const fmtMonth = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); } catch (e) { return ''; } };
let board = 'all', off = 0, done = false, busy = false, token = 0, ideasUi = null, inIdeas = false;
const boardId = () => (board === 'all' ? 'all' : board === 'blitz' ? 'blitz' : 'day:' + H.today());
const eloRows = (rows) => rows.map((r) => ({ ...r, score: r.elo, _sub: `${r.games} duel${r.games > 1 ? 's' : ''} · ${r.wins} victoire${r.wins > 1 ? 's' : ''}` }));
const avOf = (box, key, px, a, f, still) => avatar(box, { key, px, accent: a, frame: f, still, paint: H.paint });
const rgbOf = (i) => accentRgb(i);
function rowEl(r) {
  const d = document.createElement('div'); d.className = 'rk-row' + (r.name === st.name ? ' me' : ''); d.dataset.name = r.name; const av = document.createElement('div'); avOf(av, r.badge, 38, r.accent, r.frame, true);
  d.innerHTML = `<i>${r.rank}</i>`; d.append(av); const t = titleName(r.title);
  d.insertAdjacentHTML('beforeend', `<div class="who"><b>${esc(r.name)}${r.online ? '<u class="on-dot" title="En ligne"></u>' : ''}</b><small style="${t ? `color:rgb(${rgbOf(r.accent)})` : ''}">${r._sub ? esc(r._sub) : t ? esc(t) : 'Secteur ' + (r.sector + 0) + ' · ' + esc(H.tierName(r.tier))}</small></div>${r.level ? `<span class="lv">NIV ${r.level}</span>` : ''}<span class="sc">${pts(r.score)}</span>`);
  return d;
}
function podium(rows) { // les trois premiers : 2 · 1 · 3, la couronne pour le premier
  const pod = $('#rk-pod'); pod.textContent = ''; if (!rows.length) return;
  for (const idx of [1, 0, 2]) {
    const r = rows[idx]; if (!r) continue; const d = document.createElement('div'); d.className = 'pd p' + (idx + 1); d.dataset.name = r.name; const av = document.createElement('div'); avOf(av, r.badge, idx === 0 ? 84 : 66, r.accent, r.frame, false);
    d.innerHTML = idx === 0 ? `<div class="crown">${CROWN}</div>` : ''; d.append(av); const t = titleName(r.title);
    d.insertAdjacentHTML('beforeend', `<div class="nm">${esc(r.name)}${r.online ? '<u class="on-dot"></u>' : ''}</div><div class="tt" style="color:rgb(${rgbOf(r.accent)})">${r._sub ? esc(r._sub) : t ? esc(t) : r.level ? 'Niveau ' + r.level : ''}</div><div class="sc">${pts(r.score)}</div><div class="blk">${idx + 1}</div>`); pod.append(d);
  }
}
async function more() { // charge la page suivante (défilement infini)
  if (busy || done) return; busy = true; const t = token, list = $('#rk-list');
  try {
    let rows = board === 'elo' ? eloRows(await rpc('elo_board', { p_offset: off, p_limit: PAGE })) : await rpc('leaderboard', { p_board: boardId(), p_offset: off, p_limit: PAGE });
    if (t !== token) return;
    if (!off && !rows.length) list.innerHTML = '<div id="rk-msg">Personne ici pour l\'instant.<br>Sois le premier à y entrer.</div>';
    let rest = rows; if (!off) { podium(rows.slice(0, 3)); rest = rows.slice(3); }
    for (const r of rest) list.append(rowEl(r)); off += rows.length; done = rows.length < PAGE;
  } catch (e) { if (t === token && !off) list.innerHTML = `<div id="rk-msg">${ERR.network}</div>`; done = true; }
  finally { if (t === token) busy = false; }
}
async function show(b) {
  const tab = b === 'ideas'; inIdeas = tab; if (!tab) board = b; off = 0; done = false; busy = false; token++; const t = token;
  document.querySelectorAll('.hub-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.b === b));
  $('#rk-list').textContent = ''; $('#rk-pod').textContent = ''; $('#rk-body').scrollTop = 0; $('#rk-me').innerHTML = ''; $('#rk-ideas').hidden = !tab; $('#rk-list').hidden = tab; $('#rk-pod').hidden = tab; $('#rk-feed').hidden = tab;
  $('#rk-name').textContent = st.name ? 'Mon profil' : 'Choisir un pseudo';
  $('#hub-sub').textContent = tab ? 'Propose, soutiens, façonne le jeu' : b === 'day' ? 'Le défi du jour, tous contre la montre' : b === 'blitz' ? 'Cuve étroite, chrono, tempo : le plus rapide gagne' : b === 'elo' ? 'Duel de cuve : celui qui fait déborder perd' : 'Les meilleurs univers du monde';
  if (tab) { if (!ideasUi) ideasUi = mountIdeas($('#rk-ideas'), { call: (fn, args) => rpc(fn, { p_secret: secret(), ...args }).catch((e) => { throw new Error(ERR[e.message] || ERR.network); }), name: () => st.name, askName, isAdmin: () => !!st.admin, toast: (x) => H.toast(x), vib: (x) => H.vib(x) }); ideasUi.refresh(); $('#rk-me').innerHTML = st.name ? `Connecté : <b style="font-size:13px">${esc(st.name)}</b><em>Les idées les plus soutenues passent en premier</em>` : 'Choisis un pseudo pour proposer et soutenir des idées'; return; }
  more(); feed(t);
  if (!st.name) { $('#rk-me').innerHTML = 'Choisis un pseudo pour entrer dans le classement'; return; }
  if (board === 'elo') { try { const e = await rpc('elo_sync', { p_secret: secret() }); if (t !== token || !e) return; $('#rk-me').innerHTML = e.games ? `<b>n° ${fmt(e.rank)}</b> sur ${fmt(e.total)}<em>Elo ${fmt(e.elo)} · ${e.games} duel${e.games > 1 ? 's' : ''}</em>` : 'Pas encore de duel classé.<em>Défie un joueur en ligne : « Duel de cuve » depuis son profil</em>'; const seen = st.eloSeen || []; for (const x of e.recent || []) if (!seen.includes(x.match) && x.delta) { H.toast(`Duel ${x.won ? 'gagné' : 'perdu'} : Elo ${x.delta > 0 ? '+' : ''}${x.delta}`); seen.push(x.match); } st.eloSeen = seen.slice(-30); save(); } catch (e) { /* l'Elo s'affichera au prochain passage */ } return; }
  try { await flush(); const me = await rpc('my_rank', { p_secret: secret(), p_board: boardId() }); if (t === token) $('#rk-me').innerHTML = me ? `<b>n° ${fmt(me.rank)}</b> sur ${fmt(me.total)}<em>Top ${Math.max(1, Math.ceil((me.rank / me.total) * 100))} % · ${pts(me.score)}${board === 'day' ? '' : ' points'}</em>` : 'Tu n\'as pas encore de score ici.<em>Lance une partie pour entrer au classement</em>'; } catch (e) { /* le classement s'affiche quand même */ }
}
const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
async function feed(t) { // faits réels uniquement : dernières parties classées, part des joueurs ayant atteint les gros astres
  const box = $('#rk-feed'); box.innerHTML = ''; if (board !== 'all') return;
  try {
    const [a, r] = await Promise.all([rpc('activity', {}), rpc('rarity', {})]); if (t !== token || board !== 'all') return;
    const pc = (n) => (r.total ? Math.max(0.1, Math.round((n / r.total) * 1000) / 10).toLocaleString('fr-FR') : '0');
    box.innerHTML = (r.total >= 3 ? `<div class="rf-c s">${pc(r.hole)} % des joueurs ont atteint un trou noir · ${pc(r.galaxy)} % une galaxie (sur ${fmt(r.total)})</div>` : '') + (a || []).slice(0, 2).map((x) => `<div class="rf-c"><b>${esc(x.name)}</b> · ${fmt(x.score)} pts · ${esc(H.tierName(x.tier))} · ${ago(x.at)}</div>`).join('');
  } catch (e) { /* le fil est un bonus : pas d'erreur affichée */ }
}
export async function eloReport(match, won, opp) { // fin d'un duel de cuve : compte rendu au serveur (l'Elo est réglé quand les deux joueurs concordent)
  if (!ready() || !st.name) return null; try { return await rpc('duel_report', { p_secret: secret(), p_match: match, p_won: !!won, p_opp: opp }); } catch (e) { return null; }
}
export const rival = (score) => (ready() ? rpc('rival', { p_score: Math.round(score || 0) }) : Promise.resolve(null));
export const runOf = (name) => rpc('get_run', { p_name: name });
/* ---------- présence et invitations de duel ---------- */
let pulseT = 0, lastInv = '', invT = 0, giftBusy = false;
function showBanner(text, ann) { const b = $('#rk-inv'); b.dataset.m = ann ? 'ann' : ''; $('#inv-t').textContent = text; $('#inv-no').hidden = !!ann; $('#inv-ok').textContent = ann ? 'OK' : 'Accepter'; b.classList.add('on'); H.vib(12); if (ann) { clearTimeout(invT); invT = setTimeout(hideInv, 15000); } }
const hideInv = () => { clearTimeout(invT); $('#rk-inv').classList.remove('on'); };
async function pulse() { // « je suis là » toutes les 30 s ; renvoie une éventuelle invitation, montrée une seule fois et seulement hors partie
  if (!ready() || !st.name || document.hidden) return;
  if (st.lvSent !== H.level()) pushProfile(); // le niveau a changé : on le republie
  try {
    const r = await rpc('pulse', { p_secret: secret() }), d = r && r.duel; st.admin = !!(r && r.admin);
    if (r && r.gift && !giftBusy) { giftBusy = true; try { const g = await rpc('claim_gift', { p_secret: secret(), p_id: r.gift.id }); H.receive(g.eclats, g.xp, g.note, g.pack, g.packs); } catch (e) { /* déjà pris ou hors ligne */ } giftBusy = false; } // cadeau de l'administrateur : encaissé une seule fois, confirmé par le serveur
    if (r && r.msg && r.msg.id !== st.msgSeen && H.canNotify()) { st.msgSeen = r.msg.id; save(); showBanner(r.msg.text, true); } // annonce : montrée une fois
    if (d && d.code !== lastInv && H.canNotify()) { lastInv = d.code; showBanner(`${d.from} te défie en ${d.code && d.code[0] === 'Z' ? 'duel de cuve (Elo)' : 'duel 1v1'}`, false); invT = setTimeout(hideInv, 20000); }
  } catch (e) { /* hors connexion : on réessaiera */ }
}
function startPulse() {
  if (pulseT || !ready()) return; pulseT = setInterval(pulse, 30000); document.addEventListener('visibilitychange', () => { if (!document.hidden) pulse(); });
  if (st.noDuel) rpc('set_no_duel', { p_secret: secret(), p_value: true }).catch(() => {}); pulse();
}
async function answer(ok) {
  const ann = $('#rk-inv').dataset.m === 'ann'; hideInv(); if (ann) return;
  try { const r = await rpc('challenge_reply', { p_secret: secret(), p_accept: ok }); if (ok && r && r.code) H.joinDuel(r.code); }
  catch (e) { H.toast(ERR[e.message] || ERR.network); }
}
export const isAdmin = () => !!st.admin;
export const admin = (fn, args = {}) => rpc(fn, { p_secret: secret(), ...args }).catch((e) => { throw new Error(ERR[e.message] || e.message); });
export const noDuel = () => !!st.noDuel;
export function setNoDuel(v) { st.noDuel = !!v; save(); if (st.name && ready()) rpc('set_no_duel', { p_secret: secret(), p_value: !!v }).catch(() => {}); }
export async function challenge(name, code) { try { await rpc('challenge', { p_secret: secret(), p_name: name, p_code: code }); } catch (e) { throw new Error(ERR[e.message] || ERR.network); } }
export const challengeCancel = () => { if (st.name && ready()) rpc('challenge_cancel', { p_secret: secret() }).catch(() => {}); };
export function open() {
  if (!ready()) return H.toast('Le classement en ligne n\'est pas encore activé');
  $('#rk').classList.add('on'); show('all');
}
export function askName() {
  if (!ready()) return H.toast('Le classement en ligne n\'est pas encore activé');
  $('#rk-in').value = st.name; $('#rk-err').textContent = ''; $('#rk-ask').classList.add('on'); setTimeout(() => $('#rk-in').focus(), 50);
}
async function claimAccount() { // ancien compte : le pseudo doit avoir été ouvert à la reprise par l'administrateur ; un nouveau secret remplace l'ancien
  const v = $('#rk-in').value.trim(), b = $('#rk-claim'); if (b.disabled) return; if (v.length < 3) { $('#rk-err').textContent = 'Écris ton ancien pseudo ci-dessus.'; return; }
  b.disabled = true; $('#rk-err').textContent = '';
  try {
    const sec = Array.from(crypto.getRandomValues(new Uint8Array(24)), (x) => x.toString(16).padStart(2, '0')).join(''), r = await rpc('claim_player', { p_secret: sec, p_name: v });
    st.secret = sec; st.name = r.name; save(); startPulse(); $('#rk-ask').classList.remove('on'); H.toast('Compte retrouvé : ' + r.name); onName(await flush()); onProf();
  } catch (e) { $('#rk-err').textContent = ERR[e.message] || ERR.network; }
  b.disabled = false;
}
async function confirmName() {
  const v = $('#rk-in').value.trim(), ok = $('#rk-ok'); if (ok.disabled) return;
  if (!/^[\p{L}\p{N} ._-]{3,16}$/u.test(v)) { $('#rk-err').textContent = ERR.invalid_name; return; }
  ok.disabled = true; $('#rk-err').textContent = '';
  try { await rpc('register', { p_secret: secret(), p_name: v }); st.name = v; save(); startPulse(); $('#rk-ask').classList.remove('on'); H.toast('Bienvenue dans le classement, ' + v); const r = await flush(); onName(r); if (openAfterName) { openAfterName = false; openProfile(st.name); } if ($('#rk').classList.contains('on')) show(board); }
  catch (e) { $('#rk-err').textContent = ERR[e.message] || ERR.network; }
  finally { ok.disabled = false; }
}
/* ---------- profils ---------- */
let pfTimer = 0, pfName = '', onProf = () => {}, openAfterName = false;
export const avatarKey = () => (st.prof.featured || [])[0] || '';
export const whenProfile = (f) => { onProf = f; };
const closeProfile = () => { clearInterval(pfTimer); $('#rk-prof').classList.remove('on'); pfName = ''; };
const myStats = () => { const l = H.local() || {}; return { level: H.level() || 1, codex: H.codexN() || 0, sector: l.sector || 0, tier: l.tier == null ? -1 : l.tier, score: l.score || 0, playtime: l.playtime || 0, admin: !!st.admin }; };
function renderProfile(p, me, offline) {
  const keys = (p.featured || []).filter((k) => H.astreInfo(k)), card = $('#rk-prof .card'); card.style.setProperty('--a', rgbOf(p.accent));
  $('#pf-lvl').textContent = (p.level ? 'NIVEAU ' + p.level : '') + (p.elo_games > 0 ? ' · ELO ' + p.elo : ''); $('#pf-name').textContent = p.name; $('#pf-title').textContent = titleName(p.title); $('#pf-motto').textContent = p.motto ? '« ' + p.motto + ' »' : '';
  avOf($('#pf-av'), keys[0], 108, p.accent, p.frame, false);
  const show = $('#pf-show'); show.innerHTML = '';
  for (const key of keys.slice(1)) {
    const info = H.astreInfo(key), d = document.createElement('div'), c = document.createElement('canvas');
    d.className = 'pf-cell'; d.style.setProperty('--c', `rgb(${info.col.join(',')})`); c.dataset.key = key; H.paint(c, key, 84, true); d.append(c);
    d.insertAdjacentHTML('beforeend', (info.rar >= 3 ? `<em>${['', '', '', 'ÉPIQUE', 'LÉGENDAIRE', 'CRITIQUE'][info.rar]}</em>` : '') + `<b>${esc(info.name)}</b>` + (info.sub ? `<small>${esc(info.sub)}</small>` : ''));
    d.addEventListener('click', () => H.view && H.view(key)); show.append(d); // un clic = la carte immersive
  }
  $('#pf-av').onclick = () => keys[0] && H.view && H.view(keys[0]); $('#pf-lab').hidden = !show.children.length;
  clearInterval(pfTimer); if (keys.length) pfTimer = setInterval(() => document.querySelectorAll('#rk-prof canvas[data-key]').forEach((c) => H.paint(c, c.dataset.key, parseInt(c.style.width, 10) || 84, true)), 100); // astres animés
  $('#pf-rank').textContent = p.rank ? 'n° ' + fmt(p.rank) : '–'; $('#pf-score').textContent = p.score ? fmt(p.score) : '–';
  $('#pf-tier').textContent = p.tier != null ? H.tierName(p.tier) : '–'; $('#pf-wins').textContent = p.wins != null ? fmt(p.wins) : '–';
  const pt = me ? Math.max(p.playtime || 0, H.local().playtime || 0) : p.playtime || 0; $('#pf-time').textContent = pt ? fmtTime(pt) : '–'; $('#pf-cdx').textContent = p.codex != null ? fmt(p.codex) : '–'; $('#pf-stats').hidden = false;
  $('#pf-meta').textContent = offline ? 'Hors connexion : profil enregistré sur cet appareil.' : (p.since ? 'Membre depuis ' + fmtMonth(p.since) : '');
  const lk = $('#pf-like'); lk.classList.toggle('on', !!p.liked); lk.disabled = !!me || !!offline; $('#pf-lk').textContent = fmt(p.likes || 0); $('#pf-soc').hidden = !!offline;
  $('#pf-on').innerHTML = p.online ? '<u class="on-dot" style="margin:0"></u>En ligne' : ''; $('#pf-duel').hidden = $('#pf-duel2').hidden = !!me || !!offline || !p.online || p.duel === false;
  $('#pf-edit').hidden = !me; $('#pf-replay').hidden = offline || !p.score;
}
const localProfile = () => ({ name: st.name, motto: st.prof.motto, featured: st.prof.featured, accent: st.prof.accent | 0, frame: st.prof.frame | 0, title: st.prof.title || '', codex: H.codexN(), level: H.level(), ...H.local() });
async function openProfile(name) {
  const m = $('#rk-prof'); pfName = name; m.classList.add('on'); clearInterval(pfTimer);
  const me = !!st.name && name.toLowerCase() === st.name.toLowerCase();
  $('#pf-name').textContent = name; $('#pf-title').textContent = ''; $('#pf-motto').textContent = ''; $('#pf-av').innerHTML = ''; $('#pf-show').innerHTML = ''; $('#pf-lab').hidden = true; $('#pf-stats').hidden = true; $('#pf-lvl').textContent = ''; $('#pf-meta').textContent = 'Chargement…'; m.querySelector('.card').style.setProperty('--a', rgbOf(0)); $('#pf-edit').hidden = true; $('#pf-duel').hidden = $('#pf-duel2').hidden = true; $('#pf-replay').hidden = true; $('#pf-on').textContent = ''; $('#pf-lk').textContent = '0'; $('#pf-like').classList.remove('on'); $('#pf-soc').hidden = true;
  let p = null;
  try { p = await rpc('get_profile', { p_name: name, p_secret: st.secret || null }); }
  catch (e) {
    if (pfName !== name) return;
    if (me) return renderProfile(localProfile(), true, true); // le serveur ne répond pas : on montre le profil local
    $('#pf-meta').textContent = ERR.network; return;
  }
  if (pfName !== name) return; // fermé ou remplacé pendant le chargement
  if (!p) { $('#pf-meta').textContent = me ? '' : 'Profil introuvable.'; if (me) renderProfile(localProfile(), true, true); return; }
  if (me && !st.dirty) { st.prof = { featured: p.featured || [], motto: p.motto || '', accent: p.accent | 0, frame: p.frame | 0, title: p.title || '' }; save(); onProf(); } // le serveur fait foi, sauf modification en attente d'envoi
  renderProfile(me && st.dirty ? { ...p, ...st.prof } : p, me);
}
export function openMyProfile() { // bouton Profil du menu
  if (!ready()) return H.toast('Le classement en ligne n\'est pas encore activé');
  if (!st.name) { openAfterName = true; return askName(); }
  openProfile(st.name);
}
/* ---------- éditeur : aperçu en direct, tout se règle d'un toucher ---------- */
let sel = [], eds = { accent: 0, frame: 0, title: '' };
function renderPreview() {
  $('#rk-edit .ed-in').style.setProperty('--a', rgbOf(eds.accent)); avOf($('#ed-av'), sel[0], 78, eds.accent, eds.frame, false);
  $('#ed-pn').textContent = st.name || ''; $('#ed-pt').textContent = titleName(eds.title); const m = $('#ed-motto').value.trim(); $('#ed-pm').textContent = m ? '« ' + m + ' »' : '';
}
function mark() {
  document.querySelectorAll('.ed-cell').forEach((b) => { const i = sel.indexOf(b.dataset.key), t = b.querySelector('i'); b.classList.toggle('on', i >= 0); t.textContent = i < 0 ? '' : i === 0 ? '★' : i + 1; t.className = i === 0 ? 'st' : ''; });
  renderPreview(); buildFrames();
}
function buildStyleChoices() {
  const lvl = H.level() || 1, sw = $('#ed-sw'); sw.textContent = '';
  ACCENTS.forEach((a, i) => { const b = document.createElement('button'), ok = a.lv <= lvl; b.className = (a.rb ? 'rb ' : '') + (eds.accent === i ? 'on ' : '') + (ok ? '' : 'lk'); b.style.setProperty('--a', a.c.join(',')); b.setAttribute('aria-label', a.n); if (!ok) b.dataset.lv = 'N' + a.lv; b.addEventListener('click', () => { if (!ok) return H.toast(`${a.n} : niveau ${a.lv} requis`); eds.accent = i; H.vib(6); buildStyleChoices(); renderPreview(); buildFrames(); }); sw.append(b); });
  const ti = $('#ed-ti'), stats = myStats(); ti.textContent = '';
  for (const t of TITLES) { if (t.hidden && !stats.admin) continue; const ok = t.ok(stats), b = document.createElement('button'); b.className = (eds.title === t.k ? 'on ' : '') + (ok ? '' : 'lk'); b.innerHTML = esc(t.n) + (ok || !t.hint ? '' : `<small>${esc(t.hint)}</small>`); b.addEventListener('click', () => { if (!ok) return H.toast(t.hint || 'Pas encore débloqué'); eds.title = t.k; H.vib(6); buildStyleChoices(); renderPreview(); }); ti.append(b); }
  buildFrames();
}
function buildFrames() {
  const lvl = H.level() || 1, fr = $('#ed-fr'); fr.textContent = '';
  FRAMES.forEach((f, i) => { const ok = f.lv <= lvl, b = document.createElement('button'), av = document.createElement('div'); b.className = (eds.frame === i ? 'on ' : '') + (ok ? '' : 'lk'); avOf(av, sel[0], 46, eds.accent, i, true); b.append(av, document.createTextNode(f.n)); b.insertAdjacentHTML('beforeend', ok ? '' : `<small>Niveau ${f.lv}</small>`); b.addEventListener('click', () => { if (!ok) return H.toast(`${f.n} : niveau ${f.lv} requis`); eds.frame = i; H.vib(6); buildFrames(); renderPreview(); }); fr.append(b); });
}
function openEditor() {
  if (!st.name) return askName();
  const list = H.astres(), g = $('#ed-grid'); g.innerHTML = '';
  sel = (st.prof.featured || []).filter((k) => list.some((a) => a.key === k)); eds = { accent: st.prof.accent | 0, frame: st.prof.frame | 0, title: st.prof.title || '' }; $('#ed-motto').value = st.prof.motto || ''; $('#ed-err').textContent = '';
  if (!list.length) g.innerHTML = '<div class="pf-load" style="grid-column:1/-1">Fusionne quelques astres pour les exposer ici.</div>';
  for (const a of list) {
    const b = document.createElement('button'), c = document.createElement('canvas'); b.className = 'ed-cell'; b.dataset.key = a.key; H.paint(c, a.key, 46); b.append(c);
    b.insertAdjacentHTML('beforeend', `<b>${esc(a.name)}</b><i></i>`);
    b.addEventListener('click', () => { const i = sel.indexOf(a.key); if (i >= 0) sel.splice(i, 1); else if (sel.length < 3) sel.push(a.key); else return H.toast('3 astres au maximum : retire-en un d\'abord'); H.vib(5); mark(); });
    g.append(b);
  }
  buildStyleChoices(); mark(); $('#rk-edit').classList.add('on'); $('#rk-edit .ed-body').scrollTop = 0;
}
async function saveProfile() {
  const motto = $('#ed-motto').value.trim(), ok = $('#ed-ok'); if (ok.disabled) return;
  if (/[<>]/.test(motto)) { $('#ed-err').textContent = ERR.invalid_motto; return; }
  const stats = myStats(), t = TITLES.find((x) => x.k === eds.title); if (eds.title && !(t && t.ok(stats))) eds.title = ''; // un titre non débloqué n'est pas enregistré
  ok.disabled = true; $('#ed-err').textContent = '';
  const prof = { featured: sel.slice(), motto, accent: eds.accent, frame: eds.frame, title: eds.title };
  try {
    await rpc('set_profile', { p_secret: secret(), p_featured: prof.featured, p_motto: prof.motto, p_codex: H.codexN(), p_level: H.level(), p_accent: prof.accent, p_frame: prof.frame, p_title: prof.title });
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
  if (menu) { const b = document.createElement('button'); b.className = 'big glass'; b.id = 'b-rank'; b.innerHTML = '<span>Communauté</span><small>Classement · Idées</small>'; menu.appendChild(b); b.addEventListener('click', open); } // home.js le range dans la barre du bas
  $('#rk-close').addEventListener('click', () => $('#rk').classList.remove('on'));
  $('#rk-name').addEventListener('click', () => (st.name ? openProfile(st.name) : askName()));
  $('#rk-body').addEventListener('click', (e) => { const r = e.target.closest('.rk-row,.pd'); if (r && r.dataset.name) { H.vib(6); openProfile(r.dataset.name); } });
  $('#pf-close').addEventListener('click', closeProfile); $('#pf-edit').addEventListener('click', openEditor);
  $('#pf-like').addEventListener('click', async () => {
    if (!st.name) return H.toast(ERR.no_profile); const b = $('#pf-like'); if (b.disabled) return; b.disabled = true;
    try { const r = await rpc('like_player', { p_secret: secret(), p_name: pfName }); b.classList.toggle('on', r.liked); $('#pf-lk').textContent = fmt(r.likes); H.vib(r.liked ? [10, 30, 10] : 6); if (r.liked) H.track('likes', 1); }
    catch (e) { H.toast(ERR[e.message] || ERR.network); } b.disabled = false;
  });
  $('#pf-duel').addEventListener('click', () => { if (!st.name) return H.toast(ERR.no_profile); const n = pfName; closeProfile(); $('#rk').classList.remove('on'); H.invite(n); });
  $('#pf-duel2').addEventListener('click', () => { if (!st.name) return H.toast(ERR.no_profile); const n = pfName; closeProfile(); $('#rk').classList.remove('on'); H.invite(n, 'shared'); });
  $('#inv-no').addEventListener('click', () => answer(false)); $('#inv-ok').addEventListener('click', () => answer(true));
  if (ready() && st.name) startPulse();
  $('#pf-replay').addEventListener('click', async () => { const b = $('#pf-replay'); b.disabled = true; try { const run = await rpc('get_run', { p_name: pfName }); if (!run || !Array.isArray(run.log)) H.toast('Aucune rediffusion disponible'); else { closeProfile(); H.replay(run); } } catch (e) { H.toast(ERR.network); } b.disabled = false; });
  $('#ed-ok').addEventListener('click', saveProfile); $('#ed-cancel').addEventListener('click', () => $('#rk-edit').classList.remove('on')); $('#ed-name').addEventListener('click', askName);
  $('#ed-motto').addEventListener('input', () => { $('#ed-err').textContent = ''; renderPreview(); });
  $('#ed-motto').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveProfile(); }); $('#rk-ok').addEventListener('click', confirmName); $('#rk-claim').addEventListener('click', claimAccount); $('#rk-later').addEventListener('click', () => { openAfterName = false; $('#rk-ask').classList.remove('on'); });
  $('#rk-in').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmName(); });
  document.querySelectorAll('.hub-tabs button').forEach((x) => x.addEventListener('click', () => show(x.dataset.b)));
  $('#rk-body').addEventListener('scroll', (e) => { const l = e.currentTarget; if (!inIdeas && l.scrollTop + l.clientHeight > l.scrollHeight - 160) more(); }, { passive: true });
  onProf(); flush(); // scores et profil restés en attente (hors connexion la dernière fois)
}
