// Critical — boîte à idées de la communauté : chacun propose une idée (3 par jour), les autres la soutiennent d'un cœur ; les plus soutenues montent.
// L'administrateur change le statut (planifiée, en cours, réalisée, refusée), épingle ou supprime. Tout est vérifié côté serveur (supabase/schema.sql).
// api : { call(fn, args) → Promise (secret ajouté, erreurs en français), name(), askName(), isAdmin(), toast(txt), vib(n) }
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 1 ? 'à l\'instant' : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`; };
export const STATUS = { open: ['Soumise', '#9fb2d8'], planned: ['Planifiée', '#4df3ff'], doing: ['En cours', '#ffc247'], done: ['Réalisée', '#5dffc0'], rejected: ['Refusée', '#ff8aa0'] };
const HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.4 5 6.6 5c2 0 3.6 1.1 5.4 3.2C13.8 6.1 15.4 5 17.4 5c3.2 0 4.9 3 3.8 6.2-1.7 4.7-9.2 9.3-9.2 9.3z"/></svg>';
const CSS = `
.id-new{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:20px;background:linear-gradient(135deg,rgba(77,243,255,.1),rgba(255,79,216,.09));border:1px solid rgba(255,255,255,.14)}
.id-new h3{margin:0;font:800 12px var(--disp);letter-spacing:.12em;text-transform:uppercase;color:#fff}.id-new p{margin:0;font-size:12px;color:rgba(255,255,255,.62);line-height:1.4}
.id-new textarea{width:100%;min-height:78px;resize:none;border-radius:14px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.32);color:#fff;padding:10px 12px;font:500 14px/1.4 var(--font);outline:none;user-select:text;-webkit-user-select:text;touch-action:pan-y;box-sizing:border-box}
.id-new textarea:focus{border-color:#4df3ff}.id-row{display:flex;align-items:center;gap:10px}.id-row small{flex:1;font-size:11px;color:rgba(255,255,255,.5)}
.id-send{height:42px;padding:0 20px;border-radius:21px;border:0;background:linear-gradient(135deg,#5b8cff,#b46bff);color:#fff;font:800 13px var(--disp);letter-spacing:.06em}.id-send:disabled{opacity:.45}
.id-sort{display:flex;gap:6px}.id-sort button{flex:1;height:34px;border-radius:17px;font:700 11px var(--font);color:rgba(255,255,255,.62);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.id-sort button.on{color:#fff;background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4)}
.id-list{display:flex;flex-direction:column;gap:9px}.id-empty{padding:34px 14px;text-align:center;color:rgba(255,255,255,.6);font-size:14px;line-height:1.5}
.id-c{display:flex;gap:11px;padding:12px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);animation:id-in .4s cubic-bezier(.2,1,.3,1) backwards}@keyframes id-in{from{opacity:0;transform:translateY(8px)}}
.id-c.pin{border-color:rgba(255,194,71,.5);background:linear-gradient(135deg,rgba(255,194,71,.1),rgba(255,255,255,.04))}.id-c.done{border-color:rgba(93,255,192,.35)}
.id-lk{flex:none;width:52px;align-self:flex-start;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;border-radius:16px;color:#fff;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);font:800 14px var(--disp);transition:transform .35s cubic-bezier(.2,1.7,.4,1)}
.id-lk svg{width:22px;height:22px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linejoin:round}.id-lk.on{background:rgba(255,79,140,.2);border-color:rgba(255,120,170,.6)}.id-lk.on svg{fill:#ff4f8c;stroke:#ff4f8c;filter:drop-shadow(0 0 7px rgba(255,79,140,.8))}.id-lk:active{transform:scale(.88)}.id-lk:disabled{opacity:.7}
.id-b{flex:1;min-width:0}.id-b p{margin:0 0 6px;font-size:14px;line-height:1.42;color:#fff;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text}
.id-m{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;font-size:11px;color:rgba(255,255,255,.5)}.id-st{padding:2px 8px;border-radius:9px;font:800 9.5px var(--disp);letter-spacing:.06em;text-transform:uppercase;color:var(--c);border:1px solid var(--c);background:color-mix(in srgb,var(--c) 14%,transparent)}
.id-x{margin-left:auto;font-size:11px;color:#ff8aa0;background:none;border:0;padding:4px 2px}
.id-ad{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.id-ad button,.id-ad select{height:30px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.07);color:#fff;font:700 11px var(--font);padding:0 9px}.id-ad .d{border-color:rgba(255,106,138,.55);color:#ff8aa0}.id-ad .on{border-color:#ffc247;color:#ffc247}
`;
let styled = false;
export function mount(pane, api) {
  if (!styled) { styled = true; const st = make('style'); st.textContent = CSS; document.head.appendChild(st); }
  const box = make('div', 'id-new', `<h3>Une idée pour Critical ?</h3><p>Propose une nouveauté, un équilibrage, un défi… Les idées les plus soutenues par la communauté seront réalisées en priorité.</p><textarea maxlength="280" placeholder="Décris ton idée en une ou deux phrases" aria-label="Ton idée"></textarea><div class="id-row"><small>0 / 280 · 3 idées par jour</small><button class="id-send" disabled>Proposer</button></div>`);
  const sortBar = make('div', 'id-sort'), list = make('div', 'id-list'); pane.append(box, sortBar, list);
  const ta = box.querySelector('textarea'), cnt = box.querySelector('small'), send = box.querySelector('.id-send'); let sort = 'top', gen = 0, rows = [];
  const tabs = [['top', 'Populaires'], ['new', 'Récentes'], ['done', 'Réalisées']]; const setTabs = () => { sortBar.textContent = ''; for (const [k, n] of (api.isAdmin() ? tabs.concat([['all', 'Tout']]) : tabs)) { const b = make('button', k === sort ? 'on' : '', n); b.addEventListener('click', () => { sort = k; setTabs(); load(); }); sortBar.append(b); } };
  ta.addEventListener('input', () => { const n = ta.value.trim().length; cnt.textContent = `${ta.value.length} / 280 · 3 idées par jour`; send.disabled = n < 10; });
  send.addEventListener('click', async () => {
    if (!api.name()) return api.askName(); if (send.disabled) return; send.disabled = true;
    try { await api.call('idea_post', { p_text: ta.value }); ta.value = ''; cnt.textContent = '0 / 280 · 3 idées par jour'; api.toast('Idée envoyée, merci !'); api.vib([10, 30, 10]); sort = 'new'; setTabs(); await load(); }
    catch (e) { api.toast(e.message); send.disabled = ta.value.trim().length < 10; }
  });
  function card(r, i) {
    const st = STATUS[r.status] || STATUS.open, c = make('div', 'id-c' + (r.pinned ? ' pin' : '') + (r.status === 'done' ? ' done' : '')); c.style.animationDelay = Math.min(i, 8) * 0.04 + 's';
    const lk = make('button', 'id-lk' + (r.liked ? ' on' : ''), HEART + `<b>${r.likes}</b>`); lk.setAttribute('aria-label', 'Soutenir cette idée'); if (r.mine) { lk.disabled = true; lk.title = 'Ton idée compte déjà pour toi'; }
    lk.addEventListener('click', async () => {
      if (!api.name()) return api.askName(); const was = r.liked; r.liked = !was; r.likes += was ? -1 : 1; lk.classList.toggle('on', r.liked); lk.querySelector('b').textContent = r.likes; api.vib(r.liked ? [8, 24, 8] : 5); lk.disabled = true;
      try { const j = await api.call('idea_like', { p_id: r.id }); r.liked = j.liked; r.likes = j.likes; lk.classList.toggle('on', r.liked); lk.querySelector('b').textContent = r.likes; } catch (e) { r.liked = was; r.likes += was ? 1 : -1; lk.classList.toggle('on', was); lk.querySelector('b').textContent = r.likes; api.toast(e.message); }
      lk.disabled = false;
    });
    const b = make('div', 'id-b', `<p>${esc(r.body)}</p><div class="id-m"><span class="id-st" style="--c:${st[1]}">${st[0]}</span><span>${esc(r.author)}${r.mine ? ' (toi)' : ''} · ${ago(r.at)}</span></div>`);
    if (r.mine && r.status === 'open') { const x = make('button', 'id-x', 'Retirer'); x.addEventListener('click', async () => { try { await api.call('idea_delete', { p_id: r.id }); c.remove(); api.toast('Idée retirée'); } catch (e) { api.toast(e.message); } }); b.querySelector('.id-m').append(x); }
    if (api.isAdmin()) {
      const ad = make('div', 'id-ad'), sel = make('select'); sel.innerHTML = Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === r.status ? ' selected' : ''}>${v[0]}</option>`).join('');
      const act = async (fn, a, ok) => { try { await api.call(fn, { p_id: r.id, ...a }); api.toast(ok); load(); } catch (e) { api.toast(e.message); } };
      sel.addEventListener('change', () => act('admin_idea_status', { p_status: sel.value }, 'Statut mis à jour')); const pin = make('button', r.pinned ? 'on' : '', r.pinned ? '★ Épinglée' : '☆ Épingler'); pin.addEventListener('click', () => act('admin_idea_status', { p_status: r.status, p_pin: !r.pinned }, r.pinned ? 'Désépinglée' : 'Épinglée'));
      const del = make('button', 'd', 'Supprimer'); let armed = 0; del.addEventListener('click', () => { if (Date.now() - armed < 3000) act('admin_idea_delete', {}, 'Supprimée'); else { armed = Date.now(); api.toast('Touche encore pour confirmer'); } }); ad.append(sel, pin, del); b.append(ad);
    }
    c.append(lk, b); return c;
  }
  async function load() {
    const g = ++gen; list.innerHTML = '<div class="id-empty">Chargement…</div>';
    try { rows = await api.call('idea_list', { p_sort: sort, p_limit: 60 }); if (g !== gen) return; list.textContent = ''; if (!rows.length) list.innerHTML = `<div class="id-empty">${sort === 'done' ? 'Aucune idée réalisée pour l\'instant.' : 'Aucune idée ici pour l\'instant.<br>Sois le premier à en proposer une !'}</div>`; rows.forEach((r, i) => list.append(card(r, i))); }
    catch (e) { if (g === gen) list.innerHTML = `<div class="id-empty">${esc(e.message)}</div>`; }
  }
  setTabs(); return { refresh() { setTabs(); load(); } };
}
