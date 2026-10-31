# Principles — INTERCOM.TRUNK-CASTER

What the TRUNK-CASTER window keeps, each with the code that keeps it. Ecosystem rules are the root's —
[Soft Apps](../../../../../../../Documentation/%F0%9F%8F%9BPhilosophy/Soft%20Apps/readme.Soft%20Apps.md),
[A frame may not write to hardware](../../../../../../../Documentation/%F0%9F%8F%9BPhilosophy/Doctrine/readme.A%20frame%20may%20not%20write%20to%20hardware.md) — cited, not copied.

| Principle | Kept by |
|---|---|
| **A snapshot is never live.** A Trunk-Caster page is fetched and framed as `srcdoc`, with a guard as its first script that refuses every fetch, XHR, beacon, EventSource and WebSocket that is not one of the snapshot's own files — so it can never reach the OS server's `/ws` or `/api/device/`. | `guardScript()` (`js/caster.js:69`), `framed()` (:87); `tests/caster.test.mjs` |
| **Say what is missing instead of failing blank.** Runtime links and pop-outs answer with a note that the runtime is not here. | `RUNTIME_NOTE`, `POP_NOTE` (`js/caster.js:35`–:36), `linkKind()` (:46) |
| **Unreachable is dead; trust decays.** A machine is alive only while samples arrive; quiet for five minutes is dead whatever it last said; a retained `online` replayed at boot is *unheard*. | `TRUST_MS` (`js/machines.js:27`), `judge()` (:30); `tests/machines.test.mjs` |
| **Identity is the hostname, never the address.** | `js/machines.js` (rows keyed by `{host}`) |
| **The buttons declare, the shell sends.** ⏻ ›_ ⤒ offer what the machine's own agent lists in its `detail`; the frame writes nothing and hands the choice to the OS's confirmed, logged `OS.machineCommand`. What a button asks is held to the SDK's machine_command contract. | `actionsFor()`, `mountMachines()` (`js/machines.js`); `tests/contract.test.mjs` |
| **One door to the shell, versioned.** Every read of `window.parent.OS` goes through `machineApi()`, which holds a versioned `OS.machineApi` to `MACHINE_API` and names what an older or reshaped OS lacks. | `machineApi()` (`js/machines.js`); `tests/shell.test.mjs` |
| **No bus client of its own.** Machines are read from the OS's machine-bus store through `window.parent.OS`. | `shell()` (`js/machines.js:78`) |
| **The intercom never probes the OS server.** Its pages are always framed with `?engine=local`. | `PAGES` / `route()` (`js/app.js:23`, :55) |
| **Images copy, never build.** `intercom/` is microcom-sim's static build, tracked, with `BUILT-FROM` naming the commit; `npm test` fails when it is not the `SRC/microcom-sim` gitlink. | `tools/build-intercom.sh`; `tests/machines.test.mjs` |
| **The private archive stays on the disk.** `SRC/microcom` is excluded from every image; a test checks the tracked build carries no MCOM.EXE. | APK.audio `.dockerignore`; `tests/machines.test.mjs:50` |

## Where it does not hold

- **The snapshot guard posts pop-out notes to `'*'`** (`js/caster.js`, `window.open` override).
- **`SRC/trunk-caster-site` is generated** by Trunk-Caster's own publish step and is not edited here.
- **No CI workflow.** `npm test` is the one local check, run by hand before a push like the root's checks.
- **The contract and OS-store tests need the monorepo** above this checkout (`contracts/`, `PODS/POD.THIN/OS`); in a
  standalone clone they skip and say so.
- **The OS does not publish `OS.machineApi` yet**; until it does, `machineApi()` reads its four named functions.
