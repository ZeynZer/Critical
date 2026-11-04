// Génère la campagne (6 mondes x 10 niveaux) dans js/levels.js
import { writeFileSync } from 'node:fs';
import { WORLDS, PER_WORLD, campaignLevel } from '../js/gen.js';
const out = [];
const t0 = Date.now();
for (let wi = 0; wi < WORLDS.length; wi++) {
  for (let k = 0; k < PER_WORLD; k++) {
    const t = Date.now();
    const d = campaignLevel(wi, k);
    if (!d) throw new Error('Échec niveau ' + wi + ':' + k);
    out.push({ world: wi, idx: k, ...d });
    console.log(`M${wi + 1}-${k + 1}  ${d.w}x${d.h}  min=${d.min}  ${Date.now() - t}ms`);
  }
}
writeFileSync(new URL('../js/levels.js', import.meta.url), '// Fichier généré par tools/gen-levels.mjs — ne pas modifier à la main.\nexport const LEVELS = ' + JSON.stringify(out) + ';\n');
console.log('OK', out.length, 'niveaux en', Date.now() - t0, 'ms');
