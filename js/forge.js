// Critical — onglet Fusion : réunir des exemplaires de variantes d'un même rang pour fabriquer son astre prismatique (unique, équipable).
// api : { info(), paint(canvas, clé, px, live), forge(rang), equip(rang, on), toast(txt), sfx(), vib(n) }
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const CSS = `
.fg-seg{display:flex;gap:6px;padding:4px;border-radius:22px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);width:100%}.fg-seg button{flex:1;height:38px;border-radius:18px;border:0;background:none;color:rgba(255,255,255,.65);font:800 12px var(--disp);letter-spacing:.06em;text-transform:uppercase;transition:background .25s,color .25s}.fg-seg button.on{background:linear-gradient(135deg,rgba(77,243,255,.35),rgba(255,79,216,.3));color:#fff}.fg-box{width:100%;display:flex;flex-direction:column;gap:12px}.fg-box[hidden]{display:none}
.fg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%}
.fg-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 4px 9px;border-radius:22px;background:radial-gradient(120% 80% at 50% 0,rgba(255,255,255,.16),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.16);color:#fff;text-align:center;transition:transform .4s cubic-bezier(.2,1.6,.4,1)}
.fg-card:active{transform:scale(.94)}.fg-card canvas{display:block;transition:filter .3s,opacity .3s}.fg-card:not(.own) canvas{filter:grayscale(1) brightness(.8);opacity:.45}
.fg-card b{font:700 10.5px/1.15 var(--font);min-height:24px}.fg-card small{font:700 11px var(--disp);color:rgba(255,255,255,.7)}
.fg-bar{width:78%;height:5px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden}.fg-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#4df3ff,#ff4fd8)}
.fg-card.ready{border-color:#5dffc0;box-shadow:0 0 22px rgba(93,255,192,.4);animation:fgr 1.8s ease-in-out infinite}.fg-card.ready canvas{filter:none;opacity:.95}@keyframes fgr{50%{box-shadow:0 0 34px rgba(93,255,192,.7)}}
.fg-card.own{border-color:rgba(255,255,255,.5);box-shadow:0 0 22px rgba(160,120,255,.35)}.fg-card.eq::after{content:'ÉQUIPÉ';position:absolute;top:7px;right:7px;font:800 8px var(--disp);letter-spacing:.08em;color:#5dffc0}
.fg-note{margin:2px 4px 0;font-size:12.5px;line-height:1.45;color:rgba(238,244,255,.6);text-align:left}
#fg-ov{position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle at 50% 42%,#1b1450,#05060f 70%);text-align:center;color:#fff;animation:fgo .5s}@keyframes fgo{from{opacity:0}}
#fg-ov .fg-stage{position:relative;width:240px;height:240px}#fg-ov .fg-stage canvas{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.fg-in{animation:fgi 1.5s cubic-bezier(.5,0,.8,.4) forwards}@keyframes fgi{0%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(.7)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(.1)}}
.fg-out{opacity:0;animation:fgp .9s 1.5s cubic-bezier(.2,1.5,.4,1) forwards}@keyframes fgp{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}100%{opacity:1;transform:translate(-50%,-50%) scale(1.8)}}
.fg-ring{position:absolute;left:50%;top:50%;width:200px;height:200px;margin:-100px 0 0 -100px;border-radius:50%;border:4px solid #fff;opacity:0;animation:fgw 1s 1.5s ease-out forwards}@keyframes fgw{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(2.4)}}
#fg-ov h3{margin:0;font:900 24px var(--disp);letter-spacing:.05em;text-transform:uppercase;opacity:0;animation:fgt .6s 2.3s forwards;background:linear-gradient(90deg,#4df3ff,#ff4fd8,#ffc247,#4df3ff);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent}
#fg-ov p{margin:0;max-width:300px;font-size:15px;color:rgba(238,244,255,.8);opacity:0;animation:fgt .6s 2.6s forwards}#fg-ov button{opacity:0;animation:fgt .6s 3s forwards;margin-top:10px;height:54px;width:min(300px,80vw);border-radius:27px;border:1px solid rgba(255,255,255,.45);background:linear-gradient(135deg,rgba(77,243,255,.4),rgba(255,79,216,.36));color:#fff;font:800 15px var(--disp);letter-spacing:.08em;text-transform:uppercase}
@keyframes fgt{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fg-card.ready,.fg-in{animation:none}}
`;
export function mount(page, api) {
  const st = make('style'); st.textContent = CSS; document.head.appendChild(st);
  const fbox = make('div', 'fg-box'), pbox = make('div', 'fg-box'), seg = make('div', 'fg-seg', '<button data-v="p">Packs</button><button data-v="f">Fusion</button>');
  const grid = make('div', 'fg-grid'), note = make('p', 'fg-note', 'Chaque variante obtenue en partie compte pour un exemplaire. Réunis-en assez pour un même rang et fabrique son <b>astre prismatique</b> : unique, il s\'équipe à la place de l\'apparence de ce rang.');
  fbox.append(grid, note); page.append(seg, pbox, fbox); let sig = '', packs = api.mountPacks ? api.mountPacks(pbox) : null, view = 'p'; try { view = localStorage.getItem('critical.fview') || 'p'; } catch (e) { /* ignore */ }
  const show = (v) => { view = v; try { localStorage.setItem('critical.fview', v); } catch (e) { /* ignore */ } fbox.hidden = v !== 'f'; pbox.hidden = v !== 'p'; seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); };
  seg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { api.sfx(); show(b.dataset.v); } }); show(view);
  const refresh = () => {
    const list = api.info(), s = JSON.stringify(list.map((f) => [f.copies, f.own, f.equipped])); if (s === sig) return; sig = s; grid.textContent = '';
    for (const f of list) {
      const c = make('button', 'fg-card' + (f.own ? ' own' : f.copies >= f.need ? ' ready' : '') + (f.equipped ? ' eq' : '')), cv = document.createElement('canvas'); api.paint(cv, f.key, 58);
      c.append(cv, make('b', '', f.name), f.own ? make('small', '', f.equipped ? 'Équipé' : 'Équiper') : make('small', '', `${Math.min(f.copies, f.need)} / ${f.need}`));
      if (!f.own) c.append(make('div', 'fg-bar', `<i style="width:${Math.min(100, (f.copies / f.need) * 100)}%"></i>`));
      c.addEventListener('click', () => {
        api.sfx();
        if (f.own) { api.equip(f.tier, f.equipped ? 0 : 9); api.vib(8); sig = ''; refresh(); }
        else if (f.copies >= f.need) celebrate(f);
        else api.toast(`Il te faut ${f.need} variantes de ${f.name} (${f.copies} pour l'instant)`);
      });
      grid.append(c);
    }
  };
  function celebrate(f) {
    const key = api.forge(f.tier); if (!key) return; api.vib([20, 40, 60]); sig = '';
    const ov = make('div', ''); ov.id = 'fg-ov'; const stage = make('div', 'fg-stage'); stage.append(make('div', 'fg-ring'));
    for (let i = 0; i < f.need; i++) { const c = document.createElement('canvas'); api.paint(c, String(f.tier), 56); const a = (i / f.need) * Math.PI * 2; c.className = 'fg-in'; c.style.setProperty('--x', Math.cos(a) * 130 + 'px'); c.style.setProperty('--y', Math.sin(a) * 130 + 'px'); c.style.animationDelay = i * 0.06 + 's'; stage.append(c); }
    const big = document.createElement('canvas'); api.paint(big, key, 170, true); big.className = 'fg-out'; stage.append(big);
    const tm = setInterval(() => api.paint(big, key, 170, true), 70), ok = make('button', '', 'Super');
    ov.append(stage, make('h3', '', 'Astre prismatique'), make('p', '', `${f.name} prismatique : unique, déjà équipé. Retrouve-le dans l'onglet Fusion.`), ok); document.body.append(ov);
    ok.addEventListener('click', () => { clearInterval(tm); ov.remove(); refresh(); });
  }
  refresh(); return { refresh() { refresh(); if (packs) packs.refresh(); }, packs };
}
