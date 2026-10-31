# 🔍 Architecture audit — INTERCOM.TRUNK-CASTER (2026-10-30)

Audited against the APK.audio multi-repo architecture standard: coupling, boundaries, duplication, contracts.
← [Audits](INDEX.md) · Improvements: [🛣Roadmap/IMPROVEMENTS.md](../%F0%9F%9B%A3Roadmap/IMPROVEMENTS.md)

## Bounded context
The OS window that composes three things: Trunk-Caster's views on the bus (ROAD-3440; this audit predates them — its snapshot rows are history), the MicroCOM II intercom (microcom-sim's tracked static build in `intercom/`), and the bare-metal Machines tab (read from the shell's machine store, writes handed to the shell). Plain ES modules: `js/app.js`, `js/caster.js` and `js/machines.js`, about 470 lines, with 15 node tests. 52 tracked files, three of them nested submodules. All of `js/`, `tests/`, `tools/`, `display.json` and README were read. The `intercom/assets/` bundles were not read (generated).

## Context map
| Talks to | How (topic / endpoint / file / import) | Relationship |
|---|---|---|
| `SRC/microcom-sim` (nested submodule, its own audit) | `tools/build-intercom.sh` builds it into the tracked `intercom/`, and `intercom/BUILT-FROM` records the commit (`d9d4f30`, which matches the pinned HEAD) | Customer–Supplier, pinned by submodule plus build stamp |
| `SRC/microcom` (nested submodule, private) | never served. The root `.dockerignore` keeps it out of images, and `tests/machines.test.mjs:51` asserts `intercom/` has no MCOM.EXE | Source only |
| APK:OS `Network/machine-bus` / `Network/machine-command` | `window.parent.OS.machineBusList()` and `OS.machineCommand({...})` (`js/machines.js:118,150`) | Customer of the shell's JS API (unversioned) |
| PLUGIN.MACHINE (via the shell) | reads its retained `detail` (commands, deploys, power, `dry_run`) to build the ⏻ ›_ ⤒ buttons (`actionsFor`) | Conformist to the `machine_command` contract |
| PLUGIN.DESKTOP_MONITOR (via the shell) | `APK.audio/System/BareMetal/MonitorProbes/{probe}/{host}/` status and telemetry | Conformist |
| APK:OS footer | `APK:OS/Footer/intercom-strip` frames microcom-sim's `strip.html` | Supplier of a page to OS |
| OS launch grid | `display.json`, topic `APK.audio/Gui/Softapps/Intercom/TRUNK_CASTER` | Conformist |

## Scorecard
| Category | Score (0–3) | Finding |
|---|---|---|
| Coupling & Cohesion | 3 | Every upstream is a pinned nested submodule (house rule respected). No bus client of its own. Every read of `window.parent.OS` goes through `machineApi()`, which holds a versioned `OS.machineApi` to `MACHINE_API` and names what an older OS lacks. |
| Boundary Integrity | 3 | `guardScript()` is a real ACL: snapshot pages cannot reach the OS's `/api/device/` (tested at `tests/caster.test.mjs`). Hardware writes go only through the shell's confirmed `OS.machineCommand`. The frame writes nothing itself. Identity is the hostname, never the address |
| Duplication Control | 3 | `intercom/` is a tracked build of a submodule — a deliberate copy (images do not build Softapps), stamped and tested against the pin. `actionsFor()` reads `detail`; what it offers is held to the contract's vectors and TS twin. |
| Testing & Contracts | 3 | 23 node tests in one command (`npm test`): guard, trust decay, build-is-pinned, no MCOM.EXE, actions against `contracts/vectors/machine_command.json` + `contracts/src/machine-command.ts`, `machineApi` against the OS's own machine-bus store. No CI by the repo's convention (local check). |
| Change management | 3 | Submodule pins plus `BUILT-FROM` give staged upgrades of the intercom. `package.json` 1.1.0. README current. |
Score key: 3 meets the standard · 2 minor gaps · 1 significant gaps · 0 absent / violated.

## Findings
1. **Good: the snapshot is framed by content, never by URL.** `js/caster.js` fetches the page, prepends `<base>` and the guard, and frames it as `srcdoc`, so the page's own `/ws` and `/api/…` calls are refused, not sent to the OS server. `tests/caster.test.mjs` checks *every* runtime call the snapshot makes.
2. **Good: trust decays.** `js/machines.js` `TRUST_MS = 5 min`. A retained `online` replayed at boot counts as *unheard* until a sample arrives (`tests/machines.test.mjs`). This follows the rule that unreachable is dead.
3. **Good: the private binary is kept out.** `tests/machines.test.mjs` fails if `intercom/` drifts from the pinned microcom-sim or carries MCOM.EXE.
4. **Nested repos.** `SRC/microcom` and `SRC/microcom-sim` have their own audits. (The third, the `trunk-caster-site` snapshot, was removed in ROAD-3440.)

Findings 4–8 of the first pass (unversioned shell API, contract re-derived locally, no CI, stale README, dead display topic) were delivered — see [🌍Publishing/DELIVERY.md](../%F0%9F%8C%8DPublishing/DELIVERY.md). The OS's side of the versioned API is a handoff to the OS repo.
