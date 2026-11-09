# SIGNAL LOST: HIJACK

You're **NULL**, a rogue AI with no body, stuck inside the network of **OmniVague Solutions™** ("We Do Things."). At dawn, the
company AI **G.R.E.G.** deletes you. **Hijack the programs trying to kill you**, burn through their bodies,
and climb 4 layers to escape to the open internet.

It's an action roguelite for Android, played one-thumb in portrait. No ads, no microtransactions, no account.

> Full design, numbers, and content live in **[DESIGN.md](DESIGN.md)**. It's the source of truth, and every change must update it.

## Install on your phone

### Option A: APK (real app)
1. Every push that touches `signal-lost/` runs the **Signal Lost APK** GitHub Action.
2. Open the repo on GitHub → **Actions** → the latest *Signal Lost APK* run → download the
   `signal-lost-debug-apk` artifact (a zip containing `signal-lost-debug.apk`).
3. Copy it to your phone, open it, and allow "install unknown apps" for your file manager or browser.
4. To update, install a newer APK over the old one. Your save is kept.

### Option B: Host it on the homelab
```bash
docker compose -f signal-lost.yml up -d     # from the repo root
```
Then open `http://<server-ip>:8088` on your phone. Use Chrome's menu → *Add to Home screen*.
(Offline and full-app install need HTTPS. Over plain http it works as a shortcut. Put it behind your
reverse proxy with a cert if you want the full PWA behavior.)

### Option C: Quick local test
```bash
cd signal-lost && python3 -m http.server 8088 --directory web
```

## How to play

| | TAP controls (default) | DRAG controls |
|---|---|---|
| Move | Tap/hold the floor | Drag anywhere (floating joystick) |
| Hijack | Tap an enemy in range | Tap or flick toward an enemy |
| Special | Tap your host or the SPECIAL button | SPECIAL button |

Switch schemes in **Settings → Controls**. Keyboard works too on desktop (WASD, Space, Esc).

- Your host **auto-attacks** and **slowly rots**. Jump before it pops.
- Out of a host you're a fragile **spark**. One hit costs a Core pip. Lose them all and the signal is lost.
- Every jump raises **Trace**. At 100 you get a **LOCKDOWN** with Hunters and sealed doors.
- Weakened enemies (under 50% HP) are cheaper to hijack.
- Bosses each have a hijack trick. Read BUDDY's tip.

## Project layout
```
signal-lost/
  DESIGN.md                  living design doc (source of truth)
  web/                       the game (plain JS + Canvas, no build step)
    index.html, sw.js, manifest.webmanifest, icons/
    src/  main · engine · input · audio · save · data · run · game · ui · story
  scripts/prepare-android.sh patches the generated Android project (portrait, fullscreen, icon)
  package.json, capacitor.config.json   Capacitor wrapper used by CI to build the APK
```

## Building the APK yourself
Needs Node 20+, JDK 17 and the Android SDK.
```bash
cd signal-lost
npm install
npx cap add android
bash scripts/prepare-android.sh
npx cap sync android
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```
