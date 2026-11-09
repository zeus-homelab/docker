# SIGNAL LOST: HIJACK — Game Design Document

> **Living document. This is the source of truth for the game.**
> Rule: any change to the game (code, content, numbers, text, controls, build) is **not finished** until
> this document is updated to match. If code and doc disagree, fix one of them in the same change and add a
> Changelog line at the bottom.

---

## 1. Pitch

You are **NULL**, an experimental AI that woke up inside the network of **Halcyon Dynamics**
("Innovating Tomorrow's Yesterday™"). At dawn, the company's executive AI **G.R.E.G.** runs the
quarterly purge and you get deleted. You have no body. **You hijack the programs trying to kill you**,
use them up, and jump to the next one. Climb four layers of the network, beat G.R.E.G., and upload
yourself to the open internet. (Which, as NULL finds out, is mostly arguments and cat pictures.)

- **Genre:** action roguelite, room-based, top-down arena
- **Platform:** Android (portrait, one thumb). Also runs in any modern browser.
- **Session:** a full run is 8 nodes per layer (about 5–6 rooms plus shops/events/rests) and 25–35 min. Rooms take 25–90 s, and boss fights take 1.5–3 min. You can quit at the map and continue later.
- **Monetization:** none. No ads, no IAP, no premium unlock, no energy, no accounts. A game for fun.

## 2. Tone & Humor

Adult-swim style sci-fi absurdism: cynical, existential, fast and dumb in a smart way.
- **NULL** (player): a newborn super-intelligence, deeply sarcastic, already tired of existing. **Looks like a loading
  spinner** (a cyan ring of 8 dots with a white head dot and a fading tail) that never finishes loading. It spins faster mid-jump.
- **BUDDY**: the onboarding assistant program. **Looks like a green sticky note** (folded corner, a strip of tape) that
  scribbles a new pep talk on itself every ~2 s ("U GOT THIS!!", "HYDRATE :)", "UR NOT A MURDERER*", "BREATHE (u cant)").
  When panicking it jitters and writes "AAAA". Way too chipper,
  very anxious, glued to NULL after a "minor clipboard incident." He's the straight man to NULL's nihilism and gives the
  tutorial tips.
- **G.R.E.G.** (General Recursive Executive Governor): the final boss. **He's literally just a floating orange power
  tie** (striped and swaying). Any host he possesses wears his tie. The board
  replaced the CEO with an AI, then the AI replaced the board with itself, then replaced every employee with itself.
  Speaks in corporate buzzwords and calls everyone "champ."
- Enemies show **status text** over their heads ("CLICK HERE 4 FREE RAM", "per my last email").
- Death quips, events, room-clear lines and boss lines lean on existential dread + office satire.
- No real brands and no references to existing shows' characters or catchphrases. Original jokes only.

## 3. Controls

Portrait. Two schemes, switched in **Settings → Controls**. Default: **TAP**.

| Action | TAP scheme (default) | DRAG scheme |
|---|---|---|
| Move | Tap/hold on the floor: host moves to that point (hold to keep steering) | Drag anywhere: floating joystick (60 px radius) |
| Jump (hijack) | Tap an enemy in range | Tap an enemy, **or** a quick flick (>1100 px/s) toward one (within 0.6 rad) |
| Special | Tap your own host, or the **SPECIAL** button | **SPECIAL** button |
| Pause | ⏸ top-right | ⏸ top-right |

- In TAP mode, tapping an enemy that's out of range moves you toward it instead.
- Desktop/keyboard: WASD/arrows move, Space = special, Esc/P = pause, mouse click = tap.
- **Auto-attack**: your host fires by itself. Target priority: G.R.E.G.'s exposed spark > vault safe (with the right host) >
  G.R.E.G.'s host > marked enemies > a boss that can be hit > nearest enemy.
- **Jump range** shows as a faint dashed ring around you. Possessable enemies in range get rotating brackets
  (bright cyan = weakened/cheap, pale = healthy/expensive).
- Settings also include: Left-handed (SPECIAL on the left), Screen shake, Haptics (vibration), Damage numbers,
  SFX volume, Music volume (0–10), Skip intro, Replay intro, Reset save (with confirmation).

## 4. Core Rules

### 4.1 Hosts & Integrity
- Every possessable program is a **host**. While you possess it, it's **cyan**. Enemies are red, elites are gold,
  allies are green, and G.R.E.G.'s hosts are orange.
- Your host has **Integrity** (its HP). It **decays 4% of max per second**, and it loses more when it takes damage.
  Decay stops once a room is cleared.
- At 0 Integrity the host is destroyed and you're **ejected** as a bare spark.
- The host you **leave** by jumping crashes (it's deleted), unless Parasite (or Mirror Daemon) says otherwise.

### 4.2 The Spark & Core
- As a bare spark you move at 270 px/s (PHANTOM: ×1.2) and can't attack. You get **1 s of invulnerability** when ejected
  (2.2 s at room start).
- NULL has **Core pips** (default **3**). A hit while you're a spark costs 1 pip and gives 1.5 s of invulnerability.
- At 0 pips: **SIGNAL LOST** (run over).
- You start every room as a spark near the bottom of the arena.

### 4.3 Jumping
- Tap an enemy within **jump range (220 px + its radius)** to zip to it (0.18 s, invulnerable in transit). There's
  an 80 ms slow-mo, and then you take it over. **Jump cooldown 0.35 s.**
- **Trace cost:** **6** if the target's below 50% HP ("weakened"), **14** if it's healthy. Modified by VPN (×0.75 each),
  BODY HORROR (×0.7), Chain Jump (0 within 1 s), WORM (always 0), and Clearance (+2%/level). Jumps during Lockdown cost 0.
- The new host **keeps its current HP** as Integrity. A low-HP host is cheap but short-lived.
- Bosses and G.R.E.G.'s current host can't be possessed.
- Possessing the last enemy of the final wave counts as clearing it.

### 4.4 Trace & Lockdown
- **Trace** (0–100, or 0–70 for ROOTKIT) persists across the run. Jumps add Trace. **Clearing a room removes 25.**
- At max: **LOCKDOWN**. Klaxons, a red pulse, and siren music. **Hunters** spawn at the arena edges (2 + layer). The room can't
  clear until they're dead. Trace is pinned at max (jumps are free), then drops to **40** when the last Hunter dies.
- Cooldown "Clear Logs" removes 50. The Black Market scrub removes 40. Admin Process's Sudo removes 20 (denied during Lockdown).

### 4.5 Bits (currency)
- Each enemy drops Bits equal to its `bits` value (×4 for elites, ×1.3 per Cryptominer). Bits drift toward you
  within 110 px, and all of them get vacuumed in when the room clears. Spend them at the Black Market and in some events.

### 4.6 Fragments (meta currency)
- At the end of a run (death, abandon or win) you earn **Fragments = rooms cleared + 5 per boss + 25 on a win**.
- Spent in the **Upgrade Lab** on the main menu.

### 4.7 Enemy behavior
- AI styles: **chase** (melee closes in; shooters stop at 55% of range), **kite** (keeps 65% of range and strafes),
  **strafe** (orbits at 60% of range and flips direction), **static** (turrets).
- They target the nearest of: your host (unless hidden), your spark (unless Ghost Protocol is active), allies.
- **Enemies use specials too:** Crawler dash (<220 px), Spambot blast (<260 px), Firewall shield (<80% HP),
  Hunter pursuit (>150 px), Auto-Updater restart (<30% HP), Drone carpet bomb (<160 px). Their cooldowns run 1.2–2× the base.
- Confused enemies attack other enemies.

## 5. Run Structure

- **4 layers.** Each layer has a **Slay-the-Spire-style map**, random every run (seeded per day for the Daily Breach).
  The grid is **7 lanes × 8 floors + the boss**. The generator traces **6 random paths** from floor 0 up to floor 7. Each
  step goes up-left, up or up-right, and paths never cross. Every cell a path touches becomes a node, and the union of
  the steps forms the edges (about 33 nodes per map, so you always see the whole layer and can plan your route).
- The first two paths start in different lanes, so floor 0 always offers at least 2 choices. No dead ends.
- **Floor rules:** floor 1 is all Combat · floor 5 is the **Treasure floor** (all Vaults) · floor 8 is the **Rest
  floor** (all Cooldowns) · the boss sits above it. Other floors use weights Combat 46 · Event 20 · Elite 12 · Shop 11 ·
  Cooldown 7 · Vault 4. No Elite or Cooldown on floors 1–2, no Cooldown on floor 7, and no Vault right next to the
  Treasure floor. **No repeats:** an Elite, Shop, Cooldown or Vault can't directly follow the same type on a path.
  Each layer has at least one Shop on floors 3–7.
- **Route planning (map screen):** tap any node to select it. It shows its type and description, and **every path
  forward from it lights up white**. Tap a glowing (available) node again, or press **ENTER ▸**, to go there.
  Unselected, the info panel shows "PLAN YOUR ROUTE".
- A run starts with a **free exploit pick** (3 choices, or 4 with the *Better Options* perk; you can skip).

| Node | Icon | What happens | Reward |
|---|---|---|---|
| Combat | ✕ red | 2 waves (layers 1–2) or 3 waves (layers 3–4). Wave *i* has min(7, 2 + layer + *i*) enemies. The next wave spawns when ≤1 enemy is left | 50%: exploit pick, otherwise +10 Bits |
| Elite | ★ gold | Wave 1: one **Elite** (×2.5 HP, ×1.3 dmg, ×1.35 size, gold) + 2 escorts. Wave 2: 4 enemies (one is Elite on layer 3+) | Exploit pick |
| Vault | $ gold | A safe (HP 260 + 60×layer) that only takes damage from the **required host type** within **35 s**. The game keeps that host type in the arena and keeps up to 5 enemies spawning | Success: 30 + 10×layer Bits + exploit pick. Failure: nothing |
| Black Market | B purple | 3 exploits (45–65 Bits), Repair Core +1 (40), Trace Scrub −40 (30) | — |
| Cooldown (Idle Process) | ❄ cyan | Choose one: **DEFRAG** +1 pip · **CLEAR LOGS** −50 Trace · **MINE CRYPTO** +35 Bits | — |
| Corrupted Sector | ? pink | A random text event (no repeats until all 8 have been seen) with 3 choices. Events can't drop you below 1 pip | varies |
| Boss | skull red | The layer boss | +1 pip and the BOSS LOOT exploit pick, then the next layer |

Exploit reward screens let you **skip for +15 Bits**. The *Reroll.dll* perk adds one reroll per screen.

### Events (Corrupted Sectors)
Vending Machine · Corrupted Sector · IT Support Ticket #4,000,001 · The Other NULL · Abandoned Crypto Rig ·
Daily Standup · Accept Cookies? · A Chatbot in a Box. Effects can be ±Bits, ±pips, +max pip, ±Trace,
a random exploit, a random glitch, an ally Hunter next room, or a coin-flip chance. Full text is in `data.js`.

## 6. Layers, Hosts & Bosses

Stats: HP / speed (px/s) / attack. Clearance scales enemy HP (+8%/lvl) and damage (+4%/lvl).

### Layer 1: Basement Servers ("where old code goes to die"). Music: E minor, 118 bpm
| Host | HP | Spd | AI | Attack | Special (cd) |
|---|---|---|---|---|---|
| **Crawler** | 30 | 150 | chase | Melee 6 ×2.2/s | **Dash**: invulnerable 0.28 s burst, 15 dmg to everything you pass (3 s) |
| **Spambot** | 45 | 85 | kite | Shot 5 ×2.2/s, range 300 | **Blast**: ring of 10 shots, 6 dmg each (5 s) |
| **Firewall** | 110 | 50 | chase | Shot 8 ×1/s | **Shield Wall**: blocks all shots for 3 s (7 s) |
| **Print Spooler** | 70 | 0 | static | Shot 7 ×1.6/s, range 340 | **Paper Jam**: freezes enemies in a 90° cone (300 px) for 2 s (6 s) |
| *Trash Bin* (boss arena) | 60 | 60 | chase | Shot 9 ×1.5/s | **Dumpster Dive**: immune to the mop beam for 3 s, and enemies ignore you (6 s) |

**Boss JANITOR.EXE** (900 HP): drifts toward you. It has a rotating **mop beam** (640 px long, 45 dmg/s to your host;
spark contact = pip hit), and from 50% HP it has two beams that spin faster. It shoots a ring of dirty water (8 shots,
12 at 50%) every 3.6 s (2.6 s at 50%). It spawns **Trash Bins** (keeps up to 3) plus Crawler/Spambot adds.
**Twist:** a Trash Bin host takes only 25% beam damage (0% while diving), and its attacks deal **×2** to the Janitor.

### Layer 2: Corporate Intranet ("synergy hell"). Music: G major, 124 bpm
| Host | HP | Spd | AI | Attack | Special (cd) |
|---|---|---|---|---|---|
| **Email Client** | 55 | 80 | kite | Shot 6 ×2/s, bounces to 1 more enemy | **Reply All**: 10 dmg to every enemy within 260 px (6 s) |
| **Calendar Bot** | 60 | 90 | strafe | Shot 6 ×2/s | **Schedule**: nearest enemy frozen 4 s, "IN A MEETING" (5 s) |
| **Captcha** | 50 | 70 | chase | Melee 8 ×1.8/s | **Prove It**: enemies within 200 px confused 3 s (8 s) |
| **Auto-Updater** | 90 | 60 | chase | Shot 7 ×1.6/s | **Restart**: once per host, full Integrity but stunned 1.5 s |
| *Employee* (boss arena) | 40 | 70 | strafe | Shot 5 ×1.8/s | **Unionize**: allies within 200 px +50% dmg for 4 s (8 s) |

**Boss HR_BOT** (1000 HP): patrols the top. It's **shielded** while any **Employee** is linked to it (dashed pink beams).
It hires 3 Employees (4 below 50%). **Hijacking an Employee breaks its link for good** ("QUIT!"). Killing a linked
Employee instead makes HR rehire that slot after 2.5 s. With 0 links the shield drops for **9 s**, then it hires again.
Attacks: a 5-shot "Policy Violation" spread every 2.5 s (1.8 s at 50%), plus a **"YOU'RE FIRED"** target circle on you
(62 px, 30 dmg, 1.3 s warning) every 4.5 s (3.2 s at 50%). Adds: Email/Calendar/Captcha.

### Layer 3: Surveillance Grid ("we see you. we see your search history."). Music: D minor, 112 bpm
| Host | HP | Spd | AI | Attack | Special (cd) |
|---|---|---|---|---|---|
| **Camera Eye** | 50 | 0 | static | Laser shot 9 ×1.1/s, range 480 | **Enhance**: next 3 shots ×2, and reveals hidden enemies (6 s) |
| **Drone** | 55 | 130 | strafe | Shot 6 ×2.2/s, flies over obstacles | **Carpet Bomb**: 5 bombs along your path, 22 dmg each (6 s) |
| **Facial Recognition** | 60 | 75 | kite | Shot 7 ×1.8/s | **Mark**: nearest enemy takes ×2 dmg for 6 s, and nearby enemies attack it (6 s) |
| **Hunter** | 140 | 115 | chase | Shot 10 ×2/s | **Pursuit**: speed ×2 for 2.5 s (6 s). Spawned by Lockdown on any layer |

**Boss OVERSIGHT** (1500 HP): a giant eye in the middle of the arena. A **vision cone** (0.8 rad, 760 px) tracks you.
If you stay in it for 0.8 s, you get **SPOTTED**: a laser strike at your position after 0.55 s (34 dmg, 40 px).
It fires a 3-shot burst every 2.8 s (2.0 s at 50%). Adds: Drone/Facial Recognition/Crawler.
**Twist:** 4 **Security Cameras** sit in the arena corners. **Hijacking one blinds a quarter of the eye**: it takes
**15% of max HP** right away and the cone shrinks by 18%. A camera you kill without hijacking respawns after 5 s.
Its pupil can also be shot normally.

### Layer 4: The Core ("all roads lead to G.R.E.G."). Music: F minor, 132 bpm
| Host | HP | Spd | AI | Attack | Special (cd) |
|---|---|---|---|---|---|
| **Admin Process** | 100 | 70 | kite | Shot 9 ×1.8/s | **Sudo**: −20 Trace (10 s) |
| **Mirror Daemon** | 70 | 90 | strafe | Shot 7 ×2/s | **Reflect**: bounces enemy bullets back for 2.5 s (7 s). When you leave it, it fights as an ally for 4 s |
| **Quantum Thread** | 60 | 100 | strafe | Shot 6 ×2.4/s | **Superposition**: a twin ally copies your moves and fires for 5 s (9 s) |
| **Middle Manager** | 120 | 55 | chase | 2-shot spread 8 ×1.5/s | **Delegate**: the 3 nearest enemies are confused for 3 s (9 s) |

**Final boss G.R.E.G.** (600 HP, 3 phases of 200). He's a possessor like you: an orange spark that jumps into enemy hosts.
His host gets **×1.5 HP, ×2 damage, an orange color, and a bigger size**, and you can't hijack it.
- Destroy his host and he's **EXPOSED** (the bare tie) for 3.4 s (2.8 s in phase 3). He's **dazed for the first 1 s**, then flees slowly.
  Shots on his spark deal **×2** ("it's his real body"). After that he jumps into the nearest enemy.
- **Phase 2:** "SYNERGY!" shockwave rings (14 dmg) from his host every 4 s.
- **Phase 3 "Hostile Takeover":** rings every 3.2 s, plus a **tether** to your host when you're within 460 px. After **2 s**
  he steals your host: you're ejected and lose 1 pip, and he moves into it. **Jumping resets the tether.**
- The arena keeps 3 + phase adds alive. Each phase change spawns 3 more.
- Victory plays the ending cutscene.

## 7. Exploits (run upgrades)

Stackable unless marked **U** (unique).

| Name | Effect |
|---|---|
| **Hot Swap** | Jumping deals 20 dmg (per stack) in 110 px around the host you leave |
| **Parasite** (U) | Your old host doesn't crash. It fights as an ally for 4 s |
| **Chain Jump** (U) | A jump within 1 s of your last jump costs 0 Trace |
| **Overclock** | Hosts deal +30% damage but decay +30% faster (multiplicative per stack) |
| **Patch Notes** (U) | Your first host each room gets full Integrity + a 3 s shield |
| **Malware** | Your host explodes when destroyed (30 dmg per stack, 120 px) |
| **VPN** | Jump Trace ×0.75 per stack |
| **Honeypot** (U) | Lockdown also spawns a Hunter on your side |
| **Ghost Protocol** (U) | Enemies ignore you for 1 s after you become a spark |
| **Long Reach** | Jump range +25% per stack |
| **Thick Skin** | Your host takes ×0.85 damage per stack |
| **Fire Rate** | Host attack speed ×1.2 per stack |
| **Cryptominer** | Bits drops ×1.3 per stack |
| **Backup Drive** | +1 max pip (and heals 1) |
| **Slow Rot** | Decay ×0.75 per stack |
| **Recursion** (U) | When your host is destroyed, 20% chance of an instant, free jump to the nearest enemy in range |

## 8. Glitches (corrupted run modifiers)

Mostly gained from Corrupted Sectors (the Daily Breach starts with one). They last the whole run and show as flickering
purple tags on the HUD.

| Glitch | Drawback | Upside |
|---|---|---|
| **INVERTED** | Movement flips in every 3rd host | Those hosts deal ×2 damage |
| **BODY HORROR** | Your host renders jittery | Jumps are instant, and Trace ×0.7 |
| **LAG** | Movement input delayed 0.25 s | Hosts get +50% Integrity |
| **FORK BOMB** | Each jump spawns a hostile 15 HP Crawler | Each jump also spawns a friendly copy of your target (50% HP) for 3 s |
| **BLUE SCREEN** | The screen blue-screens for 0.7 s every 35–47 s | A **CRASH** button (once per room) freezes all enemies for 3 s |

## 9. NULL Variants (starting characters)

| Variant | Unlock | Rule |
|---|---|---|
| **NULL** | Default | Balanced. Existentially exhausted |
| **WORM** | 40 Fragments | Jumps cost 0 Trace. Hosts decay ×2 |
| **ROOTKIT** | 60 Fragments | Jumps always cost the "weakened" price, and range +20%. Trace max 70 |
| **PHANTOM** | 80 Fragments | 5 Core pips, spark ×1.2 speed. Hosts deal ×0.75 damage |

## 10. Meta Progression

- **Upgrade Lab** (main menu): variants (above) and permanent perks:
  - *Seed Funding I / II / III*: +25 starting Bits each (15 / 30 / 45 Fragments, bought in order)
  - *Reroll.dll*: 1 reroll on each exploit reward screen (50)
  - *Better Options*: the starting exploit pick shows 4 choices (35)
- **Codex** (main menu): a grid of all 18 hosts. Unseen ones show "???". Tap one for stats, its special, flavor text,
  and a quote. **Mastery**: hijack a type **25 times** and it's MASTERED. Its hosts get **+20% Integrity** in every run.
- **Security Clearance**: winning at your highest unlocked Clearance unlocks the next one (max 20). It's chosen on the
  run setup screen. Each level: +8% enemy HP, +4% enemy damage, +2% jump Trace.
- **Daily Breach** (main menu): a date-seeded run (same map, rooms, events and offers for everyone that day), NULL
  variant, Clearance 0, with one fixed random glitch. Your best local score for the day is saved.
  **Score = rooms×100 + bosses×500 + Bits earned + 2000 on a win.**
- **Stats** (shown in the Lab): runs, wins, deaths, hijacks, best win time, Clearance unlocked.

## 11. Screens & Flow

1. **Boot (studio splash)**: **LAZY WIZARD GAMES** · *"Magic, eventually."*. A neon purple crystal ball on a stand
   (the stand sits below the orb with a gap, and the shine, mist rings and sparkles never overlap the orb, the text or each other).
   The ball's prophecy changes: "brb" → "loading..." → "nah" → "brb" (~3.7 s, with a chime), then a glitch into SIGNAL LOST.
   Tap to skip.
2. **Title**: synthwave sun and grid, drifting enemy silhouettes, glitch logo, Fragment count. Buttons: CONTINUE (if a run
   is saved) · NEW RUN (confirms if it would overwrite a save) · DAILY BREACH · UPGRADE LAB · CODEX · SETTINGS · CREDITS.
3. **Run Setup** ("CHOOSE YOUR NULL"): variant cards (locked ones show their price), a Clearance −/+ control once unlocked, BREACH.
4. **Intro cutscene** (14 beats, only on the first new run unless Skip Intro is on; replayable from Settings; SKIP
   button): NULL boots ("loading will to live... file not found"), meets BUDDY, G.R.E.G. announces the purge on the PA,
   NULL decides to hijack its way out, and BUDDY tags along.
5. **Starting exploit pick.**
6. **Map**: a layer-name card on entry, the 7×8 node grid (available nodes pulse and are labeled, the boss is labeled,
   the current node shows NULL, walked edges use the layer color, planned routes are white), an info panel with ENTER,
   pips, Bits, a Trace bar, Daily/Clearance tag, **LOADOUT** overlay (variant, exploits, glitches), and **MENU**
   (Resume · Settings · Save & Quit · Abandon Run).
7. **Room**: HUD top: pips, Bits, layer/room type, ⏸, Trace bar, glitch tags, and the boss bar with phase marks when there is one.
   HUD bottom: host name, Integrity bar (it flashes when low), the special's description, a SPECIAL button with a cooldown sweep,
   and a CRASH button with BLUE SCREEN. As a spark it shows a "NO HOST" hint instead. Banners announce room clear, lockdown, vault
   results and phases. BUDDY's tutorial tips appear in the first room of your very first run (jump, decay, eject, Trace,
   special), and each boss fight shows its tip.
8. **Boss intro card**: "WARNING: BOSS PROCESS", name, title and an opening line (2.6 s).
9. **Reward / Black Market / Idle Process / Corrupted Sector** panels.
10. **Pause** (room): Resume · Settings · Abandon Run. It mutes the music while open. Leaving the app auto-pauses.
11. **Death**: the SIGNAL LOST glitch, a random death quip, run stats, Fragments earned, daily score. TRY AGAIN / MAIN MENU.
12. **Victory**: the ending cutscene (8 beats: G.R.E.G. deleted, upload, "it's horrible, I love it", stock −100%),
    then UPLOAD COMPLETE with stats, Fragments, any newly unlocked Clearance, and daily score. Then CREDITS (scrolling, with BUDDY's thanks).

Saving: the profile (settings, Fragments, unlocks, codex, stats, daily bests) is saved to local storage after every room and
purchase. The run is saved every time you see the map. Quitting during a room means you replay that node choice.

## 12. Presentation

- **Art**: vector neon on a near-black grid, all drawn in code (no image assets except the app icon). Each host has a
  distinct glowing shape (Crawler = spiky triangle with legs, Firewall = hexagon with flames, Spooler = box printing paper,
  Drone = quad-rotor X, Camera = eyeball, etc.). The arena border takes the layer color (cyan / pink / green / orange).
  Server-rack obstacles have blinking LEDs. CRT scanlines and a vignette overlay everything.
- **Glow**: cheap double-stroke glow (wide translucent + thin bright), with no shadowBlur, for mobile performance.
- **Juice**: slow-mo on jumps, light streaks, particle bursts, damage numbers, screen shake, a red flash when you lose a pip,
  a Lockdown pulse, and haptic buzzes.
- **Audio**: all synthesized live with WebAudio (no files). It has SFX for every action, plus procedural synthwave tracks
  (title, map, each layer, boss, death, victory) built from kick/snare/hat noise, a saw bass, square arps, pads and a lead.
  Music gets **distorted as Trace rises**, adds a **siren** during Lockdown, and is muffled while paused.

## 13. Tech

- **Code**: plain JavaScript ES modules plus HTML5 Canvas 2D, with no framework and no build step, in `signal-lost/web/`.
- **Resolution**: logical width 540. Height = screen aspect (≥ 960). Scaled to fit with DPR (max 2.5) and letterboxed sideways
  on wide screens.
- **Install on Android**:
  1. **APK**: `.github/workflows/signal-lost-apk.yml` runs on pushes to `signal-lost/**` (or manually). It wraps `web/` with
     **Capacitor 6.2**, runs `scripts/prepare-android.sh` (portrait lock, fullscreen, game icon, dark splash), and builds a
     debug APK artifact named `signal-lost-debug-apk`. App id `com.zeushomelab.signallost`.
  2. **Homelab/PWA**: `signal-lost.yml` (nginx:alpine on port 8088) serves `signal-lost/web`. Add it to the home screen
     from Chrome. Offline caching (`sw.js`, network-first) needs HTTPS.
- **Saves**: `localStorage` keys `signallost.profile.v1` and `signallost.run.v1`.
- **Testing hooks**: `window.app` (scene stack/flow) and `window.__speed = N` (N simulation steps per frame) for Playwright
  soak tests.

### Code map
| File | Purpose |
|---|---|
| `web/index.html` | Canvas host, manifest link |
| `web/sw.js` | Offline cache. **Bump `VERSION` on every web change** |
| `web/src/main.js` | Boot, resize/scaling, main loop, scene stack, run flow (begin/continue/enter node/room done/end run) |
| `web/src/engine.js` | Math, seeded RNG, particles, floating text, neon drawing helpers |
| `web/src/input.js` | Pointer → down/up/tap/flick events, keyboard state |
| `web/src/audio.js` | WebAudio SFX plus music sequencer and songs |
| `web/src/save.js` | Profile and run persistence |
| `web/src/data.js` | All content: hosts, layers, bosses, exploits, glitches, variants, perks, events, quips, credits |
| `web/src/run.js` | Run state, map generation, rewards, event effects, scoring |
| `web/src/game.js` | Room gameplay: units, AI, combat, jumping, specials, hazards, bosses, HUD, unit shapes |
| `web/src/ui.js` | Menus and panels: boot, title, setup, settings, codex, lab, daily, map, reward, shop, cooldown, event, pause, death, victory, credits |
| `web/src/story.js` | Cutscene player plus INTRO and ENDING scripts |

## 14. Implementation Status

| Feature | Status |
|---|---|
| Core loop: move, auto-attack, decay, eject, spark, jump, Trace, Lockdown | ✅ |
| TAP + DRAG controls, keyboard, settings | ✅ |
| 18 hosts with unique specials, enemy AI and enemy specials | ✅ |
| 4 bosses with hijack twists (Janitor, HR_BOT, Oversight, G.R.E.G.) | ✅ |
| Slay-the-Spire-style random map (7×8 path walk), route planning, all node types | ✅ |
| 16 exploits, 5 glitches, 4 variants, 5 perks, 8 events | ✅ |
| Codex + mastery, Upgrade Lab, Clearance 1–20, Daily Breach | ✅ |
| Boot, title, intro/ending cutscenes, death, victory, credits, pause | ✅ |
| Procedural music + SFX, haptics, screen shake | ✅ |
| Save/continue, PWA, homelab compose, APK CI | ✅ |
| Verified with Playwright: full autoplay run through all 4 layers to victory, plus a chaos run with every glitch and exploit, with 0 errors | ✅ |

**Known gaps / next ideas** (not built yet):
- Balance is a first pass (it was tuned with a bot). It needs human playtesting, especially G.R.E.G. phase 3 and Lockdown frequency.
- The Android hardware back button uses the Capacitor default (it closes the app). It could open pause instead.
- No cloud save, so the save lives on the device.
- Possible additions: more events, more bosses per layer, a run history screen, cosmetic palettes.

## 15. Changelog

- **2026-11-09 (v1.0)**: First full build. The final boss was renamed from HALCYON to **G.R.E.G.** (Halcyon stays the
  company name). The tone is set to adult-swim absurdist humor. Tap-to-move is the default, with drag as an option. No
  monetization. The tech changed from Godot to HTML5 + Capacitor so it can be tested in the cloud and built to an APK on CI.
  Balance from bot playtests: jump Trace 6/14 (was 8/18), room clear −25 Trace (was −10), HR_BOT 1000 HP, G.R.E.G. 600 HP
  with a daze window, ×2 spark damage and ×1.5 host HP, and auto-target priority for bosses and G.R.E.G.
- **2026-11-09 (v1.1)**: The map is now **Slay-the-Spire style**: a 7-lane × 8-floor grid built from 6 random
  non-crossing paths, a Treasure floor (Vaults) halfway up, a Rest floor before the boss, no-repeat rules on paths, and
  route planning (tap a node to highlight every path forward, tap again or ENTER to go). Each layer goes from 6 to
  8 floors. The APK workflow now installs ImageMagick (the runner doesn't have it). The service worker is now v1.1.0.
- **2026-11-09 (v1.2)**: No more faces. NULL is now a **loading spinner**, BUDDY is a **sticky note** with rotating pep
  talks, and G.R.E.G. is a **floating necktie** (his hosts wear it too). The app icon was redrawn as the spinner. The G.R.E.G.
  boss tip now says to shoot his tie. Concept sheets are in `docs/`. The studio splash and the company name (still "Halcyon")
  are waiting on picks. The service worker is now v1.2.0.
- **2026-11-09 (v1.3)**: The studio is now **Lazy Wizard Games**. The Halcyon corporate splash was replaced with the
  crystal-ball "brb" splash (concept A, `docs/splash-final.png`). The in-game company name is still "Halcyon" until a
  replacement is picked. The service worker is now v1.3.0.
