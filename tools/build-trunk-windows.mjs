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
 *   PLUGIN.TRUNK_CASTER/SRC/data/seed/                  KNOWN PROTOCOLS/ and TRUNK-RELAY/relay.json: the
 *                                                       repertoire, discovered exactly as the caster does
 *   data/decks/streamdeck-*.json                        the Stream Deck panel definitions — this app's
 *                                                       own data since ROAD-3453 (they came from
 *                                                       Trunk-Caster's PANELS/, with their schema)
 *
 * data/land.json (the globe's land outline, from Trunk-Caster's runtime) is this app's own data
 * too and is not written here.
 *
 * WHAT IT WRITES:
 *   data/protocols.json, data/decks/index.json
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
const DECKS = join(APP, 'data/decks');
const OS = join(PODS, 'POD.THIN/OS');
const APP_PATH = 'APK:Softapps/HARDWARE_AND_NETWORK/INTERCOM.TRUNK-CASTER/index.html';
const check = process.argv.includes('--check');

/** The views: route, window name, icon, what it is. */
export const VIEWS = [
  ['globe', 'Globe', '🌐', 'every site the caster publishes, the frames at each and the trunks between the casters as great-circle arcs, on a globe that turns by itself and by drag; each site’s local time, load and calls, and the trunks that became habits'],
  ['relay', 'Relay', '🔁', 'the local sound-card relay: which device sits on which matrix port, its events, and bind / unbind / report through the caster'],
  ['simulator', 'Simulator', '🎚', 'the fader and the simulated clock (speed, run / stop, the hour, the event presets), the caster’s status, the live connections with release, a connect form, every event as it happens and the current run’s report'],
  ['crosspoints', 'Cross Points', '✳', 'every frame’s closed crosspoints, each as its Ward-Beck line, the crosspoint events, each frame’s tap strip (the gain on every crosspoint) with a reset to unity, and a confirmed reset'],
  ['usage', 'Usage', '📈', 'each trunk’s channels against its capacity, live connections per protocol, the voice bandwidth per protocol and per trunk, each production’s counters, and the booking timeline with book and cancel'],
  ['space', 'Space', '🛰', 'the frames as capacity: per site and per frame, which casters are free and which are trunked'],
  ['racks', 'Racks', '🗄', 'the frames in racks, one per site: every user port with its name and panel label, lit while someone is on it, and a rename form'],
  ['users', 'Users', '👥', 'the people: who holds which live connections and bookings, the caster’s phone book, who asked whom, and a panel seek'],
  ['analyzer', 'Analyzer', '🔬', 'captures of the caster’s traffic: start one with a note, stop it, list every capture on the caster and read any one analysed hour by hour'],
];

const TRUNK_SOURCE = 'Read off the bus through the shell (APK:OS/Network/trunk-bus): PLUGIN.TRUNK_CASTER and PLUGIN.TRUNK_SIM speak the trunk contract (contracts/TRUNK.md); commands go to the caster as the person signed in.';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const idPart = (s) => String(s).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/**
 * The repertoire, as the caster plugin discovers it (PLUGIN.TRUNK_CASTER src/discover.rs and
 * protocol.rs, mirrored step for step): each folder under KNOWN PROTOCOLS is a VENDOR (a sub-folder
 * is a known protocol: each sub-folder is then a protocol it implements), a GROUP (a sub-folder looks
 * like a vendor: its children are classified the same way) or a protocol's own DOCS folder. A folder
 * name resolves through the caster's table (alias, or alias prefix where `prefix`); one no row names is
 * kept as itself (lower-case, non-alphanumerics → `-`). TRUNK-* folders are never protocols, and a
 * docs folder with no document counts for nothing. The local relay is a protocol too when the caster
 * has a relay configuration (src/relay.rs PROTOCOL = "relay", named by the configuration's
 * protocol_name). [{ id, name }], sorted by id, one per id.
 */
export function repertoire(tablePath, seedDir) {
  const rows = readJson(tablePath).protocols ?? [];
  const knownDir = join(seedDir, 'KNOWN PROTOCOLS');
  const noise = (n) => n.startsWith('.') || n.startsWith('_') || /^(target|node_modules)$/i.test(n);
  const dirs = (d) => readdirSync(d).filter((n) => !noise(n) && statSync(join(d, n)).isDirectory()).sort();
  const files = (d) => readdirSync(d, { recursive: true }).some((n) => statSync(join(d, String(n))).isFile());
  const canon = (folder) => {
    const lower = folder.trim().toLowerCase();
    if (lower.startsWith('trunk-')) return null;
    const row = rows.find((r) => (r.prefix ? lower.startsWith(r.alias) : lower === r.alias));
    return row ? { id: row.id, name: row.name } : { id: lower.replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, ''), name: folder.trim() };
  };
  const isKnown = (folder) => {
    const lower = folder.trim().toLowerCase();
    return rows.some((r) => (r.prefix ? lower.startsWith(r.alias) : lower === r.alias));
  };
  const looksLikeVendor = (d) => dirs(d).some(isKnown);
  const classify = (d) => (dirs(d).some(isKnown) ? 'vendor' : dirs(d).some((s) => looksLikeVendor(join(d, s))) ? 'group' : 'docs');
  const vendorDirs = [];
  const docDirs = [];
  const place = (d, kind) => (kind === 'vendor' ? vendorDirs.push(d) : kind === 'docs' ? docDirs.push(d) : null);
  if (existsSync(knownDir)) {
    for (const n of dirs(knownDir)) {
      const d = join(knownDir, n);
      const kind = classify(d);
      if (kind === 'group') for (const v of dirs(d)) place(join(d, v), classify(join(d, v)));
      else place(d, kind);
    }
  }
  const found = new Map();
  for (const d of docDirs) {
    const c = canon(d.split('/').pop());
    if (c && files(d) && !found.has(c.id)) found.set(c.id, c);
  }
  for (const v of vendorDirs) {
    for (const n of dirs(v)) {
      const c = canon(n);
      if (c && !found.has(c.id)) found.set(c.id, c);
    }
  }
  const relay = join(seedDir, 'TRUNK-RELAY/relay.json');
  if (existsSync(relay)) found.set('relay', { id: 'relay', name: readJson(relay).protocol_name ?? 'relay' });
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
  for (const p of [join(CASTER, 'data/protocols.json'), DECKS]) {
    if (!existsSync(p)) {
      console.error(`build-trunk-windows: ${p} is not here — run this inside the APK.audio monorepo`);
      process.exit(2);
    }
  }
  const protocols = repertoire(join(CASTER, 'data/protocols.json'), join(CASTER, 'data/seed'));
  put(join(APP, 'data/protocols.json'), json(protocols));

  const decks = readdirSync(DECKS)
    .filter((f) => /^streamdeck-[a-z0-9-]+\.json$/.test(f))
    .sort()
    .map((f) => ({ file: f, def: readJson(join(DECKS, f)) }));
  for (const { file, def } of decks) {
    if (`${def.device?.model}.json` !== file) {
      console.error(`build-trunk-windows: ${file} says it is ${def.device?.model} — a deck file is named after its model`);
      process.exit(2);
    }
  }
  const deckIndex = decks.map(({ def }) => ({ model: def.device.model, name: `${def.device.model.replace(/^streamdeck-/, 'Stream Deck ').replace(/-/g, ' ')} · ${def.name}`, rows: def.device.rows, cols: def.device.cols }));
  put(join(APP, 'data/decks/index.json'), json(deckIndex));

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
