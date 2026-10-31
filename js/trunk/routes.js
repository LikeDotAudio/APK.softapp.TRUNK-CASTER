// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import * as globe from './views/globe.js';
import * as relay from './views/relay.js';
import * as simulator from './views/simulator.js';
import * as crosspoints from './views/crosspoints.js';
import * as usage from './views/usage.js';
import * as space from './views/space.js';
import * as racks from './views/racks.js';
import * as users from './views/users.js';
import * as analyzer from './views/analyzer.js';
import * as deck from './views/deck.js';
import * as sim from './views/sim.js';

/**
 * THE TRUNK-CASTER ROUTES. Each is a hash the OS menus open straight onto (one
 * display.json per route in APK:OS, the Stream Deck and Sims ones written by
 * tools/build-trunk-windows.mjs):
 *
 *   #globe #relay #simulator #crosspoints #usage #space #racks #users #analyzer
 *   #deck/<model>        one Stream Deck panel (data/decks/<model>.json)
 *   #sim/<protocol>      one protocol's frame simulator
 *
 * The snapshot's old routes (#tc, #tc/<page>) land on the view that replaced the page.
 */
export const VIEWS = {
  globe: globe.create, relay: relay.create, simulator: simulator.create, crosspoints: crosspoints.create,
  usage: usage.create, space: space.create, racks: racks.create, users: users.create, analyzer: analyzer.create,
  deck: deck.create, sim: sim.create,
};

/** The page names the published snapshot used, and the view each became. */
const LEGACY = { index: 'globe', continents: 'globe', overlord: 'globe', panels: 'deck', about: 'globe' };

/** { view, param, tab, key } for a route, or null when it is not a Trunk-Caster route. */
export function routeOf(route) {
  const m = /^(deck|sim)\/([A-Za-z0-9._-]+)$/.exec(route);
  if (m) return { view: m[1], param: m[2], tab: m[1], key: route };
  if (route === 'tc') return routeOf('globe');
  const tc = /^tc\/([a-z]+)$/.exec(route);
  if (tc) {
    const name = LEGACY[tc[1]] ?? tc[1];
    return name === 'deck' ? routeOf('deck/streamdeck-mk2') : routeOf(name);
  }
  if (route in VIEWS && route !== 'deck' && route !== 'sim') return { view: route, param: null, tab: route, key: route };
  return null;
}
