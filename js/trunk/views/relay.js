// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, form, ago, commandButton } from '../dom.js';
import { live } from '../view.js';

/**
 * THE RELAY — the local sound-card relay as frames: which device sits on which
 * matrix port (trunk/Relay/{matrix}/{port}, RelayBinding) and what the relay
 * has reported (trunk/Event/Relay). Bind, unbind and report through the caster
 * (relay_bind, relay_unbind, relay_event).
 */
export function create({ api, say }) {
  const bindings = live();
  const events = live();
  const node = el(
    'div',
    { class: 'tc-view' },
    section('Bindings', bindings.node),
    form('Bind a device to a matrix port', [
      { name: 'matrix', label: 'matrix' }, { name: 'port', label: 'port', type: 'number' },
      { name: 'device_id', label: 'device id' }, { name: 'device_label', label: 'label' }, { name: 'kind', label: 'kind', placeholder: 'mic, speaker…' },
    ], 'Bind', (a) => api.command('relay_bind', a), say),
    form('Report a relay event', [
      { name: 'kind', label: 'kind' }, { name: 'device_label', label: 'device' }, { name: 'matrix', label: 'matrix' }, { name: 'port', label: 'port', type: 'number' },
      { name: 'peak_dbfs', label: 'peak dBFS', type: 'number' }, { name: 'threshold_dbfs', label: 'threshold dBFS', type: 'number' }, { name: 'note', label: 'note' },
    ], 'Report', (a) => api.command('relay_event', a), say),
    section('Recent relay events', events.node),
  );
  return {
    node,
    update(s) {
      const rows = Object.values(s.relay).sort((a, b) => `${a.matrix}/${a.port}`.localeCompare(`${b.matrix}/${b.port}`, undefined, { numeric: true }));
      bindings.set(table([
        ['Matrix', (r) => r.matrix], ['Port', (r) => String(r.port)], ['Device', (r) => r.device_label], ['Id', (r) => el('code', {}, r.device_id)], ['Kind', (r) => r.kind],
        ['', (r) => commandButton('Unbind', () => api.command('relay_unbind', { matrix: r.matrix, port: r.port }), say)],
      ], rows, 'No device is bound (trunk/Relay/…).'));
      const ev = s.events.filter((e) => e.kind === 'Relay').slice(-50).reverse();
      events.set(table([
        ['When', (e) => ago(e.at)], ['Kind', (e) => e.event?.kind], ['Device', (e) => e.event?.device_label],
        ['Where', (e) => (e.event?.matrix ? `${e.event.matrix}/${e.event.port ?? ''}` : '—')],
        ['Peak / threshold', (e) => (e.event?.peak_dbfs !== undefined ? `${e.event.peak_dbfs} / ${e.event.threshold_dbfs ?? '—'} dBFS` : '—')], ['Note', (e) => e.event?.note],
      ], ev, 'No relay event since this OS connected.'));
    },
  };
}
