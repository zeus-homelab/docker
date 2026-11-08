# Backbeat Blitz 🥁

An Android rhythm runner where **you are the instrument**, the level is the song, and every jump is a drum hit.

![title](screenshots/title.png)

## Install

Download **[`BackbeatBlitz.apk`](BackbeatBlitz.apk)** to your phone, open it, and allow "install unknown apps" when Android asks.
Works on Android 5.0+ and plays in landscape.

## How it plays

The world is built on the music grid. One block is a 16th note, one beat is 4 blocks, and **a drum jump lasts exactly one beat**.
If you jump on the beat, you land on the beat. The bass, beat and fills you hear tell you when to jump.

| You are… | Controls | The band adds… |
|---|---|---|
| **Snare Drum** 🥁 | tap or hold to jump | full drum kit |
| **Trumpet** 🎺 | hold to blow and rise, let go to sink | a brass lead melody |
| **Tambourine** 🪘 | tap to flip gravity | jingles and claps |

Fly through the **instrument portals** to switch. The music changes with you.

### Things that will hurt you
- **Sharps**: pink spikes on the floor and ceiling
- **Noise Goons**: grumpy guys with megaphones walking at you. **Land on their heads** as the drum to stomp them (*BAP!*, bonus points)
- **Sour Notes**: angry green notes bobbing up and down on the beat
- **Vinyl Saws**: spinning records with teeth
- **Speaker stacks**: you can land on top, but don't run into the side

### Things that help
- **Cymbals** (golden discs): tap while touching one to jump again in mid-air
- **Drum Pads** (yellow): launch you extra high
- **♫ Notes**: collect them for points

### Leeway
- **Input buffer:** a tap up to 90 ms before you land, or before you reach a cymbal, still counts.
- **Coyote time:** you can still jump 60 ms after running off a ledge.
- Spikes, saws, goons and sour notes have hitboxes a little smaller than they look.

### Scoring
Jumps, flips and cymbal hits that land within ~55 ms of the beat score **PERFECT**, within ~110 ms **GREAT**.
Chain them for a **beat combo** score multiplier.
**Practice mode** (toggle it on the song list) respawns you at the last instrument change.

### Songs
Listen to a 15-second clip of every song in **[`mixtape.mp3`](mixtape.mp3)**.

| | Song | BPM | Style | Band |
|---|---|---|---|---|
| ★ | Reggaeton Rumble | 96 | dembow | electric piano, synth pluck |
| ★ | Carnival Samba | 104 | samba parade | surdo, shakers, agogo bells, congas, whistles |
| ★ | Garage Groove | 110 | garage rock | crunchy guitar chords and riff |
| ★★ | Steel Pan Splash | 118 | soca / calypso | steel pans |
| ★★ | Disco Inferno | 120 | disco | offbeat keys, octave bass, horns |
| ★★ | Marching Mayhem | 128 | drumline funk | organ clav, cowbell, horns |
| ★★ | 8-Bit Hero | 136 | chiptune | 16th-note arpeggios, square-wave lead |
| ★★★ | Surf's Up | 144 | surf rock | tremolo-picked twangy guitar |
| ★★★ | Breakbeat Blitz | 150 | breakbeat | electric piano, pluck |
| ★★★ | Ska-Doosh! | 152 | ska | organ skank, walking bass, horns |
| ★★★★ | Jungle Overdrive | 174 | drum & bass | stabs, pluck |

Most songs are in a major key. Each has a catchy two-bar hook written relative to the chords, so it always fits.
**The band follows your instrument.** As the drum, the hook trades bars with the band. As the trumpet, the horn section takes the melody. As the tambourine, jingles and claps join in.

![songs](screenshots/select.png)
![more songs](screenshots/select2.png)
![drum](screenshots/drum.png)
![trumpet](screenshots/trumpet.png)
![tambourine](screenshots/tambourine.png)

## Under the hood
- Pure Java and Android Canvas, no engine and no libraries. The APK is about 100 KB.
- **No audio files.** Every drum, percussion hit and instrument is synthesized by the app: brass, organ, steel pan, electric piano, chiptune square waves, and a Karplus-Strong plucked guitar. A step sequencer sends them to `AudioTrack` with sample-accurate timing.
- The game clock comes from the audio hardware's playback position, so the visuals stay in sync with what you hear.
- The physics constants come from each song's tempo (`Sim.java`), so every song feels the same at its own speed.
- `tools/Solver.java` is a brute-force bot. It proves every level, from every practice checkpoint, can be beaten even when inputs can only change every 1/12 s, whatever the input phase. It runs on every build.

## Building
No Gradle or Google SDK download needed. It uses the Ubuntu/Debian packages:

```sh
sudo apt-get install android-sdk-platform-23 aapt zipalign apksigner dalvik-exchange
./build.sh          # runs the level solver, then builds and signs BackbeatBlitz.apk
```

`debug.keystore` is a throwaway debug key (password `android`). It stays the same between builds, so a new APK installs over an old one.

`tools/shim/` is a small Java2D stand-in for `android.graphics`. With it the real game code can render screenshots and play a full level on a desktop JVM. That is how the screenshots above were made.
