// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, form, commandButton } from '../dom.js';
import { live } from '../view.js';

/**
 * ANALYZER — captures of the caster's traffic: start one with a note
 * (capture_start), stop it (capture_stop) and read what the caster answers —
 * the Capture without its samples, as the Result envelope's `result`.
 */
export function create({ api, say }) {
  const last = live();
  const show = (verb) => async (args = {}) => {
    const r = await api.command(verb, args);
    last.set(section(`${verb} — ${r.status}`, el('p', { class: 'hint' }, r.detail ?? ''), r.result ? el('pre', { class: 'tc-pre' }, JSON.stringify(r.result, null, 2)) : null));
    return r;
  };
  const node = el(
    'div',
    { class: 'tc-view' },
    form('Capture', [{ name: 'note', label: 'note' }], 'Start capture', show('capture_start'), say),
    el('div', { class: 'tc-row' }, commandButton('Stop capture', () => show('capture_stop')(), say)),
    last.node,
  );
  last.set(el('p', { class: 'hint' }, 'Start a capture; the caster answers with what it captured when you stop it.'));
  return { node, update() {} };
}
