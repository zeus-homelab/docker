import com.backbeat.blitz.Level;
import com.backbeat.blitz.Sim;

import java.util.HashSet;

/** Brute-force bot: proves every level (and every practice checkpoint) can be beaten. */
public class Solver {
    static HashSet<Long> seen;
    static float best;
    static int K;
    static long nodes;

    public static void main(String[] a) throws Exception {
        final int k = a.length > 0 ? Integer.parseInt(a[0]) : 8;
        Thread t = new Thread(null, new Runnable() {
            public void run() {
                boolean ok = true;
                for (Level lv : Level.all()) {
                    Sim base = new Sim(lv);
                    for (int c = 0; c < lv.cpStep.length; c++) {
                        Sim s = base.copy();
                        s.reset(lv.cpStep[c], lv.cpMode[c]);
                        K = k;
                        seen = new HashSet<Long>();
                        best = 0;
                        nodes = 0;
                        boolean r = dfs(s, false);
                        System.out.printf("%-16s cp%d (x=%4d) %s  reached x=%.1f / %d  nodes=%d%n",
                                lv.name, c, lv.cpStep[c], r ? "OK  " : "FAIL", best, lv.endStep - 8, nodes);
                        ok &= r;
                    }
                    System.out.println("  notes=" + lv.totalNotes + " bars=" + (lv.endStep / 16)
                            + " length=" + (int) (lv.endStep * lv.stepSec()) + "s");
                }
                System.exit(ok ? 0 : 1);
            }
        }, "solver", 1L << 30);
        t.start();
        t.join();
    }

    static boolean dfs(Sim s, boolean last) {
        nodes++;
        long key = ((long) (s.t * 240.0 / K)) & 0xFFFF;
        key = (key << 10) | (Math.round(s.y * 16) & 0x3FF);
        key = (key << 10) | ((Math.round(s.vy * 2) + 512) & 0x3FF);
        key = (key << 2) | s.mode;
        key = (key << 3) | (s.grav > 0 ? 4 : 0) | (s.held ? 2 : 0) | (s.buffered ? 1 : 0);
        key = (key << 12) | (s.usedCount & 0xFFF);
        if (!seen.add(key)) return false;
        if (s.px > best) best = s.px;
        boolean[] order = last ? new boolean[] {true, false} : new boolean[] {false, true};
        for (boolean p : order) {
            Sim n = s.copy();
            for (int i = 0; i < K; i++) {
                n.step(p);
                if (n.dead || n.finished) break;
            }
            if (n.finished) return true;
            if (!n.dead && dfs(n, p)) return true;
        }
        return false;
    }
}
