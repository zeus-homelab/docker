package com.backbeat.blitz;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;

/**
 * A level is a song. The world grid is locked to the music: one block = one 16th note,
 * one beat = 4 blocks, one bar = 16 blocks. Obstacles are built from one-bar "chunks".
 * Pure Java (no Android deps) so the level solver can run on a desktop JVM.
 */
public final class Level {
    public static final int SOLID = 0, SPIKE = 1, SAW = 2, GOON = 3, SOUR = 4, ORB = 5, PAD = 6,
            PORTAL = 7, NOTE = 8, FINISH = 9;

    public static final class Obj {
        public int type;
        public float x, y, w, h, r, amp, phase;
        public int mode;
        public boolean down;
        public float minX, maxX;
    }

    public static final class Section {
        public int mode, startStep, bars;
    }

    public final String name, subtitle;
    public final float bpm;
    public final int root, style, stars;
    public Obj[] objs;
    public Section[] sections;
    public int endStep, totalNotes;
    public int[] cpStep, cpMode;

    private final ArrayList<Obj> list = new ArrayList<Obj>();

    public Level(String name, String subtitle, float bpm, int root, int style, int stars, String spec) {
        this.name = name;
        this.subtitle = subtitle;
        this.bpm = bpm;
        this.root = root;
        this.style = style;
        this.stars = stars;
        build(spec);
    }

    public float beatSec() { return 60f / bpm; }
    public float stepSec() { return 15f / bpm; }

    public int sectionIndexAt(int step) {
        for (int i = sections.length - 1; i >= 0; i--) if (step >= sections[i].startStep) return i;
        return 0;
    }

    public float goonX(Obj b, float px) {
        return b.x - 0.25f * Math.max(0f, px - (b.x - 22f));
    }

    // ------------------------------------------------------------------ building

    private void build(String spec) {
        String[] secs = spec.split("\\|");
        ArrayList<Section> sl = new ArrayList<Section>();
        int o = 0;
        for (int si = 0; si < secs.length; si++) {
            String s = secs[si].trim();
            int mode = modeOf(s.charAt(0));
            String[] chunks = s.substring(2).split(",");
            Section sec = new Section();
            sec.mode = mode;
            sec.startStep = o;
            if (si > 0) portal(o + 1, mode);
            chunk(mode, "rest", o);
            o += 16;
            for (String c : chunks) {
                chunk(mode, c.trim(), o);
                o += 16;
            }
            sec.bars = (o - sec.startStep) / 16;
            sl.add(sec);
        }
        // two empty bars then the finish line
        o += 16;
        endStep = o + 16;
        Obj f = add(FINISH, o + 8, 0);
        f.minX = f.maxX = o + 8;
        sections = sl.toArray(new Section[0]);
        cpStep = new int[sections.length];
        cpMode = new int[sections.length];
        for (int i = 0; i < sections.length; i++) {
            cpStep[i] = i == 0 ? 0 : sections[i].startStep + 4;
            cpMode[i] = sections[i].mode;
        }
        objs = list.toArray(new Obj[0]);
        Arrays.sort(objs, new Comparator<Obj>() {
            public int compare(Obj a, Obj b) { return Float.compare(a.minX, b.minX); }
        });
        for (Obj b : objs) if (b.type == NOTE) totalNotes++;
    }

    private static int modeOf(char c) {
        switch (c) {
            case 'T': return Sim.TRUMPET;
            case 'B': return Sim.TAMB;
            default: return Sim.DRUM;
        }
    }

    private Obj add(int type, float x, float y) {
        Obj b = new Obj();
        b.type = type;
        b.x = x;
        b.y = y;
        b.w = 1;
        b.h = 1;
        b.minX = x;
        b.maxX = x + 1;
        list.add(b);
        return b;
    }

    private void block(float x, float y, float w, float h) {
        Obj b = add(SOLID, x, y);
        b.w = w;
        b.h = h;
        b.maxX = x + w;
    }

    private void spike(float x, float y, boolean down) { add(SPIKE, x, y).down = down; }

    private void spikes(float x0, float x1, float y, boolean down) {
        for (float x = x0; x <= x1; x++) spike(x, y, down);
    }

    private void saw(float cx, float cy, float r) {
        Obj b = add(SAW, cx, cy);
        b.r = r;
        b.minX = cx - r;
        b.maxX = cx + r;
    }

    /** A goon that meets the player around world x = m. */
    private void goon(float m) {
        Obj b = add(GOON, m + 4.4f, 0);
        b.minX = b.x - 8;
        b.maxX = b.x + 1;
    }

    private void sour(float x, float y, float amp, float phase) {
        Obj b = add(SOUR, x, y);
        b.amp = amp;
        b.phase = phase;
        b.minX = x - 0.5f;
        b.maxX = x + 1.5f;
    }

    private void orb(float x, float y) {
        Obj b = add(ORB, x, y);
        b.minX = x - 1;
        b.maxX = x + 1;
    }

    private void pad(float x) { add(PAD, x, 0); }

    private void note(float x, float y) {
        Obj b = add(NOTE, x, y);
        b.minX = x - 1;
        b.maxX = x + 1;
    }

    private void portal(float x, int mode) { add(PORTAL, x, 0).mode = mode; }

    private void chunk(int mode, String n, int o) {
        if (mode == Sim.DRUM) drumChunk(n, o);
        else if (mode == Sim.TRUMPET) trumpetChunk(n, o);
        else tambChunk(n, o);
    }

    private void drumChunk(String n, int o) {
        if (n.equals("rest")) {
            note(o + 8.5f, 0.5f);
        } else if (n.equals("spike1")) {
            spike(o + 6, 0, false);
            note(o + 6.5f, 2.9f);
        } else if (n.equals("spike2")) {
            spike(o + 2, 0, false);
            spike(o + 10, 0, false);
            note(o + 10.5f, 2.9f);
        } else if (n.equals("double")) {
            spikes(o + 2, o + 3, 0, false);
            spikes(o + 10, o + 11, 0, false);
            note(o + 2.5f, 2.9f);
        } else if (n.equals("triple")) {
            spikes(o + 6, o + 7, 0, false);
            note(o + 6.5f, 2.9f);
            spikes(o + 14, o + 15, 0, false);
        } else if (n.equals("stairs")) {
            block(o + 2, 0, 4, 1);
            block(o + 6, 0, 4, 2);
            block(o + 10, 0, 4, 3);
            note(o + 12.5f, 4.6f);
        } else if (n.equals("ledges")) {
            block(o + 3, 0, 2, 1);
            spikes(o + 5, o + 7, 0, false);
            block(o + 8, 0, 3, 1);
            note(o + 6.5f, 3.6f);
        } else if (n.equals("goon")) {
            goon(o + 10);
            note(o + 10.5f, 3.3f);
        } else if (n.equals("goon2")) {
            goon(o + 4);
            goon(o + 12);
        } else if (n.equals("mixed")) {
            spike(o + 2, 0, false);
            goon(o + 10);
        } else if (n.equals("orbpit")) {
            spikes(o + 5, o + 14, 0, false);
            orb(o + 8.2f, 1.3f);
            orb(o + 12.2f, 1.3f);
            note(o + 10.5f, 3.0f);
        } else if (n.equals("pad")) {
            pad(o + 4);
            block(o + 9, 0, 3, 2);
            note(o + 7f, 5.4f);
        } else if (n.equals("saw")) {
            saw(o + 8.5f, 0.6f, 1.0f);
        } else if (n.equals("sawpair")) {
            saw(o + 4.5f, 0.6f, 1.0f);
            saw(o + 12.5f, 0.6f, 1.0f);
            note(o + 12.5f, 3.2f);
        } else {
            throw new IllegalArgumentException("drum chunk " + n);
        }
    }

    private void trumpetChunk(String n, int o) {
        if (n.equals("rest") || n.equals("fly")) {
            note(o + 8.5f, n.equals("rest") ? 3.0f : 6.0f);
        } else if (n.equals("pillars")) {
            block(o + 3, 0, 2, 4);
            block(o + 11, 5, 2, 4);
            note(o + 4f, 5.5f);
            note(o + 12f, 3.2f);
        } else if (n.equals("tunnel")) {
            block(o + 2, 0, 14, 2);
            block(o + 2, 6.5f, 14, 2.5f);
            spikes(o + 8, o + 9, 2, false);
            note(o + 9f, 4.6f);
        } else if (n.equals("zig")) {
            block(o + 2, 0, 2, 5);
            block(o + 10, 4, 2, 5);
            note(o + 3f, 6.8f);
            note(o + 11f, 2.0f);
        } else if (n.equals("saws")) {
            saw(o + 5, 1.6f, 1.2f);
            saw(o + 5, 7.4f, 1.2f);
            saw(o + 12, 4.5f, 1.2f);
            note(o + 12f, 7.4f);
        } else if (n.equals("spikefield")) {
            spikes(o, o + 15, 0, false);
            spikes(o, o + 15, 8, true);
            note(o + 8f, 4.5f);
        } else if (n.equals("sour")) {
            sour(o + 6, 4.5f, 2.5f, 0f);
            sour(o + 12, 4.5f, 2.5f, 3.14159f);
            note(o + 9f, 4.5f);
        } else {
            throw new IllegalArgumentException("trumpet chunk " + n);
        }
    }

    private void tambChunk(String n, int o) {
        if (n.equals("rest") || n.equals("roll")) {
            note(o + 8.5f, 0.5f);
        } else if (n.equals("up")) {
            spikes(o + 6, o + 11, 0, false);
            note(o + 8.5f, 8.5f);
        } else if (n.equals("upblock")) {
            block(o + 6, 3, 6, 3);
            spikes(o + 9, o + 11, 0, false);
            note(o + 9f, 6.5f);
        } else if (n.equals("zag")) {
            spikes(o + 4, o + 7, 0, false);
            spikes(o + 12, o + 15, 8, true);
            note(o + 5.5f, 8.5f);
        } else if (n.equals("sourT")) {
            sour(o + 8, 4.5f, 1.5f, 0f);
            spikes(o + 10, o + 12, 0, false);
        } else {
            throw new IllegalArgumentException("tamb chunk " + n);
        }
    }

    // ------------------------------------------------------------------ the set list

    public static Level[] all() {
        return new Level[] {
            new Level("Garage Groove", "a backyard rock warm-up", 110f, 57, 0, 1,
                "D:rest,spike1,spike1,spike2,rest,double,spike2,stairs,rest,goon,triple"
                + "|T:fly,pillars,fly,pillars,saws"
                + "|D:spike2,orbpit,rest,pad,goon,double"
                + "|B:roll,up,roll,up"
                + "|D:spike2,triple,goon,double,spike1"),
            new Level("Marching Mayhem", "the drumline has gone rogue", 128f, 50, 1, 2,
                "D:rest,spike2,double,goon,triple,stairs,rest,ledges,orbpit,goon2"
                + "|B:up,zag,upblock,zag"
                + "|T:pillars,tunnel,zig,saws,sour"
                + "|D:pad,triple,orbpit,sawpair,mixed,goon2"
                + "|T:spikefield,zig,tunnel,sour"
                + "|D:double,triple,ledges,goon"),
            new Level("Breakbeat Blitz", "150 bpm of pure chaos", 150f, 52, 2, 3,
                "D:rest,double,triple,goon2,sawpair,orbpit,stairs,rest,mixed,ledges,triple"
                + "|T:zig,saws,tunnel,sour,zig,spikefield"
                + "|B:zag,upblock,sourT,zag,up"
                + "|D:orbpit,goon2,triple,pad,sawpair,double,mixed"
                + "|T:sour,tunnel,zig,saws"
                + "|B:zag,sourT,upblock,zag"
                + "|D:triple,goon2,orbpit,double,triple,mixed"),
        };
    }
}
