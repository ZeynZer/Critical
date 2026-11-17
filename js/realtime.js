// Client Supabase Realtime minimal (protocole Phoenix v1, canal « broadcast » public) : pas de dépendance, juste un WebSocket.
// Sert aux duels : chaque message est un petit objet JSON relayé à l'autre joueur du salon.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export function channel(name, onMsg, onClose) {
  const topic = 'realtime:' + name, q = []; let ws, ref = 0, hb = 0, ready = false, closed = false;
  const raw = (event, payload, t = topic) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ topic: t, event, payload, ref: String(++ref) })); };
  const gone = () => { clearInterval(hb); if (!closed) { closed = true; onClose && onClose(); } };
  try { ws = new WebSocket(SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SUPABASE_KEY) + '&vsn=1.0.0'); } catch (e) { setTimeout(gone, 0); return { send() {}, close() {} }; }
  ws.onopen = () => { raw('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false }, access_token: SUPABASE_KEY }); hb = setInterval(() => raw('heartbeat', {}, 'phoenix'), 25000); };
  ws.onmessage = (m) => {
    let d; try { d = JSON.parse(m.data); } catch (e) { return; }
    if (d.topic !== topic) return;
    if (d.event === 'phx_reply' && d.payload && d.payload.status === 'ok' && !ready) { ready = true; q.splice(0).forEach((p) => raw('broadcast', { type: 'broadcast', event: 'm', payload: p })); }
    else if (d.event === 'broadcast' && d.payload && d.payload.event === 'm') onMsg(d.payload.payload);
    else if (d.event === 'phx_error' || d.event === 'phx_close') gone();
  };
  ws.onclose = ws.onerror = gone;
  return {
    send(p) { if (ready) raw('broadcast', { type: 'broadcast', event: 'm', payload: p }); else q.push(p); }, // avant la connexion complète, les messages attendent
    close() { closed = true; clearInterval(hb); try { ws.close(); } catch (e) { /* ignore */ } },
  };
}
