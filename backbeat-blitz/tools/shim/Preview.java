package com.backbeat.blitz;

import android.media.AudioTrack;
import java.io.*;

/** Renders a short clip of every song (from 4 bars before the first portal) to raw 16-bit PCM. */
public class Preview {
    public static void main(String[] a) throws Exception {
        float secs = Float.parseFloat(a[1]);
        Level[] L = Level.all();
        int[] order = {3, 8, 0, 10, 4, 1, 9, 6, 2, 7, 5};
        try (FileOutputStream out = new FileOutputStream(a[0])) {
            for (int li : order) {
                Level lv = L[li];
                Audio au = new Audio();
                au.start();
                au.startSong(lv, 0); // warm the song's notes first so no silence is recorded
                au.stopSong();
                Thread.sleep(50);
                synchronized (AudioTrack.rec) { AudioTrack.rec.reset(); }
                au.startSong(lv, Math.max(32, lv.sections[1].startStep - 64));
                int need = (int) ((secs + 1) * 44100 * 2);
                while (true) { Thread.sleep(20); synchronized (AudioTrack.rec) { if (AudioTrack.rec.size() > need * 2) break; } }
                au.stop();
                byte[] b;
                synchronized (AudioTrack.rec) { b = AudioTrack.rec.toByteArray(); }
                int st = 0;
                while (st + 1 < b.length && b[st] == 0 && b[st + 1] == 0) st += 2;
                int len = (int) (secs * 44100) * 2;
                byte[] clip = new byte[len];
                System.arraycopy(b, st, clip, 0, Math.min(len, b.length - st));
                for (int i = 0; i < 44100; i++) { // 1 s fade out
                    int k = len - 2 * 44100 + 2 * i;
                    short v = (short) ((clip[k] & 0xff) | (clip[k + 1] << 8));
                    v = (short) (v * (1 - i / 44100f));
                    clip[k] = (byte) v;
                    clip[k + 1] = (byte) (v >> 8);
                }
                out.write(clip);
                out.write(new byte[44100]); // half a second of silence
                System.out.println(lv.name);
            }
        }
        System.exit(0);
    }
}
