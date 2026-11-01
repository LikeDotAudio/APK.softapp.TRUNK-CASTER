// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import { el, section, table } from '../dom.js';
import { live, framesOf, siteOf } from '../view.js';

/**
 * THE GLOBE — every site the caster publishes (trunk/Site/{slug}), the frames
 * at each (trunk/Frame/{frame}: its device carries lat/lon) and the trunks
 * between them (the trunks in those documents) as great-circle arcs, on an orthographic
 * globe that turns by itself and by drag. Land is data/land.json, the same
 * outline Trunk-Caster's own globe drew (RUST-RUNTIME/src/land.json): rings of
 * [lon, lat, lon, lat, …]. Beside it, from the caster's own views (ROAD-3453):
 * each site's local time, load and calls (trunk/View/Regions, the old
 * /api/regions) and the trunks that became habits — most used, longest locked
 * streak (View/Globe, the trend part of the old /api/globe).
 *
 * DRAWN FROM CACHED GEOMETRY, AND ONLY WHEN SOMETHING MOVED (ROAD-3468). The
 * globe used to rebuild everything on every animation frame: ~2,100 great
 * circles (33 points each, all trig), the land rings re-sliced, the frames
 * re-sorted, getComputedStyle, then one stroke per graticule line and land
 * ring, while the side panel rebuilt its whole Sites table at every bus update.
 * Under a busy hour it drew 23 fps. Now every line on the globe is unit vectors
 * made once (the land and graticule when they arrive, an arc when a trunk's
 * ends move, kept by its ends in an ArcCache), a frame of the spin is one
 * rotation per point, the graticule, the land and the frame dots go out as one
 * path each (all opaque, so nothing stacks differently), and a
 * still globe (spin stopped, no drag, no new data) is not drawn again. The side
 * panel's tables are rebuilt only when what they show changed.
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

/** A point as a unit vector [x, y, z]. */
export function unit(lon, lat) {
  const p = lat * D, l = lon * D;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

/** Points [lon, lat, lon, lat, …] (or [[lon, lat], …]) as packed unit vectors. */
export function vectors(pts) {
  const flat = typeof pts[0] === 'number';
  const n = flat ? pts.length >> 1 : pts.length;
  const out = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = flat ? unit(pts[2 * i], pts[2 * i + 1]) : unit(pts[i][0], pts[i][1]);
    out[3 * i] = x; out[3 * i + 1] = y; out[3 * i + 2] = z;
  }
  return out;
}

/** The rotation for a globe centred on (lon0, lat0): what project() does, made once per frame. */
export function orientation(lon0, lat0) {
  return { cl: Math.cos(lon0 * D), sl: Math.sin(lon0 * D), cp: Math.cos(lat0 * D), sp: Math.sin(lat0 * D) };
}

/** project() for a unit vector: [x, y, visible], the same numbers without any trig. */
export function projectUnit(x, y, z, o) {
  const c = x * o.cl + y * o.sl;
  return [y * o.cl - x * o.sl, -(o.cp * z - o.sp * c), o.sp * z + o.cp * c >= 0];
}

/**
 * The great-circle arcs of the trunks, kept by their ends. `update(pairs)` takes
 * [[a, b]] ([lon, lat] each) and returns one entry per distinct arc,
 * { vecs, count } (count = how many trunks run it); an arc whose ends did not
 * move is the same Float64Array as last time, one no trunk runs any more is
 * dropped. `built` counts the arcs made, for the tests.
 */
export class ArcCache {
  constructor(n = 32) { this.n = n; this.byKey = new Map(); this.built = 0; }
  update(pairs) {
    const seen = new Map();
    for (const [a, b] of pairs) {
      const key = `${a[0]},${a[1]}>${b[0]},${b[1]}`;
      const had = seen.get(key);
      if (had) { had.count++; continue; }
      let vecs = this.byKey.get(key);
      if (!vecs) { vecs = vectors(arc(a, b, this.n)); this.built++; }
      seen.set(key, { vecs, count: 1 });
    }
    this.byKey = new Map([...seen].map(([k, v]) => [k, v.vecs]));
    return [...seen.values()];
  }
}

/**
 * Draw on demand: `due(lon0, lat0, spin)` says whether this animation frame has
 * anything new to show — the spin is running, the globe was turned, or
 * `mark()` was called (new data, land arrived, a size or colour changed).
 */
export function painter() {
  let dirty = true, at = null;
  return {
    mark() { dirty = true; },
    due(lon0, lat0, spin) {
      const moved = !at || at[0] !== lon0 || at[1] !== lat0;
      if (!dirty && !spin && !moved) return false;
      dirty = false; at = [lon0, lat0];
      return true;
    },
  };
}

/** The graticule as polylines of unit vectors: meridians every 30°, parallels every 30° to ±60°. */
function graticule() {
  const lines = [];
  for (let lon = -180; lon < 180; lon += 30) lines.push(vectors(Array.from({ length: 37 }, (_, i) => [lon, -90 + i * 5])));
  for (let lat = -60; lat <= 60; lat += 30) lines.push(vectors(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat])));
  return lines;
}

/** One polyline of unit vectors into the current path, lifting the pen over the far side. */
function trace(g, vecs, o, cx, cy, R) {
  let pen = false;
  for (let i = 0; i < vecs.length; i += 3) {
    const x = vecs[i], y = vecs[i + 1], z = vecs[i + 2];
    const c = x * o.cl + y * o.sl;
    if (o.sp * z + o.cp * c < 0) { pen = false; continue; }
    const px = cx + (y * o.cl - x * o.sl) * R, py = cy - (o.cp * z - o.sp * c) * R;
    if (pen) g.lineTo(px, py); else g.moveTo(px, py);
    pen = true;
  }
}

/** Is the row list the same as last time, by the identity of each row? */
const sameRows = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);

export function create(ctx) {
  const canvas = el('canvas', { class: 'tc-globe', width: 720, height: 720, title: 'Drag to turn the globe' });
  const side = live('tc-side');
  const node = el('div', { class: 'tc-view tc-globe-view' }, el('div', { class: 'tc-globe-wrap' }, canvas), side.node);
  const paint = painter();
  const grid = graticule();
  let land = [];
  fetch(new URL('../../../data/land.json', import.meta.url))
    .then((r) => (r.ok ? r.json() : []))
    .then((rings) => { land = Array.isArray(rings) ? rings.map(vectors) : []; paint.mark(); })
    .catch(() => (land = []));

  let lon0 = -40, lat0 = 25, spin = true, dragging = null, raf = 0, last = performance.now();
  canvas.addEventListener('pointerdown', (e) => { dragging = [e.clientX, e.clientY, lon0, lat0]; spin = false; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    lon0 = dragging[2] - (e.clientX - dragging[0]) * 0.4;
    lat0 = Math.max(-80, Math.min(80, dragging[3] + (e.clientY - dragging[1]) * 0.4));
  });
  canvas.addEventListener('pointerup', () => (dragging = null));
  canvas.addEventListener('dblclick', () => (spin = !spin));

  const where = (s) => (Number.isFinite(s?.lon) && Number.isFinite(s?.lat) ? [s.lon, s.lat] : null);

  // What the store says, as geometry, made in update() and only read by the draw.
  const arcs = new ArcCache();
  let scene = null; // { trunkArcs, many, accent, frameDots: [x,y,z…], siteDots: [{ v, r, name }] }
  const g = canvas.getContext('2d');

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (spin) lon0 += ((now - last) / 1000) * 5;
    last = now;
    if (!paint.due(lon0, lat0, spin)) return;
    const W = canvas.width, R = W / 2 - 8, cx = W / 2, cy = W / 2;
    const o = orientation(lon0, lat0);
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#0d1824';
    g.beginPath(); g.arc(cx, cy, R, 0, 2 * Math.PI); g.fill();
    // graticule
    g.strokeStyle = '#1c2b3b'; g.lineWidth = 1;
    g.beginPath(); for (const v of grid) trace(g, v, o, cx, cy, R); g.stroke();
    // land
    g.strokeStyle = '#4a6a86'; g.fillStyle = '#16283a';
    g.beginPath(); for (const v of land) trace(g, v, o, cx, cy, R); g.stroke();
    if (!scene) return;
    // trunks
    // many trunks: thin and translucent, so the land and the sites still read through them.
    // Each trunk is its own translucent stroke, so where they cross or share an arc they
    // stack; trunks along the very same arc trace it once and stroke it once each.
    g.strokeStyle = scene.accent; g.lineWidth = scene.many ? 0.7 : 1.6;
    g.globalAlpha = scene.many ? 0.18 : 0.9;
    for (const { vecs, count } of scene.trunkArcs) {
      g.beginPath(); trace(g, vecs, o, cx, cy, R);
      for (let k = 0; k < count; k++) g.stroke();
    }
    g.globalAlpha = 1;
    // every frame a dot, and every site the caster has published a labelled one over it
    g.fillStyle = '#dce4ee';
    g.beginPath();
    const fd = scene.frameDots;
    for (let i = 0; i < fd.length; i += 3) {
      const [x, y, v] = projectUnit(fd[i], fd[i + 1], fd[i + 2], o);
      if (!v) continue;
      const px = cx + x * R, py = cy + y * R;
      g.moveTo(px + 1.8, py); g.arc(px, py, 1.8, 0, 2 * Math.PI);
    }
    g.fill();
    g.font = '10px system-ui';
    for (const d of scene.siteDots) {
      const [x, y, v] = projectUnit(d.v[0], d.v[1], d.v[2], o);
      if (!v) continue;
      const px = cx + x * R, py = cy + y * R;
      g.beginPath(); g.arc(px, py, d.r, 0, 2 * Math.PI); g.fill();
      g.fillText(d.name, px + 6, py + 3);
    }
  }
  raf = requestAnimationFrame(frame);

  // The side panel, in parts that are rebuilt only when what they show changed.
  const regionsBox = live('tc-side-part'), habitsBox = live('tc-side-part'), sitesBox = live('tc-side-part');
  const hint = el('p', { class: 'hint' });
  side.set(regionsBox.node, habitsBox.node, hint, sitesBox.node);
  const shown = { regions: undefined, trends: undefined, sites: null, counts: null };

  return {
    node,
    update(s) {
      // read before this update writes to the page, so it costs no forced style pass
      const accent = getComputedStyle(canvas).getPropertyValue('--accent') || '#ffa600';
      const frames = framesOf(s);
      const at = new Map();
      for (const f of frames) at.set(f.id, where(f));
      const trunks = Object.values(s.trunks);
      const pairs = [];
      for (const t of trunks) {
        const a = at.get(t.a_frame), b = at.get(t.b_frame);
        if (a && b) pairs.push([a, b]);
      }
      const frameDots = [];
      for (const f of frames) { const p = at.get(f.id); if (p) frameDots.push(...unit(p[0], p[1])); }
      const siteDots = [];
      for (const st of Object.values(s.sites)) {
        const p = where(st);
        if (p) siteDots.push({ v: unit(p[0], p[1]), r: st.tier === 'capital' ? 4 : st.tier === 'province' ? 3 : 2.5, name: st.name });
      }
      scene = {
        trunkArcs: arcs.update(pairs),
        many: trunks.length > 200,
        accent,
        frameDots: Float64Array.from(frameDots),
        siteDots,
      };
      paint.mark();

      const bySite = {};
      for (const f of frames) (bySite[siteOf(f)] ??= []).push(f);
      const sites = Object.values(s.sites).sort((a, b) => (b.frames ?? 0) - (a.frames ?? 0));
      const regions = Array.isArray(s.views?.Regions) ? s.views.Regions : null;
      const trends = s.views?.Globe;
      if (regions !== shown.regions) {
        shown.regions = regions;
        regionsBox.set(regions
          ? section('Local time and load', table([
            ['Site', (x) => x.site], ['Local', (x) => x.local_clock], ['Load', (x) => `${Math.round((Number(x.load) || 0) * 100)}%`],
            ['Calls', (x) => String(x.calls ?? 0)], ['Trunks', (x) => String(x.trunks ?? 0)], ['Panels live', (x) => String(x.panels_live ?? 0)],
          ], regions.slice().sort((a, b) => (b.calls ?? 0) - (a.calls ?? 0)).slice(0, 25), 'No site.'))
          : el('p', { class: 'hint' }, 'No local times on the bus yet (trunk/View/Regions).'));
      }
      if (trends !== shown.trends) {
        shown.trends = trends;
        const habits = Array.isArray(trends?.history) ? trends.history.slice().sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0) || (b.uses ?? 0) - (a.uses ?? 0)).slice(0, 15) : null;
        habitsBox.set(habits
          ? section('Trunk habits', table([
            ['A ↔ B', (h) => `${h.a} ↔ ${h.b}`], ['Uses', (h) => String(h.uses ?? 0)], ['Locked streak (days)', (h) => String(h.streak ?? 0)],
            ['Locked today', (h) => (h.lt ? 'yes' : '')], ['Longest', (h) => String(h.longest ?? '')],
          ], habits, 'No trunk has carried a call yet.'))
          : null);
      }
      const words = `${sites.length || Object.keys(bySite).length} sites · ${frames.length} frames · ${Object.keys(s.trunks).length} trunks · ${Object.keys(s.connections).length} live connections. Drag to turn; double-click to stop or start the spin.`;
      if (hint.textContent !== words) hint.textContent = words;
      const counts = sites.map((x) => (bySite[x.name] ?? bySite[x.slug])?.length ?? x.frames ?? 0).join(',');
      if (!sameRows(sites, shown.sites) || counts !== shown.counts) {
        shown.sites = sites; shown.counts = counts;
        sitesBox.set(section('Sites', table([
          ['Site', (x) => x.name],
          ['Tier', (x) => x.tier],
          ['Country', (x) => x.country],
          ['Frames', (x) => String((bySite[x.name] ?? bySite[x.slug])?.length ?? x.frames ?? 0)],
        ], sites, 'The caster has published no sites (trunk/Site/…).')));
      }
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
