// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/** Small DOM helpers shared by the Trunk-Caster views. Text is always set as text, never as HTML. */

export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return node;
}

/** A table: columns [[label, (row) => value]], rows; an empty message when there are none. */
export function table(columns, rows, empty = 'Nothing on the bus yet.') {
  if (!rows.length) return el('p', { class: 'hint' }, empty);
  return el(
    'table',
    { class: 'machines trunk' },
    el('thead', {}, el('tr', {}, columns.map(([label]) => el('th', {}, label)))),
    el('tbody', {}, rows.map((r) => el('tr', {}, columns.map(([, cell]) => el('td', {}, cell(r) ?? '—'))))),
  );
}

export const section = (title, ...body) => el('section', { class: 'tc-section' }, el('h2', {}, title), ...body);

/** "3 s ago" from unix seconds or ms. */
export function ago(t, now = Date.now()) {
  if (!t) return '—';
  const ms = t < 1e12 ? t * 1000 : t;
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** A command button: runs `run()` (a promise of a Result envelope) and says the answer in `say`. */
export function commandButton(label, run, say, attrs = {}) {
  return el('button', {
    ...attrs,
    type: 'button',
    onclick: async (ev) => {
      const b = ev.currentTarget;
      b.disabled = true;
      try {
        const r = await run();
        say(r?.ok ? `${label}: ${r.detail || 'done'}` : `${label}: ${r?.status ?? 'no answer'} — ${r?.detail ?? ''}`);
      } catch (err) {
        say(`${label}: ${err.message}`);
      } finally {
        b.disabled = false;
      }
    },
  }, label);
}

/**
 * A small form: fields [{ name, label, type: 'text'|'number'|'checkbox'|'select', options?, placeholder? }].
 * On submit `send(args)` gets only the filled fields, numbers as numbers — the contract refuses
 * an empty string where it wants a value, so an empty field is simply left out.
 */
export function form(title, fields, submitLabel, send, say) {
  const inputs = {};
  const row = fields.map((f) => {
    let input;
    if (f.type === 'select') {
      input = el('select', { name: f.name }, (f.options ?? []).map((o) => el('option', { value: o }, o)));
    } else {
      input = el('input', { name: f.name, type: f.type ?? 'text', placeholder: f.placeholder ?? '', step: f.type === 'number' ? 'any' : null, size: f.size ?? null });
    }
    inputs[f.name] = { input, f };
    return el('label', { class: 'tc-field' }, el('span', {}, f.label ?? f.name), input);
  });
  const node = el(
    'form',
    {
      class: 'tc-form',
      onsubmit: async (ev) => {
        ev.preventDefault();
        const args = {};
        for (const [name, { input, f }] of Object.entries(inputs)) {
          if (f.type === 'checkbox') {
            if (input.checked) args[name] = true;
          } else if (input.value !== '') {
            args[name] = f.type === 'number' ? Number(input.value) : input.value;
          }
        }
        const button = node.querySelector('button');
        button.disabled = true;
        try {
          const r = await send(args);
          say(r?.ok ? `${submitLabel}: ${r.detail || 'done'}` : `${submitLabel}: ${r?.status ?? 'no answer'} — ${r?.detail ?? ''}`);
        } catch (err) {
          say(`${submitLabel}: ${err.message}`);
        } finally {
          button.disabled = false;
        }
      },
    },
    title ? el('strong', {}, title) : null,
    row,
    el('button', { type: 'submit' }, submitLabel),
  );
  return node;
}
