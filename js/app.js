// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { mountMachines } from './machines.js';
import { routeOf, VIEWS } from './trunk/routes.js';
import { mountView } from './trunk/view.js';

/**
 * TRUNK-CASTER
 *
 * The intercom trunking system and the intercoms and machines it trunks, in
 * one window. First Trunk-Caster itself — the Globe, Relay, Simulator, Cross
 * Points, Usage, Space, Racks, Users and Analyzer, every Stream Deck panel and
 * every protocol's frame simulator — each read off the bus through the shell
 * (js/trunk/, ROAD-3440), from PLUGIN.TRUNK_CASTER and PLUGIN.TRUNK_SIM. Then the Ward-Beck MicroCOM II, revived
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
const trunk = document.getElementById('trunk');
const machines = document.getElementById('machines');
const note = document.getElementById('note');
let unmount = null;
let unmountTrunk = null;
let trunkRoute = null;

function say(text) {
  note.textContent = text;
  note.hidden = !text;
  clearTimeout(say.timer);
  if (text) say.timer = setTimeout(() => (note.hidden = true), 6000);
}

function show(which) {
  frame.hidden = which !== frame;
  trunk.hidden = which !== trunk;
  machines.hidden = which !== machines;
}

function route() {
  const name = location.hash.slice(1) || 'globe';
  const view = routeOf(name);
  const tab = view ? view.tab : name;
  for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('on', a.getAttribute('href') === `#${tab}`);
  for (const s of document.querySelectorAll('.tabs select')) s.value = s.querySelector(`option[value="#${name}"]`) ? `#${name}` : '';
  document.getElementById('status').textContent = '';
  if (name !== 'machines') {
    unmount?.();
    unmount = null;
  }
  if (view) {
    show(trunk);
    // the same view twice is left alone: it keeps where you had turned the globe to
    if (trunkRoute !== view.key) {
      unmountTrunk?.();
      trunkRoute = view.key;
      unmountTrunk = mountView(trunk, VIEWS[view.view], { say, param: view.param, status: document.getElementById('status') });
    }
    return;
  }
  unmountTrunk?.();
  unmountTrunk = null;
  trunkRoute = null;
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

// the Stream Deck and Sims pickers are routes too, filled from the data the tool wrote
async function fillPickers() {
  const load = async (path) => {
    try {
      const r = await fetch(path);
      return r.ok ? r.json() : [];
    } catch {
      return [];
    }
  };
  const decks = await load('data/decks/index.json');
  const sims = await load('data/protocols.json');
  document.getElementById('decks').append(...decks.map((d) => Object.assign(document.createElement('option'), { value: `#deck/${d.model}`, textContent: d.name })));
  document.getElementById('sims').append(...sims.map((p) => Object.assign(document.createElement('option'), { value: `#sim/${p.id}`, textContent: p.name })));
}
fillPickers().then(route);
for (const s of document.querySelectorAll('.tabs select')) s.addEventListener('change', () => s.value && (location.hash = s.value));
addEventListener('hashchange', route);
footerSwitch();
