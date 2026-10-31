// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table } from '../dom.js';
import { live, framesOf, siteOf } from '../view.js';

/**
 * THE GLOBE — every site the caster publishes (trunk/Site/{slug}), the frames
 * at each (trunk/Device/Frame/{frame}, which carry lat/lon) and the trunks
 * between them (trunk/Trunk/{trunk}) as great-circle arcs, on an orthographic
 * globe that turns by itself and by drag. Land is data/land.json, the same
 * outline Trunk-Caster's own globe drew (RUST-RUNTIME/src/land.json): rings of
 * [lon, lat, lon, lat, …].
 */

const D = Math.PI / 180;

/** Orthographic projection: [x, y, visible] on a unit disc, the centre at (lon0, lat0). */
export function project(lon, lat, lon0, lat0) {
  const l = (lon - lon0) * D, p = lat * D, p0 = lat0 * D;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return [Math.cos(p) * Math.sin(l), -(Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), cosc >= 0];
}

/** Points along the great circle from a to b ([lon, lat]), n segments. */
export function arc(a, b, n = 32) {
  const toV = ([lon, lat]) => [Math.cos(lat * D) * Math.cos(lon * D), Math.cos(lat * D) * Math.sin(lon * D), Math.sin(lat * D)];
  const va = toV(a), vb = toV(b);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const w = Math.acos(dot);
  if (w < 1e-9) return [a, b];
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s1 = Math.sin((1 - t) * w) / Math.sin(w), s2 = Math.sin(t * w) / Math.sin(w);
    const v = [s1 * va[0] + s2 * vb[0], s1 * va[1] + s2 * vb[1], s1 * va[2] + s2 * vb[2]];
    out.push([Math.atan2(v[1], v[0]) / D, Math.atan2(v[2], Math.hypot(v[0], v[1])) / D]);
  }
  return out;
}

export function create(ctx) {
  const canvas = el('canvas', { class: 'tc-globe', width: 720, height: 720, title: 'Drag to turn the globe' });
  const side = live('tc-side');
  const node = el('div', { class: 'tc-view tc-globe-view' }, el('div', { class: 'tc-globe-wrap' }, canvas), side.node);
  let land = [];
  fetch(new URL('../../../data/land.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : []))
    .then((rings) => (land = Array.isArray(rings) ? rings : []))
    .catch(() => (land = []));

  let lon0 = -40, lat0 = 25, spin = true, store = null, dragging = null, raf = 0, last = performance.now();
  canvas.addEventListener('pointerdown', (e) => { dragging = [e.clientX, e.clientY, lon0, lat0]; spin = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    lon0 = dragging[2] - (e.clientX - dragging[0]) * 0.4;
    lat0 = Math.max(-80, Math.min(80, dragging[3] + (e.clientY - dragging[1]) * 0.4));
  });
  canvas.addEventListener('pointerup', () => (dragging = null));
  canvas.addEventListener('dblclick', () => (spin = !spin));

  const where = (s) => (Number.isFinite(s?.lon) && Number.isFinite(s?.lat) ? [s.lon, s.lat] : null);

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (spin) lon0 += ((now - last) / 1000) * 5;
    last = now;
    const g = canvas.getContext('2d');
    const css = getComputedStyle(canvas);
    const W = canvas.width, R = W / 2 - 8, cx = W / 2, cy = W / 2;
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#0d1824';
    g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.fill();
    const P = (lon, lat) => { const [x, y, v] = project(lon, lat, lon0, lat0); return [cx + x * R, cy + y * R, v]; };
    // graticule
    g.strokeStyle = '#1c2b3b'; g.lineWidth = 1;
    for (let lon = -180; lon < 180; lon += 30) line(g, P, Array.from({ length: 37 }, (_, i) => [lon, -90 + i * 5]));
    for (let lat = -60; lat <= 60; lat += 30) line(g, P, Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
    // land
    g.strokeStyle = '#4a6a86'; g.fillStyle = '#16283a';
    for (const ring of land) {
      const pts = [];
      for (let i = 0; i + 1 < ring.length; i += 2) pts.push([ring[i], ring[i + 1]]);
      line(g, P, pts);
    }
    if (!store) return;
    const frames = framesOf(store);
    const at = Object.fromEntries(frames.map((f) => [f.id, where(f)]));
    // trunks
    // many trunks: thin and translucent, so the land and the sites still read through them
    const trunks = Object.values(store.trunks);
    g.strokeStyle = css.getPropertyValue('--accent') || '#ffa600'; g.lineWidth = trunks.length > 200 ? 0.7 : 1.6;
    g.globalAlpha = trunks.length > 200 ? 0.18 : 0.9;
    for (const t of trunks) {
      const a = at[t.a_frame], b = at[t.b_frame];
      if (a && b) line(g, P, arc(a, b));
    }
    g.globalAlpha = 1;
    // every frame a dot, and every site the caster has published a labelled one over it
    const dots = [
      ...frames.map((f) => ({ p: where(f), r: 1.8, name: f.id })),
      ...Object.values(store.sites).map((s) => ({ p: where(s), r: s.tier === 'capital' ? 4 : s.tier === 'province' ? 3 : 2.5, name: s.name, label: true })),
    ];
    g.font = '10px system-ui';
    for (const d of dots) {
      if (!d.p) continue;
      const [x, y, v] = P(d.p[0], d.p[1]);
      if (!v) continue;
      g.fillStyle = '#dce4ee';
      g.beginPath(); g.arc(x, y, d.r, 0, 2 * Math.PI); g.fill();
      if (d.label) g.fillText(d.name, x + 6, y + 3);
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    node,
    update(s) {
      store = s;
      const frames = framesOf(s);
      const bySite = {};
      for (const f of frames) (bySite[siteOf(f)] ??= []).push(f);
      const sites = Object.values(s.sites).sort((a, b) => (b.frames ?? 0) - (a.frames ?? 0));
      side.set(
        el('p', { class: 'hint' }, `${sites.length || Object.keys(bySite).length} sites · ${frames.length} frames · ${Object.keys(s.trunks).length} trunks · ${Object.keys(s.connections).length} live connections. Drag to turn; double-click to stop or start the spin.`),
        section('Sites', table([
          ['Site', (x) => x.name],
          ['Tier', (x) => x.tier],
          ['Country', (x) => x.country],
          ['Frames', (x) => String((bySite[x.name] ?? bySite[x.slug])?.length ?? x.frames ?? 0)],
        ], sites, 'The caster has published no sites (trunk/Site/…).')),
      );
    },
    stop() { cancelAnimationFrame(raf); },
  };
}

function line(g, P, pts) {
  g.beginPath();
  let pen = false;
  for (const [lon, lat] of pts) {
    const [x, y, v] = P(lon, lat);
    if (!v) { pen = false; continue; }
    if (pen) g.lineTo(x, y); else g.moveTo(x, y);
    pen = true;
  }
  g.stroke();
}
