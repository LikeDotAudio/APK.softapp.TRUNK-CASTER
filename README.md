# 🌐 TRUNK-CASTER

The intercom trunking system on a globe, the intercom it trunks and the bare metal machines it runs on, in one window of the
[APK.audio](https://github.com/LikeDotAudio/APK.audio) OS. Open it from the
**Intercom** menu: TRUNK-CASTER itself, or straight onto one of its tabs.

| Tab | What |
|---|---|
| 🌐 **Trunk-Caster** | Trunk-Caster's Globe: every site, the frames at each, the trunks between the casters. Its Continents, Crosspoints, Overlord, Panels, Racks, Relay, Simulator, Space, Usage, Users and About pages are in its own bar. |
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

Trunk-Caster is the intercom trunking system. It speaks 28 protocols across Clear-Com, RTS, Riedel,
Intracom and Telos; each frame has 56+8 ports, and a trunk between two casters carries 8 channels.
Its runtime is private. Pinned at `SRC/trunk-caster-site` is its public snapshot,
[onediversifiedanthony/trunk-caster-site](https://github.com/onediversifiedanthony/trunk-caster-site):
twelve self-contained pages.

**A page is never framed by its address.** Each one counts itself live when it is served over http,
and then talks to whatever served it: a WebSocket at `/ws` and POSTs to `/api/…`. Inside the OS that
would be the OS's own server, where `/api/device/` commands real instruments. So `js/caster.js`
fetches the page and frames it as `srcdoc`: its protocol becomes `about:` and it is not live. A
guard runs before the page's own scripts and refuses every request that is not one of the snapshot's
files. That's how the published copy behaves with no caster behind it. Links between pages still
work; links to the live runtime (the analyzer, the panel editor, `127.0.0.1:8080`) say they need it.

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
index.html                 the window: tab bar, the caster frame, the intercom frame, the machines pane
js/app.js                  routing by hash (#globe, #matrix, #panel, #mc3, #emu, #machines, or a Trunk-Caster page name)
js/caster.js               fetches a snapshot page and frames it as srcdoc behind the guard (guardScript)
js/machines.js             the Machines tab: reads window.parent.OS, alive = heard within TRUST_MS (5 min)
css/app.css
intercom/                  microcom-sim's static build — TRACKED; BUILT-FROM names its commit
tools/build-intercom.sh    rebuilds intercom/ from SRC/microcom-sim (tsc --noEmit, vite build --mode static)
tests/                     node --test: caster, machines, contract (machine_command vectors + TS twin), shell (machineApi + the OS store)
SRC/trunk-caster-site      submodule: Trunk-Caster's public snapshot (twelve pages)
SRC/microcom-sim           submodule: the public simulator the intercom/ build comes from
SRC/microcom               submodule: the private archive (MCOM.EXE, decompile, specs) — kept out of every image
```

The intercom pages are always framed with `?engine=local` (`js/app.js`), so they run the matrix in the browser and never probe the OS server for a Python engine. The station chosen in the footer strip is shared through `localStorage` key `microcom.strip.station`, which the Panels tab reads to open on your own station.

`SRC/trunk-caster-site` is written by Trunk-Caster's own publish step (its commits are `Publish pages <date>`), README included, so it is not edited here.

## Tests

```bash
npm test     # node --test tests/*.test.mjs — 23 tests, the one local check (no CI workflow in this repo)
```

They check that the Globe is the front door and every published page has a route, that the guard refuses every runtime call the snapshot makes while letting the snapshot's own files through, that a machine is alive only while it is heard, that `intercom/` is the pinned microcom-sim build with no MCOM.EXE in it, that every button is a command the SDK's machine_command contract accepts (its vectors and TypeScript twin, `contracts/` at the APK.audio root, loaded by Node's type stripping) and that the answer line reads what the contract writes, and that the Machines tab reads the OS's own machine store through `machineApi()`. The contract and OS-store tests find the monorepo by walking up and skip in a standalone clone. Needs Node ≥ 22.18 (type stripping, `module.registerHooks`).

## Philosophy

- **A snapshot is never live.** A Trunk-Caster page is fetched and framed as `srcdoc` with a guard as its first script, so it can never reach the OS server's `/ws` or `/api/device/` (`js/caster.js`, `tests/caster.test.mjs`).
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
