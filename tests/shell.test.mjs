// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// The Machines tab against the shell it is framed by. machineApi() is the one
// place this repo reads window.parent.OS: a versioned OS.machineApi is held to
// MACHINE_API, an older OS is read by its four named functions, and anything
// else says what is missing instead of drawing an empty tab. The last test runs
// the OS's own machine store (APK:OS/Network/machine-bus, found by walking up to
// the monorepo's PODS/POD.THIN/OS; skipped in a standalone clone) through it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MACHINE_API, actionsFor, judge, machineApi } from '../js/machines.js';

const named = () => ({ machineBusList: () => ['l'], machineBusRead: (h) => `r:${h}`, machineBusWatch: () => () => {}, machineCommand: async (q) => q });

test('no OS, or an OS with no machine store, is "not in the OS"', () => {
  assert.deepEqual(machineApi(null), { missing: 'not in the OS' });
  assert.deepEqual(machineApi({ intercomStripOn: () => true }), { missing: 'not in the OS' });
});

test('an OS from before machineApi is read by its four named functions', async () => {
  const api = machineApi(named());
  assert.equal(api.missing, undefined);
  assert.deepEqual(api.list(), ['l']);
  assert.equal(api.read('render-01'), 'r:render-01');
  assert.deepEqual(await api.command({ verb: 'power' }), { verb: 'power' });
});

test('an OS missing one of them says which, not an empty tab', () => {
  const os = named();
  delete os.machineCommand;
  assert.match(machineApi(os).missing, /lacks machineCommand.*machine API 1/);
});

test('a versioned machineApi is held to MACHINE_API', () => {
  const api = { list: () => [], read: () => null, watch: () => () => {}, command: async () => ({}) };
  assert.equal(machineApi({ machineApi: { version: MACHINE_API, ...api } }).missing, undefined);
  assert.match(machineApi({ machineApi: { version: MACHINE_API + 1, ...api } }).missing, /speaks machine API 1; the OS offers 2/);
  assert.match(machineApi({ machineApi: { version: MACHINE_API, list: api.list } }).missing, /lacks read, watch, command/);
  assert.match(machineApi({ machineApi: { ...api } }).missing, /unversioned/);
});

function findOs() {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    const f = join(dir, 'PODS/POD.THIN/OS/Network/machine-bus/machine-bus.js');
    if (existsSync(f)) return f;
    if (dirname(dir) === dir) return null;
  }
}
const STORE = findOs();

test('the OS machine store, read through machineApi, gives the tab its rows and buttons', { skip: STORE ? false : 'no APK.audio OS above this checkout' }, () => {
  const OS = { machineCommand: async () => ({ cancelled: true }) };   // the command dialog is the OS's, not exercised here
  new Function('OS', readFileSync(STORE, 'utf8'))(OS);
  const api = machineApi(OS);
  assert.equal(api.missing, undefined, api.missing);
  const told = [];
  const unwatch = api.watch((host) => told.push(host));
  const ROOT = 'APK.audio/System/BareMetal/MonitorProbes/LinuxDesktop/render_01/';
  OS.machineBusIngest(`${ROOT}status`, JSON.stringify({ status: 'online', hostname: 'render-01' }));
  OS.machineBusIngest(`${ROOT}telemetry`, JSON.stringify({ hostname: 'render-01', cpu: { overall_percent: 5 } }));
  OS.machineBusIngest(`${ROOT}incoming/detail`, JSON.stringify({ hostname: 'render-01', power_method: 'os', commands: ['uptime'], deploys: [], macs: [] }));
  unwatch();
  assert.ok(told.includes('render-01'));
  const rows = api.list();
  assert.equal(rows.length, 1);
  const rec = api.read('render-01');
  assert.equal(judge(rec).state, 'online');
  const a = actionsFor(rec, 'online');
  assert.deepEqual(a.power.map((x) => x.action), ['cycle', 'off']);
  assert.deepEqual(a.run.map((x) => x.name), ['uptime']);
});
