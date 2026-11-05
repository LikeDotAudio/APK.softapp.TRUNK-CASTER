// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// THE ONE TABLE (ROAD-3494): the fleet is APKTable 'trunk-caster-machines'.
// paintMachines() writes it once through the vendored apk-table's markup() and
// scan(), then only rewrites the adopted table's tbody, so a sort survives.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { MACHINES_TABLE_ID, paintMachines } from '../js/machines.js';

const require = createRequire(import.meta.url);
const { loadApkTable } = require('./apk-table-shim.cjs');
const APP = new URL('..', import.meta.url).pathname;

test('the vendored markup() names the table and keeps the machines class', () => {
  const { window } = loadApkTable(APP + 'vendor/apk-table/apk-table.js');
  const html = window.APKTable.markup({ id: MACHINES_TABLE_ID, className: 'machines', head: '<tr><th>machine</th></tr>', body: '' });
  assert.match(html, /data-apk-table-host="trunk-caster-machines"/);
  assert.equal(JSON.parse(/data-apk-opts="([^"]*)"/.exec(html)[1].replace(/&quot;/g, '"')).className, 'machines');
});

test('first paint stands the table in; the next rewrites only its rows', () => {
  const calls = [];
  const tbody = { innerHTML: '' };
  const hint = { innerHTML: '' };
  const table = { el: { querySelector: () => tbody }, render() { calls.push('render'); return this; } };
  let registered = null;
  const T = {
    markup: (o) => { calls.push(['markup', o.id, o.className]); return '<host>'; },
    scan: () => { calls.push('scan'); registered = table; return [table]; },
    get: (id) => (id === MACHINES_TABLE_ID ? registered : null),
  };
  const host = { innerHTML: '', contains: (el) => el === table.el, querySelector: () => hint };
  assert.equal(paintMachines(host, '<tr><td>a</td></tr>', 'hint 1', T), table);
  assert.deepEqual(calls, [['markup', 'trunk-caster-machines', 'machines'], 'scan']);
  assert.match(host.innerHTML, /^<host><p class="hint">hint 1<\/p>$/);
  paintMachines(host, '<tr><td>b</td></tr>', 'hint 2', T);
  assert.equal(tbody.innerHTML, '<tr><td>b</td></tr>');
  assert.equal(hint.innerHTML, 'hint 2');
  assert.deepEqual(calls.slice(2), ['render']);
});

test('machines.js writes no <table> literal; index.html loads the vendored table first', () => {
  assert.doesNotMatch(readFileSync(APP + 'js/machines.js', 'utf8'), /<table|createElement\(['"]table/);
  const html = readFileSync(APP + 'index.html', 'utf8');
  assert.ok(html.indexOf('vendor/apk-table/apk-table.js') < html.indexOf('js/app.js'));
});
