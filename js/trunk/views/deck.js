// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section } from '../dom.js';
import { live, framesOf } from '../view.js';

/**
 * A STREAM DECK — one Trunk-Caster button panel (data/decks/<model>.json,
 * this app's own data since ROAD-3453, from Trunk-Caster's PANELS/ with its schema) as
 * keys on screen. The panel sits on a frame and a user port; each key asks the
 * caster for what it means, over the bus:
 *
 *   talk / listen  target names a port on the same frame → connect from this
 *                  port to that one; momentary keys release on key-up, latch
 *                  keys on the next press
 *   call           target is ICOM:port → connect to the frame named by ICOM
 *                  (its id or site, by slug or slug prefix: PARI → paris-01)
 *                  at that port
 *   reply          connect back to whoever holds a connection to this port
 *   hangup         release every live connection from this port
 *   page, none     drawn, not sent (pages are the next step)
 *
 * A key lights while a live connection (trunk/Connection/…) joins this port to
 * its target, so the light is the caster's word, not the click's.
 *
 * WHERE A TARGET LANDS (ROAD-3453). In PANELS/connect.json a panel sits on a
 * matrix and port, and its keys name ports by the MATRIX's alphas (PNL01,
 * IFB01) — the panel definition never decides what a port is called. A
 * Trunk-Caster port is named by whoever calls through it (the caster's
 * set_port_label: "the port takes the caller's name"), so a target resolves,
 * in order: a port on the chosen frame whose current name is the target;
 * else the port the operator bound it to on that frame (the Bind keys panel —
 * Companion's own per-button configuration, kept in this browser); else the
 * key stays dark and says so. Seeding frames with PNL01-style names would
 * only last until the first caller renamed the port.
 */
export function create({ api, say, param }) {
  const model = String(param || 'streamdeck-mk2');
  const head = live();
  const grid = live('tc-deck');
  const pick = el('select', { class: 'tc-frame-pick' });
  const port = el('input', { type: 'number', min: 0, step: 1, size: 4 });
  const binds = live('tc-binds');
  let deck = null;
  let store = null;
  const node = el(
    'div',
    { class: 'tc-view' },
    head.node,
    el('div', { class: 'tc-row' }, el('label', { class: 'tc-field' }, el('span', {}, 'frame'), pick), el('label', { class: 'tc-field' }, el('span', {}, 'this panel is port'), port)),
    grid.node,
    binds.node,
  );
  fetch(new URL(`../../../data/decks/${encodeURIComponent(model)}.json`, import.meta.url))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${model}: ${r.status}`))))
    .then((d) => {
      deck = d;
      port.value = d.port ?? 0;
      draw();
    })
    .catch((err) => head.set(el('p', { class: 'hint' }, `No panel definition for ${model}: ${err.message}`)));
  pick.addEventListener('change', () => draw());
  port.addEventListener('change', () => draw());

  const held = new Map();   /* key index -> connection id, for momentary keys */

  function draw() {
    if (!deck) return;
    const { rows = 0, cols = 0, key_px = 72 } = deck.device ?? {};
    head.set(section(`${deck.name ?? model} — ${deck.device?.model ?? model}`, el('p', { class: 'hint' }, `${rows} × ${cols} keys${deck.device?.encoders ? ` · ${deck.device.encoders} encoders (not drawn)` : ''}. Its own matrix in the definition is ${deck.matrix ?? '—'}; here it sits on the frame you pick.`)));
    const frame = store?.frames?.[pick.value];
    const keys = Array.from({ length: rows * cols }, (_, i) => deck.buttons.find((b) => b.row === Math.floor(i / cols) && b.col === i % cols) ?? { action: 'none' });
    grid.node.style.gridTemplateColumns = `repeat(${cols}, ${Math.min(key_px, 96)}px)`;
    grid.set(keys.map((b, i) => key(b, i, frame)));
    drawBinds(frame);
  }

  /* The operator's bindings: target alpha -> user port, per deck model and frame. */
  const bindKey = (frame, target) => `tc-deck-bind:${model}:${frame}:${String(target).toLowerCase()}`;
  const readBind = (frame, target) => {
    try { return localStorage.getItem(bindKey(frame, target)); } catch (err) { return null; }
  };
  const writeBind = (frame, target, p) => {
    try { if (p) localStorage.setItem(bindKey(frame, target), p); else localStorage.removeItem(bindKey(frame, target)); } catch (err) { /* private window: the binding lasts this page */ }
  };

  function drawBinds(frame) {
    if (!deck || !frame) return binds.set(null);
    const targets = [...new Set(deck.buttons.filter((b) => b.action === 'talk' || b.action === 'listen').map((b) => String(b.target ?? '')).filter(Boolean))];
    if (!targets.length) return binds.set(null);
    const ports = Array.from({ length: frame.user_ports ?? 0 }, (_, i) => `U${String(i).padStart(2, '0')}`);
    const rows = targets.map((t) => {
      const byName = Object.entries(frame.port_names ?? {}).find(([, n]) => String(n).toLowerCase() === t.toLowerCase());
      const sel = el('select', { disabled: !!byName }, el('option', { value: '' }, byName ? `named on the frame (${byName[0]})` : '— not bound —'),
        ports.map((p) => el('option', { value: p }, `${p}${frame.port_names?.[p] ? ` · ${frame.port_names[p]}` : ''}`)));
      if (!byName) sel.value = readBind(frame.id, t) ?? '';
      sel.addEventListener('change', () => { writeBind(frame.id, t, sel.value); draw(); });
      return el('label', { class: 'tc-field' }, el('span', {}, t), sel);
    });
    binds.set(section('Bind keys', el('p', { class: 'hint' }, `Where each key's target sits on ${frame.id}. A port named exactly like the target wins; otherwise pick its port (kept in this browser).`), el('div', { class: 'tc-row' }, rows)));
  }

  function key(b, i, frame) {
    const target = resolve(b, frame);
    const on = target && store ? Object.values(store.connections).some((c) => joins(c, frame, Number(port.value), target)) : false;
    const colors = b.colors ?? {};
    const k = el('button', {
      type: 'button',
      class: `tc-key${on ? ' on' : ''}`,
      disabled: !frame || b.action === 'none' || b.action === 'page' || (['talk', 'listen', 'call'].includes(b.action) && !target),
      title: `${b.action}${b.target ? ` ${b.target}` : ''}${target ? ` → ${target.frame} U${String(target.port).padStart(2, '0')}` : b.target ? ' (not on this frame)' : ''}`,
      style: `background:${on ? colors.active ?? '' : colors.idle ?? ''}`,
    }, String(b.label ?? '').split('\n').map((t) => el('span', {}, t)));
    const mode = b.mode ?? (b.action === 'talk' ? 'momentary' : 'latch');
    k.addEventListener('pointerdown', () => press(b, i, frame, target, mode, on));
    if (mode === 'momentary') k.addEventListener('pointerup', () => releaseHeld(i));
    return k;
  }

  function resolve(b, frame) {
    if (!frame) return null;
    if (b.action === 'talk' || b.action === 'listen') {
      const t = String(b.target ?? '');
      const hit = Object.entries(frame.port_names ?? {}).find(([, n]) => String(n).toLowerCase() === t.toLowerCase());
      const p = hit ? hit[0] : readBind(frame.id, t);
      return p && /^U\d+$/.test(p) ? { frame: frame.id, port: Number(p.slice(1)) } : null;
    }
    if (b.action === 'call') {
      const [icom, p] = String(b.target ?? '').split(':');
      const f = callFrame(framesOf(store), icom);
      return f ? { frame: f.id, port: Number(p) || 0 } : null;
    }
    return null;
  }

  async function press(b, i, frame, target, mode, on) {
    const me = Number(port.value);
    try {
      if (b.action === 'hangup') {
        const mine = Object.values(store.connections).filter((c) => c.from_frame === frame.id && Number(c.from_port) === me);
        for (const c of mine) await api.command('release', { connection: c.id });
        return say(`hung up ${mine.length} connection${mine.length === 1 ? '' : 's'}`);
      }
      if (b.action === 'reply') {
        const caller = Object.values(store.connections).find((c) => c.to_frame === frame.id && Number(c.to_port) === me);
        if (!caller) return say('nobody is calling this port');
        return report(await api.command('connect', { from: frame.id, from_port: me, to: caller.from_frame, to_port: Number(caller.from_port) || 0, why: `${deck.name ?? model} reply` }));
      }
      if (!target) return;
      if (mode === 'latch' && on) {
        const c = Object.values(store.connections).find((x) => joins(x, frame, me, target));
        return report(await api.command('release', { connection: c.id }));
      }
      const r = await api.command('connect', { from: frame.id, from_port: me, to: target.frame, to_port: target.port, why: `${deck.name ?? model} ${b.action} ${b.label ?? ''}`.trim() });
      report(r);
      const id = connectionOf(r);
      if (mode === 'momentary' && id) held.set(i, id);
    } catch (err) {
      say(err.message);
    }
  }

  async function releaseHeld(i) {
    const id = held.get(i);
    if (!id) return;
    held.delete(i);
    try { report(await api.command('release', { connection: id })); } catch (err) { say(err.message); }
  }

  const report = (r) => say(r?.ok ? r.detail || r.result?.status || 'done' : `${r?.status ?? 'no answer'} — ${r?.detail ?? r?.result?.reason ?? ''}`);

  return {
    node,
    update(s) {
      store = s;
      const frames = framesOf(s);
      const had = pick.value;
      pick.replaceChildren(...frames.map((f) => el('option', { value: f.id }, `${f.id} · ${f.protocol_name ?? f.protocol}`)));
      if (frames.some((f) => f.id === had)) pick.value = had;
      if (!frames.length) pick.append(el('option', { value: '' }, 'no frame on the bus'));
      draw();
    },
  };
}

/** The frame an ICOM alpha names: an exact id or site slug first, then the
 *  first frame whose id or site starts with it (PARI → paris-01). */
export function callFrame(frames, icom) {
  const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const slug = norm(icom);
  if (!slug) return null;
  const site = (x) => norm(x.site);
  return frames.find((x) => x.id.toLowerCase() === slug || site(x) === slug)
    ?? frames.find((x) => x.id.toLowerCase().startsWith(`${slug}-`))
    ?? frames.find((x) => x.id.toLowerCase().startsWith(slug) || site(x).startsWith(slug))
    ?? null;
}

/** Does connection c join (frame, port) to target? */
export function joins(c, frame, port, target) {
  return c.from_frame === frame?.id && Number(c.from_port) === port && c.to_frame === target.frame && Number(c.to_port) === target.port;
}

/** The connection id a connect result carries: Reply.connection is the Connection or its id. */
export function connectionOf(r) {
  const c = r?.result?.connection;
  return typeof c === 'string' ? c : c?.id ?? null;
}
