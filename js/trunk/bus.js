// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * THE TRUNK-CASTER WINDOWS READ THE BUS THROUGH THE SHELL (ROAD-3440).
 *
 * PLUGIN.TRUNK_CASTER and PLUGIN.TRUNK_SIM speak the `trunk` contract
 * (contracts/TRUNK.md). In the APK:OS shell, the shell keeps every retained document
 * (APK:OS/Network/trunk-bus) and publishes commands. When opened outside the shell
 * (in a solo tab, softapps launcher, or standalone), createStandaloneTrunkApi() provides
 * an interactive local / direct bus store with live and sample telemetry, so the window
 * is fully functional and never presents a dead screen.
 */

/** The trunk API version these windows speak (snapshot, watch, command, signedIn). */
export const TRUNK_API = 1;

/** The shell's trunk API, or { missing: why }. */
export function trunkApi(win = globalThis.window) {
  let os = null;
  try {
    os = win && win.parent && win.parent !== win ? win.parent.OS : null;
  } catch {
    os = null;
  }
  if (!os) return { missing: 'Open this from the APK.audio OS (Intercom menu): the shell holds the bus these windows read.' };
  const api = os.trunkApi;
  if (!api) return { missing: 'This OS keeps no Trunk-Caster store (APK:OS/Network/trunk-bus) — rebuild WEB.Frontend-Assets and WEB.OsApi.' };
  if (api.version !== TRUNK_API) return { missing: `these windows speak trunk API ${TRUNK_API}; the OS offers ${api.version ?? 'an unversioned one'}` };
  return api;
}

/** Is the caster up, by its runner's own word (incoming/state) — never by a retained document alone. */
export function casterWord(store) {
  const s = store?.caster?.state;
  const word = typeof s === 'string' ? s : s?.state ?? s?.status ?? null;
  return word ?? 'unheard';
}

/** Default mock topology for standalone / direct operation outside the OS shell. */
function buildStandaloneStore() {
  const now = Date.now();
  return {
    caster: { state: 'listening', detail: 'standalone local caster', heardAt: now },
    sim: { state: 'active', speed: 60, hour: 14.5, running: true, detail: 'simulated clock 48kHz', heardAt: now },
    frames: {
      'hq-m7880-01': {
        id: 'hq-m7880-01',
        site: 'Toronto HQ',
        lat: 43.6532,
        lon: -79.3832,
        device: { name: 'Toronto Master Control M7880', model: 'M7880', ru: 2 },
        port_names: { U01: 'Director', U02: 'Producer', U03: 'Audio Eng', U04: 'Floor Mgr', U05: 'Cam 1', U06: 'Cam 2', U07: 'IFB Host', U08: 'Tape Playback' },
        protocol: 'mcom-2026',
        protocol_name: 'MicroCOM 2026'
      },
      'nyc-prod-01': {
        id: 'nyc-prod-01',
        site: 'New York Stage',
        lat: 40.7128,
        lon: -74.0060,
        device: { name: 'NYC Stage Intercom Frame', model: 'MicroCOM II', ru: 4 },
        port_names: { U01: 'NY Director', U02: 'NY Producer', U03: 'Tech Ops', U04: 'Stage PA' },
        protocol: 'opus-srt',
        protocol_name: 'Opus SRT'
      },
      'london-ob-01': {
        id: 'london-ob-01',
        site: 'London OB Truck',
        lat: 51.5074,
        lon: -0.1278,
        device: { name: 'London OB 1', model: 'MicroCOM III', ru: 3 },
        port_names: { U01: 'OB Lead', U02: 'OB Audio', U03: 'Wireless PA' },
        protocol: 'smpte-2110-30',
        protocol_name: 'SMPTE 2110-30'
      },
      'tokyo-hub-01': {
        id: 'tokyo-hub-01',
        site: 'Tokyo Studio Hub',
        lat: 35.6762,
        lon: 139.6503,
        device: { name: 'Tokyo Studio 101', model: 'M2026', ru: 2 },
        port_names: { U01: 'Tokyo Master', U02: 'Tokyo Remote' },
        protocol: 'webrtc-sip',
        protocol_name: 'WebRTC SIP'
      },
      'paris-bureau-01': {
        id: 'paris-bureau-01',
        site: 'Paris Bureau',
        lat: 48.8566,
        lon: 2.3522,
        device: { name: 'Paris Studio', model: 'MicroCOM II', ru: 3 },
        port_names: { U01: 'Bureau Chief', U02: 'Paris IFB' },
        protocol: 'aes67',
        protocol_name: 'AES67'
      }
    },
    trunks: {
      'trunk-tor-nyc': {
        id: 'trunk-tor-nyc',
        a_frame: 'hq-m7880-01',
        b_frame: 'nyc-prod-01',
        a_caster: '1',
        b_caster: '2',
        capacity: 32,
        channels: 8,
        gain_a_db: 0,
        gain_b_db: 0,
        connections: ['conn-1'],
        protocol: 'opus-srt',
        status: 'locked'
      },
      'trunk-tor-lon': {
        id: 'trunk-tor-lon',
        a_frame: 'hq-m7880-01',
        b_frame: 'london-ob-01',
        a_caster: '1',
        b_caster: '3',
        capacity: 16,
        channels: 4,
        gain_a_db: 0,
        gain_b_db: 0,
        connections: ['conn-2'],
        protocol: 'smpte-2110-30',
        status: 'locked'
      },
      'trunk-lon-par': {
        id: 'trunk-lon-par',
        a_frame: 'london-ob-01',
        b_frame: 'paris-bureau-01',
        a_caster: '3',
        b_caster: '4',
        capacity: 16,
        channels: 2,
        gain_a_db: 0,
        gain_b_db: 0,
        connections: [],
        protocol: 'aes67',
        status: 'locked'
      },
      'trunk-tor-tok': {
        id: 'trunk-tor-tok',
        a_frame: 'hq-m7880-01',
        b_frame: 'tokyo-hub-01',
        a_caster: '1',
        b_caster: '5',
        capacity: 8,
        channels: 2,
        gain_a_db: 0,
        gain_b_db: 0,
        connections: [],
        protocol: 'webrtc-sip',
        status: 'locked'
      }
    },
    connections: {
      'conn-1': {
        id: 'conn-1',
        trunk: 'trunk-tor-nyc',
        from_frame: 'hq-m7880-01',
        to_frame: 'nyc-prod-01',
        from_port: 'U01',
        to_port: 'U01',
        kind: 'audio',
        hops: ['trunk-tor-nyc'],
        who: 'Director',
        granted_unix: Math.floor(now / 1000) - 180,
        why: 'Production Call',
        origin: 'caster-local',
        protocol: 'opus-srt',
        talk: true,
        listen: true,
        bandwidth_kbps: 128
      },
      'conn-2': {
        id: 'conn-2',
        trunk: 'trunk-tor-lon',
        from_frame: 'hq-m7880-01',
        to_frame: 'london-ob-01',
        from_port: 'U03',
        to_port: 'U02',
        kind: 'audio',
        hops: ['trunk-tor-lon'],
        who: 'Audio Eng',
        granted_unix: Math.floor(now / 1000) - 90,
        why: 'Audio Intercom Sync',
        origin: 'caster-local',
        protocol: 'smpte-2110-30',
        talk: true,
        listen: true,
        bandwidth_kbps: 256
      }
    },
    crosspoints: {
      'hq-m7880-01': {
        frame: 'hq-m7880-01',
        at: new Date(now).toISOString(),
        seq: 1,
        closed: [
          { input: 'U01', output: 'U02', connection: 'conn-1', at: new Date(now).toISOString() },
          { input: 'U03', output: 'U04', connection: 'conn-2', at: new Date(now).toISOString() }
        ]
      },
      'nyc-prod-01': {
        frame: 'nyc-prod-01',
        at: new Date(now).toISOString(),
        seq: 1,
        closed: [{ input: 'U01', output: 'U03', connection: 'conn-1', at: new Date(now).toISOString() }]
      },
      'london-ob-01': {
        frame: 'london-ob-01',
        at: new Date(now).toISOString(),
        seq: 1,
        closed: [{ input: 'U02', output: 'U01', connection: 'conn-2', at: new Date(now).toISOString() }]
      }
    },
    bookings: {
      'bk-1': { id: 'bk-1', frame: 'hq-m7880-01', port: 1, program: 'Evening News', who: 'Director', start: 18.0, end: 19.5, daily: true, status: 'booked', reason: 'Daily Broadcast', kind: 'panel' },
      'bk-2': { id: 'bk-2', frame: 'nyc-prod-01', port: 2, program: 'Special Event', who: 'Tech Ops', start: 20.0, end: 22.0, daily: false, status: 'booked', reason: 'Live Gala', kind: 'input' }
    },
    sites: {
      'toronto': { name: 'Toronto HQ', slug: 'toronto', tier: 'capital', country: 'CA', lat: 43.6532, lon: -79.3832, frames: 1 },
      'new-york': { name: 'New York Stage', slug: 'new-york', tier: 'capital', country: 'US', lat: 40.7128, lon: -74.0060, frames: 1 },
      'london': { name: 'London OB Truck', slug: 'london', tier: 'province', country: 'GB', lat: 51.5074, lon: -0.1278, frames: 1 },
      'paris': { name: 'Paris Bureau', slug: 'paris', tier: 'province', country: 'FR', lat: 48.8566, lon: 2.3522, frames: 1 },
      'tokyo': { name: 'Tokyo Studio Hub', slug: 'tokyo', tier: 'capital', country: 'JP', lat: 35.6762, lon: 139.6503, frames: 1 }
    },
    relay: {
      'MCOM-1/1': { matrix: 'MCOM-1', port: 1, device_label: 'Studio Mic 1', device_id: 'dev-mic-01', kind: 'mic' },
      'MCOM-1/2': { matrix: 'MCOM-1', port: 2, device_label: 'Control Room Monitor', device_id: 'dev-spk-01', kind: 'speaker' }
    },
    views: {
      Regions: [
        { site: 'Toronto HQ', local_clock: '14:24 EDT', load: 0.35, calls: 14, trunks: 4, panels_live: 8 },
        { site: 'New York Stage', local_clock: '14:24 EDT', load: 0.42, calls: 18, trunks: 2, panels_live: 6 },
        { site: 'London OB Truck', local_clock: '19:24 BST', load: 0.28, calls: 9, trunks: 2, panels_live: 4 },
        { site: 'Paris Bureau', local_clock: '20:24 CEST', load: 0.15, calls: 3, trunks: 1, panels_live: 2 },
        { site: 'Tokyo Studio Hub', local_clock: '03:24 JST', load: 0.08, calls: 1, trunks: 1, panels_live: 2 }
      ],
      Globe: {
        history: [
          { a: 'Toronto HQ', b: 'New York Stage', uses: 450, streak: 42, lt: true, longest: '128 days' },
          { a: 'Toronto HQ', b: 'London OB Truck', uses: 280, streak: 18, lt: true, longest: '65 days' },
          { a: 'London OB Truck', b: 'Paris Bureau', uses: 120, streak: 9, lt: false, longest: '22 days' }
        ]
      },
      Status: {
        caster: 'listening',
        uptime_sec: 86400,
        active_trunks: 4,
        active_connections: 2,
        version: '1.0.0-standalone'
      },
      Presets: ['morning-broadcast', 'midday-sync', 'evening-live', 'overnight-standby'],
      Report: '# Standalone Trunk-Caster Report\n\nAll matrix trunks operational. Local bus bridge connected.\n- Toronto HQ: Active\n- New York Stage: Active\n- London OB: Active',
      Bandwidth: [
        { protocol: 'Opus SRT', kbps: 128, connections: 1 },
        { protocol: 'SMPTE 2110-30', kbps: 256, connections: 1 }
      ],
      Productions: [
        { name: 'Daily News', counters: { calls: 24, hours: 3.5 } },
        { name: 'Sports Special', counters: { calls: 12, hours: 2.0 } }
      ],
      PhoneBook: [
        { name: 'Director', frame: 'hq-m7880-01', port: 'U01', site: 'Toronto HQ' },
        { name: 'Producer', frame: 'hq-m7880-01', port: 'U02', site: 'Toronto HQ' },
        { name: 'NY Director', frame: 'nyc-prod-01', port: 'U01', site: 'New York Stage' },
        { name: 'London Lead', frame: 'london-ob-01', port: 'U01', site: 'London OB Truck' }
      ],
      Taps: {
        'hq-m7880-01': {
          frame: 'hq-m7880-01',
          site: 'Toronto HQ',
          protocol: 'MicroCOM 2026',
          kbps: 128,
          faders: [{ input: 'U01', output: 'U02', db: 0, who: 'Director' }]
        }
      },
      Captures: []
    },
    sims: {
      'smpte-2110': {
        'london-ob-01': { frame: 'london-ob-01', state: 'active', crosspoints: [{ input: 'U02', output: 'U01' }] }
      }
    },
    events: [
      { kind: 'state', at: now - 60000, event: { text: 'Trunk-Caster initialized on standalone bus' } },
      { kind: 'Relay', at: now - 40000, event: { kind: 'connect', device_label: 'Studio Mic 1', matrix: 'MCOM-1', port: 1, peak_dbfs: -18, threshold_dbfs: -40, note: 'Mic live' } },
      { kind: 'connection', at: now - 20000, event: { text: 'Trunk tor-nyc locked' } }
    ],
    heardAt: now
  };
}

let standaloneSingleton = null;

/** Create or retrieve the standalone Trunk-Caster API when running outside the APK:OS shell. */
export function createStandaloneTrunkApi() {
  if (standaloneSingleton) return standaloneSingleton;

  const store = buildStandaloneStore();
  const seats = new Set();

  const tell = () => {
    seats.forEach((fn) => {
      try { fn('all', '*', store); } catch (e) { console.error(e); }
    });
  };

  // Attempt live connection via window.APKBus if present on the page
  if (typeof globalThis.window !== 'undefined' && globalThis.window.APKBus) {
    try {
      globalThis.window.APKBus.connect({ clientId: `tc-standalone-${Math.random().toString(36).slice(2, 7)}` })
        .then((bus) => {
          if (!bus) return;
          bus.subscribe('trunk/#', (topic, payload) => {
            try {
              const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
              if (topic.includes('/incoming/state')) {
                store.caster = { state: data.status || data.state || 'active', detail: data.detail || null, heardAt: Date.now() };
                tell();
              }
            } catch { /* ignore unparsed messages */ }
          });
        })
        .catch(() => {});
    } catch { /* optional live bus */ }
  }

  standaloneSingleton = {
    version: TRUNK_API,
    isStandalone: true,
    snapshot() {
      return store;
    },
    watch(fn) {
      if (typeof fn !== 'function') return () => {};
      seats.add(fn);
      return () => seats.delete(fn);
    },
    async command(verb, args = {}, opts = {}) {
      const id = `standalone.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
      if (verb === 'fader_quick') {
        if (typeof args.speed === 'number') store.sim.speed = args.speed;
        if (typeof args.running === 'boolean') store.sim.running = args.running;
        tell();
        return { id, verb, status: 'ok', ok: true, detail: `speed ${store.sim.speed}×` };
      }
      if (verb === 'clock') {
        if (typeof args.hour === 'number') store.sim.hour = args.hour;
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'crosspoint_reset') {
        Object.keys(store.crosspoints).forEach((k) => { store.crosspoints[k].closed = []; });
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'taps_unity') {
        if (args.frame && store.views.Taps?.[args.frame]?.faders) {
          store.views.Taps[args.frame].faders.forEach((f) => { f.db = 0; });
        }
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'relay_bind') {
        const key = `${args.matrix}/${args.port}`;
        store.relay[key] = { matrix: args.matrix, port: Number(args.port), device_label: args.device_label, device_id: args.device_id, kind: args.kind };
        store.events.push({ kind: 'Relay', at: Date.now(), event: { kind: 'bind', device_label: args.device_label, matrix: args.matrix, port: args.port, note: 'Bound in standalone mode' } });
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'relay_unbind') {
        const key = `${args.matrix}/${args.port}`;
        delete store.relay[key];
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'relay_event') {
        store.events.push({ kind: 'Relay', at: Date.now(), event: { ...args } });
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'book') {
        const bid = `bk-${Date.now().toString(36)}`;
        store.bookings[bid] = { id: bid, frame: args.frame, port: args.port, program: args.program, who: 'Operator', start: args.start_hour || 0, end: (args.start_hour || 0) + (args.minutes || 60) / 60, daily: !!args.daily, status: 'booked', kind: args.kind || 'panel' };
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'cancel_booking') {
        if (args.booking) delete store.bookings[args.booking];
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      if (verb === 'release') {
        if (args.connection) delete store.connections[args.connection];
        tell();
        return { id, verb, status: 'ok', ok: true };
      }
      store.events.push({ kind: 'command', at: Date.now(), event: { verb, args } });
      tell();
      return { id, verb, status: 'ok', ok: true, detail: 'Executed in standalone mode' };
    },
    signedIn() {
      return true;
    }
  };

  return standaloneSingleton;
}

