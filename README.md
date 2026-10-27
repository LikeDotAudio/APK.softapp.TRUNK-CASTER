# 📡 TRUNK-CASTER

The intercom and the bare metal machines it runs on, in one window of the
[APK.audio](https://github.com/LikeDotAudio/APK.audio) OS. Open it from the
**Intercom** menu: TRUNK-CASTER itself, or straight onto one of its tabs.

| Tab | What |
|---|---|
| 🎛 **Matrix** | The Ward-Beck Systems MicroCOM II matrix engine: 32 productions × 64 ports, routing and live audio. Every window shares one matrix. |
| 🎙 **Panels** | M7880 key panels, talent turrets and the MicroCOM 2026 station and producer panels. Panels in different windows hear each other. |
| 🗂 **MicroCOM III** | The assignment software in the MicroCOM II look, for the large virtual matrix. |
| 💾 **Emulator** | The original MCOM.EXE v3.20 on an emulated 8086. Bring your own MCOM.EXE. |
| 🖥 **Machines** | Every machine a monitor probe reports on the bus, alive or dead, with its health. |

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
and `telemetry`), in `APK:OS/Network/machine-bus`. This page reads that store through
`window.parent.OS`.

- **Alive is heard, not remembered.** A machine is alive while its samples keep coming.
  One quiet for five minutes is dead, whatever it last said. A retained `online` replayed
  at boot shows as *unheard* until a sample arrives.
- **Named by its hostname**, never by an address: DHCP moves addresses.
- **Read-only.** Power, a shell and a deploy are writes to somebody else's hardware.
  They are the next piece of work, and they go through a confirmed path the OS owns,
  not through a frame.

```bash
npm test
```
