package com.backbeat.blitz;

import android.content.Context;
import android.graphics.Canvas;
import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.*;
import java.util.*;
import javax.imageio.ImageIO;

public class Shots {
    static String out;
    static Field f(String n) throws Exception { Field x = GameView.class.getDeclaredField(n); x.setAccessible(true); return x; }
    static void set(Object o, String n, Object v) throws Exception { f(n).set(o, v); }
    static Object get(Object o, String n) throws Exception { return f(n).get(o); }
    static Object call(Object o, String n, Object... a) throws Exception {
        for (Method m : GameView.class.getDeclaredMethods()) if (m.getName().equals(n) && m.getParameterCount() == a.length) { m.setAccessible(true); return m.invoke(o, a); }
        throw new RuntimeException(n);
    }
    static void shot(GameView v, String name) throws Exception {
        BufferedImage im = new BufferedImage(2400, 1080, BufferedImage.TYPE_INT_ARGB);
        java.awt.Graphics2D g = im.createGraphics();
        call(v, "draw2", new Canvas(g));
        g.dispose();
        BufferedImage half = new BufferedImage(1200, 540, BufferedImage.TYPE_INT_RGB);
        java.awt.Graphics2D g2 = half.createGraphics();
        g2.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g2.drawImage(im, 0, 0, 1200, 540, null);
        g2.dispose();
        ImageIO.write(half, "png", new File(out, name + ".png"));
    }

    static ArrayList<Boolean> path;
    static HashSet<Long> seen;
    static final int K = 8;
    static boolean dfs(Sim s, boolean last) {
        long key = ((long) (s.t * 240.0 / K)) & 0xFFFF;
        key = (key << 10) | (Math.round(s.y * 16) & 0x3FF);
        key = (key << 10) | ((Math.round(s.vy * 2) + 512) & 0x3FF);
        key = (key << 2) | s.mode;
        key = (key << 5) | (s.grav > 0 ? 16 : 0) | (s.held ? 8 : 0) | (s.buffered ? 4 : 0)
                | (s.bufT > 0 ? 2 : 0) | (s.coyote > 0 ? 1 : 0);
        key = (key << 12) | (s.usedCount & 0xFFF);
        if (!seen.add(key)) return false;
        for (boolean p : last ? new boolean[]{true, false} : new boolean[]{false, true}) {
            Sim n = s.copy();
            for (int i = 0; i < K; i++) { n.step(p); n.evN = 0; if (n.dead || n.finished) break; }
            path.add(p);
            if (n.finished) return true;
            if (!n.dead && dfs(n, p)) return true;
            path.remove(path.size() - 1);
        }
        return false;
    }

    public static void main(String[] a) throws Exception {
        out = a[0];
        int lvl = Integer.parseInt(a[1]);
        GameView v = new GameView(new Context());
        v.surfaceChanged(null, 0, 2400, 1080);
        if (lvl == 0) {
            Thread.sleep(300);
            call(v, "update", 0.016f);
            shot(v, "01_title");
            set(v, "state", 1);
            shot(v, "02_select");
            set(v, "page", 1);
            shot(v, "03_select_p2");
            set(v, "page", 0);
        }
        call(v, "startLevel", lvl);
        Sim sim = (Sim) get(v, "sim");
        Level lv = sim.lv;
        // find a winning input sequence and replay it through the real game handlers
        Sim probe = new Sim(lv);
        path = new ArrayList<>(); seen = new HashSet<>();
        Thread t = new Thread(null, () -> { if (!dfs(probe, false)) throw new RuntimeException("unsolvable"); }, "s", 1L << 30);
        t.start(); t.join();
        System.out.println("path decisions " + path.size());
        int[] shotSteps = a.length > 2 ? Arrays.stream(a[2].split(",")).mapToInt(Integer::parseInt).toArray() : new int[0];
        int si = 0, frame = 0;
        for (int d = 0; d < path.size(); d++) {
            for (int i = 0; i < K; i++) {
                sim.step(path.get(d));
                call(v, "handleEvents");
                if (sim.dead) throw new RuntimeException("died at " + sim.px);
                if (sim.finished) { call(v, "finish"); break; }
                if (++frame % 4 == 0) {
                    call(v, "updateParticles", 1f / 60);
                    set(v, "songT", sim.t);
                    // emulate update()'s visual bits
                    set(v, "pressed", path.get(d));
                }
                if (si < shotSteps.length && sim.px >= shotSteps[si]) {
                    set(v, "songT", sim.t);
                    float ceil = sim.mode != Sim.DRUM ? 1f : 0f;
                    set(v, "ceilA", ceil);
                    shot(v, String.format("L%d_%04d", lvl, shotSteps[si]));
                    si++;
                }
            }
            if (sim.finished) break;
        }
        System.out.println("finished=" + sim.finished + " notes=" + get(v, "notesGot") + "/" + lv.totalNotes + " score=" + get(v, "score") + " maxCombo=" + get(v, "maxCombo"));
        if (lvl == 0) {
            set(v, "paused", true);
            shot(v, "09_pause");
            set(v, "paused", false);
            set(v, "state", 3);
            set(v, "doneT", 1.0f);
            shot(v, "10_done");
        }
        System.exit(0);
    }
}
