// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, form, commandButton } from '../dom.js';
import { live } from '../view.js';

/**
 * ANALYZER — captures of the caster's traffic: start one with a note
 * (capture_start), stop it (capture_stop), and read every capture on the
 * caster's volume (trunk/View/Captures, the old /api/captures) and any one of
 * them analysed — its summary and its traffic hour by hour
 * (View/Capture/{id}, the old /api/analyze/{id}).
 */
export function create({ api, say }) {
  const last = live();
  const list = live();
  const detail = live();
  let picked = null;
  let store = null;
  const show = (verb) => async (args = {}) => {
    const r = await api.command(verb, args);
    last.set(section(`${verb} — ${r.status}`, el('p', { class: 'hint' }, r.detail ?? '')));
    return r;
  };
  const node = el(
    'div',
    { class: 'tc-view' },
    form('Capture', [{ name: 'note', label: 'note' }], 'Start capture', show('capture_start'), say),
    el('div', { class: 'tc-row' }, commandButton('Stop capture', () => show('capture_stop')(), say)),
    last.node,
    section('Captures', list.node),
    detail.node,
  );
  const pick = (id) => {
    picked = id;
    draw();
  };
  function draw() {
    const v = store?.views ?? {};
    const caps = v.Captures;
    if (!caps || typeof caps !== 'object') {
      list.set(el('p', { class: 'hint' }, 'No capture list on the bus yet (trunk/View/Captures).'));
    } else {
      const rows = (caps.current ? [{ ...caps.current, _current: true }] : []).concat(caps.captures ?? []);
      list.set(table([
        ['Capture', (c) => el('a', { href: '#', onclick: (e) => { e.preventDefault(); pick(c.id); } }, c.id)],
        ['Note', (c) => c.note], ['Started', (c) => `${c.started_at ?? ''} (${c.started_clock ?? ''})`],
        ['Ended', (c) => (c._current ? 'capturing…' : c.ended_at ?? '')], ['Frames', (c) => String(c.frames ?? '')],
      ], rows, 'No capture on the caster.'));
    }
    const c = picked ? v.Capture?.[picked] : null;
    if (!picked) return detail.set(null);
    if (!c) return detail.set(el('p', { class: 'hint' }, `No analysis of ${picked} on the bus (trunk/View/Capture/${picked}).`));
    const sm = c.summary ?? {};
    detail.set(section(`${c.id} — ${c.note || 'no note'}`,
      el('p', {}, [
        `${sm.samples ?? 0} samples over ${Math.round((sm.duration_sim_seconds ?? 0) / 60)} sim min`,
        `${sm.granted ?? 0} granted (${sm.granted_via ?? 0} via), ${sm.denied ?? 0} denied, ${sm.released ?? 0} released`,
        `peak ${sm.peak_live ?? 0} live (avg ${(sm.avg_live ?? 0).toFixed?.(1) ?? sm.avg_live})`,
        `channels ${pct(sm.avg_channel_utilization)} avg / ${pct(sm.max_channel_utilization)} max`,
        sm.crosschecks_failed ? `${sm.crosschecks_failed} crosschecks failed` : null,
        sm.blackout_samples ? `${sm.blackout_samples} blackout samples` : null,
      ].filter(Boolean).join(' · ')),
      table([
        ['Hour', (b) => b.clock], ['Samples', (b) => String(b.samples)], ['Live avg / peak', (b) => `${(b.avg_live ?? 0).toFixed(1)} / ${b.peak_live ?? 0}`],
        ['Granted', (b) => String(b.granted ?? 0)], ['Denied', (b) => String(b.denied ?? 0)], ['Released', (b) => String(b.released ?? 0)],
        ['Channels avg / max', (b) => `${pct(b.avg_channel_utilization)} / ${pct(b.max_channel_utilization)}`], ['Load', (b) => pct(b.avg_load)],
        ['', (b) => (b.blackout ? 'blackout' : '')],
      ], c.buckets?.hour ?? [], 'No hour in this capture.'),
    ));
  }
  last.set(el('p', { class: 'hint' }, 'Start a capture; stop it and it is analysed below.'));
  return { node, update(s) { store = s; draw(); } };
}

const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;
