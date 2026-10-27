// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { health, judge, TRUST_MS } from '../js/machines.js';

const NOW = 1_800_000_000_000;
const rec = (over) => ({ host: 'render-01', probe: 'LinuxDesktop', status: null, statusAt: 0, telemetry: null, heardAt: 0, ...over });

test('alive is a sample heard inside five minutes; quieter is dead, whatever it last said', () => {
  assert.equal(TRUST_MS, 300_000);
  assert.equal(judge(rec({ heardAt: NOW - 4_000 }), NOW).state, 'alive');
  assert.equal(judge(rec({ heardAt: NOW - TRUST_MS }), NOW).state, 'alive');
  const dead = judge(rec({ heardAt: NOW - TRUST_MS - 1, status: { status: 'online' }, statusAt: NOW - 9e6 }), NOW);
  assert.equal(dead.state, 'dead');
  assert.match(dead.why, /not heard for 5 min/);
});

test('a remembered online is not alive until it is heard', () => {
  const j = judge(rec({ status: { status: 'online' }, statusAt: NOW }), NOW);
  assert.equal(j.state, 'unheard');
  assert.match(j.why, /remembered/);
});

test('an offline the probe left behind is dead with its reason; a sample after it wins', () => {
  const off = judge(rec({ status: { status: 'offline', reason: 'connection_lost' }, statusAt: NOW - 1000, heardAt: NOW - 2000 }), NOW);
  assert.equal(off.state, 'offline');
  assert.match(off.why, /connection lost/);
  assert.equal(judge(rec({ status: { status: 'offline' }, statusAt: NOW - 3000, heardAt: NOW - 1000 }), NOW).state, 'alive');
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

test('the intercom build is the pinned microcom-sim, and carries no MCOM.EXE', () => {
  const built = readFileSync(new URL('../intercom/BUILT-FROM', import.meta.url), 'utf8').trim();
  assert.match(built, /^[0-9a-f]{40}$/);
  for (const page of ['matrix.html', 'panel.html', 'mc3.html', 'emu.html']) assert.ok(existsSync(new URL(`../intercom/${page}`, import.meta.url)), page);
  assert.ok(!existsSync(new URL('../intercom/MCOM.EXE', import.meta.url)));
});
