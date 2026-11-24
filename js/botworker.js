// Critical — série de parties de robots en arrière-plan (console admin › Robots) : le jeu reste fluide pendant le calcul.
import { playGame } from './bot.js';
self.onmessage = (e) => {
  const { level, mode, games, maxDrops, seed0 } = e.data;
  for (let i = 0; i < games; i++) {
    const seed = (seed0 + i * 7919) >>> 0, t0 = Date.now();
    const G = playGame(seed, level, { mode, maxDrops, onStep: (g) => { if (g.n % 6000 === 0) self.postMessage({ t: 'p', i, drops: g.drops, score: g.score }); } });
    self.postMessage({ t: 'r', i, seed, score: G.score, sector: G.depth + 1, drops: G.drops, tier: G.maxTier, over: !!G.over, mins: Math.round(G.t / 6) / 10, real: Math.round((Date.now() - t0) / 100) / 10 });
  }
  self.postMessage({ t: 'end' });
};
