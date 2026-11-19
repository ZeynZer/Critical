// Critical — coquille de l'application : écran de démarrage, réglages, messages, et branchement des modules.
import * as A from './audio.js';
import * as MINE from './mine.js';
import * as QS from './quests.js';
import * as RANK from './rank.js';
import * as HOME from './home.js';
import * as INTRO from './intro.js';
import * as FORGE from './forge.js';
import * as GOALS from './goals.js';
import * as ADMIN from './admin.js';
import * as PACKUI from './packui.js';

const $ = (s) => document.querySelector(s);
const KEY = 'critical.v1';
const S = { sfx: true, mus: true, vib: true, quick: false };
try { Object.assign(S, (JSON.parse(localStorage.getItem(KEY) || '{}').set) || {}); } catch (e) { /* stockage indisponible */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ set: S })); } catch (e) { /* ignore */ } };
const vib = (p) => { if (S.vib && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* ignore */ } };
let toastT = 0;
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const refresh = () => HOME.update({ dust: MINE.dust(), daily: MINE.daily(), codex: MINE.codexN(), themes: MINE.themeStat(), level: MINE.levelInfo(), goals: GOALS.summary() });

// son : débloqué par le premier geste (l'écran de démarrage en demande un) ; mise en veille et reprise gérées par audio.js
A.setSfx(S.sfx); A.setMusic(S.mus);
['pointerdown', 'pointerup', 'click'].forEach((ev) => document.addEventListener(ev, () => { A.init(); A.resume(); }, { passive: true }));
document.addEventListener('pointerdown', () => { try { screen.orientation.lock('portrait').catch(() => {}); } catch (e) { /* non supporté (iOS, bureau) : la consigne CSS prend le relais */ } }, { once: true });

// réglages
const tap = (id, f) => $(id).addEventListener('click', () => { A.ui(); vib(9); f(); });
tap('#o-prof', () => { $('#m-settings').classList.remove('on'); RANK.openMyProfile(); });
tap('#b-set2', () => { $('#o-admin').hidden = !RANK.isAdmin(); $('#o-name').textContent = RANK.name() || 'Choisir un pseudo'; $('#o-sfx').checked = S.sfx; $('#o-mus').checked = S.mus; $('#o-vib').checked = S.vib; $('#o-gh').checked = MINE.ghostOn(); $('#o-quick').checked = S.quick; $('#o-duel').checked = !RANK.noDuel(); $('#m-settings').classList.add('on'); });
tap('#o-close', () => $('#m-settings').classList.remove('on'));
$('#o-sfx').onchange = (e) => { S.sfx = e.target.checked; A.setSfx(S.sfx); save(); };
$('#o-mus').onchange = (e) => { S.mus = e.target.checked; A.setMusic(S.mus); save(); };
$('#o-duel').onchange = (e) => RANK.setNoDuel(!e.target.checked);
$('#o-quick').onchange = (e) => { S.quick = e.target.checked; save(); };
$('#o-gh').onchange = (e) => MINE.setGhost(e.target.checked);
$('#o-vib').onchange = (e) => { S.vib = e.target.checked; save(); vib([14, 40, 14]); };

// modules (chacun ajoute ses boutons au menu, home.js les met en page)
MINE.init({ goal: GOALS.event, back: () => { if (!MINE.isNew()) HOME.hint(); }, vib, toast, today, time: (sec) => { QS.time(); RANK.reportTime(sec); }, track: QS.track, quests: QS.html, refresh, submit: RANK.submit, rank: RANK.open, challenge: RANK.challenge, challengeCancel: RANK.challengeCancel, name: RANK.name, rival: RANK.rival, runOf: RANK.runOf, askName: RANK.askName, named: () => !!RANK.name(), online: RANK.ready });
RANK.init({ view: MINE.viewCard, level: () => MINE.levelInfo().level, replay: MINE.openReplay, invite: MINE.inviteDuel, joinDuel: MINE.joinDuel, canNotify: MINE.canNotify, track: (...a) => { QS.track(...a); if (a[0] === 'likes') GOALS.event('like'); }, receive: (d, x, note, pack, n) => { if (d) MINE.grant(d, note || 'Cadeau'); if (x) MINE.giveXp(x); if (pack && n) MINE.packAdd(pack, n); toast('Cadeau reçu : ' + [d && d.toLocaleString('fr-FR') + ' Éclats', x && x + ' XP', pack && n && `${n} pack${n > 1 ? 's' : ''}`].filter(Boolean).join(' + ') + (note ? ' · ' + note : '')); }, toast, vib, today, astres: MINE.astres, astreInfo: MINE.astreInfo, paint: MINE.paintAstre, codexN: MINE.codexN, tierName: MINE.tierName, local: MINE.localStats }); RANK.whenNamed(MINE.rankLine);
const menu = $('#s-title .menu');
for (const [id, label, sub, f] of [['b-duel', 'Duel 1v1', 'Affronte un ami avec un code', MINE.openDuel], ['b-goals', 'Défis', ' ', GOALS.open], ['b-sandbox', 'Bac à sable', 'Tous tes astres, sans limite', MINE.openSandbox], ['b-daily', 'Défi du jour', ' ', MINE.openDaily], ['b-themes', 'Thèmes', 'Change le décor', MINE.openThemes], ['b-codex', 'Codex', '', MINE.openCodex], ['b-profile', 'Profil', '', RANK.openMyProfile]]) {
  const b = document.createElement('button'); b.id = id; b.className = 'big glass'; b.innerHTML = `<span>${label}</span>` + (sub ? `<small>${sub}</small>` : ''); menu.appendChild(b); b.addEventListener('click', () => { A.ui(); vib(9); f(); });
}
QS.init({ today, grant: MINE.grant, toast, vib, playtime: MINE.playtime, giveTheme: MINE.giveTheme, themeName: MINE.themeName });
GOALS.init({ pack: MINE.packAdd, grant: MINE.grant, xp: MINE.giveXp, level: () => MINE.levelInfo().level, toast, vib, sfx: A.ui, changed: refresh });
let packs = null;
const adm = ADMIN.mount({ call: RANK.admin, toast, local: { p: () => MINE.adminLocal.packs(3), test: (r) => packs && packs.preview(r), e: () => MINE.adminLocal.eclats(10000), x: () => MINE.adminLocal.xp(1000), u: () => MINE.adminLocal.unlock() } });
tap('#o-admin', () => { $('#m-settings').classList.remove('on'); adm.open(); });
HOME.init({ sfx: A.ui, levelInfo: MINE.levelInfo, forge: (el) => FORGE.mount(el, { view: MINE.viewCard, mountPacks: (box) => (packs = PACKUI.mount(box, { info: MINE.packInfo, open: (id) => MINE.packOpen(id), preview: (r, id) => MINE.packOpen(id, true, r), free: MINE.packFree, paintCard: MINE.paintCard, view: MINE.viewCard, buildCard: MINE.buildCard, sfx: { charge: A.packCharge, place: A.packPlace, rise: A.packRise, link: A.packLink, swallow: A.packSwallow, boom: A.packBoom, hit: A.packHit }, vib, toast, quick: () => S.quick, refresh })), info: MINE.forgeInfo, paint: MINE.paintAstre, forge: MINE.forge, equip: MINE.equip, toast, sfx: A.ui, vib }) });
// l'icône du bouton Profil devient l'astre de profil choisi
const avatar = () => { const d = $('#b-profile'), k = RANK.avatarKey(); if (!d) return; const box = d.querySelector('.hm-sbi') || d; let c = d.querySelector('canvas.hm-av'); if (!MINE.astreInfo(k)) { if (c) c.remove(); const ic = d.querySelector('.hm-ic'); if (ic) ic.style.display = ''; return; } if (!c) { c = document.createElement('canvas'); c.className = 'hm-av'; box.prepend(c); } d.querySelector('.hm-ic').style.display = 'none'; MINE.paintAstre(c, k, 44); };
RANK.whenProfile(avatar); avatar();
refresh();

// démarrage : « Zeyn's Games » en fondu, puis un appui pour entrer (c'est aussi lui qui débloque le son)
const sp = $('#splash');
setTimeout(() => sp.classList.add('ready'), 1700);
sp.addEventListener('pointerup', () => { if (!sp.classList.contains('ready')) return; A.init(); A.resume(); A.ui(); sp.classList.add('out'); setTimeout(() => sp.remove(), 700);
  // premier lancement : présentation animée puis partie guidée ; sinon, simple indice de glissement dans le menu
  if (MINE.isNew() && !INTRO.seen()) INTRO.show({ paint: MINE.paintAstre, sfx: A.ui, onPlay: () => MINE.open(), onSkip: () => setTimeout(HOME.hint, 600) }); else setTimeout(HOME.hint, 1400);
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* hors-ligne indisponible */ });

// anti appui involontaire : tout bouton d'une fenêtre ou d'une bannière qui vient d'apparaître reste inerte 0,75 s
// (on martèle l'écran, la fenêtre « Partie terminée » surgit sous le doigt : le tap ne doit rien déclencher)
{
  const ARM = 750, isPanel = (el) => el.nodeType === 1 && (el.classList.contains('modal') || el.id === 'rk-inv');
  const arm = (el) => { el.classList.add('arming'); clearTimeout(el._ar); el._ar = setTimeout(() => el.classList.remove('arming'), ARM); };
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'childList') { m.addedNodes.forEach((n) => { if (isPanel(n) && n.classList.contains('on')) arm(n); }); continue; }
      const el = m.target; if (!isPanel(el)) continue;
      if (m.attributeName === 'class' && el.classList.contains('on') && !(m.oldValue || '').split(' ').includes('on')) arm(el);
      else if (m.attributeName === 'data-s' && el.dataset.s === 'end') arm(el); // résultat d'un duel
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-s'], attributeOldValue: true });
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.arming') && e.target.closest('button')) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
}
