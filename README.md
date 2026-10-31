# 🌐 TRUNK-CASTER

The intercom trunking system on a globe, the intercom it trunks and the bare metal machines it runs on, in one window of the
[APK.audio](https://github.com/LikeDotAudio/APK.audio) OS. Open it from the
**Intercom** menu: TRUNK-CASTER itself, or straight onto one of its tabs.

| Tab | What |
|---|---|
| 🌐 **Globe** | Every site the caster publishes, the frames at each and the trunks between the casters, on a turning globe. |
| 🔁 **Relay** | The local sound-card relay: devices on matrix ports, its events; bind, unbind, report. |
| 🎚 **Simulator** | The fader and the simulated clock, live connections with release, a connect form, every event. |
| ✳ **Cross Points** | Every frame's closed crosspoints as Ward-Beck lines, the crosspoint events, a confirmed reset. |
| 📈 **Usage** | Trunks against capacity, connections per protocol, bookings with book and cancel. |
| 🛰 **Space** | Frames as capacity: free and trunked casters per site and per frame. |
| 🗄 **Racks** | Frames in racks: every port with its name and panel label, lit while in use; rename. |
| 👥 **Users** | Who holds which connections and bookings, who asked whom; panel seek. |
| 🔬 **Analyzer** | Captures of the caster's traffic: start, stop, read. |
| 🎛 **Decks** | Each Stream Deck panel (mini, mk2, plus, xl) as keys on screen, on a frame and port of your choosing. |
| 🧪 **Sims** | One window per protocol's frame simulator: sim vs caster, double validation. |
| 🎛 **Matrix** | The Ward-Beck Systems MicroCOM II matrix engine: 32 productions × 64 ports, routing and live audio. Every window shares one matrix. |
| 🎙 **Panels** | M7880 key panels, talent turrets and the MicroCOM 2026 station and producer panels. Panels in different windows hear each other. |
| 🗂 **MicroCOM III** | The assignment software in the MicroCOM II look, for the large virtual matrix. |
| 💾 **Emulator** | The original MCOM.EXE v3.20 on an emulated 8086. Bring your own MCOM.EXE. |
| 🖥 **Machines** | Every machine a monitor probe reports on the bus, alive or dead, with its health. |

Your station's keys are also in the OS taskbar, between the recent applications and the open
windows: microcom-sim's `strip.html`, framed by `APK:OS/Footer/intercom-strip`. Click latches,
hold talks, and a caller glows amber. 🎧 joins the audio and ⤢ opens the Panels tab on the same
station. Right-click 🎙 to take the keys off the taskbar; the **🎙 keys in the footer** switch in
this window's header brings them back.

## Trunk-Caster

Trunk-Caster is the intercom trunking system: 28 protocols, frames of 56+8 ports, trunks of 8
channels between casters. Since ROAD-3440 it runs **on the APK.audio plugin SDK** — the caster is
PLUGIN.TRUNK_CASTER (token `trunk`), the frame simulators PLUGIN.TRUNK_SIM (token `trunk_sim`), and
they speak the `trunk` contract (`contracts/TRUNK.md` at the APK.audio root). Every view here reads
the bus, never an HTTP server of the caster's own.

**No bus client of its own.** The OS shell keeps every retained `trunk` document — frames, trunks,
connections, crosspoints, bookings, sites, relay bindings, sim frames — and a ring of events, in
`APK:OS/Network/trunk-bus`. The views read it through `window.parent.OS.trunkApi` (version 1,
`js/trunk/bus.js`); a command (connect, release, rename, book, the fader, the relay, captures…) is
handed to `OS.trunkApi.command(verb, args)`, which checks it against the contract, stamps the person
signed in, publishes it on `trunk/outgoing/command` and resolves with the caster's
`trunk/incoming/result`. Opened outside the shell, a view says there is no bus here.

**Every window is written from data.** `tools/build-trunk-windows.mjs` writes one OS window per view,
per Stream Deck panel (`INTERCOM.Caster/SRC/PANELS/streamdeck-*.json` → `data/decks/`) and per protocol
(the caster plugin's `data/protocols.json` and its seed `KNOWN PROTOCOLS` folders → `data/protocols.json`),
and `--check` fails when one is out of date. No protocol or panel is listed in code.

The published snapshot this app used to frame (`trunk-caster-site`) is gone: it was not online
locally, and the Globe now draws the live caster.

## The intercom

The intercom comes from [microcom-sim](https://github.com/LikeDotAudio/microcom-sim), which is pinned
at `SRC/microcom-sim`. The page serves its static build from `intercom/`.
That build is **tracked**, the same as the CAD's `dist/`, because the APK.audio images copy
Softapps without running a build. After you bump the submodule, rebuild it:

```bash
tools/build-intercom.sh        # or: npm run build:intercom
```

`intercom/BUILT-FROM` names the commit the build came from.

`SRC/microcom` is the private [microcom](https://github.com/LikeDotAudio/microcom) archive:
MCOM.EXE, its decompile, the specs and the terminal emulator. It is in the tree to work on,
but the APK.audio root `.dockerignore` keeps it out of every image, so the OS never serves
the Ward-Beck binary. MicroCOM II and its software are © 1991–93 Ward-Beck Systems Ltd.,
developed by Weitech Computer Solutions.

## The machines

The machines tab holds no bus client of its own. The OS keeps what every monitor probe
says under `APK.audio/System/BareMetal/MonitorProbes/{probe}/{host}/` (`status`, retained,
and `telemetry`, and PLUGIN.MACHINE's retained `incoming/detail` and `incoming/state`), in
`APK:OS/Network/machine-bus`. This page reads that store through `window.parent.OS`, by one
adapter, `machineApi()` in `js/machines.js`: an OS that publishes `OS.machineApi` is held to
`MACHINE_API` (1); an older OS is read by its four named functions (`machineBusList`,
`machineBusRead`, `machineBusWatch`, `machineCommand`). An OS that has neither shape gets a
"this OS cannot show the machines" page that names what is missing, not an empty tab.

- **Alive is heard, not remembered.** A machine is alive while its samples keep coming.
  One quiet for five minutes is dead, whatever it last said. A retained `online` replayed
  at boot shows as *unheard* until a sample arrives.
- **Named by its hostname**, never by an address: DHCP moves addresses.
- **Said in the SDK's words.** A row's state is a word of `contracts/tokens/state.json` — `online`,
  `offline`, `unresponsive` (quiet past five minutes), `stale` (a remembered online), `unknown` — and is
  coloured by the token (`vendor/apk-contracts/apk-tokens.css`, vendored by
  `.apk.scripts/vendor_contract_web.py`; `--check` holds the copy). The accent is the brand token too.
- **The buttons declare, the shell sends** (PLAN-3394.01). ⏻ power, ›_ a named command and
  ⤒ a deploy offer exactly what the machine's own agent lists in its `detail`; a machine that
  is not alive can only be woken, to the MAC it last published. The frame writes nothing: it
  hands the choice to `OS.machineCommand`, which asks the person to confirm, logs it and
  publishes it as the broker's operator. The machine's answer (the retained `incoming/state`)
  is shown under the buttons; "rehearse" sends it as a dry run.

## Layout

```
index.html                 the window: tab bar, the Trunk-Caster pane, the intercom frame, the machines pane
js/app.js                  routing by hash (#globe … #analyzer, #deck/<model>, #sim/<protocol>, #matrix, #panel, #mc3, #emu, #machines)
js/trunk/                  the Trunk-Caster views: bus.js (the shell's trunkApi), view.js, routes.js, views/*.js
data/                      written by tools/build-trunk-windows.mjs: protocols.json, decks/, land.json
js/machines.js             the Machines tab: reads window.parent.OS, alive = heard within TRUST_MS (5 min)
css/app.css
intercom/                  microcom-sim's static build — TRACKED; BUILT-FROM names its commit
tools/build-intercom.sh    rebuilds intercom/ from SRC/microcom-sim (tsc --noEmit, vite build --mode static)
tools/build-trunk-windows.mjs  writes data/ and one APK:OS window per view, Stream Deck and protocol (--check)
tests/                     node --test: trunk (routes, globe, decks, sims, windows), machines, contract (machine_command vectors + TS twin), shell (machineApi + the OS store)
SRC/microcom-sim           submodule: the public simulator the intercom/ build comes from
SRC/microcom               submodule: the private archive (MCOM.EXE, decompile, specs) — kept out of every image
```

The intercom pages are always framed with `?engine=local` (`js/app.js`), so they run the matrix in the browser and never probe the OS server for a Python engine. The station chosen in the footer strip is shared through `localStorage` key `microcom.strip.station`, which the Panels tab reads to open on your own station.

## Tests

```bash
npm test     # node --test tests/*.test.mjs — 26 tests, the one local check (no CI workflow in this repo)
```

They check that every Trunk-Caster route lands on its view (the snapshot's old routes included), the globe's projection and arcs, the Stream Deck keys' reading of a connection, a sim's agreement with the caster, that every generated window is current, that a machine is alive only while it is heard, that `intercom/` is the pinned microcom-sim build with no MCOM.EXE in it, that every button is a command the SDK's machine_command contract accepts (its vectors and TypeScript twin, `contracts/` at the APK.audio root, loaded by Node's type stripping) and that the answer line reads what the contract writes, and that the Machines tab reads the OS's own machine store through `machineApi()`. The contract and OS-store tests find the monorepo by walking up and skip in a standalone clone. Needs Node ≥ 22.18 (type stripping, `module.registerHooks`).

## Philosophy

- **The caster speaks the bus.** Every Trunk-Caster view reads the shell's trunk store and sends its commands through the shell, checked by the contract (`js/trunk/bus.js`, `APK:OS/Network/trunk-bus`); a light on a key is the caster's word, not the click's.
- **Windows from data.** No protocol or panel is listed in code: `tools/build-trunk-windows.mjs` writes them, and `--check` holds them.
- **Unreachable is dead; trust decays.** A machine is alive only while its probe's samples arrive; one quiet for five minutes is dead whatever it last said, and a retained `online` replayed at boot is *unheard* (`js/machines.js` `TRUST_MS`).
- **Identity is the hostname, never the address** (`js/machines.js`).
- **A frame may not write to hardware.** The Machines tab writes nothing: ⏻ ›_ ⤒ offer what the machine's agent (PLUGIN.MACHINE) says it can do, and hand the chosen action to the OS (`OS.machineCommand`), which confirms it with the person, logs it and publishes it as the broker's `apkaudio-operator` (PLAN-3394.01). The answer comes back retained and shows under the buttons.
- **No bus client of its own.** The page reads the shell's machine-bus store through `window.parent.OS` rather than opening a second connection (`js/machines.js`).
- **Images copy, never build.** `intercom/` is committed, as the CAD's `dist/` is, because the APK.audio images copy Softapps without running a build (`tools/build-intercom.sh`).
- **The private archive stays on the disk.** `SRC/microcom` is a submodule to work on, excluded by the APK.audio root `.dockerignore`; a test checks the tracked build carries no MCOM.EXE.

## 📚 Wiki

The depth is in [Documentation/README.md](Documentation/README.md): [principles](Documentation/%F0%9F%8F%9BPhilosophy/PRINCIPLES.md), [architecture](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/ARCHITECTURE.md), [delivery](Documentation/%F0%9F%8C%8DPublishing/DELIVERY.md).

<!-- wiki:smoke -->
**Smoke test** — ✅ PASS 2/2 since 2026-10-30 12:51 EDT — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
