// Critical — coquille de l'application : écran de démarrage, réglages, messages, et branchement des modules.
import * as A from './audio.js';
import * as MINE from './mine.js';
import * as QS from './quests.js';
import * as RANK from './rank.js';
import * as HOME from './home.js';

const $ = (s) => document.querySelector(s);
const KEY = 'critical.v1';
const S = { sfx: true, mus: true, vib: true };
try { Object.assign(S, (JSON.parse(localStorage.getItem(KEY) || '{}').set) || {}); } catch (e) { /* stockage indisponible */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ set: S })); } catch (e) { /* ignore */ } };
const vib = (p) => { if (S.vib && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* ignore */ } };
let toastT = 0;
const toast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const refresh = () => HOME.update({ dust: MINE.dust(), daily: MINE.daily() });

// son : débloqué par le premier geste (l'écran de démarrage en demande un), repris au retour dans l'application
A.setSfx(S.sfx); A.setMusic(S.mus);
['pointerdown', 'pointerup', 'click'].forEach((ev) => document.addEventListener(ev, () => { A.init(); A.resume(); }, { passive: true }));
document.addEventListener('visibilitychange', () => { if (!document.hidden) A.resume(); });

// réglages
const tap = (id, f) => $(id).addEventListener('click', () => { A.ui(); vib(9); f(); });
tap('#b-set2', () => { $('#o-sfx').checked = S.sfx; $('#o-mus').checked = S.mus; $('#o-vib').checked = S.vib; $('#m-settings').classList.add('on'); });
tap('#o-close', () => $('#m-settings').classList.remove('on'));
$('#o-sfx').onchange = (e) => { S.sfx = e.target.checked; A.setSfx(S.sfx); save(); };
$('#o-mus').onchange = (e) => { S.mus = e.target.checked; A.setMusic(S.mus); save(); };
$('#o-vib').onchange = (e) => { S.vib = e.target.checked; save(); vib([14, 40, 14]); };

// modules (chacun ajoute ses boutons au menu, home.js les met en page)
MINE.init({ vib, toast, today, track: QS.track, quests: QS.html, refresh, submit: RANK.submit, rank: RANK.open, askName: RANK.askName, named: () => !!RANK.name(), online: RANK.ready });
RANK.init({ toast, vib, today, astres: MINE.astres, astreInfo: MINE.astreInfo, paint: MINE.paintAstre, codexN: MINE.codexN, tierName: MINE.tierName }); RANK.whenNamed(MINE.rankLine);
const menu = $('#s-title .menu');
for (const [id, label, sub, f] of [['b-daily', 'Défi du jour', ' ', MINE.openDaily], ['b-themes', 'Thèmes', 'Change le décor', MINE.openThemes], ['b-codex', 'Codex', '', MINE.openCodex]]) {
  const b = document.createElement('button'); b.id = id; b.className = 'big glass'; b.innerHTML = `<span>${label}</span>` + (sub ? `<small>${sub}</small>` : ''); menu.appendChild(b); b.addEventListener('click', () => { A.ui(); vib(9); f(); });
}
HOME.init();
QS.init({ today, grant: MINE.grant, toast, vib });
refresh();

// démarrage : « Zeyn's Games » en fondu, puis un appui pour entrer (c'est aussi lui qui débloque le son)
const sp = $('#splash');
setTimeout(() => sp.classList.add('ready'), 1700);
sp.addEventListener('pointerup', () => { if (!sp.classList.contains('ready')) return; A.init(); A.resume(); A.ui(); sp.classList.add('out'); setTimeout(() => sp.remove(), 700); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* hors-ligne indisponible */ });
