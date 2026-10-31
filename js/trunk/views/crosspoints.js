// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, ago, commandButton } from '../dom.js';
import { live } from '../view.js';
import * as C from '../../../vendor/apk-contracts/apk-contracts.mjs';

/**
 * CROSS POINTS — every frame's closed crosspoints as the caster holds them
 * (trunk/Crosspoint/{frame}, written whole on each change), the Ward-Beck line
 * each one is (rendered through the contract's renderWardBeckLine), and the
 * crosspoint events as they happen. Reset clears them all (crosspoint_reset)
 * after you say so.
 */
export function create({ api, say }) {
  const frames = live();
  const recent = live();
  const node = el(
    'div',
    { class: 'tc-view' },
    el('div', { class: 'tc-row' },
      commandButton('Reset every crosspoint', () => (confirm('Open every crosspoint on every frame?') ? api.command('crosspoint_reset', {}) : Promise.resolve({ ok: false, status: 'cancelled', detail: '' })), say)),
    section('Closed crosspoints by frame', frames.node),
    section('Recent crosspoint events', recent.node),
  );
  return {
    node,
    update(s) {
      const docs = Object.values(s.crosspoints).filter((d) => d.closed?.length).sort((a, b) => String(a.frame).localeCompare(String(b.frame)));
      const rows = docs.flatMap((d) => d.closed.map((x) => ({ ...x, frame: d.frame, at: d.at, seq: d.seq })));
      frames.set(
        el('p', { class: 'hint' }, `${rows.length} closed on ${docs.length} frames.`),
        table([
          ['Frame', (r) => r.frame], ['Input', (r) => r.input], ['Output', (r) => r.output], ['Connection', (r) => el('code', {}, r.connection ?? '')],
          ['Ward-Beck', (r) => el('code', {}, wardBeck(s, r))], ['Since', (r) => ago(Date.parse(r.at) || 0)],
        ], rows, 'No closed crosspoint (trunk/Crosspoint/…).'),
      );
      recent.set(table([
        ['When', (e) => ago(e.at)], ['Op', (e) => e.event?.op], ['Frame', (e) => e.event?.frame], ['In → out', (e) => `${e.event?.input} → ${e.event?.output}`], ['Connection', (e) => e.event?.connection],
      ], s.events.filter((e) => e.kind === 'Crosspoint').slice(-40).reverse(), 'No crosspoint event since this OS connected.'));
    },
  };
}

/** The local Ward-Beck line for one closed crosspoint, rendered by the contract. */
export function wardBeck(s, r) {
  const f = s.frames[r.frame];
  const site = f?.site ?? '';
  const name = (port) => f?.port_names?.[port] ?? port;
  const line = { site, frame: r.frame, input: r.input, input_name: name(r.input), switch: 'CLOSE', output_name: name(r.output), output: r.output, out_frame: r.frame, out_site: site };
  return C.renderWardBeckLine(line);
}
