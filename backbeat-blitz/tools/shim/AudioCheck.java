package com.backbeat.blitz;
import android.media.AudioTrack;
import java.io.*;
public class AudioCheck {
  public static void main(String[] a) throws Exception {
    Level[] L = Level.all();
    for (int li = 0; li < 3; li++) {
      Audio au = new Audio(); au.start(); Thread.sleep(50);
      synchronized (AudioTrack.rec) { AudioTrack.rec.reset(); }
      au.startSong(L[li], 0);
      while (true) { Thread.sleep(50); synchronized (AudioTrack.rec) { if (AudioTrack.rec.size() > (L[li].endStep * L[li].stepSec() + 2) * 44100 * 2) break; } }
      au.stop();
      byte[] b; synchronized (AudioTrack.rec) { b = AudioTrack.rec.toByteArray(); }
      int n = b.length / 2; double sum = 0; int peak = 0, hot = 0;
      for (int i = 0; i < n; i++) { int s = (short) ((b[2*i] & 0xff) | (b[2*i+1] << 8)); sum += (double) s * s; peak = Math.max(peak, Math.abs(s)); if (Math.abs(s) > 29000) hot++; }
      System.out.printf("%s: %.1fs rms=%.0f (%.1f dBFS) peak=%d hot=%.3f%%%n", L[li].name, n / 44100.0, Math.sqrt(sum / n), 20 * Math.log10(Math.sqrt(sum / n) / 32768), peak, 100.0 * hot / n);
      if (li == 0) try (FileOutputStream f = new FileOutputStream(a[0])) { wav(f, b); }
    }
    System.exit(0);
  }
  static void wav(OutputStream o, byte[] d) throws IOException {
    DataOutputStream w = new DataOutputStream(o);
    w.writeBytes("RIFF"); w.writeInt(Integer.reverseBytes(36 + d.length)); w.writeBytes("WAVEfmt ");
    w.writeInt(Integer.reverseBytes(16)); w.writeShort(Short.reverseBytes((short) 1)); w.writeShort(Short.reverseBytes((short) 1));
    w.writeInt(Integer.reverseBytes(44100)); w.writeInt(Integer.reverseBytes(88200)); w.writeShort(Short.reverseBytes((short) 2)); w.writeShort(Short.reverseBytes((short) 16));
    w.writeBytes("data"); w.writeInt(Integer.reverseBytes(d.length)); w.write(d);
  }
}
