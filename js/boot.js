// Critical — démarrage. Si une sauvegarde cloud attend d'être appliquée (restauration par code, ou progression plus avancée venue
// d'un autre appareil), elle est recopiée dans le stockage AVANT que les modules ne le lisent, puis l'application démarre.
try {
  const raw = localStorage.getItem('critical.cloud.apply');
  if (raw) {
    const d = JSON.parse(raw), keys = d.k || {};
    for (const [k, v] of Object.entries(keys)) if (/^critical\./.test(k) && typeof v === 'string') localStorage.setItem(k, v);
    const rk = JSON.parse(keys['critical.rank.v1'] || '{}'); rk.secret = d.secret; rk.pending = []; // l'identité reste celle de l'appareil (ou du code saisi)
    localStorage.setItem('critical.rank.v1', JSON.stringify(rk));
    localStorage.setItem('critical.cloud.v1', JSON.stringify({ rev: d.rev | 0, sig: d.sig || '', at: Date.now() }));
    localStorage.removeItem('critical.cloud.apply');
  }
} catch (e) { /* stockage indisponible : on démarre normalement */ }
import('./app.js');
