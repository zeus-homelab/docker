package com.backbeat.blitz;

/**
 * The step sequencer. The band follows your instrument: drum sections get the full kit,
 * trumpet sections add a brass lead line, tambourine sections add jingles and claps.
 * Every 16-step bar is one bar of world, so the music literally is the level.
 */
final class Music {
    // [style][mode] -> {kick, snare, hat, perc}
    // snare: x = full, g = ghost. hat: x = closed, o = open. perc: b = cowbell, r = rim, c = clap
    private static final String[][][] DR = {
        { // 0: garage rock
            {"x.....x.x.......", "....x.......x...", "x.x.x.x.x.x.x.x.", "................"},
            {"x...x...x...x...", "....x.......x...", "..o...o...o...o.", "................"},
            {"x.......x.x.....", "....x.......x...", "................", "................"},
        },
        { // 1: marching funk
            {"x...x...x...x...", "g...x..gg.g.x.g.", "x.x.x.x.x.x.x.x.", "b.......b.b....."},
            {"x...x...x...x...", "....x.......x..g", "..o...o...o...o.", "................"},
            {"x...x...x...x...", "....x.......x...", "................", "r..r..r...r..r.."},
        },
        { // 2: breakbeat
            {"x.x.......xx....", "....x..g.g..x..g", "x.x.x.x.x.x.x.x.", "................"},
            {"x..x..x...x..x..", "....x.......x...", "xxxxxxxxxxxxxxxx", "................"},
            {"x.x...x...x.....", "....x.......x.x.", "................", "................"},
        },
        { // 3: reggaeton dembow
            {"x...x...x...x...", "...x..x....x..x.", "x.x.x.x.x.x.x.x.", "................"},
            {"x...x...x...x...", "...x..x....x..x.", "..o...o...o...o.", "................"},
            {"x...x...x...x...", "...x..x....x..x.", "................", "................"},
        },
        { // 4: disco
            {"x...x...x...x...", "....x.......x...", "..o...o...o...o.", "....c.......c..."},
            {"x...x...x...x...", "....x.......x...", "x.o.x.o.x.o.x.o.", "....c.......c..."},
            {"x...x...x...x...", "....x.......x...", "................", "b.b...b.b.b...b."},
        },
        { // 5: jungle / drum & bass
            {"x.........x.....", "....x..g.g..x..g", "x.xxx.xxx.xxx.xx", "................"},
            {"x......x..x.....", "....x.......x...", "xxxxxxxxxxxxxxxx", "................"},
            {"x.........x.....", "....x..g....x.g.", "................", "................"},
        },
    };
    private static final String[] BASS = {"0.0.....0.0.1.0.", "0..0..1.0..0.51.", "0.0...1.0.0...5.",
            "0..0..0.0..1..0.", "0.1.0.1.0.1.0.1.", "0.......0..5...."};
    private static final String[] LEAD = {"x..x..x.x.x.x...", "x.x.x...x.xx.x..", "x..x..x...x.x.x.",
            "x..x..x...x.x...", "x.x...x.x.x...x.", "x...x...x.x.x..."};
    private static final int[][] PROG = {{0, 8, 3, 10}, {0, 10, 8, 7}, {0, 3, 10, 8},
            {0, 5, 8, 7}, {0, 10, 8, 10}, {0, 3, 8, 7}};

    static boolean isMajor(int off) { return off == 8 || off == 3 || off == 10 || off == 7; }

    /** Root (semitone offset from key) of the chord playing at a given step. */
    static int chordAt(Level lv, int step) {
        int style = lv == null ? 0 : lv.style;
        return PROG[style][(step / 16) % 4];
    }

    static void step(Audio a, Level lv, int step, int d) {
        int style, mode, barInSec, secBars, secIdx, root;
        if (lv == null) { // menu loop
            style = 0;
            mode = Sim.DRUM;
            barInSec = (step / 16) % 8;
            secBars = 8;
            secIdx = 1;
            root = 57;
        } else {
            if (step > lv.endStep) return;
            style = lv.style;
            root = lv.root;
            if (step == lv.endStep) {
                a.trigger(a.crash, 0.8f, d);
                a.trigger(a.kick, 1f, d);
                a.trigger(a.bass(root - 24), 0.5f, d);
                return;
            }
            secIdx = lv.sectionIndexAt(step);
            Level.Section sec = lv.sections[Math.min(secIdx, lv.sections.length - 1)];
            mode = sec.mode;
            barInSec = (step - sec.startStep) / 16;
            secBars = sec.bars;
            if (step >= sec.startStep + sec.bars * 16) { // outro bars after the last section
                barInSec = secBars + (step - sec.startStep - sec.bars * 16) / 16;
            }
        }
        int s = step & 15;
        int bar = step / 16;
        boolean intro = secIdx == 0 && barInSec < 2;
        boolean fill = barInSec == secBars - 1 && s >= 12;
        String[] p = DR[style][mode];

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
            char pc = p[3].charAt(s);
            if (pc == 'b') a.trigger(a.cowbell, 0.5f, d);
            if (pc == 'r') a.trigger(a.rim, 0.5f, d);
            if (pc == 'c') a.trigger(a.clap, 0.5f, d);
        }
        char h = p[2].charAt(s);
        if (h == 'x') a.trigger(a.hatC, (s & 3) == 0 ? 0.55f : 0.35f, d);
        else if (h == 'o') a.trigger(a.hatO, 0.4f, d);
        if (mode == Sim.TRUMPET && !fill && (s & 3) == 0 && h != 'x') a.trigger(a.hatC, 0.3f, d);

        if (mode == Sim.TAMB) {
            a.trigger(a.tamb, (s & 1) == 0 ? 0.55f : 0.3f, d);
            if (s == 4 || s == 12) a.trigger(a.clap, 0.55f, d);
        }

        if (intro && secIdx == 0 && lv != null) return;

        int ch = PROG[style][bar % 4];
        char b = BASS[style].charAt(s);
        if (b != '.') {
            int note = root - 24 + ch;
            if (b == '1') note += 12;
            if (b == '5') note += 7;
            a.trigger(a.bass(note), 0.55f, d);
        }

        if (mode == Sim.TRUMPET && LEAD[style].charAt(s) == 'x') {
            int[] tones = {0, isMajor(ch) ? 4 : 3, 7, 12};
            int hsh = (bar * 7 + s * 13 + (bar % 2) * 5) & 0xFFFF;
            int note = root + ch + tones[(hsh / 3) % 4];
            while (note > root + 14) note -= 12;
            a.trigger(a.lead(note), 0.3f, d);
        }
    }
}
