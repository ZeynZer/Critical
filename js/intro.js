// Critical — présentation du premier lancement : trois écrans animés (fusion, ligne de défaite, progression), puis la partie guidée.
// Aucune dépendance : les astres sont les vraies images du jeu (paint), animées en CSS (transform/opacity seulement).
const KEY = 'critical.intro.v1';
export const seen = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
const mark = () => { try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ } };
const $ = (s, r = document) => r.querySelector(s);
const make = (cls, html) => { const e = document.createElement('div'); e.className = cls; if (html) e.innerHTML = html; return e; };

const CSS = `
#ob{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;background:radial-gradient(120% 70% at 50% 0,#171347 0,#080a22 55%,#03030c);color:#fff;animation:ob-in .6s ease}
@keyframes ob-in{from{opacity:0}}#ob.out{opacity:0;transition:opacity .45s}
#ob-sl{flex:1;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior:contain}#ob-sl::-webkit-scrollbar{display:none}
.ob-s{flex:none;width:100%;height:100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:calc(env(safe-area-inset-top,0px) + 50px) 28px 150px;text-align:center}
.ob-s h2{margin:0;font:900 26px/1.1 var(--disp);letter-spacing:.04em;text-transform:uppercase;text-shadow:0 0 24px rgba(77,243,255,.45)}.ob-s p{margin:0;max-width:320px;font-size:16px;line-height:1.45;color:rgba(238,244,255,.82)}.ob-s p b{color:#fff}
.ob-sc{position:relative;width:260px;height:230px;flex:none}.ob-sc>canvas{position:absolute;display:block}.ob-sc canvas{display:block}
#ob-skip{position:absolute;right:16px;top:calc(env(safe-area-inset-top,0px) + 14px);height:40px;padding:0 16px;border-radius:20px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:rgba(238,244,255,.8);font:600 13px var(--font)}
#ob-bot{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);display:flex;flex-direction:column;align-items:center;gap:16px;padding:0 28px}
#ob-dots{display:flex;gap:8px}#ob-dots i{width:8px;height:8px;border-radius:4px;background:rgba(255,255,255,.25);transition:width .3s,background .3s}#ob-dots i.on{width:26px;background:linear-gradient(90deg,#4df3ff,#ff4fd8)}
#ob-next{width:100%;max-width:340px;height:58px;border-radius:29px;border:1px solid rgba(255,255,255,.45);background:linear-gradient(135deg,rgba(77,243,255,.4),rgba(255,79,216,.36));color:#fff;font:800 16px var(--disp);letter-spacing:.08em;text-transform:uppercase;box-shadow:0 0 30px rgba(77,243,255,.3)}#ob-next:active{transform:scale(.96)}
/* scène 1 : deux astres identiques fusionnent */
.f-a,.f-b,.f-r,.f-o{position:absolute;left:50%;top:50%}.f-a{animation:fa 4.2s infinite}.f-b{animation:fb 4.2s infinite}.f-r{animation:fr 4.2s infinite}
@keyframes fa{0%{transform:translate(-150%,-210%) scale(.9);opacity:0}12%{opacity:1}42%,47%{transform:translate(-100%,0) scale(1);opacity:1}50%,100%{transform:translate(-50%,0) scale(0);opacity:0}}
@keyframes fb{0%,8%{transform:translate(150%,-210%) scale(.9);opacity:0}20%{opacity:1}42%,47%{transform:translate(0%,0) scale(1);opacity:1}50%,100%{transform:translate(0%,0) scale(0);opacity:0}}
.f-o{width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;border:3px solid #4df3ff;box-shadow:0 0 24px #4df3ff;opacity:0;animation:fo 4.2s infinite}
@keyframes fo{0%,47%{transform:scale(.3);opacity:0}49%{opacity:1}68%,100%{transform:scale(1.7);opacity:0}}
.f-r{margin:-45px 0 0 -45px;animation:fr 4.2s infinite}@keyframes fr{0%,48%{transform:scale(0);opacity:0}58%{transform:scale(1.25);opacity:1}66%,88%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}
.f-gd{position:absolute;left:30px;right:30px;bottom:8px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)}
/* scène 2 : la ligne de défaite */
.l-box{position:absolute;inset:6px 30px 0;border-radius:24px;border:1.5px solid rgba(255,255,255,.22);background:rgba(255,255,255,.04)}
.l-line{position:absolute;left:36px;right:36px;top:62px;border-top:2.5px dashed rgba(255,255,255,.6);animation:ll 5.4s infinite}@keyframes ll{0%,22%{border-color:rgba(255,255,255,.6)}28%,78%{border-color:#ff5577}86%,100%{border-color:rgba(255,255,255,.6)}}
.l-up{position:absolute;left:50%;margin-left:-26px;top:10px;animation:lu 5.4s infinite}@keyframes lu{0%,18%{transform:translateY(96px)}30%,76%{transform:translateY(0)}88%,100%{transform:translateY(96px)}}
.l-t{position:absolute;left:50%;top:120px;width:64px;height:64px;margin-left:-32px;animation:lt 5.4s infinite}.l-t svg{width:64px;height:64px;transform:rotate(-90deg)}.l-t circle{fill:none;stroke-width:6;stroke-linecap:round}.l-t .bg{stroke:rgba(255,255,255,.12)}.l-t .fg{stroke:#ff5577;stroke-dasharray:176;animation:lf 5.4s infinite}
@keyframes lt{0%,28%{opacity:0}34%,78%{opacity:1}86%,100%{opacity:0}}@keyframes lf{0%,30%{stroke-dashoffset:176}78%,100%{stroke-dashoffset:0}}
/* scène 3 : la chaîne des astres */
.c-g{display:grid;grid-template-columns:repeat(5,1fr);gap:8px 4px;width:260px;justify-items:center;align-content:center;height:230px}.c-g div{opacity:.28;transform:scale(.8);animation:cw 5.2s infinite;animation-delay:calc(var(--i) * .26s)}
@keyframes cw{0%,6%{opacity:.28;transform:scale(.8)}12%{opacity:1;transform:scale(1.18);filter:drop-shadow(0 0 12px rgba(120,220,255,.9))}22%,100%{opacity:.7;transform:scale(1)}}
@media (max-height:700px){.ob-sc{transform:scale(.82);margin:-18px 0}.ob-s{gap:10px;padding-bottom:130px}.ob-s h2{font-size:22px}}
@media (prefers-reduced-motion:reduce){.ob-sc *{animation:none!important}}
`;

// show({ paint(canvas, key, px), onPlay(), sfx() }) : affiche la présentation ; onPlay = lancer la partie guidée, sinon retour au menu
export function show({ paint, onPlay, onSkip, sfx = () => {} }) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const spr = (key, px, cls) => { const c = document.createElement('canvas'); paint(c, key, px); if (cls) c.className = cls; return c; };
  const wrap = make('', ''); wrap.id = 'ob';
  const sl = make(''); sl.id = 'ob-sl';
  // 1 · fusion
  const s1 = make('ob-s', '<div class="ob-sc" data-i="0"><div class="f-gd"></div><div class="f-o"></div></div><h2>Fusionne les astres</h2><p>Lâche un astre dans la cuve. <b>Deux astres identiques qui se touchent fusionnent</b> en un plus gros.</p>');
  const sc1 = $('.ob-sc', s1); for (const [cls, key, px] of [['f-a', '1', 64], ['f-b', '1', 64], ['f-r', '2', 90]]) { const w = make(cls); w.style.cssText += `margin:-${px / 2}px 0 0 -${px / 2}px`; w.append(spr(key, px)); sc1.append(w); }
  // 2 · la ligne
  const s2 = make('ob-s', '<div class="ob-sc"><div class="l-box"></div><div class="l-line"></div><div class="l-t"><svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="28"/><circle class="fg" cx="32" cy="32" r="28"/></svg></div></div><h2>Garde la cuve sous la ligne</h2><p>Un astre <b>entièrement au-dessus de la ligne pendant 2,6 secondes</b>, c\'est perdu. Fusionne pour faire de la place.</p>');
  const sc2 = $('.ob-sc', s2); const up = make('l-up'); up.append(spr('3', 52)); sc2.append(up);
  [['2', 48, 54, 172], ['1', 44, 112, 176], ['2', 48, 168, 172], ['1', 44, 82, 130]].forEach(([k, px, x, y]) => { const c = spr(k, px); c.style.left = x + 'px'; c.style.top = y + 'px'; sc2.append(c); });
  // 3 · la progression
  const s3 = make('ob-s', '<div class="ob-sc"><div class="c-g"></div></div><h2>Va toujours plus loin</h2><p>De la poussière d\'étoile à la <b>galaxie</b> : variantes rares, trous noirs qui avalent, secteurs, et des <b>duels</b> entre amis.</p>');
  const g = $('.c-g', s3); for (let i = 0; i < 13; i++) { const d = document.createElement('div'); d.style.setProperty('--i', i); d.append(spr(String(i), 36)); g.append(d); }
  sl.append(s1, s2, s3);
  const dots = make(''); dots.id = 'ob-dots'; dots.innerHTML = '<i class="on"></i><i></i><i></i>';
  const next = document.createElement('button'); next.id = 'ob-next'; next.textContent = 'Suivant';
  const skip = document.createElement('button'); skip.id = 'ob-skip'; skip.textContent = 'Passer';
  const bot = make(''); bot.id = 'ob-bot'; bot.append(dots, next);
  wrap.append(sl, skip, bot); document.body.append(wrap);
  let n = 0;
  const upd = () => { const i = Math.round(sl.scrollLeft / sl.clientWidth); if (i !== n) { n = i; dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i)); next.textContent = i === 2 ? 'Jouer' : 'Suivant'; sfx(); } };
  let t = 0; sl.addEventListener('scroll', () => { if (!t) t = requestAnimationFrame(() => { t = 0; upd(); }); }, { passive: true });
  const done = (play) => { mark(); wrap.classList.add('out'); setTimeout(() => { wrap.remove(); st.remove(); }, 450); (play ? onPlay : onSkip)(); };
  next.addEventListener('click', () => { sfx(); if (n < 2) sl.scrollTo({ left: (n + 1) * sl.clientWidth, behavior: 'smooth' }); else done(true); });
  skip.addEventListener('click', () => { sfx(); done(false); });
}
