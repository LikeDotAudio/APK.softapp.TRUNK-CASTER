# Delivery — INTERCOM.TRUNK-CASTER

## Build

- The app: none — plain ES modules.
- The intercom: `tools/build-intercom.sh` (or `npm run build:intercom`) after bumping `SRC/microcom-sim`:
  `npm ci` there if needed, `tsc --noEmit`, `vite build --mode static --outDir intercom/`, then writes
  `intercom/BUILT-FROM`. `intercom/` is committed.

## Test

`npm test` → `node --test tests/*.test.mjs` — 23 passed (2026-10-30), the one local check (no CI workflow). Node ≥ 22.18. Monorepo smoke run:
[SMOKE.md](../%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md).

## Ship

- **Repository**: `https://github.com/LikeDotAudio/APK.softapp.TRUNK-CASTER` — a submodule at
  `PODS/POD.THIN/Softapps/HARDWARE_AND_NETWORK/INTERCOM.TRUNK-CASTER`, with three submodules of its own
  (`SRC/microcom-sim`, `SRC/microcom` private, `SRC/trunk-caster-site`). No GitHub workflow.
- **Image**: `web-static` (`PODS/POD.THIN/WEB.Frontend-Assets/Docker/Dockerfile`) copies the Softapps tree; the root
  `.dockerignore` drops `**/INTERCOM.TRUNK-CASTER/SRC/microcom`, so the Ward-Beck archive never ships. Storage-Portal
  (`:8080`) proxies `/APK:Softapps/` to web-static (PLAN-3421.01).
- **Where it lands**: `http://127.0.0.1:8080/APK:Softapps/HARDWARE_AND_NETWORK/INTERCOM.TRUNK-CASTER/index.html`
  (200 on 2026-10-30), opened by the OS Intercom menu and the footer strip.
- **Public relatives**: microcom-sim deploys itself to https://likedotaudio.github.io/microcom-sim/; the
  trunk-caster-site snapshot is published by Trunk-Caster's own step, outside this repo.

## After an edit

`up-stack.sh WEB.Frontend-Assets`. Push and pointer bumps (deepest first): `.apk.scripts/deploy_all.py`.

## Not automated

- Rebuilding `intercom/` after a submodule bump is by hand (`tools/build-intercom.sh`); `npm test` fails until it is done, because it holds `BUILT-FROM` to the `SRC/microcom-sim` gitlink.
- `SRC/trunk-caster-site` updates only when its upstream publishes and the pointer is bumped.

## Delivered from the 2026-10-30 audit

TRUNK-CASTER is the OS's Intercom → TRUNK-CASTER window (served from the web-static image's Softapps copy).

- **One local test command** — `npm test` runs all 23 node tests (guard, trust decay, pinned intercom build / no MCOM.EXE, actions, the contract and shell tests below); the repo has no workflow, so per the root's convention it is a local check, not new CI. Verified: 23 pass.
- **The buttons are tested against the contract** — `tests/contract.test.mjs` loads the SDK's `contracts/vectors/machine_command.json` and its TypeScript twin `contracts/src/machine-command.ts` (Node type stripping): every valid vector is a command some `detail` makes a button for, every button wrapped as the shell sends it passes `parseMachineCommand` (dry run too), and `answerLine()` reads what `machineAnswer()` writes. Skips in a standalone clone. Verified: 3 pass.
- **Versioned shell API, checked here** — `machineApi()` in `js/machines.js` is the one door to `window.parent.OS`: an `OS.machineApi` is held to `MACHINE_API = 1`, an older OS is read by `machineBusList/Read/Watch` + `machineCommand`, and a reshaped OS gets a page naming what is missing instead of an empty tab. `tests/shell.test.mjs` also runs the OS's own `Network/machine-bus/machine-bus.js` through it. Verified: 5 pass. The OS side (publishing `OS.machineApi`) is handed off to the OS repo; until then the named functions are read.
- **README "The machines" is current** — describes the shipped ⏻ ›_ ⤒ buttons (PLAN-3394.01), the answer line, rehearse, and `machineApi()`; test list and counts updated.
- **Dead display topic dropped** — `display.json` no longer declares `APK.audio/Gui/Softapps/Intercom/TRUNK_CASTER` (nothing published or read it; not in `OS/system/project-apps.json`). The OS's own displays keep their `Gui/Display/TRUNK_CASTER*` topics.
- **Intercom rebuilt from the new microcom-sim** — `SRC/microcom-sim` → `ba6e1d8` (parity in CI, versioned strip wire and `hello.proto`), `intercom/` rebuilt by `tools/build-intercom.sh` with `BUILT-FROM` matching the pin; `SRC/microcom` → `b6e0268`. `package.json` 1.1.0.
- **CC-02/WS-07 liveness in the token's words and tones** (from the SDK/contracts audit) — `judge()` now returns words of `contracts/tokens/state.json`: `online`, `offline`, `unresponsive` (quiet past TRUST_MS), `stale` (a remembered online), `unknown`; each row carries `data-apk-state` and is coloured from `vendor/apk-contracts/apk-tokens.css` (vendored by `.apk.scripts/vendor_contract_web.py`, held by its `--check`); `--ok/--warn/--bad` are `--apk-state-good/kinda/dead`. Registering `js/machines.js` `judge` in the root `check_state_words.py` MINTERS is handed off to the root. Verified: 23 node tests, `vendor_contract_web.py --check`, `check_brand_colour.py` (did not grow).
- **WS-07 brand accent** (from the SDK/contracts audit) — `css/app.css` `--accent` is `var(--apk-accent)` (was `#f5a524`); the intercom (microcom-sim → `ba6e1d8`…`81b8914`) dropped the same near-miss upstream, and `intercom/` was rebuilt from it.
