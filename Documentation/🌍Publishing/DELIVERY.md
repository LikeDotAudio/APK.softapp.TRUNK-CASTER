# Delivery — INTERCOM.TRUNK-CASTER

## Build

- The app: none — plain ES modules.
- The intercom: `tools/build-intercom.sh` (or `npm run build:intercom`) after bumping `SRC/microcom-sim`:
  `npm ci` there if needed, `tsc --noEmit`, `vite build --mode static --outDir intercom/`, then writes
  `intercom/BUILT-FROM`. `intercom/` is committed.

## Test

`npm test` → `node --test tests/*.test.mjs` — 10 passed (2026-10-30). Monorepo smoke run:
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

- Rebuilding `intercom/` after a submodule bump is by hand; nothing checks `BUILT-FROM` against the gitlink.
- `SRC/trunk-caster-site` updates only when its upstream publishes and the pointer is bumped.
