package com.backbeat.blitz;

import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTimestamp;
import android.media.AudioTrack;

import java.util.HashMap;

/**
 * Every sound in the game is synthesized at startup: no sample files at all. A mixer thread
 * streams to an AudioTrack and runs the step sequencer sample-accurately; the game reads the
 * song clock back from the hardware playback position so visuals stay locked to what you hear.
 */
public final class Audio implements Runnable {
    public static final int SR = 44100;
    private static final int BLOCK = 256, MAXV = 72;

    public float[] kick, snare, ghost, hatC, hatO, clap, tomH, tomM, tomL, crash, ride, tamb, cowbell,
            scratch, rim, whoosh, shaker, congaH, congaL, agogoH, agogoL, whistle, surdo;

    /** Pitched instruments, synthesized on demand and cached per note. */
    public static final int BASS = 0, BRASS = 1, CHIME = 2, ORGAN = 3, STEEL = 4, PLUCK = 5, KEYS = 6,
            GUITAR = 7, CHIP = 8;
    private final HashMap<Integer, float[]> notes = new HashMap<Integer, float[]>();
    private Level warmedFor;
    private boolean warmed;

    private final Object lock = new Object();
    private final float[][] vData = new float[MAXV][];
    private final int[] vPos = new int[MAXV], vDelay = new int[MAXV];
    private final float[] vGain = new float[MAXV];

    private AudioTrack track;
    private Thread thread;
    private volatile boolean running, paused;
    private volatile long framesWritten;

    // song state (guarded by lock)
    private Level song;
    private boolean songOn, menuSong;
    private long songStartFrame;
    private int songBase, nextStep;
    private double stepFrames;
    private float menuBpm = Music.MENU_BPM;

    // clock
    private final AudioTimestamp ts = new AudioTimestamp();
    private long refFrame, refNano, lastQuery, lastHead = -1;
    private boolean refValid, useTs = true;
    private double lastReturned;

    private int seed = 0x1234567;

    public Audio() {
        synth();
    }

    // ================================================================ lifecycle

    public void start() {
        if (running) return;
        int min = AudioTrack.getMinBufferSize(SR, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int bytes = Math.max(min * 2, BLOCK * 2 * 8);
        track = new AudioTrack(AudioManager.STREAM_MUSIC, SR, AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT, bytes, AudioTrack.MODE_STREAM);
        framesWritten = 0;
        lastReturned = 0;
        refValid = false;
        lastHead = -1;
        synchronized (lock) {
            for (int i = 0; i < MAXV; i++) vData[i] = null;
            songOn = false;
        }
        running = true;
        paused = false;
        track.play();
        thread = new Thread(this, "mixer");
        thread.setPriority(Thread.MAX_PRIORITY);
        thread.start();
    }

    public void stop() {
        running = false;
        if (thread != null) {
            try { thread.join(500); } catch (InterruptedException ignored) { }
            thread = null;
        }
        if (track != null) {
            try { track.pause(); track.flush(); track.release(); } catch (Exception ignored) { }
            track = null;
        }
    }

    public void setPaused(boolean p) {
        if (track == null || p == paused) return;
        paused = p;
        try {
            if (p) track.pause(); else track.play();
        } catch (Exception ignored) { }
        refValid = false;
    }

    public boolean isPaused() { return paused; }

    // ================================================================ song control

    public void startSong(Level lv, int fromStep) {
        if (lv != warmedFor || !warmed) { // keep only the current song's notes in memory
            synchronized (notes) { notes.clear(); }
            warmedFor = lv;
            warmed = true;
        }
        Music.warm(this, lv);
        synchronized (lock) {
            for (int i = 0; i < MAXV; i++) if (vData[i] != null && vData[i] != crash && vData[i] != scratch) vData[i] = null;
            song = lv;
            menuSong = lv == null;
            float bpm = lv == null ? menuBpm : lv.bpm;
            stepFrames = SR * 15.0 / bpm;
            songBase = fromStep;
            nextStep = fromStep;
            songStartFrame = framesWritten + BLOCK;
            songOn = true;
        }
    }

    public void stopSong() {
        synchronized (lock) {
            songOn = false;
            for (int i = 0; i < MAXV; i++) {
                float[] d = vData[i];
                if (d != null && d != crash && d != scratch && d != whoosh) vData[i] = null;
            }
        }
    }

    /** Seconds of song time that the listener is hearing right now. */
    public double songTime() {
        double hf = heardFrame();
        synchronized (lock) {
            return (songBase * stepFrames + (hf - songStartFrame)) / SR;
        }
    }

    private double heardFrame() {
        AudioTrack tr = track;
        if (tr == null) return lastReturned;
        long now = System.nanoTime();
        if (!refValid || now - lastQuery > (useTs ? 200_000_000L : 0L)) {
            lastQuery = now;
            boolean got = false;
            if (useTs) {
                try {
                    got = tr.getTimestamp(ts) && ts.nanoTime > 0 && ts.framePosition > 0;
                } catch (Exception e) {
                    got = false;
                }
                if (got) {
                    refFrame = ts.framePosition;
                    refNano = ts.nanoTime;
                    refValid = true;
                }
            }
            if (!got) {
                long head = tr.getPlaybackHeadPosition() & 0xFFFFFFFFL;
                if (head != lastHead || !refValid) {
                    lastHead = head;
                    refFrame = head;
                    refNano = now;
                    refValid = true;
                }
            }
        }
        double f = refFrame + (paused ? 0 : (now - refNano) * (SR / 1e9));
        double maxF = framesWritten;
        if (f > maxF) f = maxF;
        if (f < lastReturned) f = lastReturned;
        lastReturned = f;
        return f;
    }

    // ================================================================ sfx

    public void play(float[] d, float gain) {
        synchronized (lock) { trigger(d, gain, 0); }
    }

    public float[] chime(int midi) { return note(CHIME, midi); }
    public float[] lead(int midi) { return note(BRASS, midi); }
    public float[] bass(int midi) { return note(BASS, midi); }

    public float[] note(int inst, int midi) {
        midi = Math.max(12, Math.min(108, midi));
        Integer key = inst * 256 + midi;
        float[] d;
        synchronized (notes) { d = notes.get(key); }
        if (d == null) { // synthesize outside the lock so the mixer is never held up
            switch (inst) {
                case BASS: d = mkBass(midi); break;
                case BRASS: d = mkLead(midi); break;
                case ORGAN: d = mkOrgan(midi); break;
                case STEEL: d = mkSteel(midi); break;
                case PLUCK: d = mkPluck(midi); break;
                case KEYS: d = mkKeys(midi); break;
                case GUITAR: d = mkGuitar(midi); break;
                case CHIP: d = mkChip(midi); break;
                default: d = mkChime(midi); break;
            }
            synchronized (notes) { notes.put(key, d); }
        }
        return d;
    }

    /** Called from the mixer thread with the lock held. */
    void trigger(float[] d, float gain, int delay) {
        if (d == null) return;
        int slot = -1;
        for (int i = 0; i < MAXV; i++) if (vData[i] == null) { slot = i; break; }
        if (slot < 0) {
            int best = 0;
            for (int i = 1; i < MAXV; i++) if (vPos[i] > vPos[best]) best = i;
            slot = best;
        }
        vData[slot] = d;
        vPos[slot] = 0;
        vDelay[slot] = delay;
        vGain[slot] = gain;
    }

    // ================================================================ mixer

    public void run() {
        float[] mix = new float[BLOCK];
        short[] out = new short[BLOCK];
        while (running) {
            if (paused) {
                try { Thread.sleep(8); } catch (InterruptedException ignored) { }
                continue;
            }
            for (int i = 0; i < BLOCK; i++) mix[i] = 0;
            synchronized (lock) {
                if (songOn) {
                    long end = framesWritten + BLOCK;
                    while (true) {
                        long sf = songStartFrame + (long) ((nextStep - songBase) * stepFrames);
                        if (sf >= end) break;
                        int delay = (int) Math.max(0, sf - framesWritten);
                        Music.step(this, menuSong ? null : song, nextStep, delay);
                        nextStep++;
                    }
                }
                for (int v = 0; v < MAXV; v++) {
                    float[] d = vData[v];
                    if (d == null) continue;
                    float gn = vGain[v];
                    int i = vDelay[v];
                    vDelay[v] = 0;
                    int p = vPos[v];
                    for (; i < BLOCK && p < d.length; i++, p++) mix[i] += d[p] * gn;
                    vPos[v] = p;
                    if (p >= d.length) vData[v] = null;
                }
            }
            for (int i = 0; i < BLOCK; i++) {
                float x = mix[i] * 0.8f;
                x = x / (1f + Math.abs(x) * 0.6f); // soft clip
                out[i] = (short) (Math.max(-1f, Math.min(1f, x)) * 32000);
            }
            AudioTrack tr = track;
            if (tr == null) break;
            int w = tr.write(out, 0, BLOCK);
            if (w < 0) break;
            framesWritten += BLOCK;
        }
    }

    // ================================================================ synthesis

    private float rnd() {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed & 0xFFFFFF) / (float) 0x800000 - 1f;
    }

    private static int n(float sec) { return (int) (sec * SR); }

    private void synth() {
        // kick: pitch-swept sine with a click
        kick = new float[n(0.45f)];
        double ph = 0;
        for (int i = 0; i < kick.length; i++) {
            float t = i / (float) SR;
            float f = 46 + 120 * (float) Math.exp(-t * 32);
            ph += 2 * Math.PI * f / SR;
            float v = (float) Math.sin(ph) * (float) Math.exp(-t * 6.5);
            if (t < 0.003f) v += rnd() * 0.4f * (1 - t / 0.003f);
            kick[i] = (float) Math.tanh(v * 1.6f);
        }
        snare = mkSnare(1f);
        ghost = mkSnare(0.3f);
        hatC = mkHat(0.06f, 60);
        hatO = mkHat(0.35f, 9);
        ride = mkHat(0.8f, 4);
        // clap: three noise bursts and a tail
        clap = new float[n(0.25f)];
        float lp = 0, prev = 0;
        for (int i = 0; i < clap.length; i++) {
            float t = i / (float) SR;
            float e = 0;
            for (int k = 0; k < 3; k++) {
                float dt = t - k * 0.011f;
                if (dt >= 0) e = Math.max(e, (float) Math.exp(-dt * 180));
            }
            e = Math.max(e, 0.6f * (float) Math.exp(-(t - 0.022f) * 16) * (t > 0.022f ? 1 : 0));
            float nz = rnd();
            float hp = nz - prev;
            prev = nz;
            lp += 0.45f * (hp - lp);
            clap[i] = lp * e * 1.3f;
        }
        tomH = mkTom(210);
        tomM = mkTom(150);
        tomL = mkTom(100);
        // crash: bright, long noise wash with a few inharmonic partials
        crash = new float[n(1.6f)];
        prev = 0;
        float prev2 = 0;
        for (int i = 0; i < crash.length; i++) {
            float t = i / (float) SR;
            float nz = rnd();
            float hp = nz - prev;
            prev = nz;
            float hp2 = hp - prev2;
            prev2 = hp;
            float metal = (float) (Math.sin(2 * Math.PI * 4120 * t) + Math.sin(2 * Math.PI * 5730 * t) * 0.7
                    + Math.sin(2 * Math.PI * 7310 * t) * 0.5) * 0.08f;
            crash[i] = (hp2 * 0.35f + metal) * (float) Math.exp(-t * 2.4) * (t < 0.002f ? t / 0.002f : 1);
        }
        // tambourine: jingly high noise
        tamb = new float[n(0.16f)];
        prev = 0;
        for (int i = 0; i < tamb.length; i++) {
            float t = i / (float) SR;
            float nz = rnd();
            float hp = nz - prev;
            prev = nz;
            float j = (float) (Math.sin(2 * Math.PI * 5200 * t) * Math.sin(2 * Math.PI * 7900 * t));
            tamb[i] = (hp * 0.5f + j * hp * 0.6f) * (float) Math.exp(-t * 26) * 0.9f;
        }
        cowbell = new float[n(0.3f)];
        for (int i = 0; i < cowbell.length; i++) {
            float t = i / (float) SR;
            float a = sq(562 * t) + sq(845 * t);
            cowbell[i] = a * 0.22f * (float) Math.exp(-t * 11);
        }
        rim = new float[n(0.04f)];
        for (int i = 0; i < rim.length; i++) {
            float t = i / (float) SR;
            rim[i] = ((float) Math.sin(2 * Math.PI * 1700 * t) * 0.6f + rnd() * 0.4f) * (float) Math.exp(-t * 120);
        }
        // record scratch: wobbling band of noise sweeping down
        scratch = new float[n(0.55f)];
        lp = 0;
        ph = 0;
        for (int i = 0; i < scratch.length; i++) {
            float t = i / (float) SR;
            float f = 900 - 700 * t / 0.55f + 300 * (float) Math.sin(t * 40);
            ph += 2 * Math.PI * f / SR;
            lp += 0.3f * (rnd() - lp);
            scratch[i] = ((float) Math.sin(ph) * 0.5f + lp) * (float) Math.sin(ph * 0.5) * 0.7f
                    * Math.min(1, (0.55f - t) * 8);
        }
        whoosh = new float[n(0.4f)];
        lp = 0;
        for (int i = 0; i < whoosh.length; i++) {
            float t = i / (float) SR;
            float c = 0.02f + 0.3f * t / 0.4f;
            lp += c * (rnd() - lp);
            whoosh[i] = lp * (float) Math.sin(Math.PI * t / 0.4f) * 0.8f;
        }
        // shaker: soft-attack band of noise
        shaker = new float[n(0.09f)];
        prev = 0;
        lp = 0;
        for (int i = 0; i < shaker.length; i++) {
            float t = i / (float) SR;
            float nz = rnd();
            float hp = nz - prev;
            prev = nz;
            lp += 0.5f * (hp - lp);
            shaker[i] = lp * Math.min(1, t / 0.015f) * (float) Math.exp(-t * 40) * 0.8f;
        }
        congaH = mkConga(340);
        congaL = mkConga(230);
        agogoH = mkBell(930);
        agogoL = mkBell(700);
        surdo = mkTom(62);
        // samba whistle: a fast warbling trill
        whistle = new float[n(0.16f)];
        ph = 0;
        for (int i = 0; i < whistle.length; i++) {
            float t = i / (float) SR;
            float f = 2400 + 180 * (float) Math.sin(2 * Math.PI * 28 * t);
            ph += 2 * Math.PI * f / SR;
            whistle[i] = ((float) Math.sin(ph) + rnd() * 0.15f) * Math.min(1, t / 0.01f) * Math.min(1, (0.16f - t) / 0.03f) * 0.35f;
        }
    }

    private float[] mkConga(float f0) {
        float[] d = new float[n(0.22f)];
        double ph = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            float f = f0 * (1 + 0.25f * (float) Math.exp(-t * 60));
            ph += 2 * Math.PI * f / SR;
            d[i] = ((float) Math.sin(ph) + (t < 0.004f ? rnd() * 0.5f : 0)) * (float) Math.exp(-t * 16) * 0.8f;
        }
        return d;
    }

    private float[] mkBell(float f) {
        float[] d = new float[n(0.25f)];
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            d[i] = (float) (Math.sin(2 * Math.PI * f * t) + 0.6 * Math.sin(2 * Math.PI * f * 2.72 * t))
                    * (float) Math.exp(-t * 14) * 0.35f * Math.min(1, t / 0.001f);
        }
        return d;
    }

    private static float sq(float ph) { return (ph - (float) Math.floor(ph)) < 0.5f ? 1f : -1f; }

    private float[] mkSnare(float amt) {
        float[] d = new float[n(0.25f)];
        float prev = 0, lp = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            float tone = (float) Math.sin(2 * Math.PI * 185 * t) * (float) Math.exp(-t * 28) * 0.55f
                    + (float) Math.sin(2 * Math.PI * 330 * t) * (float) Math.exp(-t * 40) * 0.25f;
            float nz = rnd();
            float hp = nz - prev * 0.6f;
            prev = nz;
            lp += 0.6f * (hp - lp);
            d[i] = (tone + lp * 0.75f * (float) Math.exp(-t * 15)) * amt;
        }
        return d;
    }

    private float[] mkHat(float len, float decay) {
        float[] d = new float[n(len)];
        float p1 = 0, p2 = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            float nz = rnd();
            float h1 = nz - p1;
            p1 = nz;
            float h2 = h1 - p2;
            p2 = h1;
            d[i] = h2 * 0.35f * (float) Math.exp(-t * decay);
        }
        return d;
    }

    private float[] mkTom(float f0) {
        float[] d = new float[n(0.4f)];
        double ph = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            float f = f0 * (1 + 0.6f * (float) Math.exp(-t * 18));
            ph += 2 * Math.PI * f / SR;
            d[i] = ((float) Math.sin(ph) + rnd() * 0.08f * (float) Math.exp(-t * 40)) * (float) Math.exp(-t * 8);
        }
        return d;
    }

    private static float hz(int midi) { return 440f * (float) Math.pow(2, (midi - 69) / 12.0); }

    private float[] mkBass(int midi) {
        float f = hz(midi);
        float[] d = new float[n(0.32f)];
        float lp = 0, lp2 = 0;
        double ph = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            ph += f / SR;
            float saw = (float) (2 * (ph - Math.floor(ph)) - 1);
            float c = 0.03f + 0.25f * (float) Math.exp(-t * 14);
            lp += c * (saw - lp);
            lp2 += c * (lp - lp2);
            float env = Math.min(1, t / 0.004f) * (float) Math.exp(-t * 3.5) * Math.min(1, (0.32f - t) * 30);
            d[i] = (float) Math.tanh(lp2 * 2.2f) * env * 0.9f;
        }
        return d;
    }

    private float[] mkLead(int midi) {
        float f = hz(midi);
        float len = 0.36f;
        float[] d = new float[n(len)];
        float lp = 0;
        double ph = 0, ph2 = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            float vib = t > 0.09f ? 1 + 0.006f * (float) Math.sin(2 * Math.PI * 5.5 * t) : 1;
            ph += f * vib / SR;
            ph2 += f * 1.003f * vib / SR;
            float saw = (float) (2 * (ph - Math.floor(ph)) - 1);
            float sqr = (ph2 - Math.floor(ph2)) < 0.5 ? 0.6f : -0.6f;
            float c = 0.05f + 0.35f * (1 - (float) Math.exp(-t * 30)) * (float) Math.exp(-t * 2.5);
            lp += c * ((saw + sqr) * 0.5f - lp);
            float env = Math.min(1, t / 0.02f) * Math.min(1, (len - t) / 0.08f);
            d[i] = lp * env * 1.1f;
        }
        return d;
    }

    private float[] mkOrgan(int midi) {
        float f = hz(midi), len = 0.2f;
        float[] d = new float[n(len)];
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            double w = 2 * Math.PI * f * t;
            float v = (float) (Math.sin(w) + 0.6 * Math.sin(2 * w) + 0.35 * Math.sin(3 * w) + 0.2 * Math.sin(4 * w));
            float env = Math.min(1, t / 0.004f) * Math.min(1, (len - t) / 0.04f) * (0.75f + 0.25f * (float) Math.exp(-t * 30));
            d[i] = v * env * 0.4f;
        }
        return d;
    }

    private float[] mkSteel(int midi) {
        float f = hz(midi), len = 0.7f;
        float[] d = new float[n(len)];
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            double w = 2 * Math.PI * f * t;
            float body = (float) (Math.sin(w) + 0.5 * Math.sin(2 * w) * Math.exp(-t * 3) + 0.3 * Math.sin(3.01 * w) * Math.exp(-t * 5));
            float ping = (float) (Math.sin(5.1 * w) * Math.exp(-t * 40)) * 0.3f;
            d[i] = (body + ping) * (float) Math.exp(-t * 5) * Math.min(1, t / 0.002f) * 0.5f;
        }
        return d;
    }

    private float[] mkPluck(int midi) {
        float f = hz(midi), len = 0.24f;
        float[] d = new float[n(len)];
        float lp = 0;
        double ph = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            ph += f / SR;
            float sq = (ph - Math.floor(ph)) < 0.5 ? 1f : -1f;
            float c = 0.05f + 0.5f * (float) Math.exp(-t * 25);
            lp += c * (sq - lp);
            d[i] = lp * (float) Math.exp(-t * 11) * Math.min(1, t / 0.002f) * 0.45f;
        }
        return d;
    }

    private float[] mkKeys(int midi) {
        float f = hz(midi), len = 0.55f;
        float[] d = new float[n(len)];
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            double w = 2 * Math.PI * f * t;
            float v = (float) (Math.sin(w + 0.8 * Math.sin(w) * Math.exp(-t * 6)) + 0.25 * Math.sin(2 * w)
                    + 0.25 * Math.sin(7.1 * w) * Math.exp(-t * 25));
            d[i] = v * (float) Math.exp(-t * 4) * Math.min(1, t / 0.003f) * Math.min(1, (len - t) / 0.05f) * 0.45f;
        }
        return d;
    }

    /** Karplus-Strong plucked string with a touch of drive: surf guitar twang. */
    private float[] mkGuitar(int midi) {
        float f = hz(midi), len = 0.5f;
        float[] d = new float[n(len)];
        int N = Math.max(2, Math.round(SR / f));
        float[] buf = new float[N];
        float lp = 0;
        for (int i = 0; i < N; i++) { lp += 0.6f * (rnd() - lp); buf[i] = lp; }
        int idx = 0;
        float last = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            float cur = buf[idx];
            float nxt = buf[(idx + 1) % N];
            buf[idx] = 0.4985f * (cur + nxt);
            idx = (idx + 1) % N;
            last = cur;
            float trem = 1 + 0.12f * (float) Math.sin(2 * Math.PI * 7 * t);
            d[i] = (float) Math.tanh(last * 2.2f) * trem * Math.min(1, (len - t) / 0.05f) * 0.5f;
        }
        return d;
    }

    private float[] mkChip(int midi) {
        float f = hz(midi), len = 0.3f;
        float[] d = new float[n(len)];
        double ph = 0;
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            float vib = t > 0.08f ? 1 + 0.012f * (float) Math.sin(2 * Math.PI * 6 * t) : 1;
            ph += f * vib / SR;
            float duty = t < 0.05f ? 0.125f : 0.25f;
            float sq = (ph - Math.floor(ph)) < duty ? 1f : -0.35f;
            d[i] = sq * Math.min(1, (len - t) / 0.06f) * (0.8f + 0.2f * (float) Math.exp(-t * 20)) * 0.22f;
        }
        return d;
    }

    private float[] mkChime(int midi) {
        float f = hz(midi);
        float[] d = new float[n(0.6f)];
        for (int i = 0; i < d.length; i++) {
            float t = i / (float) SR;
            d[i] = (float) (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2 * t)
                    + 0.15 * Math.sin(2 * Math.PI * f * 3.01 * t)) * (float) Math.exp(-t * 6) * 0.5f
                    * Math.min(1, t / 0.002f);
        }
        return d;
    }
}
