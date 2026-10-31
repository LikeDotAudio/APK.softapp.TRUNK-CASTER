// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * THE TRUNK-CASTER WINDOWS READ THE BUS THROUGH THE SHELL (ROAD-3440).
 *
 * PLUGIN.TRUNK_CASTER and PLUGIN.TRUNK_SIM speak the `trunk` contract
 * (contracts/TRUNK.md). This page holds no MQTT client of its own: the shell
 * keeps every retained document (APK:OS/Network/trunk-bus) and publishes the
 * commands, so there is one connection and one answer to "is the caster
 * there". A window opened outside the shell has no bus and says so.
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
