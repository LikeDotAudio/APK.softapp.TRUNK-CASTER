// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, form, commandButton } from '../dom.js';
import { live, framesOf } from '../view.js';

/**
 * USAGE — how much of the trunking is in use: each trunk's channels against
 * its capacity (trunk/Trunk/… with its connections), live connections per
 * protocol (by the frame they start on), and the booking timeline
 * (trunk/Booking/…) with book and cancel (book, cancel_booking). The caster's
 * own views add the voice bandwidth per protocol and per trunk
 * (trunk/View/Bandwidth, the old /api/bandwidth) and each production's
 * counters (View/Productions).
 */
export function create({ api, say }) {
  const trunks = live();
  const protocols = live();
  const bookings = live();
  const bandwidth = live();
  const productions = live();
  const node = el(
    'div',
    { class: 'tc-view' },
    section('Trunks', trunks.node),
    section('Live connections per protocol', protocols.node),
    section('Voice bandwidth', bandwidth.node),
    section('Productions', productions.node),
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
      const bw = s.views?.Bandwidth;
      bandwidth.set(bw && typeof bw === 'object'
        ? [
          el('p', {}, `${kbps(bw.kbps)} heard · ${kbps(bw.carried_kbps)} carried · ${bw.talking ?? 0} talking · over ${bw.window_s ?? '?'} s`),
          table([['Protocol', (r) => r.protocol], ['Talking', (r) => String(r.talking ?? 0)], ['kbit/s', (r) => kbps(r.kbps)]],
            (bw.by_protocol ?? []).slice().sort((a, b) => (b.kbps ?? 0) - (a.kbps ?? 0)), 'Nobody is talking.'),
          table([['Trunk', (r) => r.trunk], ['A → B', (r) => `${r.a_frame} → ${r.b_frame}`], ['Calls', (r) => meter(r.calls ?? 0, r.capacity ?? 0)], ['kbit/s', (r) => kbps(r.kbps)], ['per channel', (r) => kbps(r.kbps_per_channel)]],
            (bw.trunks ?? []).slice().sort((a, b) => (b.kbps ?? 0) - (a.kbps ?? 0)).slice(0, 40), 'No trunk carries a voice.'),
        ]
        : el('p', { class: 'hint' }, 'No bandwidth on the bus yet (trunk/View/Bandwidth).'));
      const pr = s.views?.Productions;
      productions.set(pr && typeof pr === 'object'
        ? table([
          ['Production', (r) => r[0]], ['Studio', (r) => r[1].studio], ['On air', (r) => (r[1].on_air ? 'yes' : '')],
          ['Offered', (r) => String(r[1].offered ?? 0)], ['Answered', (r) => String(r[1].answered ?? 0)], ['Busy', (r) => String(r[1].busy ?? 0)],
          ['Live', (r) => String(r[1].live ?? 0)], ['Trunks', (r) => `${r[1].trunks_used ?? 0}/${r[1].trunks ?? 0}`],
        ], Object.entries(pr), 'No production in the fader.')
        : el('p', { class: 'hint' }, 'No productions on the bus yet (trunk/View/Productions).'));
      const bs = Object.values(s.bookings).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
      bookings.set(table([
        ['Program', (b) => b.program], ['Frame / port', (b) => `${b.frame} ${b.port}`], ['Kind', (b) => b.kind], ['Who', (b) => b.who],
        ['Start → end (sim s)', (b) => `${b.start} → ${b.end}`], ['Daily', (b) => (b.daily ? 'yes' : '')], ['Status', (b) => b.status], ['Reason', (b) => b.reason],
        ['', (b) => (b.status === 'booked' ? commandButton('Cancel', () => api.command('cancel_booking', { booking: b.id }), say) : '')],
      ], bs, 'No booking (trunk/Booking/…).'));
    },
  };
}

/** kbit/s, one decimal. */
export const kbps = (v) => `${(Number(v) || 0).toFixed(1)} kbit/s`;

/** A small bar: used of capacity. */
export function meter(used, capacity) {
  const pct = capacity ? Math.min(100, Math.round((used / capacity) * 100)) : 0;
  const cls = pct >= 100 ? 'meter bad' : pct >= 75 ? 'meter warn' : 'meter';
  return el('span', {}, el('span', { class: cls }, el('i', { style: `width:${pct}%` })), `${used}/${capacity}`);
}
