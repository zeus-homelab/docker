# Midnight Pizza Patrol (Android)

A night-shift arcade game for Android phones. You play as an animatronic mascot at **Chompy's Pizza Palace**
and chase down the naughty kids who are trashing the place after hours.

**Install:** copy `dist/PizzaPatrol.apk` to your phone, open it, and allow "install unknown apps" when asked.
Requires Android 7.0 or newer. The game plays in landscape.

## Gameplay
- **Build your bot:** mix and match the head, body, arms and legs of five original mascots
  (Gus the Gator, Penny the Penguin, Rocco the Raccoon, Mabel the Moose, Ollie the Owl).
  - Legs set **speed**, arms set **grab reach**, the head sets **vision** and **roar** size, and the body sets **battery** (sprint time).
- **Move:** drag anywhere on the left side of the screen. **SPRINT:** hold to run (drains battery).
  **ROAR:** freezes naughty kids nearby, but it scares good kids too and costs points.
- Naughty kids wear red caps and are marked with a red **!** (red arrows point to ones off screen). Touch them to send them to Time-Out.
- Catch the quota before **6 AM**, and don't let the **MESS** meter reach 100%.
- 5 nights, each harder than the last. Progress and best scores are saved on the device.

### Special features
- **Head powers (POWER button):** Gator *Chomp Dash* (lunge), Penguin *Ice Slide* (icy trail kids slip on),
  Raccoon *Pizza Bait* (kids stop to munch), Moose *Stampede* (charge), Owl *Night Sight* (see far, reveal sneaky kids).
- **Air vents** link the dining hall, arcade, kitchen, party room, restrooms and office. You and the kids can both use them.
- **Pizza deliveries** lure naughty kids into a group. Grab the box yourself to recharge your battery and powers.
- **Naughty kid types:** Skaters (fast) and Sneaky kids (hoodies, hide in the ball pit, invisible in the dark).
- **Themed nights:** 1 Opening Night, 2 Lights Out (power outages), 3 The Night Guard (freeze when his flashlight
  hits you, or he catches you moving), 4 Sugar Rush (everyone is fast), 5 The Prankster King (boss you must catch 3 times).
- **Worn animatronic look** (toggle in the builder): grubby fur, exposed metal joints, torn chest wires, cracked faces,
  black eyes with glowing pupils at night, security-camera static, and an instant-camera "BUSTED!" photo on every catch.
- **Tickets & prize shop:** earn tickets each night and buy accessories for your bot: shades, chef hat, headphones, propeller cap, crown.

## Project layout
- `app/assets/index.html`: the whole game (HTML5 canvas + synthesized WebAudio, no external assets).
  The soundtrack is original and generated live: *Midnight Waltz* (title), *Workshop Bounce* (builder),
  *Night Shift* (gameplay, adds layers as the mess and the clock rise), *Blackout* (power outages),
  *Prankster's Parade* (night 5), plus clock-tower bells every hour.
  Open it in a desktop browser to play-test (WASD/arrows, Shift = sprint, Space = roar, E = power, Esc = pause).
- `app/src/.../MainActivity.java`: full-screen WebView wrapper.
- `build.sh`: builds and signs the APK **without the Android SDK**, using Maven Central artifacts only
  (aapt2 and framework resources from apktool-lib, dalvik-dx, apksig). Needs JDK 11+, python3, curl, unzip, zip.
  It generates a signing key (`pizza-patrol.p12`, git-ignored) on first run. Keep that file if you want
  future builds to install as updates rather than requiring an uninstall.
- `render_icons.js`: regenerates the launcher icons from the game's own drawing code (needs Playwright).
