package com.backbeat.blitz;

/**
 * The step sequencer and the house band. Every song is a {@link Style}: drum patterns per
 * instrument section, a bass line, a four-chord progression, a backing part (chord stabs or
 * an arpeggio) and a two-bar hook melody. Melodies are written relative to the current chord
 * so they always fit the harmony.
 *
 * The band follows your instrument: as the drum, the hook trades bars with the backing part;
 * as the trumpet, a brass section plays the hook every bar; as the tambourine, the hook keeps
 * going under jingles and claps.
 */
final class Music {
    static final float MENU_BPM = 116f;
    private static final int MENU_STYLE = 4, MENU_ROOT = 57;

    static final class Style {
        /** [mode] -> {kick, snare, hat, perc lines...}; snare x/g, hat x/o, perc see {@link #perc}. */
        final String[][] dr;
        /** bass: 0 root, 1 octave, 2..7 degrees above the chord root, . rest */
        final String bass;
        final int[] prog;
        final boolean[] minor;
        /** chord stabs ('x') or, when arp, chord-relative melody digits played on every step. */
        final String comp;
        final boolean arp, power;
        final int compInst, compOct;
        /** 32 steps (two bars) of chord-relative melody: 1 2 3 4 5 6 7 8 9 T, '.' = rest. */
        final String hook;
        final int hookInst, hookOct;

        Style(String[][] dr, String bass, int[] prog, boolean[] minor, String comp, boolean arp, boolean power,
              int compInst, int compOct, String hook, int hookInst, int hookOct) {
            this.dr = dr; this.bass = bass; this.prog = prog; this.minor = minor; this.comp = comp; this.arp = arp;
            this.power = power; this.compInst = compInst; this.compOct = compOct; this.hook = hook;
            this.hookInst = hookInst; this.hookOct = hookOct;
        }
    }

    private static final boolean F = false, T = true;

    static final Style[] STYLES = {
        // 0: garage rock, I-V-vi-IV with crunchy guitar
        new Style(new String[][] {
                {"x.....x.x.......", "....x.......x...", "x.x.x.x.x.x.x.x."},
                {"x...x...x...x...", "....x.......x...", "..o...o...o...o."},
                {"x.......x.x.....", "....x.......x...", "................"}},
            "0.0.....0.0.1.0.", new int[] {0, 7, 9, 5}, new boolean[] {F, F, T, F},
            "x.....x.x...x...", F, T, Audio.GUITAR, 0,
            "5.5.6.5...3.1...3.3.4.3...2.1...", Audio.GUITAR, 12),
        // 1: marching funk, organ clav and horns
        new Style(new String[][] {
                {"x...x...x...x...", "g...x..gg.g.x.g.", "x.x.x.x.x.x.x.x.", "b.......b.b....."},
                {"x...x...x...x...", "....x.......x..g", "..o...o...o...o."},
                {"x...x...x...x...", "....x.......x...", "................", "r..r..r...r..r.."}},
            "0..0..1.0..0.51.", new int[] {0, 5, 7, 5}, new boolean[] {F, F, F, F},
            "..x.x...x.x.x...", F, F, Audio.ORGAN, 12,
            "1.1.3.5.8...5.3.4.4.3.1.2...1...", Audio.BRASS, 12),
        // 2: breakbeat, mixolydian keys and a pluck hook
        new Style(new String[][] {
                {"x.x.......xx....", "....x..g.g..x..g", "x.x.x.x.x.x.x.x."},
                {"x..x..x...x..x..", "....x.......x...", "xxxxxxxxxxxxxxxx"},
                {"x.x...x...x.....", "....x.......x.x.", "................"}},
            "0.0...1.0.0...5.", new int[] {0, 10, 5, 0}, new boolean[] {F, F, F, F},
            "x..x..x...x..x..", F, F, Audio.KEYS, 12,
            "8.5.3.5.8.5.9.8.5.3.1.3.5...3...", Audio.PLUCK, 12),
        // 3: reggaeton, vi-IV-I-V
        new Style(new String[][] {
                {"x...x...x...x...", "...x..x....x..x.", "x.x.x.x.x.x.x.x."},
                {"x...x...x...x...", "...x..x....x..x.", "..o...o...o...o."},
                {"x...x...x...x...", "...x..x....x..x.", "................", "....c.......c..."}},
            "0..0..0.0..1..0.", new int[] {9, 5, 0, 7}, new boolean[] {T, F, F, F},
            "x..x..x.x..x..x.", F, F, Audio.KEYS, 12,
            "5..5..3.1..3..5.6..5..3.2..1....", Audio.PLUCK, 12),
        // 4: disco, I-vi-ii-V with offbeat keys and horns
        new Style(new String[][] {
                {"x...x...x...x...", "....x.......x...", "..o...o...o...o.", "....c.......c..."},
                {"x...x...x...x...", "....x.......x...", "x.o.x.o.x.o.x.o.", "....c.......c..."},
                {"x...x...x...x...", "....x.......x...", "................", "b.b...b.b.b...b."}},
            "0.1.0.1.0.1.0.1.", new int[] {0, 9, 2, 7}, new boolean[] {F, T, T, F},
            "..x...x...x...x.", F, F, Audio.KEYS, 12,
            "1.3.5.8.....5.6.5.3.1.2.....1...", Audio.BRASS, 12),
        // 5: jungle / drum & bass, minor key but bright stabs
        new Style(new String[][] {
                {"x.........x.....", "....x..g.g..x..g", "x.xxx.xxx.xxx.xx"},
                {"x......x..x.....", "....x.......x...", "xxxxxxxxxxxxxxxx"},
                {"x.........x.....", "....x..g....x.g.", "................"}},
            "0.......0..5....", new int[] {0, 8, 3, 10}, new boolean[] {T, F, F, F},
            "x.......x..x....", F, F, Audio.KEYS, 12,
            "8...5...3.5.8...T...8...5.3.1...", Audio.PLUCK, 12),
        // 6: surf rock, tremolo-picked twang
        new Style(new String[][] {
                {"x.x...x.x.x...x.", "....x.......x...", "x.x.x.x.x.x.x.x."},
                {"x...x...x...x...", "....x.......x...", "..o...o...o...o."},
                {"x.x...x...x.....", "....x.......x...", "................"}},
            "0..0..1.0.5.1.0.", new int[] {0, 0, 5, 7}, new boolean[] {F, F, F, F},
            "1111555588885555", T, F, Audio.GUITAR, 0,
            "5.6.5.3.1...3.5.8.7.5.6.5...3...", Audio.GUITAR, 12),
        // 7: ska, organ skank on every offbeat, walking bass, horns
        new Style(new String[][] {
                {"x.......x.......", "....x.......x...", "x.x.x.x.x.x.x.x."},
                {"x.......x.......", "....x.......x...", "..o...o...o...o."},
                {"x.......x.......", "....x.......x...", "................"}},
            "0.3.5.6.1.6.5.3.", new int[] {0, 9, 5, 7}, new boolean[] {F, T, F, F},
            "..x...x...x...x.", F, F, Audio.ORGAN, 12,
            "8.8.9.8.5...3.5.6.5.3.1.2...1...", Audio.BRASS, 12),
        // 8: samba carnival: surdo, shakers, agogo bells, congas, whistles
        new Style(new String[][] {
                {"x.......x.......", "..g...g...g..g.g", "................", "ssssssssssssssss", "a.A.a..Aa.A.a..A", "....L.......L..."},
                {"x.......x.......", "....x.......x...", "................", "ssssssssssssssss", "....L.......L...", "h.lh.lh.h.lh.l.."},
                {"x.......x.......", "..g...g...g..g.g", "................", "a.A.a..Aa.A.a..A", "....L.......L...", "w.w............."}},
            "0..5.0..0..5.1..", new int[] {0, 5, 7, 0}, new boolean[] {F, F, F, F},
            "x..x..x...x..x..", F, F, Audio.KEYS, 12,
            "5.5.3.5.6.5.3.1.2.2.1.2.3...1...", Audio.PLUCK, 12),
        // 9: chiptune, 16th-note arpeggios and a square-wave hero melody
        new Style(new String[][] {
                {"x.....x...x.....", "....x.......x...", "x.x.x.x.x.x.x.x."},
                {"x...x...x...x...", "....x.......x..x", "xxxxxxxxxxxxxxxx"},
                {"x.....x...x.....", "....x.......x...", "................"}},
            "0.1.0.1.0.1.5.1.", new int[] {0, 7, 9, 5}, new boolean[] {F, F, T, F},
            "1358853113588531", T, F, Audio.PLUCK, 12,
            "8.8.5.8...9.T.9.8.5.3.5...1.....", Audio.CHIP, 12),
        // 10: soca / calypso, steel pans everywhere
        new Style(new String[][] {
                {"x...x...x...x...", "..x...x...x...x.", "x.x.x.x.x.x.x.x.", "....c.......c..."},
                {"x...x...x...x...", "....x.......x...", "..o...o...o...o.", "b..b..b.b..b..b."},
                {"x...x...x...x...", "..x...x...x...x.", "................", "....c.......c..."}},
            "0..0..5.1..0..5.", new int[] {0, 5, 0, 7}, new boolean[] {F, F, F, F},
            "x..x..x.x..x..x.", F, F, Audio.STEEL, 0,
            "5.3.5.6.5.3.1...2.3.2.1.2.3.5...", Audio.STEEL, 12),
    };

    private static Style style(Level lv) { return STYLES[lv == null ? MENU_STYLE : lv.style]; }

    private static int root(Level lv) { return lv == null ? MENU_ROOT : lv.root; }

    /** Root (semitone offset from key) of the chord playing at a given step. */
    static int chordAt(Level lv, int step) {
        return style(lv).prog[(step / 16) % 4];
    }

    /** Semitones above the chord root for a melody digit, or -100 for a rest. */
    private static int deg(char c, boolean minor) {
        switch (c) {
            case '1': return 0;
            case '2': return 2;
            case '3': return minor ? 3 : 4;
            case '4': return 5;
            case '5': return 7;
            case '6': return minor ? 8 : 9;
            case '7': return 10;
            case '8': return 12;
            case '9': return 14;
            case 'T': return minor ? 15 : 16;
            default: return -100;
        }
    }

    /** Chord root as a MIDI note close to the key root (within -5..+6 semitones). */
    private static int chordBase(Level lv, int ch) {
        return root(lv) + (ch > 6 ? ch - 12 : ch);
    }

    /** Pre-render exactly the notes this song plays, so the mixer never synthesizes mid-song. */
    static void warm(Audio a, Level lv) {
        Style st = style(lv);
        int r = root(lv);
        for (int i = 0; i < 4; i++) {
            int base = chordBase(lv, st.prog[i]);
            boolean mi = st.minor[i];
            for (int k = 0; k < 16; k++) {
                char b = st.bass.charAt(k);
                if (b != '.') a.bass(base - 24 + (b == '1' ? 12 : b == '0' ? 0 : deg(b, mi)));
                if (st.arp) {
                    int off = deg(st.comp.charAt(k), mi);
                    if (off > -100) a.note(st.compInst, base + st.compOct + off);
                }
            }
            if (!st.arp) {
                int c0 = base + st.compOct;
                a.note(st.compInst, c0);
                a.note(st.compInst, c0 + (st.power ? 7 : (mi ? 3 : 4)));
                a.note(st.compInst, c0 + (st.power ? 12 : 7));
            }
            for (int k = 0; k < st.hook.length(); k++) {
                int off = deg(st.hook.charAt(k), mi);
                if (off == -100) continue;
                a.note(st.hookInst, base + st.hookOct + off);
                a.lead(base + 12 + off);
            }
            int honk = r + st.prog[i] + 7; // the trumpet's own honk (GameView EV_HONK)
            while (honk > r + 14) honk -= 12;
            a.lead(honk);
        }
        int b0 = chordBase(lv, st.prog[0]); // the final chord
        a.bass(b0 - 24);
        for (int k : new int[] {0, 4, 7}) a.note(st.compInst, b0 + st.compOct + k);
        a.note(st.hookInst, b0 + st.hookOct + 12);
        for (int k = 0; k <= 16; k++) a.chime(r + 12 + k);
    }

    private static void perc(Audio a, char pc, int d) {
        switch (pc) {
            case 'b': a.trigger(a.cowbell, 0.45f, d); break;
            case 'r': a.trigger(a.rim, 0.5f, d); break;
            case 'c': a.trigger(a.clap, 0.5f, d); break;
            case 's': a.trigger(a.shaker, 0.45f, d); break;
            case 'h': a.trigger(a.congaH, 0.45f, d); break;
            case 'l': a.trigger(a.congaL, 0.5f, d); break;
            case 'a': a.trigger(a.agogoH, 0.45f, d); break;
            case 'A': a.trigger(a.agogoL, 0.45f, d); break;
            case 'L': a.trigger(a.surdo, 0.9f, d); break;
            case 'w': a.trigger(a.whistle, 0.4f, d); break;
            case 't': a.trigger(a.tamb, 0.4f, d); break;
        }
    }

    static void step(Audio a, Level lv, int step, int d) {
        Style st = style(lv);
        int mode, barInSec, secBars, secIdx;
        if (lv == null) { // menu loop
            mode = Sim.DRUM;
            barInSec = (step / 16) % 8;
            secBars = 8;
            secIdx = 1;
        } else {
            if (step > lv.endStep) return;
            if (step == lv.endStep) { // big finish chord
                a.trigger(a.crash, 0.8f, d);
                a.trigger(a.kick, 1f, d);
                int base = chordBase(lv, st.prog[0]);
                a.trigger(a.bass(base - 24), 0.5f, d);
                for (int k : new int[] {0, 4, 7}) a.trigger(a.note(st.compInst, base + st.compOct + k), 0.2f, d);
                a.trigger(a.note(st.hookInst, base + st.hookOct + 12), 0.3f, d);
                return;
            }
            secIdx = lv.sectionIndexAt(step);
            Level.Section sec = lv.sections[Math.min(secIdx, lv.sections.length - 1)];
            mode = sec.mode;
            barInSec = (step - sec.startStep) / 16;
            secBars = sec.bars;
        }
        int s = step & 15;
        int bar = step / 16;
        boolean intro = lv != null && secIdx == 0 && barInSec < 2;
        boolean fill = barInSec == secBars - 1 && s >= 12;
        String[] p = st.dr[mode];

        // ---- drums
        if (s == 0 && barInSec == 0 && !intro) a.trigger(a.crash, 0.55f, d);
        if (lv != null && step == 0) a.trigger(a.crash, 0.4f, d);
        if (fill) {
            if (s == 12) { a.trigger(a.tomH, 0.6f, d); a.trigger(a.kick, 0.8f, d); }
            if (s == 13) a.trigger(a.tomH, 0.5f, d);
            if (s == 14) a.trigger(a.tomM, 0.6f, d);
            if (s == 15) { a.trigger(a.tomL, 0.7f, d); a.trigger(a.snare, 0.5f, d); }
        } else {
            if (p[0].charAt(s) == 'x') a.trigger(a.kick, 1f, d);
            if (!intro) {
                char sn = p[1].charAt(s);
                if (sn == 'x') a.trigger(a.snare, 0.75f, d);
                else if (sn == 'g') a.trigger(a.ghost, 0.6f, d);
            }
            for (int k = 3; k < p.length; k++) perc(a, p[k].charAt(s), d);
        }
        char h = p[2].charAt(s);
        if (h == 'x') a.trigger(a.hatC, (s & 3) == 0 ? 0.55f : 0.35f, d);
        else if (h == 'o') a.trigger(a.hatO, 0.4f, d);
        if (mode == Sim.TAMB) {
            a.trigger(a.tamb, (s & 1) == 0 ? 0.5f : 0.28f, d);
            if (s == 4 || s == 12) a.trigger(a.clap, 0.5f, d);
        }

        if (intro) return;

        // ---- harmony
        int ch = st.prog[bar % 4];
        boolean mi = st.minor[bar % 4];
        int base = chordBase(lv, ch);

        char b = st.bass.charAt(s);
        if (b != '.') {
            int note = base - 24;
            if (b == '1') note += 12;
            else if (b != '0') note += deg(b, mi);
            a.trigger(a.bass(note), 0.55f, d);
        }

        if (st.arp) {
            int off = deg(st.comp.charAt(s), mi);
            if (off > -100) a.trigger(a.note(st.compInst, base + st.compOct + off), 0.16f, d);
        } else if (st.comp.charAt(s) == 'x') {
            int c0 = base + st.compOct;
            a.trigger(a.note(st.compInst, c0), 0.13f, d);
            a.trigger(a.note(st.compInst, c0 + (st.power ? 7 : (mi ? 3 : 4))), 0.13f, d);
            a.trigger(a.note(st.compInst, c0 + (st.power ? 12 : 7)), 0.13f, d);
        }

        // ---- the hook: trades bars with the band as the drum, the horns take it as the trumpet
        int phrase = lv == null ? bar : barInSec;
        boolean hookBar = mode != Sim.DRUM || (phrase % 4) >= 2;
        if (hookBar) {
            int off = deg(st.hook.charAt((phrase % 2) * 16 + s), mi);
            if (off > -100) {
                if (mode == Sim.TRUMPET) a.trigger(a.lead(base + 12 + off), 0.3f, d);
                else a.trigger(a.note(st.hookInst, base + st.hookOct + off), mode == Sim.TAMB ? 0.2f : 0.28f, d);
            }
        }
    }
}
