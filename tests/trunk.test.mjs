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
import { project, arc } from '../js/trunk/views/globe.js';
import { joins, connectionOf } from '../js/trunk/views/deck.js';
import { agree, checkedIn } from '../js/trunk/views/sim.js';
import { wardBeck } from '../js/trunk/views/crosspoints.js';
import { trunkApi, TRUNK_API, casterWord } from '../js/trunk/bus.js';

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

const MONOREPO = existsSync(join(APP, '../../../../POD.THICK/PLUGINS/PLUGIN.TRUNK_CASTER/SRC/data/protocols.json'));
test('every generated window and data file is current (build-trunk-windows --check)', { skip: MONOREPO ? false : 'no APK.audio monorepo above this checkout' }, () => {
  const out = execFileSync(process.execPath, [join(APP, 'tools/build-trunk-windows.mjs'), '--check'], { encoding: 'utf8' });
  assert.match(out, /current/);
});
