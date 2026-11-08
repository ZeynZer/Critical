// Critical — worker : calcule le niveau du jour hors du thread principal (voir daily.js).
import { dailyLevel } from './gen.js';
self.onmessage = (e) => {
  let def = null;
  try { def = dailyLevel(e.data); } catch (err) { /* ignore */ }
  self.postMessage({ ds: e.data, def });
};
