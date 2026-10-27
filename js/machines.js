// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * THE MACHINES
 *
 * Every bare metal machine a monitor probe reports on the bus, read from the
 * store the shell keeps (APK:OS/Network/machine-bus) — this page holds no bus
 * client of its own, for the reason NETWORK.Switch's bus.js gives: one shell,
 * one connection, one answer to "is it on the bus".
 *
 * ALIVE IS HEARD, NOT REMEMBERED. A machine is alive while its samples keep
 * coming; one not heard for TRUST_MS is dead, whatever its last status said. A
 * retained `online` replayed at boot is only a memory of a machine, so until a
 * sample arrives it is shown as unheard. An `offline` the probe left behind
 * (its Will, or its goodbye) is dead with the reason it gave.
 *
 * Named by the hostname it gives itself; its addresses are shown as where it
 * was last seen, never as what it is.
 *
 * READ-ONLY. Power, a shell and a deploy are writes to somebody else's
 * hardware: they come through a confirmed path the shell owns, not from a
 * frame (the doctrine `A frame may not write to hardware`).
 */

/** How long a sample is believed, ms: five minutes, and then it is dead. */
export const TRUST_MS = 5 * 60 * 1000;

/** What a record says about its machine now: { state: alive | dead | offline | unheard, why }. */
export function judge(rec, now = Date.now()) {
  const st = rec.status ?? {};
  const age = rec.heardAt ? now - rec.heardAt : Infinity;
  if (st.status === 'offline' && rec.statusAt >= rec.heardAt) return { state: 'offline', why: `offline${st.reason ? ` · ${st.reason.replace(/_/g, ' ')}` : ''}${st.at ? ` · ${st.at}` : ''}` };
  if (age <= TRUST_MS) return { state: 'alive', why: `heard ${ago(age)}` };
  if (rec.heardAt) return { state: 'dead', why: `not heard for ${ago(age)}` };
  return { state: 'unheard', why: st.status === 'online' ? 'a remembered “online” — no sample yet' : 'no sample yet' };
}

/** A record's health, the few numbers that say how a machine is: plain data for the row. */
export function health(rec) {
  const t = rec.telemetry ?? {};
  const parts = t.storage?.partitions ?? [];
  const fullest = parts.reduce((a, p) => (!a || (p.percent ?? 0) > (a.percent ?? 0) ? p : a), null);
  const temps = Object.entries(t.cpu?.temperatures ?? {});
  const hottest = temps.reduce((a, b) => (!a || b[1] > a[1] ? b : a), null);
  const ips = Object.entries(t.network?.interfaces ?? {}).flatMap(([name, list]) => (list ?? []).map((ip) => `${ip} (${name})`));
  return {
    os: [t.os?.system, t.os?.release, t.os?.architecture].filter(Boolean).join(' '),
    uptime: Number.isFinite(t.os?.uptime_sec) ? duration(t.os.uptime_sec * 1000) : '',
    cpu: t.cpu?.overall_percent,
    cores: t.cpu?.core_count,
    load: t.cpu?.load_avg?.['1m'],
    mem: t.memory?.percent,
    memTotal: t.memory?.total_mb,
    disk: fullest ? { at: fullest.mountpoint, percent: fullest.percent, total: fullest.total_gb } : null,
    hot: hottest ? { label: hottest[0], c: hottest[1] } : null,
    ips,
  };
}

const ORDER = { alive: 0, unheard: 1, offline: 2, dead: 3 };

function ago(ms) {
  if (!Number.isFinite(ms)) return '—';
  if (ms < 60e3) return `${Math.max(0, Math.round(ms / 1000))} s ago`;
  return `${duration(ms)} ago`;
}

function duration(ms) {
  const m = Math.floor(ms / 60e3);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/** The shell's machine store, or null — opened on its own, or from a page that is not the shell. */
function shell() {
  try {
    if (!window.parent || window.parent === window) return null;
    const os = window.parent.OS;
    return os && typeof os.machineBusList === 'function' ? os : null;
  } catch {
    return null;
  }
}

const pct = (v) => (Number.isFinite(v) ? `${Math.round(v)} %` : '—');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const bar = (v, warn = 80, bad = 92) => (Number.isFinite(v) ? `<span class="meter ${v >= bad ? 'bad' : v >= warn ? 'warn' : ''}"><i style="width:${Math.min(100, v)}%"></i></span>` : '');

/** Draw the machines into `host`, keep them current; returns the unmount. */
export function mountMachines(host, status) {
  const os = shell();
  if (!os) {
    host.innerHTML = `<div class="empty"><h2>No bus here</h2><p>The machines are read from the APK.audio OS's own connection to the bus. Open TRUNK-CASTER from the OS — <b>Intercom → TRUNK-CASTER</b> — to see them.</p></div>`;
    status.textContent = 'not in the OS';
    return () => {};
  }
  const draw = () => {
    const now = Date.now();
    const rows = os.machineBusList().map((r) => ({ r, j: judge(r, now), h: health(r) }));
    rows.sort((a, b) => ORDER[a.j.state] - ORDER[b.j.state] || a.r.host.localeCompare(b.r.host));
    const count = (s) => rows.filter((x) => x.j.state === s).length;
    status.textContent = rows.length ? `${count('alive')} alive · ${count('dead') + count('offline')} dead · ${count('unheard')} unheard` : '';
    if (!rows.length) {
      host.innerHTML = `<div class="empty"><h2>No machines on the bus yet</h2><p>A machine appears here when its monitor probe speaks under <code>APK.audio/System/BareMetal/MonitorProbes/</code> — run PLUGIN.DESKTOP_MONITOR on it.</p></div>`;
      return;
    }
    host.innerHTML = `
      <table class="machines">
        <thead><tr><th>machine</th><th>state</th><th>OS · up</th><th>CPU</th><th>memory</th><th>fullest disk</th><th>hottest</th><th>last seen at</th><th title="Power, shell and deploy come with phase 2 — through a confirmed path the shell owns">actions</th></tr></thead>
        <tbody>${rows
          .map(({ r, j, h }) => `
          <tr class="${j.state}">
            <td><b>${esc(r.host)}</b><div class="sub">${esc(r.probe)}</div></td>
            <td><span class="dot"></span>${esc(j.state)}<div class="sub">${esc(j.why)}</div></td>
            <td>${esc(h.os || '—')}<div class="sub">${h.uptime ? `up ${esc(h.uptime)}` : ''}</div></td>
            <td>${bar(h.cpu)} ${pct(h.cpu)}<div class="sub">${h.cores ? `${h.cores} cores` : ''}${Number.isFinite(h.load) ? ` · load ${h.load.toFixed(2)}` : ''}</div></td>
            <td>${bar(h.mem)} ${pct(h.mem)}<div class="sub">${h.memTotal ? `of ${(h.memTotal / 1024).toFixed(1)} GB` : ''}</div></td>
            <td>${h.disk ? `${bar(h.disk.percent)} ${pct(h.disk.percent)}<div class="sub">${esc(h.disk.at)} · ${h.disk.total} GB</div>` : '—'}</td>
            <td>${h.hot ? `<span class="${h.hot.c >= 85 ? 'hot' : ''}">${h.hot.c.toFixed(0)} °C</span><div class="sub">${esc(h.hot.label)}</div>` : '—'}</td>
            <td class="ips">${h.ips.length ? h.ips.map(esc).join('<br>') : '—'}</td>
            <td class="acts"><button disabled title="Phase 2">⏻</button><button disabled title="Phase 2">›_</button><button disabled title="Phase 2">⤒</button></td>
          </tr>`)
          .join('')}</tbody>
      </table>
      <p class="hint">Alive is a sample heard in the last ${TRUST_MS / 60000} minutes; anything quieter is dead, whatever it last said. Addresses are where each machine was last seen — DHCP moves them. Power, shell and deploy come next, through a confirmed path the OS owns.</p>`;
  };
  draw();
  let queued = false;
  const unwatch = os.machineBusWatch(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      draw();
    });
  });
  // the ages move on even when nothing speaks, and a machine going quiet is the news
  const tick = setInterval(draw, 5000);
  const stop = () => {
    unwatch();
    clearInterval(tick);
  };
  addEventListener('pagehide', stop, { once: true });
  return stop;
}
