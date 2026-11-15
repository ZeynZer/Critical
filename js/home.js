// Critical — écran d'accueil « coupe géologique » : roche mate, dalles franches, un seul accent ambre.
// Non destructif : il réorganise les boutons EXISTANTS (mêmes identifiants, mêmes actions).
// À lancer après CH.init(), ED.init() et MINE.init() (qui ajoutent leurs boutons au menu).
const $ = (s, r = document) => r.querySelector(s);
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const ico = (p) => `<svg class="hm-ic" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const ICONS = {
  camp: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  casc: '<path d="M6 3v7M12 3v12M18 3v5"/><circle cx="6" cy="14" r="2.5"/><circle cx="12" cy="19" r="2.5"/><circle cx="18" cy="12" r="2.5"/>',
  core: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  levels: '<rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/>',
  atelier: '<path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 013 3L8 18.5z"/><path d="M14.5 6l3.5 3.5"/>',
  coll: '<path d="M7 4h10l3.5 5L12 20.5 3.5 9z"/><path d="M3.5 9h17M9.5 9L12 20.5M14.5 9L12 20.5"/>',
  code: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
};
const DOTS = [[186, 202, 224], [70, 222, 255], [64, 226, 134], [255, 214, 64], [255, 70, 86]]; // les premiers minéraux du Forage
const CSS = `
#s-title.hm{padding:0;overflow:hidden;background:
  repeating-linear-gradient(176deg,rgba(255,255,255,.028) 0 2px,transparent 2px 38px),
  repeating-linear-gradient(183deg,rgba(0,0,0,.2) 0 14px,transparent 14px 71px),
  linear-gradient(180deg,#2a2018 0%,#1d1714 34%,#17141a 62%,#0f0d14 100%)}
#s-title.hm .title-wrap{margin:0 auto;max-width:440px;height:100%;padding:calc(env(safe-area-inset-top,0px) + 64px) 16px calc(env(safe-area-inset-bottom,0px) + 86px);gap:0;justify-content:center;overflow-y:auto;scrollbar-width:none}
#s-title.hm .logo{font-size:min(14.5vw,62px);letter-spacing:.01em;color:#fff;margin:0;align-self:flex-start;display:block;border-bottom:5px solid #ffb238;padding-bottom:6px}
#s-title.hm .tag{align-self:flex-start;margin:8px 0 22px;font-family:var(--disp);font-size:11px;letter-spacing:2.6px;text-transform:uppercase;color:rgba(255,255,255,.55)}
#s-title.hm .menu{gap:10px}
#s-title.hm .gear{position:absolute;right:14px;top:calc(env(safe-area-inset-top,0px) + 12px);width:44px;height:44px;display:grid;place-items:center;background:rgba(0,0,0,.4);border:1.5px solid rgba(255,255,255,.2);border-radius:6px;z-index:2}
#s-title.hm .gear svg{width:20px;height:20px}
#s-title.hm .hm-stars{position:absolute;left:16px;top:calc(env(safe-area-inset-top,0px) + 12px);height:44px;margin:0;display:flex;align-items:center;font:700 12px var(--disp);letter-spacing:1.5px;color:rgba(255,255,255,.6);z-index:2}
#s-title.hm .hm-stars b{color:#ffb238}
.hm-in{animation:hm-in .5s cubic-bezier(.2,.9,.3,1.1) backwards;animation-delay:var(--e,0s)}
@keyframes hm-in{from{opacity:0;transform:translateY(18px)}}
.hm-hero{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:104px;padding:14px 16px;text-align:left;background:#ffb238;color:#1b140a;border-radius:6px;box-shadow:0 6px 0 #a8651a;transition:transform .08s,box-shadow .08s}
.hm-hero:active{transform:translateY(5px);box-shadow:0 1px 0 #a8651a}
.hm-hero .hm-dots{display:flex;align-items:flex-end;gap:3px;flex:none}
.hm-hero .hm-dots i{display:block;border-radius:50%;border:2px solid #1b140a;animation:hm-bob 2.4s ease-in-out infinite;animation-delay:calc(var(--i) * -.3s)}
@keyframes hm-bob{50%{transform:translateY(-5px)}}
.hm-hero .hm-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.hm-hero .hm-t{font-family:var(--disp);font-weight:900;font-size:27px;letter-spacing:1.5px;text-transform:uppercase;line-height:1}
.hm-hero small{font-size:12.5px;font-weight:600;color:rgba(27,20,10,.72)}
.hm-list{width:100%;border:1.5px solid rgba(255,255,255,.14);background:rgba(10,8,12,.5);border-radius:6px}
.hm-row{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:58px;padding:8px 14px;text-align:left;border-top:1.5px solid rgba(255,255,255,.1);color:#fff}
.hm-row:first-child{border-top:0}.hm-row:active{background:rgba(255,255,255,.07)}
.hm-row .hm-ic,.hm-di .hm-ic{width:22px;height:22px;flex:none;color:#ffb238}
.hm-row .hm-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.hm-row .hm-t{font-family:var(--disp);font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase}
.hm-row small{font-size:12px;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-row .hm-chev{width:16px;height:16px;flex:none;opacity:.4}
.hm-row .hm-live{width:8px;height:8px;border-radius:50%;background:#7dffb0;flex:none}
.hm-row .hm-prog{position:absolute;left:0;bottom:-1.5px;height:2px;width:var(--p,0%);background:var(--c,#ffb238)}
.hm-row .ch-bar{width:64px;height:5px;border-radius:0;margin:0;flex:none;background:rgba(255,255,255,.14)}.hm-row .ch-bar b{border-radius:0;background:#ffb238;box-shadow:none}
.hm-row .ch-badge{position:static;flex:none}
.hm-row.ch-ready{background:rgba(255,178,56,.14);animation:none;box-shadow:none}
.hm-dock{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;padding:0 8px env(safe-area-inset-bottom,0px);background:#0c0a0e;border-top:1.5px solid rgba(255,255,255,.14);z-index:2}
.hm-di{flex:1;max-width:120px;height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font-size:11px;font-weight:600;color:rgba(255,255,255,.75)}
.hm-di small{display:none}.hm-di:active{color:#ffb238}
@media (max-height:680px){#s-title.hm .tag{margin-bottom:12px}.hm-hero{min-height:84px}.hm-row{min-height:50px}}
@media (prefers-reduced-motion:reduce){.hm-in,.hm-hero .hm-dots i{animation:none}}
`;
const CHEV = '<svg class="hm-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const DROP = ['big', 'glass', 'half', 'primary', 'hero', 'icon', 'foot'];
let camp = null, live = null;

// Transforme un bouton existant en ligne : icône · titre + sous-titre · (extras déjà présents) · chevron
function row(b, icon, delay) {
  b.classList.remove(...DROP); b.classList.add('hm-row', 'hm-in'); b.style.setProperty('--e', delay);
  const t = b.querySelector('span:not(.ch-badge)'), s = b.querySelector('small'), tx = make('span', 'hm-tx');
  if (t) { t.classList.add('hm-t'); tx.append(t); } if (s) tx.append(s);
  b.insertAdjacentHTML('afterbegin', ico(icon)); b.children[0].after(tx); b.insertAdjacentHTML('beforeend', CHEV);
  return b;
}

export function init() {
  const scr = $('#s-title'); if (!scr || scr.classList.contains('hm')) return;
  const menu = $('.menu', scr), wrap = $('.title-wrap', scr); if (!menu || !wrap) return;
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  scr.classList.add('hm');

  const logo = $('.logo', wrap); if (logo) { logo.textContent = 'CRITICAL'; logo.classList.add('hm-in'); }
  const tag = $('.tag', wrap); if (tag) { tag.textContent = 'Fusionne · Perce · Descends'; tag.classList.add('hm-in'); }
  const gear = $('#b-set2'); if (gear) gear.classList.remove('glass', 'icon');
  const stars = $('#t-stars'); if (stars) { stars.className = 'hm-stars'; scr.appendChild(stars); }

  const hero = $('#b-mine');
  if (hero) {
    const t = hero.querySelector('span'), s = hero.querySelector('small'), tx = make('span', 'hm-tx');
    hero.className = 'hm-hero hm-in'; hero.style.setProperty('--e', '.08s');
    if (t) t.className = 'hm-t'; tx.append(...[t, s].filter(Boolean));
    hero.textContent = '';
    hero.append(make('span', 'hm-dots', DOTS.map((c, i) => `<i style="--i:${i};width:${11 + i * 5}px;height:${11 + i * 5}px;background:rgb(${c})"></i>`).join('')), tx);
  }

  const list = make('div', 'hm-list');
  const play = $('#b-play'), daily = $('#b-daily'), casc = $('#b-endless'), chest = $('#b-chest');
  if (play) { list.append(row(play, ICONS.camp, '.16s')); camp = make('i', 'hm-prog'); play.append(camp); }
  if (daily) { list.append(row(daily, ICONS.cal, '.2s')); live = make('i', 'hm-live'); daily.lastChild.before(live); }
  if (casc) list.append(row(casc, ICONS.casc, '.24s'));
  if (chest) list.append(row(chest, ICONS.core, '.28s'));
  menu.append(list);

  const dock = make('nav', 'hm-dock'); dock.setAttribute('aria-label', 'Navigation');
  for (const [id, icon] of [['#b-levels', ICONS.levels], ['#b-atelier', ICONS.atelier], ['#b-coll', ICONS.coll], ['#b-code', ICONS.code]]) {
    const b = $(id); if (!b) continue;
    if (!b.querySelector('span')) { const lbl = b.textContent.trim(); b.textContent = ''; b.appendChild(make('span', '', lbl)); }
    b.classList.remove(...DROP); b.classList.add('hm-di'); b.insertAdjacentHTML('afterbegin', ico(icon)); dock.appendChild(b);
  }
  scr.appendChild(dock);
  menu.querySelectorAll('.row,.ch-row').forEach((r) => { if (!r.children.length) r.remove(); }); // anciennes rangées vides
}

// Appelé par refreshTitle() : progression de la campagne + point « défi disponible »
export function update({ pct = 0, col = '#ffb238' } = {}) {
  if (camp) { camp.style.setProperty('--p', Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%'); camp.style.setProperty('--c', col); }
  const d = $('#b-daily-s'); if (live && d) live.style.display = /^Fait/.test(d.textContent) ? 'none' : '';
}
