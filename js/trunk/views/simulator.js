// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, form, ago, commandButton } from '../dom.js';
import { live } from '../view.js';

/**
 * THE SIMULATOR — Trunk-Caster's fader and simulated clock, the requests it
 * grants and the events it raises. Drives the caster with fader_quick (speed,
 * run/stop), clock (the simulated hour), fader_preset and connect / release;
 * shows the live connections (trunk/Connection/…) and every event
 * (trunk/Event/…) since this OS connected. The per-protocol frame simulators
 * have a window each (Intercom › Sims).
 */
export function create({ api, say }) {
  const conns = live();
  const events = live();
  const speed = el('input', { type: 'range', min: 0, max: 240, step: 1, value: 60 });
  const speedText = el('b', {}, '60×');
  speed.addEventListener('input', () => (speedText.textContent = `${speed.value}×`));
  speed.addEventListener('change', async () => {
    try {
      const r = await api.command('fader_quick', { speed: Number(speed.value) });
      say(r.ok ? `speed ${speed.value}×` : `speed: ${r.status} — ${r.detail}`);
    } catch (err) { say(err.message); }
  });
  const node = el(
    'div',
    { class: 'tc-view' },
    section('Fader',
      el('div', { class: 'tc-row' },
        el('label', { class: 'tc-field' }, el('span', {}, 'speed'), speed, speedText),
        commandButton('Run', () => api.command('fader_quick', { running: true }), say),
        commandButton('Stop', () => api.command('fader_quick', { running: false }), say),
      ),
      form(null, [{ name: 'hour', label: 'simulated hour (0–23.99)', type: 'number' }], 'Set the clock', (a) => api.command('clock', a), say),
      form(null, [{ name: 'preset', label: 'event preset' }], 'Load preset', (a) => api.command('fader_preset', a), say),
    ),
    form('Ask for a connection', [
      { name: 'from', label: 'from frame' }, { name: 'from_port', label: 'port', type: 'number' },
      { name: 'to', label: 'to frame' }, { name: 'to_port', label: 'port', type: 'number' },
      { name: 'why', label: 'why' }, { name: 'hold_seconds', label: 'hold s', type: 'number' },
    ], 'Connect', (a) => api.command('connect', a), say),
    section('Live connections', conns.node),
    section('Events', events.node),
  );
  return {
    node,
    update(s) {
      const rows = Object.values(s.connections).sort((a, b) => (b.granted_unix ?? 0) - (a.granted_unix ?? 0));
      conns.set(table([
        ['Who', (c) => c.who], ['From', (c) => `${c.from_frame} ${c.from_port ?? ''}`], ['To', (c) => `${c.to_frame} ${c.to_port ?? ''}`],
        ['Kind', (c) => `${c.kind}${c.hops?.length ? ` · ${c.hops.length} hop${c.hops.length > 1 ? 's' : ''}` : ''}`],
        ['Granted', (c) => ago(c.granted_unix)], ['Why', (c) => c.why], ['Origin', (c) => c.origin],
        ['', (c) => commandButton('Release', () => api.command('release', { connection: c.id }), say)],
      ], rows, 'No live connection (trunk/Connection/…).'));
      const ev = s.events.slice(-60).reverse();
      events.set(table([
        ['When', (e) => ago(e.at)], ['Kind', (e) => e.kind],
        ['What', (e) => el('code', {}, summarise(e))],
      ], ev, 'No event since this OS connected.'));
    },
  };
}

export function summarise({ kind, event: e }) {
  if (!e || typeof e !== 'object') return String(e ?? '');
  if (kind === 'Crosspoint') return `${e.op} ${e.frame} ${e.input}→${e.output} (${e.connection ?? ''})`;
  if (kind === 'Gpio') return `pin ${e.pin} ${e.state ? 'on' : 'off'} ${e.function ?? ''} ${e.from_frame ?? ''}→${e.to_frame ?? ''}`;
  if (kind === 'Label') return `${e.frame} ${e.port} “${e.label?.full ?? ''}”${e.over ? ' (too long)' : ''}`;
  if (kind === 'Relay') return `${e.kind} ${e.device_label}`;
  return JSON.stringify(e).slice(0, 160);
}
