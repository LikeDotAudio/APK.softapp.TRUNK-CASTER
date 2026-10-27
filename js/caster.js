// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * TRUNK-CASTER'S OWN PAGES: THE GLOBE AND THE REST
 *
 * Trunk-Caster is the intercom trunking system — 28 protocols, frames of
 * 56+8 ports, trunks of 8 channels between casters, every site on a globe.
 * Its runtime is private; what is here is its public snapshot
 * (onediversifiedanthony/trunk-caster-site, pinned at SRC/trunk-caster-site):
 * twelve self-contained pages, the Globe first.
 *
 * A PAGE IS NEVER FRAMED BY ITS ADDRESS. Each one decides it is live when it
 * is served over http (`LIVE = location.protocol.startsWith('http')`) and then
 * talks to whoever served it: a WebSocket at /ws and POSTs to /api/…. Served
 * from the APK.audio OS that is the OS's own server, where /api/device/ sends
 * commands to real instruments. So the page is fetched and handed to the
 * frame as srcdoc: its protocol is about:, it is not live, and a guard run
 * before its own scripts refuses every request that is not one of the
 * snapshot's own files — exactly how the published copy behaves with no
 * caster behind it. A <base> keeps its relative files resolving.
 *
 * Its own navigation is kept: a link to another of its pages is caught and
 * opened the same way (#tc/<page>), and a link to the live runtime (the
 * analyzer, the panel editor, 127.0.0.1:8080) says it needs the runtime
 * rather than opening the OS's own port. A pop-out (window.open) is refused
 * the same way: it would open the page at its own address, about:srcdoc.
 */

export const SITE = 'SRC/trunk-caster-site/';

/** The pages the snapshot publishes, by route; the Globe is the front door. */
export const PAGES = ['index', 'continents', 'crosspoints', 'overlord', 'panels', 'racks', 'relay', 'simulator', 'space', 'usage', 'users', 'about'];

export const RUNTIME_NOTE = 'This needs the Trunk-Caster runtime, which is not running here — this is its published snapshot.';
export const POP_NOTE = 'Pop-out windows need the Trunk-Caster runtime; in the snapshot each section stays in this window.';

/** The page a route names, or null: #globe and #tc are the Globe, #tc/<page> one of the others. */
export function pageOf(route) {
  if (route === 'globe' || route === 'tc' || route === 'tc/index') return 'index';
  const m = /^tc\/([a-z]+)$/.exec(route);
  return m && PAGES.includes(m[1]) ? m[1] : null;
}

/** What a link inside a page is: another page of the snapshot, the live runtime, or something to leave alone. */
export function linkKind(href, siteUrl) {
  let u;
  try {
    u = new URL(href, siteUrl);
  } catch {
    return { kind: 'other' };
  }
  const site = new URL(siteUrl);
  if (u.origin === site.origin && u.pathname.startsWith(site.pathname)) {
    const name = u.pathname.slice(site.pathname.length).replace(/\.html$/, '') || 'index';
    if (PAGES.includes(name)) return { kind: 'page', page: name };
  }
  if (/^(127\.0\.0\.1|localhost)(:8080)?$/.test(u.host) && u.port === '8080') return { kind: 'runtime' };
  if (u.origin === site.origin && /^\/(analyzer|panels\/editor|api\/|ws)/.test(u.pathname)) return { kind: 'runtime' };
  return { kind: 'other' };
}

/**
 * The guard: the first script in the page. Every fetch, XHR, beacon,
 * EventSource and WebSocket that is not one of the snapshot's own files is
 * refused, and a WebSocket is never opened, so the page runs as the published
 * copy does — off the data it carries.
 */
export function guardScript(siteUrl) {
  return `<script>(() => {
  const SITE = ${JSON.stringify(siteUrl)};
  const own = (u) => { try { const x = new URL(String(u && u.url || u), SITE); return x.href.startsWith(SITE) && !/[?#]/.test(x.href.slice(SITE.length)) && /\\.(html|json|js|css|png|svg|jpg|gz)$/.test(x.pathname); } catch (e) { return false; } };
  const refuse = (u) => Promise.reject(new TypeError('Trunk-Caster snapshot: no runtime here for ' + u));
  const f = window.fetch.bind(window);
  window.fetch = (u, o) => own(u) ? f(u, o) : refuse(u && u.url || u);
  const X = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { if (!own(u)) throw new TypeError('Trunk-Caster snapshot: no runtime here for ' + u); return X.apply(this, arguments); };
  if (navigator.sendBeacon) navigator.sendBeacon = () => false;
  window.EventSource = function () { throw new TypeError('Trunk-Caster snapshot: no runtime here'); };
  window.WebSocket = function () { throw new TypeError('Trunk-Caster snapshot: no runtime here'); };
  // a pop-out opens the page at its own address, which here is about:srcdoc: say so instead of a blank window
  window.open = () => { try { parent.postMessage({ source: 'trunk-caster-snapshot', note: 'pop' }, '*'); } catch (e) {} return null; };
})();</script>`;
}

/** A page's HTML made safe to frame: its <base>, and the guard before anything of its own. */
export function framed(html, siteUrl) {
  const head = `<base href="${siteUrl}">${guardScript(siteUrl)}`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + head) : head + html;
}

/** Load `page` into `frame`; links between pages go through `go(page)`, runtime links through `note()`. */
export async function loadPage(frame, page, { go, note, base = location.href } = {}) {
  const siteUrl = new URL(SITE, base).href;
  const r = await fetch(new URL(`${page}.html`, siteUrl));
  if (!r.ok) throw new Error(`${page}.html: ${r.status}`);
  frame.srcdoc = framed(await r.text(), siteUrl);
  frame.onload = () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.addEventListener(
      'click',
      (ev) => {
        const a = ev.target.closest?.('a[href]');
        if (!a) return;
        const k = linkKind(a.getAttribute('href'), siteUrl);
        if (k.kind === 'page') {
          ev.preventDefault();
          go?.(k.page);
        } else if (k.kind === 'runtime') {
          ev.preventDefault();
          note?.(RUNTIME_NOTE);
        }
      },
      true,
    );
  };
}
