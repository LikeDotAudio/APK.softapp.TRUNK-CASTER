// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table, ago } from '../dom.js';
import { live } from '../view.js';

/**
 * ONE PROTOCOL'S FRAME SIMULATOR — what PLUGIN.TRUNK_SIM says each of this
 * protocol's frames holds (trunk_sim/{protocol}/Frame/{frame}/state, SimFrame)
 * beside what the caster believes (trunk/Crosspoint/{frame}), and how the
 * double validation is going: lines applied (`…/ack`) and refused (`…/reject`,
 * with the last reason). A frame whose sim and caster disagree is marked —
 * the caster resends on a persistent mismatch, so a mark that stays is news.
 */
export function create({ param }) {
  const protocol = String(param ?? '');
  const head = live();
  const frames = live();
  const node = el('div', { class: 'tc-view' }, head.node, section('Frames', frames.node));
  return {
    node,
    update(s) {
      const sims = s.sims[protocol] ?? {};
      const wire = s.simWire[protocol] ?? {};
      const casterFrames = Object.values(s.frames).filter((f) => f.protocol === protocol);
      const ids = [...new Set([...Object.keys(sims), ...casterFrames.map((f) => f.id)])].sort();
      const name = casterFrames[0]?.protocol_name ?? protocol;
      const word = typeof s.sim.state === 'string' ? s.sim.state : s.sim.state?.state ?? 'unheard';
      head.set(el('p', { class: 'hint' }, `${name}: ${Object.keys(sims).length} simulated frames reporting, ${casterFrames.length} frames the caster advertises. Simulator plugin: ${word}.`));
      frames.set(table([
        ['Frame', (id) => id],
        ['Sim closed', (id) => (sims[id] ? String(sims[id].closed?.length ?? 0) : '—')],
        ['Caster closed', (id) => String(s.crosspoints[id]?.closed?.length ?? 0)],
        ['Agree', (id) => (sims[id] ? (agree(sims[id], s.crosspoints[id]) ? 'yes' : el('b', { class: 'hot' }, 'no')) : '—')],
        ['Applied / rejected', (id) => (sims[id] ? `${sims[id].applied ?? 0} / ${sims[id].rejects ?? 0}` : '—')],
        ['Acks · rejects heard', (id) => (wire[id] ? `${wire[id].acks} · ${wire[id].rejects}` : '—')],
        ['Last reject', (id) => (wire[id]?.lastReject ? el('code', {}, Array.isArray(wire[id].lastReject) ? wire[id].lastReject[0] : String(wire[id].lastReject)) : '—')],
        ['Checked in', (id) => ago(Date.parse(sims[id]?.checked_in_at ?? '') || 0)],
      ], ids, `No ${name} frame is on the bus: is Plugin-TRUNK_SIM running with this protocol?`));
    },
  };
}

/** Do the sim's closed crosspoints match the caster's for one frame (as sets of input→output)? */
export function agree(sim, caster) {
  const key = (x) => `${x.input}>${x.output}`;
  const a = new Set((sim?.closed ?? []).map(key));
  const b = new Set((caster?.closed ?? []).map(key));
  return a.size === b.size && [...a].every((k) => b.has(k));
}
