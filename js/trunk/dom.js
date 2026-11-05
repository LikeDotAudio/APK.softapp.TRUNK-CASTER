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

/**
 * A command that did not go through, said as what happened / why / do this
 * (APKSoftapp.showProblem) with a Retry, else as a line in `say` when the SDK is
 * not on the page (the tests). A thrown error is explained; an answer that is not
 * ok is the caster refusing it (control_rejected). A cancel is the person's own
 * choice and only said.
 */
export function failed(subject, what, { say = () => {}, retry } = {}) {
  const sdk = globalThis.APKSoftapp;
  const thrown = what instanceof Error || typeof what === 'string';
  const line = thrown ? `${subject}: ${what?.message ?? what}` : `${subject}: ${what?.status ?? 'no answer'} — ${what?.detail ?? what?.result?.reason ?? ''}`;
  if (!thrown && what?.status === 'cancelled') return say(line);
  if (!sdk?.showProblem) return say(line);
  say(line);
  const opts = { subject, onRetry: retry };
  if (thrown) return sdk.showProblem(what, opts);
  if (!what) return sdk.showProblem('control_unconfirmed', { ...opts, fix: ['Check the caster is up: the status line at the top right says "caster: …" from its own word.'] });
  return sdk.showProblem('control_rejected', {
    ...opts,
    detail: `${what.status ?? 'refused'}${what.detail || what.result?.reason ? ` — ${what.detail ?? what.result.reason}` : ''}`,
    fix: ['Read the reason above: the caster says why it refused (a busy port, an unknown frame, a value out of range).', 'Change the fields it names and send again.'],
  });
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
        if (r?.ok) say(`${label}: ${r.detail || 'done'}`);
        else failed(label, r, { say, retry: () => b.click() });
      } catch (err) {
        failed(label, err, { say, retry: () => b.click() });
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
          if (r?.ok) say(`${submitLabel}: ${r.detail || 'done'}`);
          else failed(submitLabel, r, { say, retry: () => node.requestSubmit() });
        } catch (err) {
          failed(submitLabel, err, { say, retry: () => node.requestSubmit() });
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
