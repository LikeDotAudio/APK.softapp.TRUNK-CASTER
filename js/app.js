// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { mountMachines } from './machines.js';

/**
 * TRUNK-CASTER
 *
 * One window for the intercom and the machines it runs on. The intercom is the
 * Ward-Beck MicroCOM II, revived in the browser by microcom-sim and built into
 * intercom/ (tools/build-intercom.sh): its matrix, panels, MicroCOM III and the
 * MCOM.EXE emulator each open in the frame below. The machines are every bare
 * metal box a monitor probe reports on the bus (machines.js).
 *
 * The route is the hash, so the OS menus open straight onto a tab; no route is
 * the matrix. The intercom pages keep their state in this origin's IndexedDB
 * and share one matrix through a SharedWorker, so a panel opened from the OS
 * menu and one opened here are on the same frame.
 */

const PAGES = { matrix: 'matrix.html', panel: 'panel.html', mc3: 'mc3.html', emu: 'emu.html' };

const frame = document.getElementById('intercom');
const machines = document.getElementById('machines');
let unmount = null;

function route() {
  const name = location.hash.slice(1) || 'matrix';
  for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('on', a.getAttribute('href') === `#${name}`);
  if (name === 'machines') {
    frame.hidden = true;
    machines.hidden = false;
    unmount ??= mountMachines(machines, document.getElementById('status'));
    return;
  }
  unmount?.();
  unmount = null;
  machines.hidden = true;
  frame.hidden = false;
  // the engine runs here, in the browser: said outright rather than left to the pages' probe of
  // /api/state, which on the OS's own server is an OS route and not mcommatrix's
  const page = `intercom/${PAGES[name] ?? PAGES.matrix}?engine=local`;
  // the same page twice is left alone: reloading it would drop the panel's live audio
  if (!frame.src.endsWith(page)) frame.src = page;
  document.getElementById('status').textContent = '';
}

addEventListener('hashchange', route);
route();
