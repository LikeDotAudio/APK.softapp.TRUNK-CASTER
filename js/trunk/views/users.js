// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, form, ago } from '../dom.js';
import { live } from '../view.js';

/**
 * USERS — the people: who holds which live connections (Connection.who), who
 * has booked what (Booking.who), and who asked whom, newest first. The
 * caster's phone book (trunk/View/PhoneBook, the old /api/phonebook) says who
 * is reachable and where. Look for a panel by asking the caster to seek one
 * (panel_seek).
 */
export function create({ api, say }) {
  const people = live();
  const asked = live();
  const book = live();
  const node = el(
    'div',
    { class: 'tc-view' },
    section('People', people.node),
    section('Phone book', book.node),
    form('Look for a panel', [
      { name: 'from', label: 'from frame' }, { name: 'panel_frame', label: 'panel frame' }, { name: 'panel_port', label: 'panel port', type: 'number' }, { name: 'why', label: 'why' },
    ], 'Seek', (a) => api.command('panel_seek', a), say),
    section('Who asked whom', asked.node),
  );
  return {
    node,
    update(s) {
      const by = {};
      for (const c of Object.values(s.connections)) (by[c.who || '(nobody)'] ??= { who: c.who || '(nobody)', live: 0, booked: 0, last: 0 }).live += 1;
      for (const c of Object.values(s.connections)) by[c.who || '(nobody)'].last = Math.max(by[c.who || '(nobody)'].last, c.granted_unix ?? 0);
      for (const b of Object.values(s.bookings)) (by[b.who || '(nobody)'] ??= { who: b.who || '(nobody)', live: 0, booked: 0, last: 0 }).booked += 1;
      people.set(table([
        ['Who', (p) => p.who], ['Live connections', (p) => String(p.live)], ['Bookings', (p) => String(p.booked)], ['Last granted', (p) => ago(p.last)],
      ], Object.values(by).sort((a, b) => b.live - a.live || b.booked - a.booked), 'Nobody holds a connection or a booking.'));
      const pb = Array.isArray(s.views?.PhoneBook) ? s.views.PhoneBook : null;
      book.set(pb
        ? table([
          ['Who', (e) => el('span', {}, e.badge?.emoji ? `${e.badge.emoji} ` : '', e.who)], ['Panel label', (e) => el('code', {}, e.label?.l8 ?? e.label?.full ?? '')],
          ['Panels', (e) => (e.panels ?? []).join(', ')], ['Sites', (e) => (e.sites ?? []).join(', ')],
          ['Calls', (e) => String(e.calls ?? 0)], ['Live now', (e) => String(e.live_now ?? 0)], ['Last called', (e) => e.last_called ?? ''],
        ], pb.slice().sort((a, b) => (b.live_now ?? 0) - (a.live_now ?? 0) || (b.calls ?? 0) - (a.calls ?? 0)), 'The phone book is empty.')
        : el('p', { class: 'hint' }, 'No phone book on the bus yet (trunk/View/PhoneBook).'));
      asked.set(table([
        ['Who', (c) => c.who], ['From', (c) => `${c.from_frame} ${c.from_port ?? ''}`], ['To', (c) => `${c.to_frame} ${c.to_port ?? ''}`], ['Why', (c) => c.why], ['Where', (c) => c.where], ['Granted', (c) => ago(c.granted_unix)],
      ], Object.values(s.connections).sort((a, b) => (b.granted_unix ?? 0) - (a.granted_unix ?? 0))));
    },
  };
}
