// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { loadPage, pageOf, POP_NOTE } from './caster.js';
import { mountMachines } from './machines.js';

/**
 * TRUNK-CASTER
 *
 * The intercom trunking system and the intercoms and machines it trunks, in
 * one window. First Trunk-Caster itself — the Globe and its other pages, from
 * its published snapshot (caster.js). Then the Ward-Beck MicroCOM II, revived
 * in the browser by microcom-sim and built into intercom/
 * (tools/build-intercom.sh): its matrix, panels, MicroCOM III and the MCOM.EXE
 * emulator. Then the machines — every bare metal box a monitor probe reports
 * on the bus (machines.js).
 *
 * The route is the hash, so the OS menus open straight onto a tab; no route is
 * the Globe. The intercom pages keep their state in this origin's IndexedDB
 * and share one matrix through a SharedWorker, so a panel opened from the OS
 * menu and one opened here are on the same frame.
 */

const PAGES = { matrix: 'matrix.html', panel: 'panel.html', mc3: 'mc3.html', emu: 'emu.html' };

/** The station the key strip in the OS footer is set to (microcom-sim's strip/model.ts STATION_KEY), same origin. */
const STATION_KEY = 'microcom.strip.station';
const myStation = () => {
  try {
    return localStorage.getItem(STATION_KEY);
  } catch {
    return null;
  }
};

const frame = document.getElementById('intercom');
const caster = document.getElementById('caster');
const machines = document.getElementById('machines');
const note = document.getElementById('note');
let unmount = null;
let casterPage = null;

function say(text) {
  note.textContent = text;
  note.hidden = !text;
  clearTimeout(say.timer);
  if (text) say.timer = setTimeout(() => (note.hidden = true), 6000);
}

function show(which) {
  frame.hidden = which !== frame;
  caster.hidden = which !== caster;
  machines.hidden = which !== machines;
}

function route() {
  const name = location.hash.slice(1) || 'globe';
  const page = pageOf(name);
  const tab = page ? 'globe' : name;
  for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('on', a.getAttribute('href') === `#${tab}`);
  document.getElementById('status').textContent = '';
  if (name !== 'machines') {
    unmount?.();
    unmount = null;
  }
  if (page) {
    show(caster);
    // the same page twice is left alone: it keeps where you had turned the globe to
    if (casterPage !== page) {
      casterPage = page;
      loadPage(caster, page, { go: (p) => (location.hash = p === 'index' ? '#globe' : `#tc/${p}`), note: say }).catch((err) => say(`Trunk-Caster: ${err.message}`));
    }
    return;
  }
  if (name === 'machines') {
    show(machines);
    unmount ??= mountMachines(machines, document.getElementById('status'));
    return;
  }
  show(frame);
  // the engine runs here, in the browser: said outright rather than left to the pages' probe of
  // /api/state, which on the OS's own server is an OS route and not mcommatrix's
  const mine = name === 'panel' ? myStation() : null;
  const src = `intercom/${PAGES[name] ?? PAGES.matrix}?engine=local${mine ? `&p=${encodeURIComponent(mine.replace(' ', '/'))}` : ''}`;
  // the same page twice is left alone: reloading it would drop the panel's live audio
  if (!frame.src.endsWith(src)) frame.src = src;
}

/** Framed by the OS: a switch for the keys in its footer (APK:OS/Footer/intercom-strip). */
function footerSwitch() {
  let os = null;
  try {
    os = window.parent !== window && typeof window.parent.OS?.setIntercomStrip === 'function' ? window.parent.OS : null;
  } catch {
    os = null;
  }
  const box = document.getElementById('footer-keys');
  if (!os || !box) return;
  const input = box.querySelector('input');
  input.checked = os.intercomStripOn();
  input.addEventListener('change', () => os.setIntercomStrip(input.checked));
  box.hidden = false;
}

// a snapshot page refused a pop-out (caster.js guard): say why rather than leave a blank window
addEventListener('message', (ev) => {
  if (ev.source === caster.contentWindow && ev.data?.source === 'trunk-caster-snapshot' && ev.data.note === 'pop') say(POP_NOTE);
});
addEventListener('hashchange', route);
route();
footerSwitch();
