# Architecture — INTERCOM.TRUNK-CASTER

## Use

Open **Intercom** › **TRUNK-CASTER** (🌐) from the OS menu, or one of its tabs directly. Routing is by hash:

| Hash | Tab | Source |
|---|---|---|
| `#globe` (default) or a page name (`continents`, `crosspoints`, `overlord`, `panels`, `racks`, `relay`, `simulator`, `space`, `usage`, `users`, `about`) | 🌐 Trunk-Caster | `SRC/trunk-caster-site/<page>.html`, framed as `srcdoc` |
| `#matrix` · `#panel` · `#mc3` · `#emu` | 🎛 Matrix · 🎙 Panels · 🗂 MicroCOM III · 💾 Emulator | `intercom/<page>.html?engine=local` |
| `#machines` | 🖥 Machines | `js/machines.js` |

The footer strip (`PODS/POD.THIN/OS/Footer/intercom-strip`) frames `intercom/strip.html`; the station chosen there is
shared through `localStorage` `microcom.strip.station`, which the Panels tab opens on. The header's
**🎙 keys in the footer** switch brings the strip back after it is taken off.

## How it works

```
index.html ─▶ js/app.js route()
   ├─ Trunk-Caster page ─▶ js/caster.js loadPage():
   │     fetch SRC/trunk-caster-site/<page>.html → framed(): <base> + guardScript() first → iframe.srcdoc
   │     (about:srcdoc is not "served over http", so the page does not count itself live;
   │      the guard refuses anything that is not a snapshot file)
   │     links: another snapshot page → go(page); a runtime link → note(RUNTIME_NOTE)
   ├─ intercom tab ─▶ iframe intercom/<matrix|panel|mc3|emu>.html?engine=local
   │     (microcom-sim's local engine in a SharedWorker; every window shares one matrix)
   └─ machines ─▶ mountMachines(): machineApi(window.parent.OS) → { list, read, watch, command }
         (OS.machineApi held to MACHINE_API = 1, or the four named machineBus*/machineCommand functions)
         APK.audio/System/BareMetal/MonitorProbes/{probe}/{host}/status (retained) + telemetry
         judge() → state.json words: online (heard ≤ TRUST_MS) · offline (said so, newer than the last sample) · unresponsive (quiet past TRUST_MS) · stale (remembered online, unheard) · unknown
         rows drawn with data-apk-state + vendor/apk-contracts/apk-tokens.css
         health(): fullest partition, hottest sensor, …
         actionsFor(detail): ⏻ ›_ ⤒ → command({probe, host, verb, action|name, mac, dry_run}) — the OS confirms,
         logs and publishes; answerLine() reads the retained incoming/state answer
```

## Files

| Path | Role |
|---|---|
| `index.html`, `css/app.css` | The window: tab bar, caster frame, intercom frame, machines pane |
| `js/app.js` | Hash routing, `?engine=local`, the footer-keys switch |
| `js/caster.js` | Snapshot framing and the guard |
| `js/machines.js` | The Machines tab |
| `intercom/` | microcom-sim's static build (tracked); `BUILT-FROM` |
| `tools/build-intercom.sh` | Rebuilds `intercom/` from `SRC/microcom-sim` |
| `tests/` | `node --test` (`npm test`): `caster`, `machines`, `contract` (machine_command vectors + TS twin from the root `contracts/`), `shell` (`machineApi` + the OS's machine-bus store) |
| `SRC/trunk-caster-site` | Submodule: Trunk-Caster's public snapshot (generated upstream) |
| `SRC/microcom-sim` | Submodule: the public simulator |
| `SRC/microcom` | Submodule: the private archive — never in an image |
