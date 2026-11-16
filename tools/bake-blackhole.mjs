// Génère assets/blackhole.webp : image fixe du trou noir, rendue avec le même moteur que l'animation mais en très haute définition.
// Elle s'affiche dès l'ouverture de l'accueil (avant la fin de la cuisson) et sur les appareils sans WebGL.
// Usage : lancer un serveur (python3 -m http.server 8000) puis  node tools/bake-blackhole.mjs  (nécessite playwright).
import { createRequire } from 'node:module'; import { writeFileSync } from 'node:fs'; import { execSync } from 'node:child_process';
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/')('playwright');
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 800, height: 800 } });
await p.goto('http://localhost:8000/js/config.js');
const url = await p.evaluate(async () => {
  const c = document.createElement('canvas'); c.style.cssText = 'width:720px;height:720px'; document.body.append(c);
  const { createBlackHole } = await import('/js/blackhole.js'); const h = createBlackHole(c, { custom: { D: 720, M: 1440, steps: 420 } }); if (!h) return null;
  h.size(720); while (!h.ready) { h.step(); await new Promise((r) => setTimeout(r, 0)); }
  h.draw(3.2); return c.toDataURL('image/webp', 0.9); // dans la même tâche que draw() : sinon le tampon est vidé
});
if (!url) throw new Error('WebGL indisponible : image non générée');
const buf = Buffer.from(url.split(',')[1], 'base64'); writeFileSync('assets/blackhole.webp', buf); console.log('assets/blackhole.webp', Math.round(buf.length / 1024), 'Ko');
await b.close();
