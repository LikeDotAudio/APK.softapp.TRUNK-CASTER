// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { trunkApi, casterWord, createStandaloneTrunkApi } from './bus.js';
import { el } from './dom.js';

/** The caster's own word is from the bus: escaped before it goes into the status line. */
const escText = (s) => (globalThis.APKSoftapp?.esc ?? ((t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])))(s);

/**
 * One Trunk-Caster view mounted into `root`. `create(ctx)` builds it once and
 * returns `{ node, update(store), stop?() }`; `update` runs again (at most four
 * times a second) whenever the bus says something, so the forms a view holds
 * keep what is typed in them. `ctx` carries the API, `say(text)` and the
 * route's parameter.
 */
export function mountView(root, create, { say, param, status } = {}) {
  root.replaceChildren();
  let api = trunkApi();
  let isStandalone = false;
  if (api.missing) {
    // When opened outside the shell, use standalone bus so all views work cleanly
    api = createStandaloneTrunkApi();
    isStandalone = true;
    const pill = typeof document !== 'undefined' ? document.getElementById('standalone-pill') : null;
    if (pill) pill.hidden = false;
  }
  const ctx = { api, say: say ?? (() => {}), param };
  const view = create(ctx);
  root.append(view.node);
  let queued = false;
  let stopped = false;
  const draw = () => {
    queued = false;
    if (stopped) return;
    const store = api.snapshot();
    if (status) {
      const modeLabel = isStandalone ? '<span style="opacity:0.85;color:var(--apk-accent,#ffa600);margin-right:6px;">[Standalone Bus]</span>' : '';
      status.innerHTML = `${modeLabel}caster: ${escText(casterWord(store))} · ${Object.keys(store.frames || {}).length} frames · ${Object.keys(store.connections || {}).length} connections`;
    }
    view.update(store);
  };
  const unwatch = api.watch(() => {
    if (queued) return;
    queued = true;
    setTimeout(draw, 250);
  });
  draw();
  return () => {
    stopped = true;
    unwatch();
    view.stop?.();
  };
}

/** The frames of a store as a sorted list. */
export const framesOf = (store) => Object.values(store.frames).sort((a, b) => String(a.id).localeCompare(String(b.id)));

/** A frame's site-ish name for grouping: its site, else the slug before its number. */
export const siteOf = (f) => f.site || String(f.id).replace(/-\d+$/, '');

/** A view's live part: a box whose children are replaced on every update. */
export function live(className = 'tc-live') {
  const node = el('div', { class: className });
  return { node, set: (...kids) => node.replaceChildren(...kids.flat().filter(Boolean)) };
}
