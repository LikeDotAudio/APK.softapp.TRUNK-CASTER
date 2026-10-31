// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table } from '../dom.js';
import { live, framesOf, siteOf } from '../view.js';
import { meter } from './usage.js';

/**
 * SPACE — the frames as capacity: per site, how many frames, user ports and
 * casters it has, and per frame which casters are free and which are trunked
 * (Frame.caster_status), so where the room is to trunk next is one glance.
 */
export function create() {
  const sites = live();
  const frames = live();
  const node = el('div', { class: 'tc-view' }, section('Sites', sites.node), section('Frames in space', frames.node));
  return {
    node,
    update(s) {
      const all = framesOf(s);
      const by = {};
      for (const f of all) {
        const k = siteOf(f);
        const x = (by[k] ??= { site: k, frames: 0, ports: 0, casters: 0, free: 0 });
        x.frames += 1; x.ports += f.user_ports ?? 0; x.casters += f.casters ?? 0; x.free += f.free_casters ?? 0;
      }
      sites.set(table([
        ['Site', (x) => x.site], ['Frames', (x) => String(x.frames)], ['User ports', (x) => String(x.ports)],
        ['Casters trunked', (x) => meter(x.casters - x.free, x.casters)],
      ], Object.values(by).sort((a, b) => b.frames - a.frames), 'No frame is on the bus (trunk/Device/Frame/…).'));
      frames.set(table([
        ['Frame', (f) => f.id], ['Protocol', (f) => f.protocol_name ?? f.protocol], ['Site', (f) => siteOf(f)],
        ['Casters', (f) => el('span', { class: 'tc-casters' }, (f.caster_status ?? []).map((c) => el('i', { class: c.state === 'trunked' ? 'on' : '', title: c.state === 'trunked' ? `C${c.index} → ${c.peer_frame} (${c.trunk})` : `C${c.index} free` })))],
        ['Free', (f) => String(f.free_casters ?? '—')], ['Live ports', (f) => String(Object.keys(f.live_ports ?? {}).length)],
      ], all));
    },
  };
}
