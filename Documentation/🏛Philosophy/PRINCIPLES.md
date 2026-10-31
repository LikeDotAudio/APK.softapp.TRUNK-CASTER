# Principles — INTERCOM.TRUNK-CASTER

What the TRUNK-CASTER window keeps, each with the code that keeps it. Ecosystem rules are the root's —
[Soft Apps](../../../../../../../Documentation/%F0%9F%8F%9BPhilosophy/Soft%20Apps/readme.Soft%20Apps.md),
[A frame may not write to hardware](../../../../../../../Documentation/%F0%9F%8F%9BPhilosophy/Doctrine/readme.A%20frame%20may%20not%20write%20to%20hardware.md) — cited, not copied.

| Principle | Kept by |
|---|---|
| **The caster speaks the bus (ROAD-3440).** Every Trunk-Caster view reads the shell's trunk store (`APK:OS/Network/trunk-bus`) and sends commands through the shell, which checks each one against the `trunk` contract and sends it as the person signed in. The caster plugin is the agent between a person and the frames. | `trunkApi()` (`js/trunk/bus.js`), `mountView()` (`js/trunk/view.js`); `tests/trunk.test.mjs` |
| **A light is the caster's word, not the click's.** A Stream Deck key lights while a live connection joins its port to its target. | `joins()` (`js/trunk/views/deck.js`) |
| **Say what is missing instead of failing blank.** Outside the shell, with an OS that keeps no trunk store, or one of another API version, a view says which. | `trunkApi()` (`js/trunk/bus.js`) |
| **Windows from data, never a list in code.** One OS window per view, Stream Deck panel and protocol, written from the panel definitions and the caster plugin's protocol table; `--check` holds them. | `tools/build-trunk-windows.mjs`; `tests/trunk.test.mjs` |
| **Unreachable is dead; trust decays.** A machine is alive only while samples arrive; quiet for five minutes is dead whatever it last said; a retained `online` replayed at boot is *unheard*. | `TRUST_MS` (`js/machines.js:27`), `judge()` (:30); `tests/machines.test.mjs` |
| **Identity is the hostname, never the address.** | `js/machines.js` (rows keyed by `{host}`) |
| **The buttons declare, the shell sends.** ⏻ ›_ ⤒ offer what the machine's own agent lists in its `detail`; the frame writes nothing and hands the choice to the OS's confirmed, logged `OS.machineCommand`. What a button asks is held to the SDK's machine_command contract. | `actionsFor()`, `mountMachines()` (`js/machines.js`); `tests/contract.test.mjs` |
| **One door to the shell, versioned.** Every read of `window.parent.OS` goes through `machineApi()`, which holds a versioned `OS.machineApi` to `MACHINE_API` and names what an older or reshaped OS lacks. | `machineApi()` (`js/machines.js`); `tests/shell.test.mjs` |
| **No bus client of its own.** Machines are read from the OS's machine-bus store through `window.parent.OS`. | `shell()` (`js/machines.js:78`) |
| **The intercom never probes the OS server.** Its pages are always framed with `?engine=local`. | `PAGES` / `route()` (`js/app.js:23`, :55) |
| **Images copy, never build.** `intercom/` is microcom-sim's static build, tracked, with `BUILT-FROM` naming the commit; `npm test` fails when it is not the `SRC/microcom-sim` gitlink. | `tools/build-intercom.sh`; `tests/machines.test.mjs` |
| **The private archive stays on the disk.** `SRC/microcom` is excluded from every image; a test checks the tracked build carries no MCOM.EXE. | APK.audio `.dockerignore`; `tests/machines.test.mjs:50` |

## Where it does not hold

- **Trunk commands are not confirmed one by one.** A connect or release is sent as soon as it is asked (signed in only); the caster decides. Only the global crosspoint reset asks first.
- **The windows' data is read from two other trees** (PLUGIN.TRUNK_CASTER's `data/`, INTERCOM.Caster's `PANELS/`); `build-trunk-windows.mjs` needs the monorepo.
- **No CI workflow.** `npm test` is the one local check, run by hand before a push like the root's checks.
- **The contract and OS-store tests need the monorepo** above this checkout (`contracts/`, `PODS/POD.THIN/OS`); in a
  standalone clone they skip and say so.
- **The OS does not publish `OS.machineApi` yet**; until it does, `machineApi()` reads its four named functions.
