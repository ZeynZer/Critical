// Test du cycle de vie du son dans un vrai navigateur (nécessite playwright et un serveur : python3 -m http.server 8000).
//   node tools/test-audio.mjs
// Vérifie : session audio « ambiance » (jamais « lecture »), aucun faux son silencieux, suspension en arrière-plan, reprise,
// et pas de battement de cœur de danger pendant la pause. L'extinction de l'écran est simulée par les événements de visibilité.
import assert from 'node:assert/strict'; import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const p = await c.newPage(); await p.route(/supabase\.co/, (r) => r.abort());
p.on('pageerror', (e) => { throw e; });
await p.addInitScript(() => {
  localStorage.setItem('critical.forage.v2', JSON.stringify({ tut: 1 }));
  window.__a = { osc: 0, types: [], audios: 0, ctxs: [] };
  let t = 'auto'; Object.defineProperty(navigator, 'audioSession', { value: { get type() { return t; }, set type(v) { window.__a.types.push(v); t = v; } } }); // iOS 16.4+ simulé
  const AC = window.AudioContext, co = AC.prototype.createOscillator, NA = window.Audio;
  AC.prototype.createOscillator = function () { window.__a.osc++; if (!window.__a.ctxs.includes(this)) window.__a.ctxs.push(this); return co.call(this); };
  window.Audio = function (...a) { window.__a.audios++; return new NA(...a); };
});
const set = (hidden) => p.evaluate((h) => { Object.defineProperty(document, 'hidden', { value: h, configurable: true }); Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
const st = () => p.evaluate(() => ({ osc: window.__a.osc, state: window.__a.ctxs[0] ? window.__a.ctxs[0].state : 'aucun' }));
await p.goto('http://localhost:8000/'); await p.waitForTimeout(2300); await p.mouse.click(195, 420); await p.waitForTimeout(2500);

// 1. session « ambiance » et aucun contournement du bouton silencieux
const a0 = await p.evaluate(() => ({ types: window.__a.types, audios: window.__a.audios, tags: document.querySelectorAll('audio').length }));
assert.ok(a0.types.length && a0.types.every((t) => t === 'ambient'), 'la session audio doit rester « ambient » : ' + a0.types);
assert.equal(a0.audios + a0.tags, 0, 'aucun faux son silencieux (il forçait le mode lecture)');
assert.equal((await st()).state, 'running', 'le son doit démarrer après le premier appui');

// 2. écran éteint : le son est suspendu et rien n'est plus généré
await set(true); await p.waitForTimeout(500);
const s1 = await st(); assert.equal(s1.state, 'suspended', 'le contexte audio doit être suspendu en arrière-plan');
await p.waitForTimeout(9000); const s2 = await st(); assert.equal(s2.osc, s1.osc, 'aucun son ne doit être généré en arrière-plan');

// 3. retour : reprise et musique relancée
await set(false); await p.waitForTimeout(1500);
const s3 = await st(); assert.equal(s3.state, 'running', 'le son doit reprendre au retour'); assert.ok(s3.osc > s2.osc, 'la musique doit repartir');

// 4. pas de battement de cœur de danger pendant la pause
await p.evaluate(() => { const m = document.querySelector('#o-mus'); m.checked = false; m.dispatchEvent(new Event('change')); }); // musique coupée : on ne compte que les effets
await p.evaluate(() => document.querySelector('#b-mine').click()); await p.waitForTimeout(800);
await p.evaluate(() => { window.__mine.G.mod = { g: 0, inset: 0, n: '' }; setInterval(() => { window.__mine.G.danger = 0.6; }, 30); }); // danger maintenu : sans astre au-dessus de la ligne il retomberait aussitôt
const count = async (ms) => { const a = (await st()).osc; await p.waitForTimeout(ms); return (await st()).osc - a; };
const beating = await count(2500);
await p.evaluate(() => document.querySelector('#mn-help').click()); await p.waitForTimeout(300);
const paused = await count(2500);
assert.ok(beating > paused + 3, `le battement doit s'arrêter en pause (${beating} sons en jeu, ${paused} en pause)`);
console.log(`son OK : session ${a0.types.join(',')} · suspendu en arrière-plan · repris au retour · battement ${beating} → ${paused} en pause`);
await b.close();
