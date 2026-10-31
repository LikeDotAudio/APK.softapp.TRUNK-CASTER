// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, form } from '../dom.js';
import { framesOf, siteOf } from '../view.js';
import { vlist } from '../virtual.js';

/**
 * RACKS — the frames as they would sit in racks, one rack per site: each frame
 * a unit with its user ports (named and labelled from Frame.port_names /
 * port_labels, lit while someone is on them, Frame.live_ports) and its casters.
 * Rename a port (rename) — the caster cuts the 6/8/16-character panel labels.
 * The racks are one windowed list (virtual.js): a site's heading, then its
 * units, and only those in sight are drawn.
 */
export function create({ api, say }) {
  const none = el('p', { class: 'hint' }, 'No frame is on the bus (trunk/Frame/…).');
  const racks = vlist((it) => (it.site !== undefined ? el('h2', { class: 'tc-rack-site' }, `${it.site} — ${it.count} frames`) : unit(it.frame)), (it) => it.key, 'tc-racks');
  const node = el(
    'div',
    { class: 'tc-view' },
    form('Rename a port', [
      { name: 'frame', label: 'frame' }, { name: 'port', label: 'port', type: 'number' }, { name: 'name', label: 'name' },
      { name: 'l6', label: '6-char', size: 6 }, { name: 'l8', label: '8-char', size: 8 }, { name: 'l16', label: '16-char', size: 16 },
    ], 'Rename', (a) => api.command('rename', a), say),
    none,
    racks.node,
  );
  return {
    node,
    update(s) {
      const by = {};
      for (const f of framesOf(s)) (by[siteOf(f)] ??= []).push(f);
      const keys = Object.keys(by).sort();
      none.hidden = keys.length > 0;
      racks.node.hidden = !keys.length;
      racks.set(rackItems(keys, by));
    },
  };
}

function unit(f) {
  const ports = Array.from({ length: f.user_ports ?? 0 }, (_, i) => `U${String(i).padStart(2, '0')}`);
  return el(
    'div',
    { class: 'tc-unit', title: `${f.protocol_name ?? f.protocol} · ${f.family ?? ''}` },
    el('div', { class: 'tc-unit-head' }, el('b', {}, f.id), ` ${f.protocol_name ?? f.protocol}`, f.badge?.emoji ? ` ${f.badge.emoji}` : ''),
    el('div', { class: 'tc-ports' }, ports.map((p) => {
      const who = f.live_ports?.[p];
      const label = f.port_labels?.[p]?.l6 ?? f.port_names?.[p] ?? '';
      return el('span', { class: `tc-port${who ? ' on' : ''}`, title: `${p}${f.port_names?.[p] ? ` · ${f.port_names[p]}` : ''}${who ? ` · ${who}` : ''}` }, label || p.slice(1));
    })),
    el('div', { class: 'tc-casters' }, (f.caster_status ?? []).map((c) => el('i', { class: c.state === 'trunked' ? 'on' : '', title: c.state === 'trunked' ? `C${c.index} → ${c.peer_frame}` : `C${c.index} free` }))),
  );
}

/** The racks as one list: each site's heading, then its frames, in order. */
export function rackItems(sites, by) {
  return sites.flatMap((site) => [{ key: `site:${site}`, site, count: by[site].length }, ...by[site].map((frame) => ({ key: `frame:${frame.id}:${frame.user_ports ?? 0}`, frame }))]);
}
