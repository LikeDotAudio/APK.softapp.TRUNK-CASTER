// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
//
// The Machines tab as a CONSUMER of the machine_command contract, not a parallel
// reading of it: what the buttons offer is checked against the SDK's own vectors
// (contracts/vectors/machine_command.json) and its TypeScript twin
// (contracts/src/machine-command.ts, loaded with Node's type stripping), and the
// answer line reads what the twin's machineAnswer() writes.
//
// The contract lives at the APK.audio root, found by walking up from here; in a
// standalone checkout of this repo there is none, and these tests say so and skip.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';
import { actionsFor, answerLine } from '../js/machines.js';

function findContracts() {
  for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'contracts/vectors/machine_command.json')) && existsSync(join(dir, 'contracts/src/machine-command.ts'))) return join(dir, 'contracts');
    if (dirname(dir) === dir) return null;
  }
}
const CONTRACTS = findContracts();
const skip = CONTRACTS ? false : 'no APK.audio contracts/ above this checkout (standalone clone)';

let vectors = { valid: [] };
let mc = null;
if (CONTRACTS) {
  vectors = JSON.parse(readFileSync(join(CONTRACTS, 'vectors/machine_command.json'), 'utf8'));
  // the twin imports its siblings as `./x.js` (tsc's spelling); under type stripping they are `./x.ts`
  registerHooks({
    resolve(spec, ctx, next) {
      try { return next(spec, ctx); } catch (err) {
        if (spec.endsWith('.js') && ctx.parentURL?.endsWith('.ts')) return next(`${spec.slice(0, -3)}.ts`, ctx);
        throw err;
      }
    },
  });
  mc = await import(pathToFileURL(join(CONTRACTS, 'src/machine-command.ts')).href);
}

const NOW = 1_793_000_000_000;
const rec = (o) => ({ host: 'render-01', probe: 'p1', segment: 'render-01', heardAt: NOW, ...o });
const all = (a) => [...a.power, ...a.run, ...a.deploy];
/** What the shell adds around a button's choice before it publishes (the confirmation, the operator, the clock). */
const envelope = (a, dryRun = false) => {
  const base = vectors.valid[0].doc;
  const doc = { id: base.id, verb: a.verb, session: base.session, operator: base.operator, issued_at_ms: base.issued_at_ms };
  for (const k of ['action', 'name', 'mac']) if (a[k] !== undefined) doc[k] = a[k];
  if (dryRun) doc.dry_run = true;
  return doc;
};

test('every command the contract calls valid is one a button can ask for', { skip }, () => {
  assert.ok(vectors.valid.length > 0);
  for (const { why, doc } of vectors.valid) {
    const wake = doc.verb === 'power' && doc.action === 'on';
    const detail = {
      hostname: 'render-01',
      power_method: doc.verb === 'power' && !wake ? 'os' : 'none',
      commands: doc.verb === 'run' ? [doc.name] : [],
      deploys: doc.verb === 'deploy' ? [doc.name] : [],
      macs: doc.mac ? [{ interface: 'eno1', mac: doc.mac }] : [],
    };
    const offered = all(actionsFor(rec({ detail }), wake ? 'unresponsive' : 'online'));
    const hit = offered.find((a) => a.verb === doc.verb && a.action === doc.action && a.name === doc.name && a.mac === doc.mac);
    assert.ok(hit, `${why}: no button asks for ${mc.describeMachineCommand(doc)}`);
  }
});

test('every button, wrapped as the shell sends it, is a command the contract accepts', { skip }, () => {
  const detail = { hostname: 'render-01', power_method: 'os', commands: ['uptime', 'disk'], deploys: ['apk-plugins'], macs: [{ interface: 'eno1', mac: 'aa:bb:cc:00:11:22' }] };
  const offered = [...all(actionsFor(rec({ detail }), 'online')), ...all(actionsFor(rec({ detail }), 'unresponsive'))];
  assert.ok(offered.length >= 6);
  for (const a of offered) {
    for (const k of Object.keys(a)) assert.ok(k === 'label' || mc.MACHINE_COMMAND_KEYS.includes(k), `button field ${k} is not in the contract`);
    for (const dry of [false, true]) {
      const parsed = mc.parseMachineCommand(envelope(a, dry));
      assert.equal(mc.describeMachineCommand(parsed), `${a.verb} ${a.action ?? a.name}`);
    }
  }
});

test('the answer line reads the answer the contract writes', { skip }, () => {
  for (const { doc } of vectors.valid) {
    const cmd = mc.parseMachineCommand(doc);
    const answer = JSON.parse(mc.machineAnswer(cmd, null, mc.STATUS_DONE, 'ok', 'render-01', !!cmd.dry_run, NOW - 3000));
    assert.equal(answerLine(rec({ answer }), NOW), `${mc.describeMachineCommand(cmd)}: done${cmd.dry_run ? ' (dry run)' : ''} · ok · 3 s ago`);
  }
  const unread = JSON.parse(mc.machineAnswer(null, 'cmd-0101-abcd', mc.STATUS_REFUSED, 'unknown key argv', 'render-01', false, NOW - 3000));
  assert.equal(answerLine(rec({ answer: unread }), NOW), 'refused · unknown key argv · 3 s ago');
});
