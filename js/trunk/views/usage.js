// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, form, commandButton } from '../dom.js';
import { live, framesOf } from '../view.js';

/**
 * USAGE — how much of the trunking is in use: each trunk's channels against
 * its capacity (trunk/Trunk/… with its connections), live connections per
 * protocol (by the frame they start on), and the booking timeline
 * (trunk/Booking/…) with book and cancel (book, cancel_booking).
 */
export function create({ api, say }) {
  const trunks = live();
  const protocols = live();
  const bookings = live();
  const node = el(
    'div',
    { class: 'tc-view' },
    section('Trunks', trunks.node),
    section('Live connections per protocol', protocols.node),
    section('Bookings', bookings.node),
    form('Book a port', [
      { name: 'frame', label: 'frame' }, { name: 'port', label: 'port', type: 'number' }, { name: 'program', label: 'program' },
      { name: 'start_hour', label: 'start hour', type: 'number' }, { name: 'minutes', label: 'minutes', type: 'number' },
      { name: 'kind', label: 'kind', type: 'select', options: ['panel', 'input'] }, { name: 'to', label: 'to frame' }, { name: 'daily', label: 'daily', type: 'checkbox' },
    ], 'Book', (a) => api.command('book', a), say),
  );
  return {
    node,
    update(s) {
      const ts = Object.values(s.trunks).sort((a, b) => (b.connections?.length ?? 0) - (a.connections?.length ?? 0));
      trunks.set(table([
        ['Trunk', (t) => t.id], ['A', (t) => `${t.a_frame} C${t.a_caster ?? ''}`], ['B', (t) => `${t.b_frame} C${t.b_caster ?? ''}`],
        ['In use', (t) => meter(t.connections?.length ?? 0, t.capacity ?? 0)], ['Gain A / B', (t) => `${t.gain_a_db ?? 0} / ${t.gain_b_db ?? 0} dB`],
      ], ts, 'No trunk is up (trunk/Trunk/…).'));
      const frames = s.frames;
      const per = {};
      for (const c of Object.values(s.connections)) {
        const p = frames[c.from_frame]?.protocol_name ?? frames[c.from_frame]?.protocol ?? '(unknown frame)';
        per[p] = (per[p] ?? 0) + 1;
      }
      const totals = {};
      for (const f of framesOf(s)) totals[f.protocol_name ?? f.protocol] = (totals[f.protocol_name ?? f.protocol] ?? 0) + 1;
      protocols.set(table([
        ['Protocol', (r) => r[0]], ['Frames', (r) => String(totals[r[0]] ?? 0)], ['Live connections', (r) => String(r[1])],
      ], Object.entries(per).sort((a, b) => b[1] - a[1]), 'No live connection.'));
      const bs = Object.values(s.bookings).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
      bookings.set(table([
        ['Program', (b) => b.program], ['Frame / port', (b) => `${b.frame} ${b.port}`], ['Kind', (b) => b.kind], ['Who', (b) => b.who],
        ['Start → end (sim s)', (b) => `${b.start} → ${b.end}`], ['Daily', (b) => (b.daily ? 'yes' : '')], ['Status', (b) => b.status], ['Reason', (b) => b.reason],
        ['', (b) => (b.status === 'booked' ? commandButton('Cancel', () => api.command('cancel_booking', { booking: b.id }), say) : '')],
      ], bs, 'No booking (trunk/Booking/…).'));
    },
  };
}

/** A small bar: used of capacity. */
export function meter(used, capacity) {
  const pct = capacity ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
  const cls = pct >= 100 ? 'meter bad' : pct >= 75 ? 'meter warn' : 'meter';
  return el('span', {}, el('span', { class: cls }, el('i', { style: `width:${pct}%` })), `${used}/${capacity}`);
}
