#!/usr/bin/env node
// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/**
 * build-trunk-windows.mjs — every Trunk-Caster window, written from data (ROAD-3440).
 *
 *   node tools/build-trunk-windows.mjs            write data/ and the OS windows
 *   node tools/build-trunk-windows.mjs --check    write nothing; exit 1 when anything differs
 *
 * WHAT IT READS (nothing here lists a protocol or a panel):
 *   PLUGIN.TRUNK_CASTER/SRC/data/protocols.json        the caster's protocol table (alias → id, name)
 *   PLUGIN.TRUNK_CASTER/SRC/data/seed/KNOWN PROTOCOLS/  the repertoire's folders: every leaf folder is a
 *                                                       protocol — its row in the table, or (no row) itself,
 *                                                       as the caster keeps it; a leaf straight under a
 *                                                       VENDOR group is a vendor with no protocol folder
 *   INTERCOM.Caster/SRC/PANELS/streamdeck-*.json        the Stream Deck panel definitions
 *   INTERCOM.Caster/SRC/RUST-RUNTIME/src/land.json      the globe's land outline
 *
 * WHAT IT WRITES:
 *   data/protocols.json, data/decks/<model>.json, data/decks/index.json, data/land.json
 *   PODS/POD.THIN/OS/Trunk <Name>/display.json   one window per view, per Stream Deck and per protocol,
 *                                                group Intercom; a window it wrote before whose source
 *                                                has gone is removed (only folders holding an id it owns)
 *
 * The nine views are this app's own routes (js/trunk/routes.js), so they are named here.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const PODS = resolve(APP, '../../../..');
const CASTER = join(PODS, 'POD.THICK/PLUGINS/PLUGIN.TRUNK_CASTER/SRC');
const REFERENCE = join(PODS, 'POD.THICK/INTERCOM.Caster/SRC');
const OS = join(PODS, 'POD.THIN/OS');
const APP_PATH = 'APK:Softapps/HARDWARE_AND_NETWORK/INTERCOM.TRUNK-CASTER/index.html';
const check = process.argv.includes('--check');

/** The views: route, window name, icon, what it is. */
export const VIEWS = [
  ['globe', 'Globe', '🌐', 'every site the caster publishes, the frames at each and the trunks between the casters as great-circle arcs, on a globe that turns by itself and by drag'],
  ['relay', 'Relay', '🔁', 'the local sound-card relay: which device sits on which matrix port, its events, and bind / unbind / report through the caster'],
  ['simulator', 'Simulator', '🎚', 'the fader and the simulated clock (speed, run / stop, the hour, presets), the live connections with release, a connect form and every event as it happens'],
  ['crosspoints', 'Cross Points', '✳', 'every frame’s closed crosspoints, each as its Ward-Beck line, the crosspoint events, and a confirmed reset'],
  ['usage', 'Usage', '📈', 'each trunk’s channels against its capacity, live connections per protocol, and the booking timeline with book and cancel'],
  ['space', 'Space', '🛰', 'the frames as capacity: per site and per frame, which casters are free and which are trunked'],
  ['racks', 'Racks', '🗄', 'the frames in racks, one per site: every user port with its name and panel label, lit while someone is on it, and a rename form'],
  ['users', 'Users', '👥', 'the people: who holds which live connections and bookings, who asked whom, and a panel seek'],
  ['analyzer', 'Analyzer', '🔬', 'captures of the caster’s traffic: start one with a note, stop it, read what was captured'],
];

const TRUNK_SOURCE = 'Read off the bus through the shell (APK:OS/Network/trunk-bus): PLUGIN.TRUNK_CASTER and PLUGIN.TRUNK_SIM speak the trunk contract (contracts/TRUNK.md); commands go to the caster as the person signed in.';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const idPart = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** The repertoire, as the caster resolves it: [{ id, name }], sorted by id, one per id. */
export function repertoire(tablePath, knownDir) {
  const rows = readJson(tablePath).protocols ?? [];
  const resolveName = (folder) => {
    const lower = folder.trim().toLowerCase();
    if (lower.startsWith('trunk-')) return null;
    const row = rows.find((r) => (r.prefix ? lower.startsWith(r.alias) : lower === r.alias));
    return row ? { id: row.id, name: row.name } : { id: slug(folder), name: folder.trim() };
  };
  const found = new Map();
  for (const r of rows) found.set(r.id, { id: r.id, name: r.name });
  const walk = (dir, underVendorGroup) => {
    for (const name of readdirSync(dir).sort()) {
      if (name.startsWith('.') || name.startsWith('_')) continue;
      const p = join(dir, name);
      if (!statSync(p).isDirectory()) continue;
      const subs = readdirSync(p).filter((n) => statSync(join(p, n)).isDirectory() && !n.startsWith('.') && !n.startsWith('_'));
      if (subs.length) walk(p, name.toLowerCase() === 'vendor');
      else if (!underVendorGroup) {
        const hit = resolveName(name);
        if (hit && !found.has(hit.id)) found.set(hit.id, hit);
      }
    }
  };
  if (existsSync(knownDir)) walk(knownDir, false);
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function display(id, name, icon, subGroup, route, what) {
  return {
    id,
    name,
    icon,
    group: 'Intercom',
    subGroup,
    kind: 'web',
    app: `${APP_PATH}#${route}`,
    class: 'execution',
    description: `INTERCOM: TRUNK-CASTER ${name.toUpperCase()} — ${what}. ${TRUNK_SOURCE} Written by INTERCOM.TRUNK-CASTER/tools/build-trunk-windows.mjs.`,
    topic: `APK.audio/Gui/Display/${id}`,
    autostart: false,
  };
}

const changed = [];
function put(path, text) {
  const old = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (old === text) return;
  changed.push(path);
  if (check) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}
const json = (v) => `${JSON.stringify(v, null, 2)}\n`;

function main() {
  for (const p of [join(CASTER, 'data/protocols.json'), join(REFERENCE, 'PANELS')]) {
    if (!existsSync(p)) {
      console.error(`build-trunk-windows: ${p} is not here — run this inside the APK.audio monorepo`);
      process.exit(2);
    }
  }
  const protocols = repertoire(join(CASTER, 'data/protocols.json'), join(CASTER, 'data/seed/KNOWN PROTOCOLS'));
  put(join(APP, 'data/protocols.json'), json(protocols));

  const decks = readdirSync(join(REFERENCE, 'PANELS'))
    .filter((f) => /^streamdeck-[a-z0-9-]+\.json$/.test(f))
    .sort()
    .map((f) => ({ file: f, def: readJson(join(REFERENCE, 'PANELS', f)) }));
  for (const { def } of decks) put(join(APP, `data/decks/${def.device.model}.json`), json(def));
  const deckIndex = decks.map(({ def }) => ({ model: def.device.model, name: `${def.device.model.replace(/^streamdeck-/, 'Stream Deck ').replace(/-/g, ' ')} · ${def.name}`, rows: def.device.rows, cols: def.device.cols }));
  put(join(APP, 'data/decks/index.json'), json(deckIndex));
  put(join(APP, 'data/land.json'), readFileSync(join(REFERENCE, 'RUST-RUNTIME/src/land.json'), 'utf8'));

  const windows = [
    ...VIEWS.map(([route, name, icon, what]) => ({ folder: `Trunk ${name}`, doc: display(`TRUNK_${idPart(route).toUpperCase()}`, name, icon, 'Trunk-Caster', route, what) })),
    ...deckIndex.map((d) => ({ folder: `Trunk Deck ${d.name.replace(/ · .*/, '')}`, doc: display(`TRUNK_DECK_${idPart(d.model.replace(/^streamdeck-/, '')).toUpperCase()}`, d.name.replace(/ · .*/, ''), '🎛️', 'Stream Decks', `deck/${d.model}`, `the ${d.rows} × ${d.cols} ${d.name} button panel as keys on screen: sits on a frame and a port; talk, listen, call, reply and hang-up keys ask the caster to connect or release, and a key lights while the caster holds that connection`) })),
    ...protocols.map((p) => ({ folder: `Trunk Sim ${p.name}`, doc: display(`TRUNK_SIM_${idPart(p.id).toUpperCase()}`, `${p.name} Sim`, '🧪', 'Simulators', `sim/${p.id}`, `the ${p.name} frame simulator: what PLUGIN.TRUNK_SIM says each ${p.name} frame holds beside what the caster believes, whether they agree, and the double validation (lines applied and refused, the last reason)`) })),
  ];
  const owned = new Set(windows.map((w) => w.doc.id));
  for (const w of windows) put(join(OS, w.folder, 'display.json'), json(w.doc));

  // a window this tool wrote whose source has gone
  for (const name of readdirSync(OS).filter((n) => n.startsWith('Trunk '))) {
    const p = join(OS, name, 'display.json');
    if (!existsSync(p)) continue;
    const id = readJson(p).id ?? '';
    if (/^TRUNK_/.test(id) && !owned.has(id) && windows.every((w) => w.folder !== name)) {
      changed.push(`${p} (removed)`);
      if (!check) rmSync(join(OS, name), { recursive: true });
    }
  }

  if (check) {
    if (changed.length) {
      console.error(`build-trunk-windows --check: ${changed.length} out of date:\n  ${changed.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`build-trunk-windows --check: ${windows.length} windows, ${protocols.length} protocols, ${decks.length} decks — current`);
  } else {
    console.log(`build-trunk-windows: ${windows.length} windows (${VIEWS.length} views, ${decks.length} decks, ${protocols.length} sims); ${changed.length} file(s) written`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
