// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { actionsFor, answerLine, health, judge, TRUST_MS } from '../js/machines.js';

const NOW = 1_800_000_000_000;
const rec = (over) => ({ host: 'render-01', probe: 'LinuxDesktop', status: null, statusAt: 0, telemetry: null, heardAt: 0, ...over });

test('alive is a sample heard inside five minutes; quieter is dead, whatever it last said', () => {
  assert.equal(TRUST_MS, 300_000);
  assert.equal(judge(rec({ heardAt: NOW - 4_000 }), NOW).state, 'online');
  assert.equal(judge(rec({ heardAt: NOW - TRUST_MS }), NOW).state, 'online');
  const dead = judge(rec({ heardAt: NOW - TRUST_MS - 1, status: { status: 'online' }, statusAt: NOW - 9e6 }), NOW);
  assert.equal(dead.state, 'unresponsive');
  assert.match(dead.why, /not heard for 5 min/);
});

test('a remembered online is not alive until it is heard', () => {
  const j = judge(rec({ status: { status: 'online' }, statusAt: NOW }), NOW);
  assert.equal(j.state, 'stale');
  assert.match(j.why, /remembered/);
});

test('an offline the probe left behind is dead with its reason; a sample after it wins', () => {
  const off = judge(rec({ status: { status: 'offline', reason: 'connection_lost' }, statusAt: NOW - 1000, heardAt: NOW - 2000 }), NOW);
  assert.equal(off.state, 'offline');
  assert.match(off.why, /connection lost/);
  assert.equal(judge(rec({ status: { status: 'offline' }, statusAt: NOW - 3000, heardAt: NOW - 1000 }), NOW).state, 'online');
});

test('health is the few numbers that say how a machine is, from the probe’s own payload', () => {
  const h = health(rec({ telemetry: {
    os: { system: 'Linux', release: '7.0.0', architecture: 'x86_64', uptime_sec: 90000 },
    cpu: { overall_percent: 37.5, core_count: 16, load_avg: { '1m': 2.5 }, temperatures: { Package: 61, 'Core 3': 74.2 } },
    memory: { percent: 48, total_mb: 32768 },
    storage: { partitions: [{ mountpoint: '/', percent: 41, total_gb: 900 }, { mountpoint: '/media', percent: 93, total_gb: 4000 }] },
    network: { interfaces: { eno1: ['10.0.0.20'], wlp2s0: [] } },
  } }));
  assert.equal(h.os, 'Linux 7.0.0 x86_64');
  assert.equal(h.uptime, '25 h 0 min');
  assert.equal(h.cpu, 37.5);
  assert.deepEqual(h.disk, { at: '/media', percent: 93, total: 4000 });
  assert.deepEqual(h.hot, { label: 'Core 3', c: 74.2 });
  assert.deepEqual(h.ips, ['10.0.0.20 (eno1)']);
  assert.deepEqual(health(rec({})).ips, [], 'a machine not yet heard has no numbers, not wrong ones');
});

test('the intercom build is the pinned microcom-sim, and carries no MCOM.EXE', (t) => {
  const built = readFileSync(new URL('../intercom/BUILT-FROM', import.meta.url), 'utf8').trim();
  assert.match(built, /^[0-9a-f]{40}$/);
  // PINNED means the SRC/microcom-sim gitlink, not "some commit". The index is
  // asked rather than HEAD so a bump and its rebuild agree before they are
  // committed together. Outside a git checkout there is no pin to compare.
  let pinned = '';
  try {
    pinned = execFileSync('git', ['ls-files', '-s', 'SRC/microcom-sim'],
      { cwd: new URL('..', import.meta.url), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\s+/)[1] || '';
  } catch { /* not a checkout */ }
  if (!pinned) t.diagnostic('no SRC/microcom-sim gitlink here; BUILT-FROM checked for shape only');
  else assert.equal(built, pinned, 'intercom/ was built from a different microcom-sim than SRC/microcom-sim pins: run tools/build-intercom.sh');
  for (const page of ['matrix.html', 'panel.html', 'mc3.html', 'emu.html']) assert.ok(existsSync(new URL(`../intercom/${page}`, import.meta.url)), page);
  assert.ok(!existsSync(new URL('../intercom/MCOM.EXE', import.meta.url)));
});

// PLAN-3394.01 — the buttons offer what the machine's own agent says it can do.
const detail = { hostname: 'render-01', power_method: 'os', commands: ['uptime', 'disk'], deploys: ['plugins'], macs: [{ interface: 'eno1', mac: 'aa:bb:cc:00:11:22' }] };

test('no agent, no actions — and it says why', () => {
  const a = actionsFor(rec({}), 'online');
  assert.deepEqual([a.power, a.run, a.deploy], [[], [], []]);
  assert.match(a.why, /PLUGIN\.MACHINE/);
});

test('an alive machine with an agent offers its own power, commands and deploys', () => {
  const a = actionsFor(rec({ detail }), 'online');
  assert.deepEqual(a.power.map((x) => x.action), ['cycle', 'off']);
  assert.deepEqual(a.run.map((x) => x.name), ['uptime', 'disk']);
  assert.deepEqual(a.deploy.map((x) => x.name), ['plugins']);
  assert.equal(actionsFor(rec({ detail: { ...detail, power_method: 'none' } }), 'online').power.length, 0, 'no power method, no power buttons');
});

test('a dead machine can only be woken, to the MAC it last published', () => {
  const a = actionsFor(rec({ detail }), 'unresponsive');
  assert.deepEqual(a.power, [{ label: 'Power on — wake aa:bb:cc:00:11:22', verb: 'power', action: 'on', mac: 'aa:bb:cc:00:11:22' }]);
  assert.deepEqual([a.run, a.deploy], [[], []]);
  assert.match(actionsFor(rec({ detail: { ...detail, macs: [] } }), 'unresponsive').why, /no MAC/);
});

test('the answer line says what, how it went, and when', () => {
  const line = answerLine(rec({ answer: { verb: 'power', action: 'cycle', status: 'done', dry_run: true, detail: 'dry run: would run `systemctl reboot`', at_ms: NOW - 3000 } }), NOW);
  assert.equal(line, 'power cycle: done (dry run) · dry run: would run `systemctl reboot` · 3 s ago');
  assert.equal(answerLine(rec({})), '');
});

test('no button is left waiting for a phase 2', () => {
  const src = readFileSync(new URL('../js/machines.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('disabled title="Phase 2"'));
});
