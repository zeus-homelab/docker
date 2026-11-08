package com.backbeat.blitz;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Build;
import android.view.MotionEvent;
import android.view.SurfaceHolder;
import android.view.SurfaceView;

import java.util.ArrayList;

public final class GameView extends SurfaceView implements SurfaceHolder.Callback, Runnable {
    private static final int TITLE = 0, SELECT = 1, PLAY = 2, DONE = 3;
    private static final int[] MODE_COL = {0xFFFF3D7F, 0xFFFFC23D, 0xFF3DFFD0};
    private static final String[] MODE_NAME = {"SNARE DRUM", "TRUMPET", "TAMBOURINE"};
    private static final String[] MODE_HINT = {
        "Tap or hold to jump. Jump ON the beat!",
        "Hold to blow and rise, let go to sink",
        "Tap to flip gravity!",
    };
    /** Song-list order, easiest first (indices stay stable so saved bests keep working). */
    private static final int[] ORDER = {3, 8, 0, 10, 4, 1, 9, 6, 2, 7, 5};
    private static final int PER_PAGE = 6;
    private int page;
    private static final int[] SCALE = {0, 2, 3, 5, 7, 8, 10, 12, 14, 15};

    private final Audio audio;
    private final Level[] levels = Level.all();
    private final SharedPreferences prefs;
    private final SurfaceHolder holder;

    private Thread thread;
    private volatile boolean running;
    private boolean surfaceOk, resumed;
    private boolean hwCanvas = Build.VERSION.SDK_INT >= 23;

    private int W = 1, H = 1;
    private float bp = 1, gy = 1, camX;
    private Shader[] bg = new Shader[3];

    private int state = TITLE;
    private boolean paused, practice;
    private int li;
    private Level lv;
    private Sim sim;
    private boolean dead;
    private float deadT, doneT, rot, shake, flash, hintT, ceilA, honkT, trailT;
    private int flashCol;
    private String hint = "";
    private int attempts, cp, score, combo, maxCombo, notesGot, startStep, lastPct;
    private boolean newBest;
    private float[] stompT = new float[0];
    private float time, menuX;
    private double songT;

    // input
    private volatile boolean pressed;
    private final ArrayList<float[]> taps = new ArrayList<float[]>();

    // particles
    private static final int MAXP = 260;
    private final float[] pX = new float[MAXP], pY = new float[MAXP], pVX = new float[MAXP], pVY = new float[MAXP],
            pL = new float[MAXP], pML = new float[MAXP], pS = new float[MAXP];
    private final int[] pC = new int[MAXP], pK = new int[MAXP];
    private int pN;

    // popups
    private static final int MAXT = 16;
    private final String[] tS = new String[MAXT];
    private final float[] tX = new float[MAXT], tY = new float[MAXT], tL = new float[MAXT];
    private final int[] tC = new int[MAXT];

    // lit piano keys
    private final int[] keyIdx = new int[8];
    private final float[] keyT = new float[8];
    private int keyN;

    private final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint ps = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pt = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final RectF rf = new RectF();

    public GameView(Context ctx) {
        super(ctx);
        holder = getHolder();
        holder.addCallback(this);
        setFocusable(true);
        prefs = ctx.getSharedPreferences("backbeat", 0);
        practice = prefs.getBoolean("practice", false);
        ps.setStyle(Paint.Style.STROKE);
        ps.setStrokeCap(Paint.Cap.ROUND);
        ps.setStrokeJoin(Paint.Join.ROUND);
        Typeface tf = Typeface.create("sans-serif-black", Typeface.NORMAL);
        if (tf == null) tf = Typeface.DEFAULT_BOLD;
        pt.setTypeface(tf);
        pt.setTextAlign(Paint.Align.CENTER);
        for (int i = 0; i < keyT.length; i++) keyT[i] = -10;
        audio = new Audio();
        audio.start();
        audio.startSong(null, 0);
    }

    // ================================================================ lifecycle

    public void resume() {
        resumed = true;
        if (!(state == PLAY && paused)) audio.setPaused(false);
        startThread();
    }

    public void pause() {
        resumed = false;
        if (state == PLAY && !dead && sim != null && !sim.finished) paused = true;
        pressed = false;
        audio.setPaused(true);
        stopThread();
    }

    public void destroy() {
        stopThread();
        audio.stop();
    }

    private synchronized void startThread() {
        if (running || !surfaceOk || !resumed) return;
        running = true;
        thread = new Thread(this, "game");
        thread.start();
    }

    private synchronized void stopThread() {
        running = false;
        Thread t = thread;
        thread = null;
        if (t != null && t != Thread.currentThread()) {
            try { t.join(1000); } catch (InterruptedException ignored) { }
        }
    }

    public void surfaceCreated(SurfaceHolder h) {
        surfaceOk = true;
        startThread();
    }

    public void surfaceChanged(SurfaceHolder h, int f, int w, int hh) {
        W = Math.max(w, 1);
        H = Math.max(hh, 1);
        bp = H / 12.5f;
        gy = H - 1.2f * bp;
        int[][] g = {{0xFF0B0420, 0xFF3B0B45}, {0xFF120A02, 0xFF4A2A06}, {0xFF02121A, 0xFF07384A}};
        for (int i = 0; i < 3; i++) bg[i] = new LinearGradient(0, 0, 0, H, g[i][0], g[i][1], Shader.TileMode.CLAMP);
    }

    public void surfaceDestroyed(SurfaceHolder h) {
        surfaceOk = false;
        stopThread();
    }

    /** Back button; returns false to let the activity close. */
    public boolean back() {
        if (state == TITLE) return false;
        synchronized (taps) { taps.add(new float[] {0, 0, 2}); }
        return true;
    }

    // ================================================================ input

    private boolean inPause(float x, float y) {
        float dx = x - (W - 1.0f * bp), dy = y - 0.95f * bp;
        return dx * dx + dy * dy < (1.0f * bp) * (1.0f * bp);
    }

    @Override
    public boolean onTouchEvent(MotionEvent e) {
        int a = e.getActionMasked();
        if (a == MotionEvent.ACTION_DOWN || a == MotionEvent.ACTION_POINTER_DOWN) {
            int i = e.getActionIndex();
            float x = e.getX(i), y = e.getY(i);
            boolean pb = state == PLAY && !paused && inPause(x, y);
            if (state == PLAY && !paused && !pb) pressed = true;
            synchronized (taps) { taps.add(new float[] {x, y, pb ? 1 : 0}); }
        } else if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) {
            pressed = false;
        } else if (a == MotionEvent.ACTION_POINTER_UP && e.getPointerCount() <= 1) {
            pressed = false;
        }
        return true;
    }

    // ================================================================ loop

    public void run() {
        long last = System.nanoTime();
        while (running) {
            long now = System.nanoTime();
            float dt = Math.min(0.05f, (now - last) / 1e9f);
            last = now;
            time += dt;
            try {
                update(dt);
            } catch (Exception e) {
                e.printStackTrace();
            }
            Canvas c = null;
            boolean hw = hwCanvas;
            try {
                c = hw ? holder.getSurface().lockHardwareCanvas() : holder.lockCanvas();
            } catch (Exception e) {
                if (hw) hwCanvas = false;
                c = null;
            }
            if (c == null) {
                try { Thread.sleep(16); } catch (InterruptedException ignored) { }
                continue;
            }
            try {
                draw2(c);
            } catch (Exception e) {
                e.printStackTrace();
            } finally {
                try {
                    if (hw) holder.getSurface().unlockCanvasAndPost(c);
                    else holder.unlockCanvasAndPost(c);
                } catch (Exception ignored) { }
            }
        }
    }

    // ================================================================ update

    private void update(float dt) {
        float[][] tp;
        synchronized (taps) {
            tp = taps.toArray(new float[0][]);
            taps.clear();
        }
        for (float[] t : tp) onTap(t[0], t[1], (int) t[2]);

        updateParticles(dt);
        for (int i = 0; i < MAXT; i++) if (tL[i] > 0) { tL[i] -= dt; tY[i] += dt * 1.2f; }
        shake = Math.max(0, shake - dt);
        flash = Math.max(0, flash - dt * 2.5f);
        hintT = Math.max(0, hintT - dt);

        if (state != PLAY) {
            menuX += dt * 5f;
            songT = audio.songTime();
            return;
        }
        if (paused) return;
        songT = audio.songTime();
        if (dead) {
            deadT += dt;
            if (deadT > 1.0f) restart();
        } else if (sim.finished) {
            doneT += dt;
            if (doneT > 2.0f) { state = DONE; doneT = 0; }
            // keep the camera rolling into the finish
            sim.t += dt;
            sim.px = (float) (sim.t * sim.speed);
        } else {
            boolean press = pressed;
            int n = 0;
            while (sim.t + Sim.DT <= songT && n < 480) {
                sim.step(press);
                n++;
                handleEvents();
                if (sim.dead) { die(); break; }
                if (sim.finished) { finish(); break; }
            }
            for (int c = cp + 1; c < lv.cpStep.length; c++) {
                if (sim.px >= lv.cpStep[c]) {
                    cp = c;
                    if (practice) popup("CHECKPOINT", sim.px + 1, 6.5f, 0xFF7CFF6B);
                }
            }
            // visuals
            if (sim.mode == Sim.DRUM) {
                if (sim.grounded) {
                    float target = Math.round(rot / 90f) * 90f;
                    rot += (target - rot) * Math.min(1, dt * 20);
                } else rot += 180f / sim.B * dt;
            } else if (sim.mode == Sim.TRUMPET) {
                float target = -(float) Math.toDegrees(Math.atan2(sim.vy, sim.speed)) * 0.8f;
                rot += (target - rot) * Math.min(1, dt * 12);
                if (pressed) {
                    trailT -= dt;
                    if (trailT <= 0) {
                        trailT = 0.09f;
                        spawn(sim.px + 1.3f, sim.y + 0.45f, 1.5f, (float) (Math.random() - 0.3) * 1.5f, 0.8f,
                                0xFFFFE08A, Math.random() < 0.5 ? 1 : 2, 0.5f);
                    }
                }
            } else {
                rot += sim.grav * sim.speed / 0.45f * dt * 57.3f;
            }
            if (sim.mode == Sim.DRUM && !sim.grounded) {
                trailT -= dt;
                if (trailT <= 0) {
                    trailT = 0.06f;
                    spawn(sim.px, sim.y + 0.45f, -1f, 0, 0.35f, MODE_COL[0], 0, 0.14f);
                }
            }
        }
        float ct = (sim.mode != Sim.DRUM && !dead) ? 1 : 0;
        ceilA += (ct - ceilA) * Math.min(1, dt * 4);
    }

    private void onTap(float x, float y, int type) {
        if (type == 2) { // back
            if (state == PLAY) {
                if (paused) { quitToSelect(); }
                else if (!dead && !sim.finished) pauseGame();
                else quitToSelect();
            } else if (state == SELECT) state = TITLE;
            else if (state == DONE) quitToSelect();
            return;
        }
        switch (state) {
            case TITLE:
                state = SELECT;
                audio.play(audio.crash, 0.4f);
                break;
            case SELECT: {
                if (y < 1.6f * bp && x < 4 * bp) { state = TITLE; break; }
                float bw = 7.4f * bp, bh = 0.95f * bp, by = H - 0.75f * bp;
                if (Math.abs(x - W / 2f) < bw / 2 && Math.abs(y - by) < bh / 2 + 0.2f * bp) {
                    practice = !practice;
                    prefs.edit().putBoolean("practice", practice).apply();
                    audio.play(audio.cowbell, 0.6f);
                    break;
                }
                int pages = (ORDER.length + PER_PAGE - 1) / PER_PAGE;
                if (y > H - 1.4f * bp && x < W * 0.22f && page > 0) { page--; audio.play(audio.tomH, 0.6f); break; }
                if (y > H - 1.4f * bp && x > W * 0.78f && page < pages - 1) { page++; audio.play(audio.tomH, 0.6f); break; }
                for (int slot = 0; slot < PER_PAGE; slot++) {
                    int oi = page * PER_PAGE + slot;
                    if (oi >= ORDER.length) break;
                    if (cardRect(slot).contains(x, y)) { startLevel(ORDER[oi]); break; }
                }
                break;
            }
            case PLAY:
                if (paused) {
                    float bx = W / 2f, bw = 6 * bp, bh = 1.2f * bp;
                    if (Math.abs(x - bx) < bw / 2) {
                        if (Math.abs(y - H * 0.42f) < bh / 2) resumeGame();
                        else if (Math.abs(y - H * 0.58f) < bh / 2) {
                            paused = false;
                            audio.setPaused(false);
                            audio.stopSong();
                            restart();
                        } else if (Math.abs(y - H * 0.74f) < bh / 2) quitToSelect();
                    }
                } else if (type == 1) pauseGame();
                break;
            case DONE:
                quitToSelect();
                break;
        }
    }

    private void pauseGame() {
        if (state != PLAY || dead || sim.finished || paused) return;
        paused = true;
        pressed = false;
        audio.setPaused(true);
    }

    private void resumeGame() {
        paused = false;
        audio.setPaused(false);
    }

    private void quitToSelect() {
        paused = false;
        audio.setPaused(false);
        state = SELECT;
        pN = 0;
        audio.startSong(null, 0);
    }

    private void startLevel(int i) {
        li = i;
        lv = levels[i];
        sim = new Sim(lv);
        stompT = new float[lv.objs.length];
        attempts = 0;
        cp = 0;
        state = PLAY;
        paused = false;
        pN = 0;
        restart();
        hint = MODE_HINT[0];
        hintT = 3.5f;
    }

    private void restart() {
        attempts++;
        dead = false;
        deadT = 0;
        doneT = 0;
        int c = practice ? cp : 0;
        if (!practice) cp = 0;
        startStep = lv.cpStep[c];
        sim.reset(startStep, lv.cpMode[c]);
        for (int i = 0; i < stompT.length; i++) stompT[i] = 0;
        score = 0;
        combo = 0;
        maxCombo = 0;
        notesGot = 0;
        rot = 0;
        newBest = false;
        audio.startSong(lv, startStep);
        songT = audio.songTime();
        if (c > 0) { hint = MODE_HINT[lv.cpMode[c]]; hintT = 2f; }
    }

    private int pct() {
        float fx = lv.endStep - 8;
        return Math.max(0, Math.min(100, (int) (sim.px / fx * 100)));
    }

    private void die() {
        dead = true;
        deadT = 0;
        combo = 0;
        audio.stopSong();
        audio.play(audio.crash, 0.8f);
        audio.play(audio.scratch, 0.8f);
        audio.play(audio.kick, 0.9f);
        shake = 0.35f;
        float cx = sim.px + 0.45f, cy = sim.y + 0.45f;
        int col = MODE_COL[sim.mode];
        for (int i = 0; i < 28; i++) {
            double a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 9;
            spawn(cx, cy, (float) (Math.cos(a) * s), (float) (Math.sin(a) * s), 0.6f + (float) Math.random() * 0.5f,
                    i % 3 == 0 ? 0xFFFFFFFF : col, 0, 0.12f + (float) Math.random() * 0.15f);
        }
        for (int i = 0; i < 8; i++) {
            double a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
            spawn(cx, cy, (float) (Math.cos(a) * s), (float) (Math.sin(a) * s) + 3, 1.0f, col, 1 + (i & 1), 0.6f);
        }
        lastPct = pct();
        String key = (practice ? "bestp" : "best") + li;
        if (lastPct > prefs.getInt(key, 0)) {
            prefs.edit().putInt(key, lastPct).apply();
            newBest = true;
            popup("NEW BEST " + lastPct + "%", cx, cy + 2, 0xFFFFE14D);
        } else popup(lastPct + "%", cx, cy + 2, 0xFFFFFFFF);
    }

    private void finish() {
        doneT = 0;
        lastPct = 100;
        score += 1000;
        SharedPreferences.Editor e = prefs.edit();
        if (practice) {
            e.putInt("bestp" + li, 100);
        } else {
            e.putInt("best" + li, 100);
            if (notesGot > prefs.getInt("notes" + li, 0)) e.putInt("notes" + li, notesGot);
            if (score > prefs.getInt("score" + li, 0)) e.putInt("score" + li, score);
        }
        e.apply();
        audio.play(audio.crash, 0.7f);
        for (int i = 0; i < 60; i++) {
            spawn(sim.px + (float) Math.random() * 14, 10, (float) (Math.random() - 0.5) * 4, -(float) Math.random() * 3,
                    2.5f, MODE_COL[i % 3], i % 4 == 0 ? 2 : 0, 0.2f);
        }
        popup("ENCORE!", sim.px + 4, 6, 0xFFFFE14D);
    }

    private void judge() {
        double beat = sim.t / sim.B;
        double err = Math.abs(beat - Math.rint(beat)) * sim.B;
        if (err < 0.055) {
            combo++;
            score += 50 * mult();
            popup("PERFECT", sim.px + 0.45f, sim.y + 1.6f, 0xFFFFE14D);
        } else if (err < 0.11) {
            combo++;
            score += 25 * mult();
            popup("GREAT", sim.px + 0.45f, sim.y + 1.6f, 0xFF7CFFCB);
        } else {
            combo = 0;
        }
        if (combo > maxCombo) maxCombo = combo;
    }

    private int mult() { return 1 + combo / 8; }

    private void handleEvents() {
        for (int i = 0; i < sim.evN; i++) {
            int e = sim.ev[i] >> 16, idx = sim.ev[i] & 0xFFFF;
            float cx = sim.px + 0.45f, fy = sim.y;
            switch (e) {
                case Sim.EV_JUMP:
                    audio.play(audio.tomM, 0.45f);
                    judge();
                    for (int k = 0; k < 6; k++)
                        spawn(cx, fy, (float) (Math.random() - 0.7) * 4, (float) Math.random() * 2, 0.4f, 0xFFE8D8FF, 0, 0.1f);
                    break;
                case Sim.EV_LAND:
                    if (sim.mode != Sim.TRUMPET) {
                        for (int k = 0; k < 4; k++)
                            spawn(cx, sim.grav > 0 ? fy : fy + 0.9f, (float) (Math.random() - 0.8) * 3, 0.5f, 0.3f, 0xAAFFFFFF, 0, 0.08f);
                        if (sim.y < 0.01f && sim.grav > 0) lightKey((int) Math.floor(cx));
                    }
                    break;
                case Sim.EV_ORB: {
                    audio.play(audio.ride, 0.8f);
                    audio.play(audio.crash, 0.3f);
                    judge();
                    Level.Obj b = lv.objs[idx];
                    for (int k = 0; k < 12; k++) {
                        double a = k * Math.PI / 6;
                        spawn(b.x, b.y, (float) Math.cos(a) * 5, (float) Math.sin(a) * 5, 0.4f, 0xFFFFE14D, 0, 0.12f);
                    }
                    break;
                }
                case Sim.EV_PAD:
                    audio.play(audio.kick, 1f);
                    audio.play(audio.tomH, 0.6f);
                    for (int k = 0; k < 10; k++)
                        spawn(cx, fy, (float) (Math.random() - 0.5) * 3, 4 + (float) Math.random() * 4, 0.5f, 0xFFFFE14D, 0, 0.12f);
                    break;
                case Sim.EV_STOMP: {
                    audio.play(audio.snare, 1f);
                    audio.play(audio.clap, 0.7f);
                    stompT[idx] = time;
                    score += 300 * mult();
                    combo++;
                    if (combo > maxCombo) maxCombo = combo;
                    popup("BAP!", cx, fy + 1.5f, 0xFFFF7A3D);
                    for (int k = 0; k < 8; k++)
                        spawn(cx, fy, (float) (Math.random() - 0.5) * 6, (float) Math.random() * 3, 0.6f, 0xFFFFFFFF, 2, 0.4f);
                    break;
                }
                case Sim.EV_FLIP:
                    audio.play(audio.tamb, 0.9f);
                    judge();
                    break;
                case Sim.EV_PORTAL: {
                    int m = lv.objs[idx].mode;
                    audio.play(audio.whoosh, 0.7f);
                    audio.play(audio.crash, 0.35f);
                    flash = 1;
                    flashCol = MODE_COL[m];
                    hint = MODE_NAME[m] + "!  " + MODE_HINT[m];
                    hintT = 2.6f;
                    rot = 0;
                    break;
                }
                case Sim.EV_NOTE: {
                    Level.Obj b = lv.objs[idx];
                    audio.play(audio.chime(lv.root + 12 + SCALE[notesGot % SCALE.length]), 0.45f);
                    notesGot++;
                    score += 100 * mult();
                    for (int k = 0; k < 10; k++) {
                        double a = Math.random() * Math.PI * 2;
                        spawn(b.x, b.y, (float) Math.cos(a) * 3, (float) Math.sin(a) * 3, 0.5f, 0xFFFFE14D, 0, 0.1f);
                    }
                    break;
                }
                case Sim.EV_HONK: {
                    int step = (int) (sim.t / sim.B * 4);
                    int ch = Music.chordAt(lv, step);
                    int note = lv.root + ch + 7;
                    while (note > lv.root + 14) note -= 12;
                    audio.play(audio.lead(note), 0.3f);
                    break;
                }
            }
        }
        sim.evN = 0;
    }

    private void lightKey(int k) {
        keyIdx[keyN] = k;
        keyT[keyN] = time;
        keyN = (keyN + 1) % keyIdx.length;
    }

    // ================================================================ particles

    private void spawn(float x, float y, float vx, float vy, float life, int col, int kind, float size) {
        int i = pN < MAXP ? pN++ : (int) (Math.random() * MAXP);
        pX[i] = x; pY[i] = y; pVX[i] = vx; pVY[i] = vy; pL[i] = life; pML[i] = life;
        pC[i] = col; pK[i] = kind; pS[i] = size;
    }

    private void updateParticles(float dt) {
        for (int i = 0; i < pN; i++) {
            pL[i] -= dt;
            if (pL[i] <= 0) {
                pN--;
                pX[i] = pX[pN]; pY[i] = pY[pN]; pVX[i] = pVX[pN]; pVY[i] = pVY[pN]; pL[i] = pL[pN];
                pML[i] = pML[pN]; pC[i] = pC[pN]; pK[i] = pK[pN]; pS[i] = pS[pN];
                i--;
                continue;
            }
            pX[i] += pVX[i] * dt;
            pY[i] += pVY[i] * dt;
            if (pK[i] == 0) pVY[i] -= 12 * dt;
        }
    }

    private void popup(String s, float x, float y, int col) {
        int best = 0;
        for (int i = 0; i < MAXT; i++) if (tL[i] < tL[best]) best = i;
        tS[best] = s; tX[best] = x; tY[best] = y; tL[best] = 1.0f; tC[best] = col;
    }

    // ================================================================ drawing helpers

    private float sx(float x) { return (x - camX) * bp; }
    private float sy(float y) { return gy - y * bp; }

    private float beatPhase() {
        float bpm = state == PLAY && lv != null ? lv.bpm : 100f;
        double b = songT * bpm / 60.0;
        if (b < 0) b = 0;
        return (float) (b - Math.floor(b));
    }

    private static int alpha(int col, float a) {
        int al = (int) (((col >>> 24) & 0xFF) * Math.max(0, Math.min(1, a)));
        return (col & 0x00FFFFFF) | (al << 24);
    }

    private static float hash(int a, int b) {
        int h = a * 374761393 + b * 668265263;
        h = (h ^ (h >>> 13)) * 1274126177;
        return ((h ^ (h >>> 16)) & 0xFFFF) / 65535f;
    }

    private void text(Canvas c, String s, float x, float y, float size, int col) {
        pt.setTextSize(size);
        pt.setStyle(Paint.Style.FILL);
        pt.setColor(alpha(0xFF000000, ((col >>> 24) & 0xFF) / 255f));
        c.drawText(s, x + size * 0.06f, y + size * 0.08f, pt);
        pt.setColor(col);
        c.drawText(s, x, y, pt);
    }

    private void textOutlined(Canvas c, String s, float x, float y, float size, int fill, int stroke) {
        pt.setTextSize(size);
        pt.setStyle(Paint.Style.STROKE);
        pt.setStrokeWidth(size * 0.14f);
        pt.setStrokeJoin(Paint.Join.ROUND);
        pt.setColor(stroke);
        c.drawText(s, x, y, pt);
        pt.setStyle(Paint.Style.FILL);
        pt.setColor(fill);
        c.drawText(s, x, y, pt);
    }

    private void eyes(Canvas c, float x1, float y1, float x2, float y2, float r, float look, boolean angry) {
        p.setColor(0xFFFFFFFF);
        c.drawCircle(x1, y1, r, p);
        c.drawCircle(x2, y2, r, p);
        p.setColor(0xFF15101F);
        c.drawCircle(x1 + r * 0.35f * look, y1 + r * 0.1f, r * 0.55f, p);
        c.drawCircle(x2 + r * 0.35f * look, y2 + r * 0.1f, r * 0.55f, p);
        p.setColor(0xFFFFFFFF);
        c.drawCircle(x1 + r * 0.15f, y1 - r * 0.25f, r * 0.18f, p);
        c.drawCircle(x2 + r * 0.15f, y2 - r * 0.25f, r * 0.18f, p);
        if (angry) {
            ps.setColor(0xFF15101F);
            ps.setStrokeWidth(r * 0.45f);
            c.drawLine(x1 - r, y1 - r * 1.3f, x1 + r * 0.8f, y1 - r * 0.6f, ps);
            c.drawLine(x2 + r, y2 - r * 1.3f, x2 - r * 0.8f, y2 - r * 0.6f, ps);
        }
    }

    // ---------------------------------------------------------------- instruments

    private void drawDrum(Canvas c, float cx, float cy, float h, float r) {
        c.save();
        c.translate(cx, cy);
        c.rotate(r);
        ps.setColor(0xFFE8C48A);
        ps.setStrokeWidth(h * 0.13f);
        c.drawLine(-h * 0.75f, -h * 1.45f, h * 0.15f, -h * 0.7f, ps);
        c.drawLine(h * 0.75f, -h * 1.45f, -h * 0.15f, -h * 0.7f, ps);
        p.setColor(0xFFF0DDB0);
        c.drawCircle(-h * 0.75f, -h * 1.45f, h * 0.11f, p);
        c.drawCircle(h * 0.75f, -h * 1.45f, h * 0.11f, p);
        p.setColor(0xFFD7263D);
        rf.set(-h, -h * 0.66f, h, h * 0.8f);
        c.drawRoundRect(rf, h * 0.12f, h * 0.12f, p);
        p.setColor(0x30000000);
        rf.set(h * 0.5f, -h * 0.66f, h, h * 0.8f);
        c.drawRect(rf, p);
        p.setColor(0x30FFFFFF);
        rf.set(-h * 0.85f, -h * 0.66f, -h * 0.6f, h * 0.8f);
        c.drawRect(rf, p);
        ps.setColor(0xFFFFF4E0);
        ps.setStrokeWidth(h * 0.07f);
        path.reset();
        for (int k = 0; k <= 6; k++) {
            float x = -h * 0.92f + k * (h * 1.84f / 6);
            float y = (k % 2 == 0) ? -h * 0.5f : h * 0.68f;
            if (k == 0) path.moveTo(x, y); else path.lineTo(x, y);
        }
        c.drawPath(path, ps);
        p.setColor(0xFFC9CBD6);
        rf.set(-h * 1.06f, -h * 0.98f, h * 1.06f, -h * 0.42f);
        c.drawOval(rf, p);
        p.setColor(0xFFF6F1E7);
        rf.set(-h * 0.9f, -h * 0.9f, h * 0.9f, -h * 0.5f);
        c.drawOval(rf, p);
        p.setColor(0xFFC9CBD6);
        rf.set(-h * 1.04f, h * 0.7f, h * 1.04f, h * 0.95f);
        c.drawRoundRect(rf, h * 0.1f, h * 0.1f, p);
        p.setColor(0xFF8E909C);
        for (int k = -1; k <= 1; k++) {
            rf.set(k * h * 0.62f - h * 0.08f, -h * 0.5f, k * h * 0.62f + h * 0.08f, -h * 0.3f);
            c.drawRect(rf, p);
        }
        eyes(c, -h * 0.3f, h * 0.08f, h * 0.38f, h * 0.08f, h * 0.2f, 1, false);
        c.restore();
    }

    private void drawTrumpet(Canvas c, float cx, float cy, float h, float r) {
        c.save();
        c.translate(cx, cy);
        c.rotate(r);
        int gold = 0xFFF2B632, dark = 0xFFB8801C;
        ps.setColor(dark);
        ps.setStrokeWidth(h * 0.16f);
        rf.set(-h * 0.7f, -h * 0.05f, h * 0.15f, h * 0.6f);
        c.drawRoundRect(rf, h * 0.3f, h * 0.3f, ps);
        p.setColor(gold);
        rf.set(-h * 0.95f, -h * 0.13f, h * 0.3f, h * 0.13f);
        c.drawRoundRect(rf, h * 0.1f, h * 0.1f, p);
        path.reset();
        path.moveTo(h * 0.2f, -h * 0.15f);
        path.quadTo(h * 0.7f, -h * 0.2f, h * 1.05f, -h * 0.7f);
        path.lineTo(h * 1.05f, h * 0.7f);
        path.quadTo(h * 0.7f, h * 0.2f, h * 0.2f, h * 0.15f);
        path.close();
        c.drawPath(path, p);
        p.setColor(dark);
        rf.set(h * 0.95f, -h * 0.72f, h * 1.18f, h * 0.72f);
        c.drawOval(rf, p);
        p.setColor(0xFF3A2606);
        rf.set(h * 1.02f, -h * 0.55f, h * 1.14f, h * 0.55f);
        c.drawOval(rf, p);
        p.setColor(0xFFD9DDE6);
        rf.set(-h * 1.15f, -h * 0.08f, -h * 0.9f, h * 0.08f);
        c.drawRect(rf, p);
        for (int k = 0; k < 3; k++) {
            float vx = -h * 0.45f + k * h * 0.22f;
            p.setColor(dark);
            rf.set(vx - h * 0.07f, -h * 0.5f, vx + h * 0.07f, -h * 0.1f);
            c.drawRect(rf, p);
            p.setColor(0xFFFFE6A6);
            c.drawCircle(vx, -h * 0.55f, h * 0.1f, p);
        }
        p.setColor(0x55FFFFFF);
        rf.set(-h * 0.9f, -h * 0.11f, h * 0.2f, -h * 0.03f);
        c.drawRect(rf, p);
        eyes(c, h * 0.62f, -h * 0.05f, h * 0.88f, -h * 0.05f, h * 0.13f, 1, false);
        c.restore();
    }

    private void drawTamb(Canvas c, float cx, float cy, float h, float r) {
        c.save();
        c.translate(cx, cy);
        c.rotate(r);
        p.setColor(0xFFB5651D);
        c.drawCircle(0, 0, h, p);
        p.setColor(0xFFFBEEDD);
        c.drawCircle(0, 0, h * 0.72f, p);
        for (int k = 0; k < 6; k++) {
            c.save();
            c.rotate(k * 60);
            p.setColor(0xFF5C3210);
            rf.set(-h * 0.2f, -h * 0.97f, h * 0.2f, -h * 0.78f);
            c.drawRect(rf, p);
            p.setColor(0xFFE6E8F0);
            c.drawCircle(-h * 0.1f, -h * 0.875f, h * 0.13f, p);
            c.drawCircle(h * 0.1f, -h * 0.875f, h * 0.13f, p);
            c.restore();
        }
        eyes(c, -h * 0.28f, -h * 0.1f, h * 0.28f, -h * 0.1f, h * 0.17f, 0, false);
        ps.setColor(0xFF15101F);
        ps.setStrokeWidth(h * 0.08f);
        rf.set(-h * 0.25f, -h * 0.05f, h * 0.25f, h * 0.38f);
        c.drawArc(rf, 20, 140, false, ps);
        c.restore();
    }

    private void drawInstrument(Canvas c, int mode, float cx, float cy, float h, float r) {
        if (mode == Sim.DRUM) drawDrum(c, cx, cy, h, r);
        else if (mode == Sim.TRUMPET) drawTrumpet(c, cx, cy, h, r);
        else drawTamb(c, cx, cy, h, r);
    }

    // ---------------------------------------------------------------- scenery

    private void drawBackdrop(Canvas c, int mode, float pulse) {
        p.setShader(bg[mode]);
        c.drawRect(0, 0, W, H, p);
        p.setShader(null);
        int col = MODE_COL[mode];
        // spotlights
        for (int i = 0; i < 3; i++) {
            float ang = (float) Math.sin(time * 0.7f + i * 2.1f) * 0.45f;
            float x0 = W * (0.2f + 0.3f * i);
            float len = H * 1.1f;
            float x1 = x0 + (float) Math.sin(ang - 0.12f) * len, x2 = x0 + (float) Math.sin(ang + 0.12f) * len;
            float y1 = (float) Math.cos(ang - 0.12f) * len, y2 = (float) Math.cos(ang + 0.12f) * len;
            path.reset();
            path.moveTo(x0, -5);
            path.lineTo(x1, y1);
            path.lineTo(x2, y2);
            path.close();
            p.setColor(alpha(col, 0.07f + 0.05f * pulse));
            c.drawPath(path, p);
        }
        // equalizer
        int bars = 28;
        float bw = W / (float) bars;
        int beat = (int) Math.floor(songT * (lv != null && state == PLAY ? lv.bpm : 100) / 60.0 * 2);
        for (int i = 0; i < bars; i++) {
            float n = hash(i, beat);
            float hh = (0.12f + 0.5f * n) * (0.55f + 0.45f * pulse) * H * 0.55f;
            p.setColor(alpha(col, 0.13f));
            c.drawRect(i * bw + bw * 0.12f, gy - hh, (i + 1) * bw - bw * 0.12f, gy, p);
            p.setColor(alpha(col, 0.35f));
            c.drawRect(i * bw + bw * 0.12f, gy - hh, (i + 1) * bw - bw * 0.12f, gy - hh + bw * 0.18f, p);
        }
        // crowd silhouettes bobbing to the beat
        float par = camX * 0.4f;
        float spacing = 1.25f;
        int first = (int) Math.floor(par / spacing) - 1;
        p.setColor(0xFF07030F);
        for (int k = first; k < first + W / (bp * spacing) + 3; k++) {
            float x = (k * spacing - par) * bp;
            float bob = pulse * 0.25f * bp * ((k & 1) == 0 ? 1 : 0.55f);
            float hy = gy - 0.95f * bp - bob - hash(k, 7) * 0.35f * bp;
            c.drawCircle(x, hy, 0.3f * bp, p);
            rf.set(x - 0.48f * bp, hy + 0.28f * bp, x + 0.48f * bp, gy + bp);
            c.drawRoundRect(rf, 0.3f * bp, 0.3f * bp, p);
            if (hash(k, 3) > 0.7f) { // hands up!
                ps.setColor(0xFF07030F);
                ps.setStrokeWidth(0.16f * bp);
                c.drawLine(x - 0.35f * bp, hy + 0.4f * bp, x - 0.55f * bp, hy - 0.5f * bp - bob, ps);
            }
        }
    }

    private void drawFloor(Canvas c, int mode, boolean litPlayer) {
        int col = MODE_COL[mode];
        p.setColor(0xFF0D0A1A);
        c.drawRect(0, gy, W, H, p);
        int k0 = (int) Math.floor(camX) - 1;
        int k1 = k0 + (int) (W / bp) + 3;
        float kb = H - gy;
        for (int k = k0; k <= k1; k++) {
            float x = sx(k);
            float lit = 0;
            for (int i = 0; i < keyIdx.length; i++)
                if (keyIdx[i] == k) lit = Math.max(lit, 1 - (time - keyT[i]) * 2.5f);
            p.setColor(lit > 0 ? blend(0xFFE9E4F5, col, lit) : 0xFFE9E4F5);
            c.drawRect(x + bp * 0.04f, gy + bp * 0.1f, x + bp * 0.96f, H, p);
        }
        p.setColor(0xFF120E22);
        for (int k = k0; k <= k1; k++) {
            int m = ((k % 7) + 7) % 7;
            if (m == 2 || m == 6) continue;
            float x = sx(k + 1);
            c.drawRect(x - bp * 0.3f, gy + bp * 0.1f, x + bp * 0.3f, gy + kb * 0.62f, p);
        }
        p.setColor(col);
        c.drawRect(0, gy - bp * 0.03f, W, gy + bp * 0.1f, p);
        p.setColor(0x55FFFFFF);
        c.drawRect(0, gy - bp * 0.03f, W, gy, p);
    }

    private static int blend(int a, int b, float t) {
        t = Math.max(0, Math.min(1, t));
        int ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
        int br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
        return 0xFF000000 | ((int) (ar + (br - ar) * t) << 16) | ((int) (ag + (bg - ag) * t) << 8) | (int) (ab + (bb - ab) * t);
    }

    private void drawCeiling(Canvas c, int col) {
        if (ceilA < 0.01f) return;
        float y = sy(Sim.CEIL);
        p.setColor(alpha(0xFF0D0A1A, ceilA));
        c.drawRect(0, 0, W, y, p);
        p.setColor(alpha(0xFF1E1836, ceilA));
        int k0 = (int) Math.floor(camX) - 1;
        for (int k = k0; k < k0 + W / bp + 3; k++) {
            if ((k & 1) == 0) c.drawRect(sx(k), 0, sx(k + 1), y - bp * 0.1f, p);
        }
        p.setColor(alpha(col, ceilA));
        c.drawRect(0, y - bp * 0.1f, W, y + bp * 0.03f, p);
    }

    // ---------------------------------------------------------------- objects

    private void drawObjects(Canvas c, float pulse) {
        Level.Obj[] o = lv.objs;
        float minX = camX - 3, maxX = camX + W / bp + 3;
        for (int i = 0; i < o.length; i++) {
            Level.Obj b = o[i];
            if (b.minX > maxX) break;
            if (b.maxX < minX && b.type != Level.GOON) continue;
            boolean used = sim.used[i];
            switch (b.type) {
                case Level.SOLID: drawSpeaker(c, b, pulse); break;
                case Level.SPIKE: drawSpike(c, b.x, b.y, b.down); break;
                case Level.SAW: drawSaw(c, sx(b.x), sy(b.y), b.r * bp); break;
                case Level.GOON: drawGoon(c, b, i, used); break;
                case Level.SOUR: drawSour(c, sx(b.x + 0.5f), sy(sim.sourY(b))); break;
                case Level.ORB: drawOrb(c, sx(b.x), sy(b.y), used, pulse); break;
                case Level.PAD: drawPad(c, b, used); break;
                case Level.PORTAL: drawPortal(c, b, pulse); break;
                case Level.NOTE:
                    if (!used) drawNote(c, sx(b.x), sy(b.y) + (float) Math.sin(time * 4 + b.x) * 0.08f * bp, bp * 0.95f);
                    break;
                case Level.FINISH: drawFinish(c, b.x); break;
            }
        }
    }

    private void drawSpeaker(Canvas c, Level.Obj b, float pulse) {
        float l = sx(b.x), t = sy(b.y + b.h), r = sx(b.x + b.w), bt = sy(b.y);
        p.setColor(0xFF1C1630);
        c.drawRect(l, t, r, bt, p);
        int cw = Math.max(1, Math.round(b.w)), chh = Math.max(1, (int) Math.floor(b.h));
        float cell = bp;
        float y0 = bt - chh * cell;
        for (int i = 0; i < cw; i++) {
            for (int j = 0; j < chh; j++) {
                float cx = l + (i + 0.5f) * cell, cy = bt - (j + 0.5f) * cell;
                if (cx < -bp || cx > W + bp) continue;
                p.setColor(0xFF2B2445);
                c.drawCircle(cx, cy, cell * 0.38f, p);
                p.setColor(0xFF3E3566);
                c.drawCircle(cx, cy, cell * (0.27f + 0.04f * pulse), p);
                p.setColor(0xFF9187D6);
                c.drawCircle(cx, cy, cell * 0.09f, p);
            }
        }
        if (y0 > t + 2) {
            p.setColor(0xFF2B2445);
            c.drawRect(l, t, r, y0, p);
        }
        ps.setColor(0xFF8B7BFF);
        ps.setStrokeWidth(bp * 0.07f);
        c.drawRect(l, t, r, bt, ps);
        p.setColor(0x40FFFFFF);
        c.drawRect(l, t, r, t + bp * 0.08f, p);
    }

    private void drawSpike(Canvas c, float x, float y, boolean down) {
        float l = sx(x) + bp * 0.06f, r = sx(x + 1) - bp * 0.06f, m = (l + r) / 2;
        float base = down ? sy(y + 1) : sy(y), tip = down ? sy(y + 0.12f) : sy(y + 0.88f);
        path.reset();
        path.moveTo(l - bp * 0.06f, base);
        path.lineTo(m, tip + (down ? bp * 0.1f : -bp * 0.1f));
        path.lineTo(r + bp * 0.06f, base);
        path.close();
        p.setColor(0x40FF2D75);
        c.drawPath(path, p);
        path.reset();
        path.moveTo(l, base);
        path.lineTo(m, tip);
        path.lineTo(r, base);
        path.close();
        p.setColor(0xFFFF2D75);
        c.drawPath(path, p);
        path.reset();
        path.moveTo(m - bp * 0.08f, base + (down ? bp * 0.05f : -bp * 0.05f));
        path.lineTo(m, tip + (down ? -bp * 0.0f : bp * 0.0f) + (down ? -bp * 0.1f : bp * 0.1f));
        path.lineTo(m + bp * 0.16f, base + (down ? bp * 0.05f : -bp * 0.05f));
        path.close();
        p.setColor(0x66FFFFFF);
        c.drawPath(path, p);
    }

    private void drawSaw(Canvas c, float cx, float cy, float r) {
        c.save();
        c.translate(cx, cy);
        c.rotate(-time * 400);
        path.reset();
        int teeth = 14;
        for (int k = 0; k < teeth; k++) {
            double a0 = k * 2 * Math.PI / teeth, a1 = a0 + Math.PI / teeth * 0.9;
            float r0 = r * 0.92f, r1 = r * 1.18f;
            if (k == 0) path.moveTo((float) Math.cos(a0) * r0, (float) Math.sin(a0) * r0);
            else path.lineTo((float) Math.cos(a0) * r0, (float) Math.sin(a0) * r0);
            path.lineTo((float) Math.cos(a1) * r1, (float) Math.sin(a1) * r1);
        }
        path.close();
        p.setColor(0xFFE2E2EA);
        c.drawPath(path, p);
        p.setColor(0xFF0E0E12);
        c.drawCircle(0, 0, r * 0.95f, p);
        ps.setColor(0xFF2E2E36);
        ps.setStrokeWidth(r * 0.03f);
        for (float k = 0.5f; k < 0.92f; k += 0.1f) c.drawCircle(0, 0, r * k, ps);
        p.setColor(0xFFE63946);
        c.drawCircle(0, 0, r * 0.34f, p);
        p.setColor(0xFFFFE14D);
        rf.set(-r * 0.2f, -r * 0.08f, r * 0.2f, r * 0.0f);
        c.drawRect(rf, p);
        p.setColor(0xFF0E0E12);
        c.drawCircle(0, 0, r * 0.06f, p);
        ps.setColor(0x50FFFFFF);
        ps.setStrokeWidth(r * 0.06f);
        rf.set(-r * 0.8f, -r * 0.8f, r * 0.8f, r * 0.8f);
        c.drawArc(rf, 200, 50, false, ps);
        c.restore();
    }

    private void drawGoon(Canvas c, Level.Obj b, int i, boolean stomped) {
        float gx = lv.goonX(b, sim.px);
        if (gx < camX - 3 || gx > camX + W / bp + 3) return;
        float l = sx(gx), bt = sy(0), u = bp;
        float squash = 1, fade = 1;
        if (stomped) {
            float st = time - stompT[i];
            if (st > 0.8f) return;
            squash = 0.25f;
            fade = 1 - st / 0.8f;
        }
        c.save();
        c.translate(l + u * 0.5f, bt);
        c.scale(1, squash);
        float walk = (float) Math.sin(time * 12 + b.x);
        // legs
        ps.setColor(alpha(0xFF2A2140, fade));
        ps.setStrokeWidth(u * 0.14f);
        c.drawLine(-u * 0.1f, -u * 0.55f, -u * 0.1f + walk * u * 0.18f, 0, ps);
        c.drawLine(u * 0.1f, -u * 0.55f, u * 0.1f - walk * u * 0.18f, 0, ps);
        // body (hoodie)
        p.setColor(alpha(0xFF5A5F7A, fade));
        rf.set(-u * 0.3f, -u * 1.1f, u * 0.3f, -u * 0.5f);
        c.drawRoundRect(rf, u * 0.15f, u * 0.15f, p);
        p.setColor(alpha(0xFF3D4157, fade));
        rf.set(-u * 0.3f, -u * 0.62f, u * 0.3f, -u * 0.5f);
        c.drawRect(rf, p);
        // head
        p.setColor(alpha(0xFFE0A877, fade));
        c.drawCircle(0, -u * 1.27f, u * 0.22f, p);
        p.setColor(alpha(0xFF3D4157, fade));
        rf.set(-u * 0.26f, -u * 1.55f, u * 0.26f, -u * 1.3f);
        c.drawArc(rf, 180, 180, true, p);
        // grumpy face
        p.setColor(alpha(0xFF15101F, fade));
        c.drawCircle(-u * 0.1f, -u * 1.25f, u * 0.035f, p);
        c.drawCircle(u * 0.02f, -u * 1.25f, u * 0.035f, p);
        ps.setColor(alpha(0xFF15101F, fade));
        ps.setStrokeWidth(u * 0.04f);
        c.drawLine(-u * 0.17f, -u * 1.35f, -u * 0.05f, -u * 1.3f, ps);
        c.drawLine(u * 0.08f, -u * 1.35f, -u * 0.02f, -u * 1.3f, ps);
        c.drawLine(-u * 0.12f, -u * 1.15f, u * 0.0f, -u * 1.17f, ps);
        // megaphone aimed at the player
        p.setColor(alpha(0xFFE8E8E8, fade));
        path.reset();
        path.moveTo(-u * 0.2f, -u * 0.93f);
        path.lineTo(-u * 0.62f, -u * 1.1f);
        path.lineTo(-u * 0.62f, -u * 0.72f);
        path.lineTo(-u * 0.2f, -u * 0.83f);
        path.close();
        c.drawPath(path, p);
        p.setColor(alpha(0xFFE63946, fade));
        rf.set(-u * 0.67f, -u * 1.1f, -u * 0.57f, -u * 0.72f);
        c.drawOval(rf, p);
        if (!stomped) {
            float ph = beatPhase();
            ps.setStrokeWidth(u * 0.05f);
            for (int k = 0; k < 3; k++) {
                float rr = u * (0.25f + 0.22f * k + ph * 0.2f);
                ps.setColor(alpha(0xFFFF5A5A, (1 - ph) * 0.8f));
                rf.set(-u * 0.65f - rr, -u * 0.91f - rr, -u * 0.65f + rr, -u * 0.91f + rr);
                c.drawArc(rf, 150, 60, false, ps);
            }
        }
        c.restore();
    }

    private void drawSour(Canvas c, float cx, float cy) {
        float u = bp;
        p.setColor(0x338BD93A);
        c.drawCircle(cx, cy, u * 0.6f, p);
        ps.setColor(0xFF4E8A1A);
        ps.setStrokeWidth(u * 0.08f);
        c.drawLine(cx + u * 0.27f, cy - u * 0.05f, cx + u * 0.27f, cy - u * 0.95f, ps);
        path.reset();
        path.moveTo(cx + u * 0.27f, cy - u * 0.95f);
        path.quadTo(cx + u * 0.65f, cy - u * 0.7f, cx + u * 0.5f, cy - u * 0.4f);
        c.drawPath(path, ps);
        c.save();
        c.translate(cx, cy);
        c.rotate(-20);
        p.setColor(0xFF8BD93A);
        rf.set(-u * 0.34f, -u * 0.25f, u * 0.34f, u * 0.25f);
        c.drawOval(rf, p);
        c.restore();
        eyes(c, cx - u * 0.12f, cy - u * 0.02f, cx + u * 0.12f, cy - u * 0.04f, u * 0.08f, -1, true);
        ps.setColor(0xFF15101F);
        ps.setStrokeWidth(u * 0.04f);
        rf.set(cx - u * 0.1f, cy + u * 0.08f, cx + u * 0.1f, cy + u * 0.22f);
        c.drawArc(rf, 200, 140, false, ps);
    }

    private void drawOrb(Canvas c, float cx, float cy, boolean used, float pulse) {
        float u = bp;
        if (!used) {
            ps.setColor(alpha(0xFFFFE14D, 0.35f + 0.4f * pulse));
            ps.setStrokeWidth(u * 0.06f);
            c.drawCircle(cx, cy, u * (0.62f + 0.15f * pulse), ps);
        }
        c.save();
        c.translate(cx, cy);
        c.rotate(-12 + (float) Math.sin(time * 6) * 4);
        p.setColor(used ? 0x66B8901C : 0xFFF0C040);
        rf.set(-u * 0.58f, -u * 0.17f, u * 0.58f, u * 0.17f);
        c.drawOval(rf, p);
        ps.setColor(used ? 0x66805A10 : 0xFFB8801C);
        ps.setStrokeWidth(u * 0.03f);
        rf.set(-u * 0.38f, -u * 0.1f, u * 0.38f, u * 0.1f);
        c.drawOval(rf, ps);
        p.setColor(used ? 0x66805A10 : 0xFFFFF3C4);
        c.drawCircle(0, -u * 0.04f, u * 0.08f, p);
        c.restore();
    }

    private void drawPad(Canvas c, Level.Obj b, boolean used) {
        float l = sx(b.x + 0.05f), r = sx(b.x + 0.95f), t = sy(b.y + 0.3f), bt = sy(b.y);
        p.setColor(0xFF4A4A5E);
        rf.set(l, t, r, bt);
        c.drawRoundRect(rf, bp * 0.08f, bp * 0.08f, p);
        p.setColor(used ? 0xFFB09A30 : 0xFFFFE14D);
        rf.set(l - bp * 0.03f, t - bp * 0.08f, r + bp * 0.03f, t + bp * 0.08f);
        c.drawOval(rf, p);
        if (!used) {
            p.setColor(0x30FFE14D);
            path.reset();
            path.moveTo(l, t);
            path.lineTo(l - bp * 0.2f, t - bp * 1.4f);
            path.lineTo(r + bp * 0.2f, t - bp * 1.4f);
            path.lineTo(r, t);
            path.close();
            c.drawPath(path, p);
        }
    }

    private void drawPortal(Canvas c, Level.Obj b, float pulse) {
        int col = MODE_COL[b.mode];
        float cx = sx(b.x + 0.5f);
        float top = sy(8.6f), bot = sy(0.4f);
        p.setColor(alpha(col, 0.15f + 0.1f * pulse));
        rf.set(cx - bp * 0.8f, top, cx + bp * 0.8f, bot);
        c.drawOval(rf, p);
        ps.setColor(col);
        ps.setStrokeWidth(bp * 0.24f);
        c.drawOval(rf, ps);
        ps.setColor(0xCCFFFFFF);
        ps.setStrokeWidth(bp * 0.06f);
        rf.set(cx - bp * 0.55f, top + bp * 0.3f, cx + bp * 0.55f, bot - bp * 0.3f);
        c.drawOval(rf, ps);
        drawInstrument(c, b.mode, cx, sy(4.5f), bp * 0.42f, 0);
        text(c, MODE_NAME[b.mode], cx, top - bp * 0.25f, bp * 0.42f, col);
    }

    private void drawNote(Canvas c, float x, float y, float size) {
        p.setColor(0x33FFE14D);
        c.drawCircle(x, y, size * 0.5f, p);
        pt.setTextSize(size);
        pt.setStyle(Paint.Style.FILL);
        pt.setColor(0xFFFFE14D);
        c.drawText("♫", x, y + size * 0.33f, pt);
    }

    private void drawFinish(Canvas c, float x) {
        float l = sx(x), w = bp * 0.6f;
        if (l > W + bp) return;
        int rows = 18;
        float hh = (sy(0) - sy(9.5f)) / rows;
        for (int r = 0; r < rows; r++) {
            for (int k = 0; k < 2; k++) {
                p.setColor(((r + k) & 1) == 0 ? 0xFFFFE14D : 0xFF15101F);
                c.drawRect(l + k * w / 2, sy(0) - (r + 1) * hh, l + (k + 1) * w / 2, sy(0) - r * hh, p);
            }
        }
        p.setColor(0xFFB3122E);
        c.drawRect(l + w, 0, W + bp * 40, gy, p);
        ps.setColor(0xFF7A0A1E);
        ps.setStrokeWidth(bp * 0.12f);
        for (float k = 1; k < 40; k += 1.2f) c.drawLine(l + w + k * bp, 0, l + w + k * bp, gy, ps);
        text(c, "ENCORE", l + w + bp * 4, sy(6), bp * 1.1f, 0xFFFFE14D);
    }

    private void drawParticles(Canvas c) {
        for (int i = 0; i < pN; i++) {
            float a = pL[i] / pML[i];
            float x = sx(pX[i]), y = sy(pY[i]);
            int col = alpha(pC[i], a);
            if (pK[i] == 0) {
                p.setColor(col);
                float s = pS[i] * bp;
                c.drawRect(x - s, y - s, x + s, y + s, p);
            } else {
                pt.setTextSize(pS[i] * bp * 1.6f);
                pt.setStyle(Paint.Style.FILL);
                pt.setColor(col);
                c.drawText(pK[i] == 1 ? "♪" : "♫", x, y, pt);
            }
        }
    }

    // ================================================================ screens

    private void draw2(Canvas c) {
        float pulse = (float) Math.exp(-beatPhase() * 5);
        if (state == PLAY || state == DONE) drawGame(c, pulse);
        else if (state == TITLE) drawTitle(c, pulse);
        else drawSelect(c, pulse);
        if (state == DONE) drawDone(c);
    }

    private void drawGame(Canvas c, float pulse) {
        int mode = sim.mode;
        camX = sim.px - 5f;
        c.save();
        if (shake > 0) c.translate((float) (Math.random() - 0.5) * shake * bp, (float) (Math.random() - 0.5) * shake * bp);
        drawBackdrop(c, mode, pulse);
        drawFloor(c, mode, sim.grounded);
        drawCeiling(c, MODE_COL[mode]);
        // attempt counter floating in the world
        float ax = sx(startStep + 6);
        if (ax > -W) text(c, (practice ? "PRACTICE  " : "") + "ATTEMPT " + attempts, ax, sy(6.2f), bp * 0.95f, 0xDDFFFFFF);
        drawObjects(c, pulse);
        if (!dead) {
            float cx = sx(sim.px + 0.45f), cy = sy(sim.y + 0.45f);
            p.setColor(alpha(MODE_COL[mode], 0.18f + 0.12f * pulse));
            c.drawCircle(cx, cy, bp * (0.75f + 0.12f * pulse), p);
            float h = bp * 0.47f;
            if (mode == Sim.TAMB && sim.grav < 0) drawTamb(c, cx, cy, h, rot);
            else drawInstrument(c, mode, cx, cy, h, rot);
        }
        drawParticles(c);
        for (int i = 0; i < MAXT; i++) {
            if (tL[i] <= 0) continue;
            text(c, tS[i], sx(tX[i]), sy(tY[i]), bp * 0.55f, alpha(tC[i], Math.min(1, tL[i] * 2)));
        }
        c.restore();
        if (flash > 0) {
            p.setColor(alpha(flashCol, flash * 0.35f));
            c.drawRect(0, 0, W, H, p);
        }
        drawHud(c, mode);
        if (paused) drawPauseMenu(c);
    }

    private void drawHud(Canvas c, int mode) {
        int col = MODE_COL[mode];
        float bw = W * 0.34f, bx = W / 2f - bw / 2, by = bp * 0.45f, bh = bp * 0.24f;
        p.setColor(0x55FFFFFF);
        rf.set(bx, by, bx + bw, by + bh);
        c.drawRoundRect(rf, bh / 2, bh / 2, p);
        int pc = dead ? lastPct : pct();
        p.setColor(col);
        rf.set(bx, by, bx + bw * pc / 100f, by + bh);
        c.drawRoundRect(rf, bh / 2, bh / 2, p);
        // section ticks
        p.setColor(0xAAFFFFFF);
        for (int i = 1; i < lv.sections.length; i++) {
            float fx = bx + bw * lv.sections[i].startStep / (float) (lv.endStep - 8);
            c.drawRect(fx - 1.5f, by - bh * 0.3f, fx + 1.5f, by + bh * 1.3f, p);
        }
        pt.setTextAlign(Paint.Align.LEFT);
        text(c, pc + "%", bx + bw + bp * 0.3f, by + bh, bp * 0.42f, 0xFFFFFFFF);
        text(c, "SCORE " + score, bp * 0.45f, bp * 0.85f, bp * 0.45f, 0xFFFFFFFF);
        text(c, "♫ " + notesGot + "/" + lv.totalNotes, bp * 0.45f, bp * 1.5f, bp * 0.42f, 0xFFFFE14D);
        if (combo > 1) text(c, "x" + mult() + "  " + combo + " BEAT COMBO", bp * 0.45f, bp * 2.1f, bp * 0.38f, col);
        pt.setTextAlign(Paint.Align.CENTER);
        if (practice) text(c, "PRACTICE", W / 2f, by + bh + bp * 0.55f, bp * 0.32f, 0xFF7CFF6B);
        // pause button
        float px = W - 1.0f * bp, py = 0.95f * bp;
        p.setColor(0x44FFFFFF);
        c.drawCircle(px, py, bp * 0.5f, p);
        p.setColor(0xFFFFFFFF);
        c.drawRect(px - bp * 0.18f, py - bp * 0.2f, px - bp * 0.06f, py + bp * 0.2f, p);
        c.drawRect(px + bp * 0.06f, py - bp * 0.2f, px + bp * 0.18f, py + bp * 0.2f, p);
        // beat indicator: 4 dots that light up with the beat
        float bph = beatPhase();
        int beatN = (int) Math.floor(Math.max(0, songT) / sim.B) & 3;
        for (int k = 0; k < 4; k++) {
            boolean on = k == beatN;
            p.setColor(on ? alpha(col, 1 - bph * 0.6f) : 0x44FFFFFF);
            c.drawCircle(W - 1.0f * bp - (4 - k) * bp * 0.42f - bp * 0.5f, py, bp * (on ? 0.14f : 0.1f), p);
        }
        if (hintT > 0) {
            float a = Math.min(1, hintT * 2);
            textOutlined(c, hint, W / 2f, H * 0.3f, bp * 0.6f, alpha(0xFFFFFFFF, a), alpha(0xFF15101F, a));
        }
    }

    private void button(Canvas c, String s, float cx, float cy, float w, float h, int col) {
        p.setColor(0xFF15101F);
        rf.set(cx - w / 2, cy - h / 2 + bp * 0.08f, cx + w / 2, cy + h / 2 + bp * 0.08f);
        c.drawRoundRect(rf, h / 2, h / 2, p);
        p.setColor(col);
        rf.set(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
        c.drawRoundRect(rf, h / 2, h / 2, p);
        pt.setTextSize(h * 0.45f);
        pt.setStyle(Paint.Style.FILL);
        pt.setColor(0xFF15101F);
        c.drawText(s, cx, cy + h * 0.16f, pt);
    }

    private void drawPauseMenu(Canvas c) {
        p.setColor(0xB0080412);
        c.drawRect(0, 0, W, H, p);
        textOutlined(c, "PAUSED", W / 2f, H * 0.25f, bp * 1.2f, 0xFFFFFFFF, 0xFF15101F);
        button(c, "RESUME", W / 2f, H * 0.42f, 6 * bp, 1.2f * bp, 0xFF7CFF6B);
        button(c, "RESTART", W / 2f, H * 0.58f, 6 * bp, 1.2f * bp, 0xFFFFC23D);
        button(c, "SONG LIST", W / 2f, H * 0.74f, 6 * bp, 1.2f * bp, 0xFFFF3D7F);
    }

    private void drawDone(Canvas c) {
        p.setColor(0xC0080412);
        c.drawRect(0, 0, W, H, p);
        float s = 1 + (float) Math.exp(-doneT * 6) * 0.5f;
        textOutlined(c, practice ? "PRACTICE COMPLETE" : "ENCORE!", W / 2f, H * 0.24f, bp * 1.5f * s, 0xFFFFE14D, 0xFF15101F);
        text(c, lv.name, W / 2f, H * 0.36f, bp * 0.6f, 0xFFFFFFFF);
        text(c, "SCORE  " + score, W / 2f, H * 0.5f, bp * 0.55f, 0xFFFFFFFF);
        text(c, "NOTES  " + notesGot + " / " + lv.totalNotes, W / 2f, H * 0.6f, bp * 0.55f, 0xFFFFE14D);
        text(c, "BEST COMBO  " + maxCombo + "     ATTEMPTS  " + attempts, W / 2f, H * 0.7f, bp * 0.5f, 0xFF7CFFCB);
        doneT += 0.016f;
        if (doneT > 0.8f && ((int) (time * 2) & 1) == 0)
            text(c, "TAP TO CONTINUE", W / 2f, H * 0.86f, bp * 0.5f, 0xFFFFFFFF);
    }

    private void drawTitle(Canvas c, float pulse) {
        camX = menuX;
        drawBackdrop(c, 0, pulse);
        drawFloor(c, 0, false);
        float ph = beatPhase();
        // the band, hopping on every beat
        float base = gy;
        float hop = 4 * ph * (1 - ph);
        float h = bp * 0.75f;
        drawTamb(c, W * 0.2f, base - h - hop * bp * 0.6f, h, time * 120);
        drawDrum(c, W * 0.5f, base - h * 1.05f - hop * bp * 1.6f, h, 0);
        drawTrumpet(c, W * 0.8f, base - h - bp * 1.2f - hop * bp * 0.4f, h, -10 + hop * 10);
        float s = 1 + pulse * 0.05f;
        textOutlined(c, "BACKBEAT", W / 2f, H * 0.24f, bp * 1.9f * s, 0xFFFF3D7F, 0xFF15101F);
        textOutlined(c, "BLITZ", W / 2f, H * 0.24f + bp * 1.8f * s, bp * 1.9f * s, 0xFFFFC23D, 0xFF15101F);
        text(c, "a drum-powered rhythm runner", W / 2f, H * 0.24f + bp * 2.75f, bp * 0.45f, 0xFFE9E4F5);
        if (((int) (time * 2.5f) & 1) == 0) text(c, "TAP TO PLAY", W / 2f, H * 0.66f, bp * 0.6f, 0xFFFFFFFF);
        if (Math.random() < 0.08) spawn(camX + (float) Math.random() * W / bp, 0.3f, 0, 2 + (float) Math.random() * 2,
                1.5f, MODE_COL[(int) (Math.random() * 3)], 1 + (int) (Math.random() * 2), 0.5f);
        drawParticles(c);
    }

    private RectF cardRect(int slot) {
        int col = slot % 3, row = slot / 3;
        float cw = W * 0.29f, gap = W * 0.025f, ch = H * 0.31f, rgap = H * 0.025f;
        float x0 = W / 2f - (3 * cw + 2 * gap) / 2 + col * (cw + gap);
        float y0 = H * 0.185f + row * (ch + rgap);
        return new RectF(x0, y0, x0 + cw, y0 + ch);
    }

    private float fit(String s, float size, float maxW) {
        pt.setTextSize(size);
        while (pt.measureText(s) > maxW && size > bp * 0.2f) {
            size *= 0.92f;
            pt.setTextSize(size);
        }
        return size;
    }

    private void drawSelect(Canvas c, float pulse) {
        camX = menuX;
        drawBackdrop(c, 0, pulse);
        drawFloor(c, 0, false);
        int pages = (ORDER.length + PER_PAGE - 1) / PER_PAGE;
        textOutlined(c, "PICK A SONG", W / 2f, H * 0.12f, bp * 0.85f, 0xFFFFFFFF, 0xFF15101F);
        pt.setTextAlign(Paint.Align.RIGHT);
        text(c, "PAGE " + (page + 1) + "/" + pages, W - bp * 0.5f, bp * 0.9f, bp * 0.4f, 0xFFCFC8E8);
        pt.setTextAlign(Paint.Align.CENTER);
        pt.setTextAlign(Paint.Align.LEFT);
        text(c, "< BACK", bp * 0.5f, bp * 0.9f, bp * 0.45f, 0xFFFFFFFF);
        pt.setTextAlign(Paint.Align.CENTER);
        float ph = beatPhase();
        for (int slot = 0; slot < PER_PAGE; slot++) {
            int oi = page * PER_PAGE + slot;
            if (oi >= ORDER.length) break;
            int i = ORDER[oi];
            Level l = levels[i];
            RectF r = cardRect(slot);
            int col = MODE_COL[oi % 3];
            p.setColor(0xFF15101F);
            rf.set(r.left, r.top + bp * 0.1f, r.right, r.bottom + bp * 0.1f);
            c.drawRoundRect(rf, bp * 0.35f, bp * 0.35f, p);
            p.setColor(0xF0221A3A);
            c.drawRoundRect(r, bp * 0.35f, bp * 0.35f, p);
            ps.setColor(col);
            ps.setStrokeWidth(bp * 0.07f);
            c.drawRoundRect(r, bp * 0.35f, bp * 0.35f, ps);
            float cx = r.centerX(), u = r.height();
            // little hopping instrument in the corner
            drawInstrument(c, oi % 3 == 0 ? Sim.DRUM : oi % 3 == 1 ? Sim.TAMB : Sim.TRUMPET,
                    r.right - bp * 0.75f, r.top + bp * 0.75f - 4 * ph * (1 - ph) * bp * 0.25f, bp * 0.32f, 0);
            float ns = fit(l.name, bp * 0.55f, r.width() - bp * 2.0f);
            text(c, l.name, cx - bp * 0.35f, r.top + u * 0.24f, ns, col);
            float ss = fit(l.subtitle, bp * 0.3f, r.width() * 0.9f);
            text(c, l.subtitle, cx, r.top + u * 0.4f, ss, 0xFFCFC8E8);
            String stars = "";
            for (int k = 0; k < Math.max(3, l.stars); k++) stars += k < l.stars ? "\u2605" : "\u2606";
            text(c, stars + "   " + (int) l.bpm + " BPM", cx, r.top + u * 0.58f, bp * 0.4f, 0xFFFFE14D);
            int best = prefs.getInt("best" + i, 0), bestP = prefs.getInt("bestp" + i, 0);
            int nb = prefs.getInt("notes" + i, 0);
            float bw = r.width() * 0.78f, bx = cx - bw / 2, by = r.top + u * 0.68f, bh = bp * 0.2f;
            p.setColor(0x44FFFFFF);
            rf.set(bx, by, bx + bw, by + bh);
            c.drawRoundRect(rf, bh / 2, bh / 2, p);
            p.setColor(col);
            rf.set(bx, by, bx + bw * best / 100f, by + bh);
            c.drawRoundRect(rf, bh / 2, bh / 2, p);
            text(c, best >= 100 ? "CLEARED!  \u266B " + nb + "/" + l.totalNotes : "BEST " + best + "%   practice " + bestP + "%",
                    cx, r.top + u * 0.88f, bp * 0.3f, best >= 100 ? 0xFF7CFF6B : 0xFFCFC8E8);
        }
        button(c, practice ? "PRACTICE MODE: ON" : "PRACTICE MODE: OFF", W / 2f, H - 0.75f * bp, 7.4f * bp, 0.95f * bp,
                practice ? 0xFF7CFF6B : 0xFFBDB6D6);
        if (page > 0) button(c, "< PREV", W * 0.12f, H - 0.75f * bp, 3.6f * bp, 0.95f * bp, 0xFFFFC23D);
        if (page < pages - 1) button(c, "MORE SONGS >", W * 0.86f, H - 0.75f * bp, 4.6f * bp, 0.95f * bp, 0xFFFFC23D);
        drawParticles(c);
    }
}
