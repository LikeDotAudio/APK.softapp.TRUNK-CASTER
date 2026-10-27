// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { framed, guardScript, linkKind, pageOf, PAGES, SITE } from '../js/caster.js';

const SITE_URL = 'http://localhost:8080/APK%3ASoftapps/HARDWARE_AND_NETWORK/INTERCOM.TRUNK-CASTER/SRC/trunk-caster-site/';

test('the Globe is the front door; every other published page has a route', () => {
  assert.equal(pageOf('globe'), 'index');
  assert.equal(pageOf('tc/racks'), 'racks');
  assert.equal(pageOf('tc/nope'), null);
  assert.equal(pageOf('matrix'), null);
  for (const p of PAGES) assert.ok(existsSync(new URL(`../${SITE}${p}.html`, import.meta.url)), `${p}.html is in the snapshot`);
});

test('a link to another page stays in the snapshot; a link to the live runtime never reaches the OS’s own port', () => {
  assert.deepEqual(linkKind('racks.html', SITE_URL), { kind: 'page', page: 'racks' });
  assert.deepEqual(linkKind('index.html', SITE_URL), { kind: 'page', page: 'index' });
  assert.equal(linkKind('http://127.0.0.1:8080/analyzer', SITE_URL).kind, 'runtime');
  assert.equal(linkKind('/panels/editor', SITE_URL).kind, 'runtime');
  assert.equal(linkKind('https://example.org/', SITE_URL).kind, 'other');
});

test('a framed page gets its base and the guard before any script of its own', () => {
  const html = framed('<!doctype html><html><head><title>Globe</title><script>const LIVE = 1;</script></head></html>', SITE_URL);
  const base = html.indexOf('<base href=');
  const guard = html.indexOf('Trunk-Caster snapshot');
  const own = html.indexOf('const LIVE');
  assert.ok(base > 0 && guard > base && own > guard);
});

test('the guard refuses the runtime and lets the snapshot’s own files through', async () => {
  const sent = [];
  const win = { fetch: (u) => (sent.push(String(u)), Promise.resolve('ok')), parent: { postMessage: (m) => sent.push(m.note) } };
  const XMLHttpRequest = function () {};
  XMLHttpRequest.prototype.open = () => {};
  const navigator = {};
  const code = guardScript(SITE_URL).replace(/^<script>|<\/script>$/g, '');
  new Function('window', 'XMLHttpRequest', 'navigator', 'parent', code.replace(/window\.open =/, 'window.open =').replace(/\bparent\.postMessage/, 'window.parent.postMessage'))(win, XMLHttpRequest, navigator, win.parent);
  await assert.rejects(win.fetch('/api/device/x', { method: 'POST' }), /no runtime/);
  await assert.rejects(win.fetch('/api/land'), /no runtime/);
  assert.equal(await win.fetch(SITE_URL + 'index.html'), 'ok');
  assert.throws(() => new win.WebSocket('ws://localhost:8080/ws'), /no runtime/);
  assert.throws(() => XMLHttpRequest.prototype.open.call({}, 'POST', '/api/fader'), /no runtime/);
  assert.equal(win.open('about:srcdoc?pop=x'), null);
  assert.deepEqual(sent, [SITE_URL + 'index.html', 'pop']);
});

test('every runtime call the snapshot makes is one the guard refuses', () => {
  const s = readFileSync(new URL(`../${SITE}index.html`, import.meta.url), 'utf8');
  assert.match(s, /const LIVE = location\.protocol\.startsWith\('http'\)/, 'the pages still decide LIVE by their protocol — srcdoc makes it about:');
  for (const p of s.matchAll(/api\('(\/api\/[a-z/_-]+)'/g)) assert.equal(linkKind(p[1], SITE_URL).kind, 'runtime', p[1]);
});
