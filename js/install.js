// Critical — guide d'installation de la PWA. Détecte le téléphone (iPhone / Android) et le navigateur, puis explique pas à pas
// comment ajouter le jeu à l'écran d'accueil. Montré à l'ouverture tant que l'app n'est pas installée (« Plus tard » le repousse de 3 jours).
// maybe(cb) : montre le guide si utile puis appelle cb ; open() : le rouvre à la demande (Réglages) ; canInstall() : l'app n'est pas déjà installée.
const KEY = 'critical.install.v1', DAY = 864e5;
let st = { snooze: 0, never: false, done: false };
try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } };
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; }); // Chrome / Edge / Samsung (Android) : installation en un geste
window.addEventListener('appinstalled', () => { st.done = true; save(); const o = document.getElementById('ins'); if (o) o.remove(); });

export function detect(ua = navigator.userAgent, plat = navigator.platform, touch = navigator.maxTouchPoints) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (plat === 'MacIntel' && touch > 1), android = /Android/i.test(ua);
  const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|MicroMessenger|Twitter|; wv\)/i.test(ua);
  let browser = 'other';
  if (ios) browser = inApp ? 'inapp' : /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : /EdgiOS/.test(ua) ? 'edge' : /OPiOS|OPT\//.test(ua) ? 'opera' : /Safari/.test(ua) ? 'safari' : 'other';
  else if (android) browser = inApp ? 'inapp' : /SamsungBrowser/.test(ua) ? 'samsung' : /Firefox/.test(ua) ? 'firefox' : /EdgA/.test(ua) ? 'edge' : /OPR\//.test(ua) ? 'opera' : /Chrome/.test(ua) ? 'chrome' : 'other';
  else browser = /Edg\//.test(ua) ? 'edge' : /Firefox/.test(ua) ? 'firefox' : /Chrome/.test(ua) ? 'chrome' : /Safari/.test(ua) ? 'safari' : 'other';
  return { os: ios ? 'ios' : android ? 'android' : 'desktop', browser, ipad: /iPad/.test(ua) || (ios && !/iPhone/.test(ua)) };
}
export const installed = () => { try { return !!(window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: minimal-ui)').matches)) || navigator.standalone === true; } catch (e) { return false; } };
export const canInstall = () => !installed() && !st.done;

// pictogrammes fidèles à ceux que le téléphone affiche
const IC = {
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M8.2 7L12 3.2 15.8 7M7 10.2H6.2A1.7 1.7 0 004.5 12v7a1.7 1.7 0 001.7 1.7h11.6a1.7 1.7 0 001.7-1.7v-7a1.7 1.7 0 00-1.7-1.8H17"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4.2"/><path d="M12 8v8M8 12h8"/></svg>',
  dots: '<svg viewBox="0 0 24 24" class="f"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>',
  hdots: '<svg viewBox="0 0 24 24" class="f"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>',
  install: '<svg viewBox="0 0 24 24"><rect x="6" y="2.8" width="12" height="18.4" rx="2.6"/><path d="M12 7.5v6M9.3 11.2L12 13.9l2.7-2.7M10 18h4"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-6.5 8 6.5M6 9.5V19h12V9.5"/></svg>',
  safari: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.8"/><path d="M15.8 8.2l-2.2 5.4-5.4 2.2 2.2-5.4z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
// étapes selon le téléphone et le navigateur : [pictogramme, titre, détail]
export function steps(d) {
  if (d.os === 'ios') {
    if (d.browser === 'inapp') return { warn: 'Tu es dans le navigateur intégré d\'une application : il ne peut pas installer Critical.', list: [[IC.safari, 'Ouvre Safari', 'Touche « ⋯ » (ou le bouton de partage) puis « Ouvrir dans Safari », ou copie le lien dans Safari.'], [IC.share, 'Appuie sur Partager', 'Le carré avec une flèche vers le haut.'], [IC.plus, 'Sur l\'écran d\'accueil', 'Fais défiler la liste, touche « Sur l\'écran d\'accueil » puis « Ajouter ».']] };
    const where = d.ipad ? 'en haut à droite de l\'écran' : d.browser === 'safari' ? 'dans la barre du bas (ou dans le menu « ⋯ » si tu ne le vois pas)' : 'dans la barre d\'adresse ou le menu « ⋯ »';
    return { list: [[IC.share, 'Appuie sur Partager', `Le carré avec une flèche vers le haut, ${where}.`], [IC.plus, 'Sur l\'écran d\'accueil', 'Fais défiler la liste vers le bas, puis touche « Sur l\'écran d\'accueil ».'], [IC.check, 'Touche « Ajouter »', 'Critical apparaît sur ton écran d\'accueil, comme une vraie application.']], hint: d.ipad ? 'top' : 'bottom', note: d.browser !== 'safari' && d.browser !== 'chrome' && d.browser !== 'edge' ? 'Astuce : Safari est le navigateur le plus fiable pour cette installation.' : '' };
  }
  if (d.os === 'android') {
    if (d.browser === 'inapp') return { warn: 'Tu es dans le navigateur intégré d\'une application : ouvre le lien dans Chrome.', list: [[IC.dots, 'Ouvre le menu', 'Touche « ⋮ » puis « Ouvrir dans le navigateur » (Chrome).'], [IC.install, 'Installe', 'Dans Chrome : menu « ⋮ » puis « Installer l\'application ».'], [IC.check, 'Confirme', 'Touche « Installer ».']] };
    if (d.browser === 'samsung') return { list: [[IC.menu, 'Ouvre le menu', 'Touche « ☰ » en bas à droite.'], [IC.plus, 'Ajouter la page à', 'Choisis « Écran d\'accueil » (ou « Installer l\'application »).'], [IC.check, 'Confirme', 'Touche « Ajouter » : Critical apparaît sur ton écran d\'accueil.']] };
    if (d.browser === 'firefox') return { list: [[IC.dots, 'Ouvre le menu', 'Touche « ⋮ » en haut à droite.'], [IC.install, 'Installer', 'Choisis « Installer » (ou « Ajouter à l\'écran d\'accueil »).'], [IC.check, 'Confirme', 'Touche « Ajouter » : Critical apparaît sur ton écran d\'accueil.']] };
    return { list: [[IC.dots, 'Ouvre le menu', 'Touche « ⋮ » en haut à droite du navigateur.'], [IC.install, 'Installer l\'application', 'Ou « Ajouter à l\'écran d\'accueil » selon ta version.'], [IC.check, 'Confirme', 'Touche « Installer » : Critical apparaît sur ton écran d\'accueil.']], oneTap: true };
  }
  return { list: [[IC.install, 'Cherche l\'icône d\'installation', 'Dans la barre d\'adresse du navigateur (à droite), ou dans son menu : « Installer Critical ».'], [IC.check, 'Confirme', 'Critical s\'ouvre dans sa propre fenêtre, sans barre de navigation.']], oneTap: true };
}
const CSS = `
#ins{position:fixed;inset:0;z-index:95;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 14px) 16px calc(env(safe-area-inset-bottom,0px) + 14px);background:radial-gradient(70% 50% at 50% 0,rgba(91,140,255,.28),transparent 70%),radial-gradient(60% 45% at 80% 100%,rgba(255,79,216,.2),transparent 70%),rgba(3,4,14,.96);animation:ins-in .5s cubic-bezier(.2,1,.3,1);overflow-y:auto;-webkit-tap-highlight-color:transparent}
@keyframes ins-in{from{opacity:0;transform:translateY(20px)}}#ins.out{opacity:0;transition:opacity .3s}
.ins-c{width:100%;max-width:420px;display:flex;flex-direction:column;gap:12px;margin:auto 0}
.ins-top{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}.ins-top img{width:76px;height:76px;border-radius:19px;box-shadow:0 8px 30px rgba(120,100,255,.5)}
.ins-top h2{margin:0;font:900 22px/1.15 var(--disp);color:#fff}.ins-top p{margin:0;font-size:13.5px;line-height:1.45;color:rgba(255,255,255,.7)}
.ins-b{display:flex;justify-content:center;flex-wrap:wrap;gap:6px}.ins-b span{padding:5px 11px;border-radius:12px;font:700 11px var(--font);color:rgba(255,255,255,.85);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
.ins-w{padding:10px 12px;border-radius:16px;font-size:12.5px;line-height:1.4;color:#ffd58a;background:rgba(255,194,71,.1);border:1px solid rgba(255,194,71,.35)}
.ins-l{display:flex;flex-direction:column;gap:9px;counter-reset:s}
.ins-s{display:flex;align-items:center;gap:12px;padding:12px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);animation:ins-st .6s cubic-bezier(.2,1,.3,1) backwards}.ins-s:nth-child(2){animation-delay:.12s}.ins-s:nth-child(3){animation-delay:.24s}@keyframes ins-st{from{opacity:0;transform:translateX(-14px)}}
.ins-i{position:relative;flex:none;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,rgba(77,243,255,.22),rgba(255,79,216,.2));border:1px solid rgba(255,255,255,.22)}.ins-i svg{width:28px;height:28px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ins-i svg.f{fill:#fff;stroke:none}
.ins-i::after{counter-increment:s;content:counter(s);position:absolute;left:-7px;top:-7px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:900 11px var(--disp);color:#fff;background:#5b8cff;border:2px solid #080a22}
.ins-s b{display:block;font:800 14.5px var(--font);color:#fff}.ins-s small{display:block;margin-top:2px;font-size:12px;line-height:1.35;color:rgba(255,255,255,.62)}
.ins-n{font-size:11.5px;color:rgba(255,255,255,.5);text-align:center}
.ins-go{height:54px;border-radius:27px;border:0;color:#fff;font:800 14px var(--disp);letter-spacing:.06em;background:linear-gradient(135deg,#5b8cff,#b46bff);box-shadow:0 8px 28px rgba(120,100,255,.4)}.ins-go.g{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);box-shadow:none}
.ins-r{display:flex;gap:8px}.ins-r button{flex:1;height:46px;border-radius:23px;font:700 12.5px var(--font);color:rgba(255,255,255,.75);background:none;border:1px solid rgba(255,255,255,.16)}.ins-r button:first-child{color:#fff;background:rgba(255,255,255,.08)}
.ins-arrow{position:fixed;left:50%;margin-left:-24px;width:48px;text-align:center;font-size:26px;color:#4df3ff;text-shadow:0 0 14px #4df3ff;pointer-events:none;animation:ins-bob 1.1s ease-in-out infinite}.ins-arrow.bottom{bottom:calc(env(safe-area-inset-bottom,0px) + 2px)}.ins-arrow.top{top:calc(env(safe-area-inset-top,0px) + 2px);left:auto;right:18px;margin:0}
@keyframes ins-bob{50%{transform:translateY(6px)}}.ins-arrow.top{animation-name:ins-bobu}@keyframes ins-bobu{50%{transform:translateY(-6px)}}
#ins.arming button{pointer-events:none}@media (prefers-reduced-motion:reduce){#ins,.ins-s,.ins-arrow{animation:none}}`;
let styled = false, onClose = null;
export function open(cb, opts = {}) {
  if (document.getElementById('ins')) return; if (!styled) { styled = true; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); }
  const d = detect(), sp = steps(d), o = make('div', 'arming'); o.id = 'ins'; setTimeout(() => o.classList.remove('arming'), 700); onClose = cb || null;
  const c = make('div', 'ins-c'), name = d.os === 'ios' ? 'ton iPhone' : d.os === 'android' ? 'ton téléphone Android' : 'ton ordinateur';
  c.append(make('div', 'ins-top', `<img src="icons/icon-192.png" alt="" width="76" height="76"><h2>Installe Critical sur ${d.ipad ? 'ton iPad' : name}</h2><p>Une vraie application : plein écran, plus fluide, et elle marche même sans connexion.</p>`), make('div', 'ins-b', '<span>⚡ Plus fluide</span><span>🖥 Plein écran</span><span>📴 Hors connexion</span>'));
  if (sp.warn) c.append(make('div', 'ins-w', sp.warn));
  const list = make('div', 'ins-l'); for (const [ic, t, sub] of sp.list) list.append(make('div', 'ins-s', `<div class="ins-i">${ic}</div><div><b>${t}</b><small>${sub}</small></div>`)); c.append(list);
  if (sp.note) c.append(make('p', 'ins-n', sp.note));
  const close = (snooze, never) => { if (never) st.never = true; if (snooze) st.snooze = Date.now() + snooze * DAY; save(); o.classList.add('out'); setTimeout(() => o.remove(), 300); const f = onClose; onClose = null; if (f) f(); };
  if (deferred) { const b = make('button', 'ins-go', 'Installer maintenant'); b.addEventListener('click', async () => { try { deferred.prompt(); const r = await deferred.userChoice; deferred = null; if (r && r.outcome === 'accepted') { st.done = true; save(); close(0); } } catch (e) { /* le guide manuel reste affiché */ } }); c.insertBefore(b, list); }
  if (opts.manual) { const b = make('button', 'ins-go g', 'Fermer'); b.addEventListener('click', () => close(0)); c.append(b); }
  else { const r = make('div', 'ins-r'), a = make('button', '', 'Je m\'en occupe'), b = make('button', '', 'Plus tard'); a.addEventListener('click', () => close(7)); b.addEventListener('click', () => close(3)); r.append(a, b); c.append(r); const z = make('button', 'ins-n', 'Ne plus me le proposer'); z.style.cssText = 'background:none;border:0;padding:6px;color:rgba(255,255,255,.4)'; z.addEventListener('click', () => close(0, true)); c.append(z); }
  o.append(c); if (sp.hint) o.append(make('div', 'ins-arrow ' + sp.hint, sp.hint === 'top' ? '▲' : '▼')); document.body.append(o);
}
// à appeler une fois au lancement : guide si utile (téléphone, app non installée, pas repoussé), puis cb
export function maybe(cb) {
  const d = detect(); if (d.os === 'desktop' || installed() || st.done || st.never || st.snooze > Date.now()) return cb && cb();
  open(cb);
}
export const show = () => open(null, { manual: true });
