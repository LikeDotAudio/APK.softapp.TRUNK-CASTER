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
 * THE BUTTONS DECLARE, THE SHELL SENDS (PLAN-3394.01). Power, a named command
 * and a deploy are writes to somebody else's hardware, so this frame writes
 * nothing: ⏻ ›_ ⤒ pick an action and hand it to `OS.machineCommand`, which
 * shows the person the shell's own confirmation, logs it and publishes it as
 * the broker's operator (the doctrine `A frame may not write to hardware`).
 * What can be asked is what the machine's own agent (PLUGIN.MACHINE) says it
 * can do in its retained `detail`; its answer comes back retained as `answer`
 * on the record and is shown in the row. No agent, no buttons that pretend.
 */

/** How long a sample is believed, ms: five minutes, and then it is dead. */
export const TRUST_MS = 5 * 60 * 1000;

/**
 * What a record says about its machine now: { state, why }, the state a word of
 * the SDK's state token (contracts/tokens/state.json), so the row is drawn with
 * the token's tone: online (heard inside TRUST_MS) · offline (the probe said so,
 * newer than its last sample) · unresponsive (heard once, quiet past TRUST_MS:
 * unreachable is dead) · stale (a remembered online, no sample yet) · unknown
 * (nothing heard at all).
 */
export function judge(rec, now = Date.now()) {
  const st = rec.status ?? {};
  const age = rec.heardAt ? now - rec.heardAt : Infinity;
  if (st.status === 'offline' && rec.statusAt >= rec.heardAt) return { state: 'offline', why: `offline${st.reason ? ` · ${st.reason.replace(/_/g, ' ')}` : ''}${st.at ? ` · ${st.at}` : ''}` };
  if (age <= TRUST_MS) return { state: 'online', why: `heard ${ago(age)}` };
  if (rec.heardAt) return { state: 'unresponsive', why: `not heard for ${ago(age)}` };
  return st.status === 'online' ? { state: 'stale', why: 'a remembered “online” — no sample yet' } : { state: 'unknown', why: 'no sample yet' };
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

const ORDER = { online: 0, stale: 1, unknown: 2, offline: 3, unresponsive: 4 };

/**
 * What the three buttons may ask of one machine, read off its agent's
 * `detail` — never a list kept here. `{ power, run, deploy, why }`: each a list
 * of `{ label, verb, action?, name?, mac? }`, and `why` when there is no agent.
 * A machine that is not alive can only be woken: its own agent cannot answer,
 * so `power on` goes to a wake relay with the MAC it last published.
 */
export function actionsFor(rec, state) {
  const d = rec.detail;
  if (!d) return { power: [], run: [], deploy: [], why: 'no machine agent (PLUGIN.MACHINE) has spoken for this machine' };
  const mac = (d.macs ?? []).map((m) => m.mac).find(Boolean);
  const wake = mac ? [{ label: `Power on — wake ${mac}`, verb: 'power', action: 'on', mac }] : [];
  if (state !== 'online') return { power: wake, run: [], deploy: [], why: wake.length ? '' : 'not alive, and no MAC to wake it by' };
  const power = d.power_method && d.power_method !== 'none'
    ? [{ label: 'Reboot', verb: 'power', action: 'cycle' }, { label: 'Power off', verb: 'power', action: 'off' }]
    : [];
  return {
    power,
    run: (d.commands ?? []).map((name) => ({ label: name, verb: 'run', name })),
    deploy: (d.deploys ?? []).map((name) => ({ label: name, verb: 'deploy', name })),
    why: '',
  };
}

/** One line for the last answer the machine gave: `done · … · 12 s ago`. */
export function answerLine(rec, now = Date.now()) {
  const a = rec.answer;
  if (!a) return '';
  const what = [a.verb, a.action ?? a.name].filter(Boolean).join(' ');
  return `${what ? `${what}: ` : ''}${a.status}${a.dry_run ? ' (dry run)' : ''} · ${a.detail ?? ''} · ${ago(now - (a.at_ms ?? rec.answerAt ?? now))}`;
}

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

/** The machine API version this tab speaks (list, read, watch, command — as below). */
export const MACHINE_API = 1;
const NAMED = ['machineBusList', 'machineBusRead', 'machineBusWatch', 'machineCommand'];

/**
 * The shell's machine API as this tab uses it — `{ list, read, watch, command }` —
 * or `{ missing }` saying why not, so a reshaped OS shows "needs …", never a
 * silent empty tab. An OS that publishes `OS.machineApi = { version, list, read,
 * watch, command }` is held to MACHINE_API; one from before that is read by the
 * four named functions it has always had, each checked.
 */
export function machineApi(os) {
  if (!os) return { missing: 'not in the OS' };
  const api = os.machineApi;
  if (api && typeof api === 'object') {
    if (api.version !== MACHINE_API) return { missing: `this tab speaks machine API ${MACHINE_API}; the OS offers ${api.version ?? 'an unversioned one'}` };
    const gone = ['list', 'read', 'watch', 'command'].filter((k) => typeof api[k] !== 'function');
    if (gone.length) return { missing: `the OS's machine API ${MACHINE_API} lacks ${gone.join(', ')}` };
    return { list: () => api.list(), read: (h) => api.read(h), watch: (fn) => api.watch(fn), command: (req) => api.command(req) };
  }
  const gone = NAMED.filter((k) => typeof os[k] !== 'function');
  if (gone.length === NAMED.length) return { missing: 'not in the OS' };
  if (gone.length) return { missing: `the OS lacks ${gone.join(', ')} — this tab needs machine API ${MACHINE_API}` };
  return { list: () => os.machineBusList(), read: (h) => os.machineBusRead(h), watch: (fn) => os.machineBusWatch(fn), command: (req) => os.machineCommand(req) };
}

/** The shell's OS object, or null — opened on its own, or from a page that is not the shell. */
function shell() {
  try {
    if (!window.parent || window.parent === window) return null;
    return window.parent.OS ?? null;
  } catch {
    return null;
  }
}

const pct = (v) => (Number.isFinite(v) ? `${Math.round(v)} %` : '—');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const BUTTONS = [['power', '⏻', 'Power'], ['run', '›_', 'Run a named command'], ['deploy', '⤒', 'Deploy']];

const bar = (v, warn = 80, bad = 92) => (Number.isFinite(v) ? `<span class="meter ${v >= bad ? 'bad' : v >= warn ? 'warn' : ''}"><i style="width:${Math.min(100, v)}%"></i></span>` : '');

let standaloneMachineSingleton = null;

/** Default standalone machine telemetry when running outside the OS shell. */
export function createStandaloneMachineApi() {
  if (standaloneMachineSingleton) return standaloneMachineSingleton;

  const now = Date.now();
  const list = [
    {
      host: 'portal-audio-01',
      segment: 'portal-audio-01',
      probe: 'APK.audio/System/BareMetal/MonitorProbes/portal-audio-01',
      heardAt: now - 15000,
      statusAt: now - 15000,
      status: { status: 'online' },
      telemetry: {
        os: { system: 'Linux', release: '6.8.0-audio', architecture: 'x86_64', uptime_sec: 172800 },
        cpu: { overall_percent: 21.4, core_count: 16, load_avg: { '1m': 0.62 }, temperatures: { 'Core 0': 46.5, 'Core 1': 47.0 } },
        memory: { percent: 34.2, total_mb: 65536 },
        storage: { partitions: [{ mountpoint: '/', percent: 48, total_gb: 1960 }] },
        network: { interfaces: { eno1: ['192.168.1.50'], eth0: ['10.0.0.10'] } }
      },
      detail: {
        hostname: 'portal-audio-01',
        power_method: 'os',
        commands: ['uptime', 'restart-service', 'vacuum-logs'],
        deploys: ['plugins', 'config'],
        macs: [{ interface: 'eno1', mac: '52:54:00:11:22:33' }]
      },
      answer: null
    },
    {
      host: 'trunk-caster-node',
      segment: 'trunk-caster-node',
      probe: 'APK.audio/System/BareMetal/MonitorProbes/trunk-caster-node',
      heardAt: now - 8000,
      statusAt: now - 8000,
      status: { status: 'online' },
      telemetry: {
        os: { system: 'Linux', release: '6.8.0-rt', architecture: 'x86_64', uptime_sec: 345600 },
        cpu: { overall_percent: 14.8, core_count: 8, load_avg: { '1m': 0.28 }, temperatures: { 'Core 0': 41.2, 'Core 1': 42.0 } },
        memory: { percent: 22.5, total_mb: 32768 },
        storage: { partitions: [{ mountpoint: '/', percent: 32, total_gb: 980 }] },
        network: { interfaces: { eno1: ['192.168.1.51'] } }
      },
      detail: {
        hostname: 'trunk-caster-node',
        power_method: 'os',
        commands: ['uptime', 'reload-matrix', 'resync-ptp'],
        deploys: ['firmware', 'plugins'],
        macs: [{ interface: 'eno1', mac: '52:54:00:44:55:66' }]
      },
      answer: null
    },
    {
      host: 'ob-truck-gateway',
      segment: 'ob-truck-gateway',
      probe: 'APK.audio/System/BareMetal/MonitorProbes/ob-truck-gateway',
      heardAt: now - 35000,
      statusAt: now - 35000,
      status: { status: 'online' },
      telemetry: {
        os: { system: 'Linux', release: '6.8.0-edge', architecture: 'aarch64', uptime_sec: 86400 },
        cpu: { overall_percent: 32.1, core_count: 12, load_avg: { '1m': 1.10 }, temperatures: { 'SoC': 54.0 } },
        memory: { percent: 45.0, total_mb: 16384 },
        storage: { partitions: [{ mountpoint: '/', percent: 61, total_gb: 480 }] },
        network: { interfaces: { eth0: ['192.168.10.20'], srt0: ['10.10.0.2'] } }
      },
      detail: {
        hostname: 'ob-truck-gateway',
        power_method: 'os',
        commands: ['uptime', 'ping-hq', 'reconnect-srt'],
        deploys: ['config'],
        macs: [{ interface: 'eth0', mac: '52:54:00:77:88:99' }]
      },
      answer: null
    }
  ];

  const map = new Map(list.map((r) => [r.host, r]));
  const seats = new Set();

  standaloneMachineSingleton = {
    version: MACHINE_API,
    isStandalone: true,
    list() {
      return Array.from(map.values());
    },
    read(host) {
      return map.get(host) ?? null;
    },
    watch(fn) {
      if (typeof fn !== 'function') return () => {};
      seats.add(fn);
      return () => seats.delete(fn);
    },
    async command(req) {
      const rec = map.get(req.host);
      const cmdId = `standalone-cmd-${Date.now().toString(36)}`;
      const logId = `log-${Math.random().toString(36).slice(2, 6)}`;
      if (rec) {
        rec.answer = { id: cmdId, status: 'ok', detail: `Action ${req.verb || req.action || 'command'} confirmed in standalone mode` };
        seats.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
      }
      return { cancelled: false, log_id: logId, command_id: cmdId };
    }
  };

  return standaloneMachineSingleton;
}


/* THE ONE TABLE (ROAD-3494): the fleet is APKTable 'trunk-caster-machines'
   (vendor/apk-table, held to /FrontEnd/shared by check.sh webshared). The rows
   stay this file's escaped markup — buttons, bars, the click delegation on
   `host` — written through APKTable.markup() once and adopted; after that only
   the tbody is rewritten, so a sort or filter the operator chose survives the
   5 s redraw. Any script reads it as APKTable.get('trunk-caster-machines'). */
export const MACHINES_TABLE_ID = 'trunk-caster-machines';
const MACHINES_HEAD = '<tr><th data-key="machine">machine</th><th data-key="state">state</th><th data-key="os">OS · up</th><th data-key="cpu">CPU</th><th data-key="memory">memory</th><th data-key="disk">fullest disk</th><th data-key="hottest">hottest</th><th data-key="seen">last seen at</th><th data-key="actions" title="Power, a named command, a deploy — each confirmed in the OS, logged and sent as the operator">actions</th></tr>';

export function paintMachines(host, body, hint, T = globalThis.APKTable) {
  const live = T && T.get(MACHINES_TABLE_ID);
  if (live && live.el && host.contains(live.el)) {
    const tbody = live.el.querySelector('tbody');
    tbody.innerHTML = body;
    live.render();   // re-read the rows now, keeping the sort and filter
    const p = host.querySelector('p.hint');
    if (p) p.innerHTML = hint;
    return live;
  }
  host.innerHTML = T.markup({ id: MACHINES_TABLE_ID, className: 'machines', head: MACHINES_HEAD, body, toolbar: true, searchPlaceholder: 'Filter machines' })
    + `<p class="hint">${hint}</p>`;
  T.scan(host);
  return T.get(MACHINES_TABLE_ID);
}

/** Draw the machines into `host`, keep them current; returns the unmount. */
export function mountMachines(host, status) {
  let os = machineApi(shell());
  let isStandalone = false;
  if (os.missing === 'not in the OS') {
    os = createStandaloneMachineApi();
    isStandalone = true;
    const pill = typeof document !== 'undefined' ? document.getElementById('standalone-pill') : null;
    if (pill) pill.hidden = false;
  } else if (os.missing) {
    host.innerHTML = `<div class="empty"><h2>This OS cannot show the machines</h2><p>${esc(os.missing)}. Update the APK.audio OS, or this window, so the two agree.</p></div>`;
    status.textContent = `needs machine API ${MACHINE_API}`;
    return () => {};
  }
  /* What this window is doing: which menu is open, and the last word from the
     shell per machine (asking, sent, cancelled, refused). Keyed by host. */
  let open = null;
  const said = {};
  let rehearse = false;

  const send = async (r, a) => {
    open = null;
    said[r.host] = { text: 'waiting for your confirmation in the OS…' };
    draw();
    try {
      const out = await os.command({ probe: r.probe, host: r.segment, verb: a.verb, action: a.action, name: a.name, mac: a.mac, dry_run: rehearse });
      said[r.host] = out.cancelled
        ? { text: 'cancelled — nothing was sent' }
        : { text: `sent · log ${out.log_id} — waiting for the machine to answer`, id: out.command_id };
    } catch (err) {
      said[r.host] = { text: `not sent: ${err.message}`, bad: true };
      globalThis.APKSoftapp?.showProblem(err, { subject: `${a.label ?? a.verb} on ${r.host}`, onRetry: () => send(r, a) });
    }
    draw();
  };

  host.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-host]');
    if (b && host.contains(b)) {
      const rec = os.read(b.dataset.host);
      if (!rec) return;
      if (b.dataset.kind && b.dataset.i === undefined) {
        open = open && open.host === rec.host && open.kind === b.dataset.kind ? null : { host: rec.host, kind: b.dataset.kind };
        draw();
        return;
      }
      const a = actionsFor(rec, judge(rec).state)[b.dataset.kind]?.[Number(b.dataset.i)];
      if (a) send(rec, a);
      return;
    }
    const box = e.target.closest('input[data-rehearse]');
    if (box) rehearse = box.checked;
  });

  const cell = (r, j) => {
    const can = actionsFor(r, j.state);
    const buttons = BUTTONS.map(([kind, glyph, title]) => {
      const n = can[kind].length;
      const t = n ? title : `${title} — ${can.why || `nothing this machine's agent offers`}`;
      return `<button data-host="${esc(r.host)}" data-kind="${kind}" title="${esc(t)}"${n ? '' : ' disabled'}${open && open.host === r.host && open.kind === kind ? ' class="on"' : ''}>${glyph}</button>`;
    }).join('');
    const menu = open && open.host === r.host
      ? `<div class="menu">${can[open.kind].map((a, i) => `<button data-host="${esc(r.host)}" data-kind="${open.kind}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div>`
      : '';
    const mine = said[r.host];
    const answered = mine?.id && r.answer?.id === mine.id;
    const word = answered || !mine ? answerLine(r) : mine.text;
    const bad = answered ? ['refused', 'error'].includes(r.answer.status) : mine?.bad;
    return `${buttons}${menu}${word ? `<div class="sub answer${bad ? ' bad' : ''}">${esc(word)}</div>` : ''}`;
  };

  const draw = () => {
    const now = Date.now();
    const rows = os.list().map((r) => ({ r, j: judge(r, now), h: health(r) }));
    rows.sort((a, b) => ORDER[a.j.state] - ORDER[b.j.state] || a.r.host.localeCompare(b.r.host));
    const count = (s) => rows.filter((x) => x.j.state === s).length;
    const modeTag = isStandalone ? '<span style="color:var(--apk-accent,#ffa600);opacity:0.85;margin-right:6px;">[Standalone Bus]</span>' : '';
    status.innerHTML = rows.length ? `${modeTag}${count('online')} online · ${count('unresponsive') + count('offline')} dead · ${count('stale') + count('unknown')} unheard` : '';
    if (!rows.length) {
      host.innerHTML = `<div class="empty"><h2>No machines on the bus yet</h2><p>A machine appears here when its monitor probe speaks under <code>APK.audio/System/BareMetal/MonitorProbes/</code> — run PLUGIN.DESKTOP_MONITOR on it.</p></div>`;
      return;
    }
    const body = rows
      .map(({ r, j, h }) => `
          <tr class="${j.state}" data-apk-state="${j.state}">
            <td data-sort="${esc(r.host)}"><b>${esc(r.host)}</b><div class="sub">${esc(r.probe)}</div></td>
            <td data-sort="${ORDER[j.state]}"><span class="dot"></span>${esc(j.state)}<div class="sub">${esc(j.why)}</div></td>
            <td>${esc(h.os || '—')}<div class="sub">${h.uptime ? `up ${esc(h.uptime)}` : ''}</div></td>
            <td data-sort="${Number.isFinite(h.cpu) ? h.cpu : ''}">${bar(h.cpu)} ${pct(h.cpu)}<div class="sub">${h.cores ? `${h.cores} cores` : ''}${Number.isFinite(h.load) ? ` · load ${h.load.toFixed(2)}` : ''}</div></td>
            <td data-sort="${Number.isFinite(h.mem) ? h.mem : ''}">${bar(h.mem)} ${pct(h.mem)}<div class="sub">${h.memTotal ? `of ${(h.memTotal / 1024).toFixed(1)} GB` : ''}</div></td>
            <td data-sort="${h.disk ? h.disk.percent : ''}">${h.disk ? `${bar(h.disk.percent)} ${pct(h.disk.percent)}<div class="sub">${esc(h.disk.at)} · ${h.disk.total} GB</div>` : '—'}</td>
            <td data-sort="${h.hot ? h.hot.c : ''}">${h.hot ? `<span class="${h.hot.c >= 85 ? 'hot' : ''}">${h.hot.c.toFixed(0)} °C</span><div class="sub">${esc(h.hot.label)}</div>` : '—'}</td>
            <td class="ips">${h.ips.length ? h.ips.map(esc).join('<br>') : '—'}</td>
            <td class="acts">${cell(r, j)}</td>
          </tr>`)
      .join('');
    const hint = `Alive is a sample heard in the last ${TRUST_MS / 60000} minutes; anything quieter is dead, whatever it last said. Addresses are where each machine was last seen — DHCP moves them. ⏻ ›_ ⤒ offer what each machine's agent says it can do; the OS asks you to confirm, logs it and sends it as the operator, and the machine's answer appears under the buttons. <label><input type="checkbox" data-rehearse${rehearse ? ' checked' : ''}> rehearse (dry run)</label>`;
    paintMachines(host, body, hint);
  };
  draw();
  let queued = false;
  const unwatch = os.watch(() => {
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
