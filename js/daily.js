// Critical — défi du jour : calculé en arrière-plan (Web Worker) pendant l'intro, puis mis en cache.
// Avant : toucher « Défi du jour » bloquait l'écran jusqu'à ~2 s. Maintenant : instantané.
import { dailyLevel } from './gen.js';

const KEY = 'critical.daily.', mem = new Map();

function store(ds, def) {
  if (!def) return;
  mem.set(ds, def);
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(KEY) && k !== KEY + ds) localStorage.removeItem(k); // on ne garde que le jour courant
    localStorage.setItem(KEY + ds, JSON.stringify(def));
  } catch (e) { /* ignore */ }
}

// Renvoie le niveau du jour (cache mémoire → cache disque → calcul direct en dernier recours)
export function get(ds) {
  if (mem.has(ds)) return mem.get(ds);
  try { const v = JSON.parse(localStorage.getItem(KEY + ds) || 'null'); if (v && v.g) { mem.set(ds, v); return v; } } catch (e) { /* ignore */ }
  const def = dailyLevel(ds); store(ds, def); return def;
}

// Lance le calcul dans un worker. Se résout (true/false) quand c'est prêt, ou après `timeout` ms.
export function prepare(ds, timeout = 3500) {
  return new Promise((resolve) => {
    try { const v = JSON.parse(localStorage.getItem(KEY + ds) || 'null'); if (v && v.g) { mem.set(ds, v); return resolve(true); } } catch (e) { /* ignore */ }
    let done = false; const fin = (ok) => { if (!done) { done = true; resolve(ok); } };
    try {
      const w = new Worker(new URL('./dailyworker.js', import.meta.url), { type: 'module' });
      w.onmessage = (e) => { store(e.data.ds, e.data.def); try { w.terminate(); } catch (er) { /* ignore */ } fin(!!e.data.def); };
      w.onerror = () => fin(false);
      setTimeout(() => fin(false), timeout);
    } catch (e) { fin(false); }
  });
}
