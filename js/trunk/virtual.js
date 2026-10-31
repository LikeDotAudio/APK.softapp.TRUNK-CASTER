// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el } from './dom.js';

/**
 * WINDOWED LISTS (ROAD-3466). A running fader keeps thousands of connections,
 * trunks and crosspoints in the store and asks every view to draw four times a
 * second; drawing every row built up to ~390,000 elements per window and the
 * shell fell to 4-14 fps. These draw only the rows in sight (plus a few either
 * side) inside a scrolling box, with spacers standing in for the rest, so a
 * window costs the same with 50 rows or 50,000.
 *
 * The box takes focus (tab to it; the arrows and Page Up/Down scroll it), the
 * rows are ordinary rows (select and copy their text, press their buttons),
 * and every update redraws what is in sight from the new rows. Browser find
 * only sees the rows in sight.
 */

/** Rows drawn beyond the visible ones on each side, so a fast scroll does not show a gap. */
export const OVERSCAN = 8;

/** Rows drawn before the box has a height (it is hidden, or not laid out yet). */
export const BLIND_ROWS = 40;

/**
 * The slice of `count` fixed-height rows to draw: { first, last } (last exclusive),
 * from where the box is scrolled to (`top`, below any header) and how tall it is.
 */
export function windowOf(count, rowHeight, top, height, overscan = OVERSCAN) {
  if (count <= 0) return { first: 0, last: 0 };
  const rh = rowHeight > 0 ? rowHeight : 24;
  if (!(height > 0)) return { first: 0, last: Math.min(count, BLIND_ROWS) };
  const first = Math.max(0, Math.min(count - 1, Math.floor(Math.max(0, top) / rh) - overscan));
  const last = Math.min(count, Math.ceil((Math.max(0, top) + height) / rh) + overscan);
  return { first, last: Math.max(first + 1, last) };
}

/**
 * The slice of variable-height items to draw: heights[i] is item i's measured
 * height or undefined (then `guess`). Returns { first, last, before, after }:
 * the pixels the spacers above and below stand in for.
 */
export function spanOf(heights, count, guess, top, height, overscan = OVERSCAN) {
  if (count <= 0) return { first: 0, last: 0, before: 0, after: 0 };
  const h = (i) => heights[i] ?? guess;
  if (!(height > 0)) {
    const last = Math.min(count, BLIND_ROWS);
    let after = 0;
    for (let i = last; i < count; i++) after += h(i);
    return { first: 0, last, before: 0, after };
  }
  let y = 0;
  let i = 0;
  const from = Math.max(0, top);
  while (i < count - 1 && y + h(i) <= from) y += h(i++);
  let first = i;
  let before = y;
  for (let k = 0; k < overscan && first > 0; k++) before -= h(--first);
  let end = i;
  let yEnd = y;
  while (end < count && yEnd < from + height) yEnd += h(end++);
  let last = Math.min(count, end + overscan);
  let after = 0;
  for (let k = last; k < count; k++) after += h(k);
  return { first, last, before: Math.max(0, before), after };
}

/** Run `fn` once on the next frame, however often it is asked for. */
function onNextFrame(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

/**
 * A table that draws only the rows in sight. columns are [[label, (row) => value]]
 * as `table()` takes them; `set(rows)` replaces the rows (and redraws what is in
 * sight). With no rows it says `empty`. The row height is measured from a drawn
 * row, so the stylesheet decides it.
 */
export function vtable(columns, empty = 'Nothing on the bus yet.') {
  const ths = columns.map(([label]) => el('th', {}, label));
  const head = el('thead', {}, el('tr', {}, ths));
  const body = el('tbody');
  const grid = el('table', { class: 'machines trunk tc-vtable' }, head, body);
  const box = el('div', { class: 'tc-vscroll', tabindex: 0 }, grid);
  const none = el('p', { class: 'hint' }, empty);
  const node = el('div', { class: 'tc-vtable-wrap' }, none, box);
  const pad = (h) => el('tr', { class: 'tc-vpad', 'aria-hidden': 'true' }, el('td', { colspan: columns.length, style: `height:${h}px` }));
  const widest = columns.map(() => 0);
  let rows = [];
  let rh = 0;

  function paint() {
    const n = rows.length;
    none.hidden = n > 0;
    box.hidden = n === 0;
    grid.setAttribute('aria-rowcount', String(n + 1));
    if (!n) return body.replaceChildren();
    const headH = head.offsetHeight;
    const { first, last } = windowOf(n, rh || 24, box.scrollTop - headH, box.clientHeight);
    const drawn = [];
    for (let i = first; i < last; i++) {
      const r = rows[i];
      drawn.push(el('tr', { 'aria-rowindex': i + 2 }, columns.map(([, cell]) => el('td', {}, cell(r) ?? '—'))));
    }
    body.replaceChildren(pad(first * (rh || 24)), ...drawn, pad((n - last) * (rh || 24)));
    const measured = drawn[0]?.offsetHeight ?? 0;
    // columns only ever widen, so they do not shuffle as different rows scroll past
    ths.forEach((th, i) => {
      const w = th.offsetWidth;
      if (w > widest[i]) th.style.minWidth = `${(widest[i] = w)}px`;
    });
    if (measured > 0 && Math.abs(measured - rh) > 0.5) {
      rh = measured;
      paint();
    }
  }
  box.addEventListener('scroll', onNextFrame(paint), { passive: true });
  return {
    node,
    set(next) {
      rows = next;
      paint();
    },
  };
}

/**
 * A list of items of differing heights that draws only those in sight:
 * `render(item)` builds one, `keyOf(item)` names it so its measured height is
 * remembered. `set(items)` replaces them and redraws what is in sight.
 */
export function vlist(render, keyOf, className = '') {
  const inner = el('div', { class: 'tc-vlist-inner' });
  const box = el('div', { class: `tc-vscroll tc-vlist ${className}`.trim(), tabindex: 0 }, inner);
  const heights = new Map();
  let items = [];
  let width = 0;
  let guess = 80;

  function paint(again = true) {
    if (box.clientWidth && box.clientWidth !== width) {
      width = box.clientWidth;
      heights.clear(); // a new width wraps differently
    }
    const known = items.map((it) => heights.get(keyOf(it)));
    const { first, last, before, after } = spanOf(known, items.length, guess, box.scrollTop, box.clientHeight);
    // each item in a box that holds its margins, so its measured height is the room it takes
    const drawn = items.slice(first, last).map((it) => el('div', { class: 'tc-vitem' }, render(it)));
    inner.replaceChildren(el('div', { style: `height:${before}px`, 'aria-hidden': 'true' }), ...drawn, el('div', { style: `height:${after}px`, 'aria-hidden': 'true' }));
    let changed = false;
    let sum = 0;
    drawn.forEach((node, k) => {
      const h = node.offsetHeight;
      if (!h) return;
      sum += h;
      const key = keyOf(items[first + k]);
      if (heights.get(key) !== h) {
        heights.set(key, h);
        changed = true;
      }
    });
    if (sum) guess = sum / drawn.length;
    // one more pass with the true heights, so the spacers above match what was guessed
    if (changed && again) paint(false);
  }
  box.addEventListener('scroll', onNextFrame(() => paint()), { passive: true });
  return {
    node: box,
    set(next) {
      items = next;
      paint();
    },
  };
}
