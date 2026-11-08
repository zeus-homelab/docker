package com.backbeat.blitz;

/**
 * Deterministic player physics, stepped at a fixed 240 Hz. Every constant is derived from the
 * song tempo, so a drum jump always lasts exactly one beat: jump on the beat, land on the beat.
 * Pure Java so the solver can verify levels off-device.
 */
public final class Sim {
    public static final int DRUM = 0, TRUMPET = 1, TAMB = 2;
    public static final float CEIL = 9f, PW = 0.9f, PH = 0.9f, DT = 1f / 240f;
    /** Leeway: tap up to this long before landing / touching an orb and it still counts. */
    public static final float BUFFER = 0.09f;
    /** Leeway: you can still jump this long after running off a ledge. */
    public static final float COYOTE = 0.06f;
    public static final int EV_JUMP = 1, EV_ORB = 2, EV_PAD = 3, EV_STOMP = 4, EV_FLIP = 5,
            EV_PORTAL = 6, EV_NOTE = 7, EV_HONK = 8, EV_LAND = 9;

    public final Level lv;
    public final float B, speed, g, vJump, vFall, trV, trA, gT, vT;

    public double t;
    public float px, y, vy, yPrev;
    public int mode, grav;
    public boolean grounded, dead, finished, held, buffered;
    public float bufT, coyote;
    public boolean[] used;
    public int usedCount, scan;
    public final int[] ev = new int[64];
    public int evN;

    public Sim(Level lv) {
        this.lv = lv;
        B = lv.beatSec();
        speed = 4f / B;                 // 4 blocks per beat
        float h = 2.25f;                // jump apex height in blocks
        g = 8f * h / (B * B);           // airtime == one beat
        vJump = 4f * h / B;
        vFall = 2.1f * vJump;
        trV = 0.85f * speed;
        trA = trV / (0.3f * B);
        gT = 0.9f * g;
        vT = 2f * vJump;
        used = new boolean[lv.objs.length];
        reset(0, DRUM);
    }

    public void reset(int step, int mode) {
        t = step * (double) B / 4.0;
        px = (float) (t * speed);
        y = 0;
        vy = 0;
        yPrev = 0;
        grav = 1;
        this.mode = mode;
        grounded = true;
        dead = finished = held = buffered = false;
        bufT = 0;
        coyote = 0;
        for (int i = 0; i < used.length; i++) used[i] = false;
        usedCount = 0;
        evN = 0;
        scan = 0;
    }

    public Sim copy() {
        Sim s = new Sim(lv, this);
        return s;
    }

    private Sim(Level lv, Sim o) {
        this.lv = lv;
        B = o.B; speed = o.speed; g = o.g; vJump = o.vJump; vFall = o.vFall;
        trV = o.trV; trA = o.trA; gT = o.gT; vT = o.vT;
        t = o.t; px = o.px; y = o.y; vy = o.vy; yPrev = o.yPrev; mode = o.mode; grav = o.grav;
        grounded = o.grounded; dead = o.dead; finished = o.finished; held = o.held; buffered = o.buffered;
        bufT = o.bufT; coyote = o.coyote;
        used = o.used.clone();
        usedCount = o.usedCount;
        scan = o.scan;
    }

    private void emit(int e, int idx) {
        if (evN < ev.length) ev[evN++] = (e << 16) | idx;
    }

    private void use(int i) {
        used[i] = true;
        usedCount++;
    }

    public void step(boolean press) {
        if (dead || finished) return;
        boolean edge = press && !held;
        held = press;
        if (edge) { buffered = true; bufT = BUFFER; }
        if (!press) buffered = false;
        if (bufT > 0) bufT -= DT;
        if (coyote > 0) coyote -= DT;
        t += DT;
        px = (float) (t * speed);
        yPrev = y;
        boolean wasGrounded = grounded;
        if (mode == TRUMPET && edge) emit(EV_HONK, 0);
        switch (mode) {
            case DRUM:
                if ((grounded || coyote > 0) && (press || bufT > 0)) {
                    vy = vJump;
                    grounded = false;
                    buffered = false;
                    bufT = 0;
                    coyote = 0;
                    emit(EV_JUMP, 0);
                }
                vy -= g * DT;
                if (vy < -vFall) vy = -vFall;
                break;
            case TRUMPET:
                vy += (press ? trA : -trA) * DT;
                if (vy > trV) vy = trV;
                if (vy < -trV) vy = -trV;
                break;
            default:
                if ((grounded || coyote > 0) && (buffered || bufT > 0)) {
                    grav = -grav;
                    vy = -grav * vJump * 0.25f;
                    grounded = false;
                    buffered = false;
                    bufT = 0;
                    coyote = 0;
                    emit(EV_FLIP, 0);
                }
                vy -= grav * gT * DT;
                if (vy > vT) vy = vT;
                if (vy < -vT) vy = -vT;
                break;
        }
        y += vy * DT;
        grounded = false;
        if (y < 0) {
            y = 0;
            if (vy < 0) vy = 0;
            if (grav == 1) grounded = true;
        }
        if (mode != DRUM && y + PH > CEIL) {
            y = CEIL - PH;
            if (vy > 0) vy = 0;
            if (grav == -1) grounded = true;
        }
        if (y > 11f) { y = 11f; if (vy > 0) vy = 0; }
        collide();
        if (grounded && !wasGrounded && !dead) emit(EV_LAND, 0);
        if (grounded) coyote = COYOTE;
    }

    private static boolean overlap(float ax0, float ay0, float ax1, float ay1,
                                   float bx0, float by0, float bx1, float by1) {
        return ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;
    }

    private boolean circleHit(float cx, float cy, float r) {
        float nx = Math.max(px, Math.min(cx, px + PW));
        float ny = Math.max(y, Math.min(cy, y + PH));
        float dx = cx - nx, dy = cy - ny;
        return dx * dx + dy * dy < r * r;
    }

    private void die() { dead = true; }

    private void collide() {
        Level.Obj[] o = lv.objs;
        while (scan < o.length && o[scan].maxX < px - 1f) scan++;
        float x1 = px + PW;
        float pcx = px + PW * 0.5f;
        for (int i = scan; i < o.length; i++) {
            Level.Obj b = o[i];
            if (b.minX > x1 + 0.5f) break;
            if (used[i]) continue;
            float pcy = y + PH * 0.5f;
            switch (b.type) {
                case Level.SOLID:
                    if (overlap(px, y, x1, y + PH, b.x, b.y, b.x + b.w, b.y + b.h)) {
                        float top = b.y + b.h, bot = b.y;
                        if (yPrev >= top - 0.28f && vy <= 0.001f) {
                            y = top;
                            vy = 0;
                            if (grav == 1) grounded = true;
                        } else if (yPrev + PH <= bot + 0.15f && vy >= -0.001f) {
                            y = bot - PH;
                            vy = 0;
                            if (grav == -1) grounded = true;
                        } else {
                            die();
                            return;
                        }
                    }
                    break;
                case Level.SPIKE: {
                    float sy0 = b.down ? b.y + 0.5f : b.y;
                    if (overlap(px, y, x1, y + PH, b.x + 0.33f, sy0, b.x + 0.67f, sy0 + 0.5f)) {
                        die();
                        return;
                    }
                    break;
                }
                case Level.SAW:
                    if (circleHit(b.x, b.y, b.r * 0.72f)) { die(); return; }
                    break;
                case Level.GOON: {
                    float gx = lv.goonX(b, px);
                    if (overlap(px, y, x1, y + PH, gx + 0.25f, 0, gx + 0.75f, 1.3f)) {
                        if (mode == DRUM && vy < 0 && yPrev >= 0.7f) {
                            use(i);
                            vy = vJump * 0.85f;
                            grounded = false;
                        coyote = 0;
                            emit(EV_STOMP, i);
                        } else {
                            die();
                            return;
                        }
                    }
                    break;
                }
                case Level.SOUR: {
                    float cy = sourY(b);
                    if (circleHit(b.x + 0.5f, cy, 0.32f)) { die(); return; }
                    break;
                }
                case Level.ORB: {
                    float dx = pcx - b.x, dy = pcy - b.y;
                    if ((buffered || bufT > 0) && dx * dx + dy * dy < 1.05f * 1.05f) {
                        use(i);
                        buffered = false;
                        bufT = 0;
                        grounded = false;
                        coyote = 0;
                        if (mode == DRUM) vy = vJump;
                        else if (mode == TRUMPET) vy = trV;
                        else { grav = -grav; vy = -grav * vJump * 0.4f; }
                        emit(EV_ORB, i);
                    }
                    break;
                }
                case Level.PAD:
                    if (overlap(px, y, x1, y + PH, b.x, b.y, b.x + 1f, b.y + 0.4f)) {
                        use(i);
                        grounded = false;
                        coyote = 0;
                        if (mode == DRUM) vy = vJump * 1.45f;
                        else if (mode == TRUMPET) vy = trV;
                        else { grav = -grav; vy = -grav * vJump * 0.4f; }
                        emit(EV_PAD, i);
                    }
                    break;
                case Level.PORTAL:
                    if (x1 > b.x + 0.4f) {
                        use(i);
                        mode = b.mode;
                        if (mode != TAMB) grav = 1;
                        vy *= 0.4f;
                        emit(EV_PORTAL, i);
                    }
                    break;
                case Level.NOTE: {
                    float dx = pcx - b.x, dy = pcy - b.y;
                    if (dx * dx + dy * dy < 0.95f * 0.95f) {
                        use(i);
                        emit(EV_NOTE, i);
                    }
                    break;
                }
                case Level.FINISH:
                    if (px >= b.x) finished = true;
                    break;
            }
        }
    }

    public float sourY(Level.Obj b) {
        return b.y + b.amp * (float) Math.sin(2 * Math.PI * t / B + b.phase);
    }
}
