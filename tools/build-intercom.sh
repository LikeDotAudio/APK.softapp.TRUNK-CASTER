#!/usr/bin/env bash
# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
#
# Rebuild intercom/ from the microcom-sim submodule at the commit it is pinned to.
#
# intercom/ is TRACKED, as the CAD's dist/ is: the APK.audio images COPY Softapps
# and never run a build, so what the OS serves is what is committed here. The
# submodule's own tree is left as it was — its node_modules and dist-static are
# ignored there, and the build goes straight into intercom/.
#
#   tools/build-intercom.sh          after bumping SRC/microcom-sim
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
sim="$here/SRC/microcom-sim"
[ -f "$sim/package.json" ] || git -C "$here" submodule update --init SRC/microcom-sim
cd "$sim"
[ -d node_modules ] || npm ci --no-audit --no-fund
npx tsc --noEmit
npx vite build --mode static --outDir "$here/intercom" --emptyOutDir
git rev-parse HEAD > "$here/intercom/BUILT-FROM"
echo "intercom/ built from microcom-sim $(git rev-parse --short HEAD)"
