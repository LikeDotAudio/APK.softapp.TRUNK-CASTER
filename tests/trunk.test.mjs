// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// The Trunk-Caster views (ROAD-3440): every route lands on its view, the
// globe's geometry, how a Stream Deck key reads the caster's connections, a
// sim's agreement with the caster, the Ward-Beck line a crosspoint is (through
// the contract), the shell door, and that every generated window is current.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeOf, VIEWS } from '../js/trunk/routes.js';
import { project, arc, unit, vectors, orientation, projectUnit, ArcCache, painter } from '../js/trunk/views/globe.js';
import { joins, connectionOf, callFrame } from '../js/trunk/views/deck.js';
import { agree, checkedIn } from '../js/trunk/views/sim.js';
import { wardBeck } from '../js/trunk/views/crosspoints.js';
import { trunkApi, TRUNK_API, casterWord, createStandaloneTrunkApi } from '../js/trunk/bus.js';
import { windowOf, spanOf, OVERSCAN, BLIND_ROWS } from '../js/trunk/virtual.js';
import { rackItems } from '../js/trunk/views/racks.js';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');

test('every view route, the deck and sim routes, and the snapshot routes land on a view', () => {
  for (const v of ['globe', 'relay', 'simulator', 'crosspoints', 'usage', 'space', 'racks', 'users', 'analyzer']) {
    assert.equal(routeOf(v)?.view, v);
    assert.equal(typeof VIEWS[v], 'function');
  }
  assert.deepEqual(routeOf('deck/streamdeck-xl'), { view: 'deck', param: 'streamdeck-xl', tab: 'deck', key: 'deck/streamdeck-xl' });
  assert.equal(routeOf('sim/smpte-2110').param, 'smpte-2110');
  assert.equal(routeOf('tc').view, 'globe');
  assert.equal(routeOf('tc/index').view, 'globe');
  assert.equal(routeOf('tc/racks').view, 'racks');
  assert.equal(routeOf('tc/panels').view, 'deck');
  assert.equal(routeOf('matrix'), null);
  assert.equal(routeOf('machines'), null);
  assert.equal(routeOf('deck'), null, 'a deck needs a model');
  assert.equal(routeOf('sim/../x'), null);
});

test('orthographic projection: the centre is the middle, the far side hidden', () => {
  const [x, y, v] = project(10, 20, 10, 20);
  assert.ok(Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9 && v);
  assert.equal(project(190, -20, 10, 20)[2], false);
  const [ex, , ev] = project(100, 0, 10, 0);
  assert.ok(ev && Math.abs(ex - 1) < 1e-9, 'ninety degrees east is the right edge');
});

test('a great-circle arc runs from a to b', () => {
  const pts = arc([-0.1, 51.5], [-74, 40.7], 16);
  assert.equal(pts.length, 17);
  assert.ok(Math.abs(pts[0][0] + 0.1) < 1e-6 && Math.abs(pts[0][1] - 51.5) < 1e-6);
  assert.ok(Math.abs(pts[16][0] + 74) < 1e-6 && Math.abs(pts[16][1] - 40.7) < 1e-6);
  assert.ok(pts[8][1] > 51.5, 'London to New York bows north');
});

test('the globe projects a cached unit vector exactly as project() projects lon/lat (ROAD-3468)', () => {
  for (const [lon, lat, lon0, lat0] of [[10, 20, 10, 20], [190, -20, 10, 20], [100, 0, 10, 0], [-74, 40.7, -40, 25], [151.2, -33.9, -40, 25]]) {
    const [x, y, v] = project(lon, lat, lon0, lat0);
    const [ux, uy, uv] = projectUnit(...unit(lon, lat), orientation(lon0, lat0));
    assert.ok(Math.abs(x - ux) < 1e-12 && Math.abs(y - uy) < 1e-12 && v === uv, `${lon},${lat} from ${lon0},${lat0}`);
  }
  const flat = vectors([-0.1, 51.5, -74, 40.7]), pairs = vectors([[-0.1, 51.5], [-74, 40.7]]);
  assert.equal(flat.length, 6);
  assert.deepEqual(Array.from(flat), Array.from(pairs), 'a land ring and a point list pack alike');
});

test('a trunk arc is built once and kept until its ends move; trunks on one arc share it (ROAD-3468)', () => {
  const cache = new ArcCache(16);
  const lon = [-0.1, 51.5], nyc = [-74, 40.7], tyo = [139.7, 35.7];
  const first = cache.update([[lon, nyc], [lon, tyo], [lon, nyc]]);
  assert.equal(cache.built, 2, 'two distinct arcs built');
  assert.deepEqual(first.map((a) => a.count), [2, 1], 'two trunks along London-New York');
  assert.equal(first[0].vecs.length, 17 * 3);
  const again = cache.update([[[-0.1, 51.5], [-74, 40.7]], [lon, tyo]]);
  assert.equal(cache.built, 2, 'a bus update with the same ends builds nothing');
  assert.equal(again[0].vecs, first[0].vecs, 'and hands back the very same geometry');
  cache.update([[lon, [-73, 40.7]]]);
  assert.equal(cache.built, 3, 'a moved end builds its arc again');
  assert.equal(cache.byKey.size, 1, 'arcs no trunk runs any more are dropped');
});

test('a still globe is not drawn again; the spin, a turn or new data draws it (ROAD-3468)', () => {
  const p = painter();
  assert.ok(p.due(-40, 25, false), 'the first frame draws');
  assert.ok(!p.due(-40, 25, false), 'nothing moved: no draw');
  p.mark();
  assert.ok(p.due(-40, 25, false), 'new data draws once');
  assert.ok(!p.due(-40, 25, false));
  assert.ok(p.due(-30, 25, false), 'a drag turned it');
  assert.ok(p.due(-30, 25, true) && p.due(-30, 25, true), 'while it spins every frame draws');
});

test('a Stream Deck key lights only for a connection from its port to its target', () => {
  const frame = { id: 'dante-01' };
  const c = { from_frame: 'dante-01', from_port: 7, to_frame: 'sip-02', to_port: 3 };
  assert.ok(joins(c, frame, 7, { frame: 'sip-02', port: 3 }));
  assert.ok(!joins(c, frame, 8, { frame: 'sip-02', port: 3 }));
  assert.ok(!joins(c, frame, 7, { frame: 'sip-02', port: 4 }));
  assert.equal(connectionOf({ result: { status: 'granted', connection: { id: 'c-1' } } }), 'c-1');
  assert.equal(connectionOf({ result: { connection: 'c-2' } }), 'c-2');
  assert.equal(connectionOf({ result: { status: 'denied' } }), null);
});

test('a sim agrees with the caster when they hold the same crosspoints, in any order', () => {
  const a = { closed: [{ input: 'U01', output: 'U02' }, { input: 'U03', output: 'C1' }] };
  assert.ok(agree(a, { closed: [{ input: 'U03', output: 'C1', connection: 'x' }, { input: 'U01', output: 'U02' }] }));
  assert.ok(!agree(a, { closed: [{ input: 'U01', output: 'U02' }] }));
  assert.ok(agree({ closed: [] }, undefined));
  assert.equal(checkedIn('1793469414 @APK-Shop'), 1793469414, 'the sim writes "<unix> @<host>"');
  assert.equal(checkedIn('2026-10-31T17:51:19Z'), Date.parse('2026-10-31T17:51:19Z'));
  assert.equal(checkedIn(undefined), 0);
});

test("a closed crosspoint's Ward-Beck line is the contract's rendering", () => {
  const store = { frames: { 'dante-01': { id: 'dante-01', site: 'HQ', port_names: { U01: 'Director, stage', U02: 'Cam 1' } } } };
  assert.equal(wardBeck(store, { frame: 'dante-01', input: 'U01', output: 'U02' }), 'HQ,dante-01,U01,"Director, stage",CLOSE,Cam 1,U02,dante-01,HQ');
});

test('the shell door: no parent, no store, another version — each said, not a blank', () => {
  const top = {};
  top.parent = top;
  assert.match(trunkApi(top).missing, /Open this from the APK.audio OS/);
  assert.match(trunkApi({ parent: { OS: {} } }).missing, /keeps no Trunk-Caster store/);
  assert.match(trunkApi({ parent: { OS: { trunkApi: { version: 99 } } } }).missing, /speak trunk API 1/);
  const api = { version: TRUNK_API };
  assert.equal(trunkApi({ parent: { OS: { trunkApi: api } } }), api);
  assert.equal(casterWord({ caster: { state: 'listening' } }), 'listening');
  assert.equal(casterWord({ caster: { state: { state: 'unavailable' } } }), 'unavailable');
  assert.equal(casterWord({ caster: {} }), 'unheard');
});

test('standalone fallback trunk API provides live-looking topology outside the OS', async () => {
  const api = createStandaloneTrunkApi();
  assert.equal(api.version, TRUNK_API);
  assert.equal(api.signedIn(), true);
  const snap = api.snapshot();
  assert.ok(snap.frames['hq-m7880-01']);
  assert.ok(snap.trunks['trunk-tor-nyc']);
  assert.ok(snap.sites['toronto']);
  assert.equal(casterWord(snap), 'listening');
  const res = await api.command('fader_quick', { speed: 120 });
  assert.equal(res.ok, true);
  assert.equal(api.snapshot().sim.speed, 120);
});

const MONOREPO = existsSync(join(APP, '../../../../POD.THICK/PLUGINS/PLUGIN.TRUNK_CASTER/SRC/data/protocols.json'));
test('every generated window and data file is current (build-trunk-windows --check)', { skip: MONOREPO ? false : 'no APK.audio monorepo above this checkout' }, () => {
  const out = execFileSync(process.execPath, [join(APP, 'tools/build-trunk-windows.mjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /current/);
});

test('a call key finds its intercom by id, site, or a slug prefix (PARI -> paris-01)', () => {
  const frames = [{ id: 'paris-01', site: 'Paris' }, { id: 'paris-02', site: 'Paris' }, { id: 'new-york-01', site: 'New York' }, { id: 'hq-sip-01', site: 'HQ' }];
  assert.equal(callFrame(frames, 'PARI')?.id, 'paris-01');
  assert.equal(callFrame(frames, 'paris-02')?.id, 'paris-02');
  assert.equal(callFrame(frames, 'New York')?.id, 'new-york-01');
  assert.equal(callFrame(frames, 'WASH'), null);
  assert.equal(callFrame(frames, ''), null);
});

test('a windowed table draws the rows in sight and a few either side, never all of them (ROAD-3466)', () => {
  // 40,000 rows of 24 px in a 480 px box scrolled to row 20,000: 20 in sight + the overscan
  const w = windowOf(40000, 24, 20000 * 24, 480);
  assert.equal(w.first, 20000 - OVERSCAN);
  assert.equal(w.last, 20020 + OVERSCAN);
  assert.deepEqual(windowOf(40000, 24, 0, 480), { first: 0, last: 20 + OVERSCAN });
  assert.deepEqual(windowOf(40000, 24, 40000 * 24 - 480, 480), { first: 39980 - OVERSCAN, last: 40000 }, 'scrolled to the bottom draws the last rows');
  assert.ok(windowOf(40000, 24, 1e9, 480).last === 40000, 'scrolled past the end still ends on the last row');
  assert.deepEqual(windowOf(5, 24, 0, 480), { first: 0, last: 5 }, 'a short table draws every row');
  assert.deepEqual(windowOf(0, 24, 0, 480), { first: 0, last: 0 });
  assert.deepEqual(windowOf(40000, 24, 0, 0), { first: 0, last: BLIND_ROWS }, 'a hidden box draws a first screenful, not everything');
});

test('a windowed list of differing heights puts the drawn items where the rest would have been', () => {
  const heights = [10, 20, 30, 40, 50, 60];
  const s = spanOf(heights, 6, 99, 35, 40, 0); // y 35..75: item 2 (30..60) and item 3 (60..100)
  assert.deepEqual(s, { first: 2, last: 4, before: 30, after: 110 });
  const g = spanOf([], 1000, 50, 5000, 200, 2); // unmeasured: the guess stands in
  assert.deepEqual(g, { first: 98, last: 106, before: 4900, after: 894 * 50 });
  assert.deepEqual(spanOf([], 0, 50, 0, 200), { first: 0, last: 0, before: 0, after: 0 });
});

test('the racks list is each site heading followed by its frames, keyed so heights are remembered', () => {
  const by = { a: [{ id: 'a-01', user_ports: 56 }, { id: 'a-02' }], b: [{ id: 'b-01', user_ports: 8 }] };
  const items = rackItems(['a', 'b'], by);
  assert.deepEqual(items.map((i) => i.key), ['site:a', 'frame:a-01:56', 'frame:a-02:0', 'site:b', 'frame:b-01:8']);
  assert.equal(items[0].count, 2);
});
