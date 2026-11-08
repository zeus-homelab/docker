package android.media;
/** Offline AudioTrack: records everything written so tests can inspect / save it. */
public class AudioTrack { public static final int MODE_STREAM=1; public static java.io.ByteArrayOutputStream rec=new java.io.ByteArrayOutputStream(); long frames; public static volatile long playedFrames;
 public AudioTrack(int a,int b,int c,int d,int e,int f){}
 public static int getMinBufferSize(int a,int b,int c){return 4096;}
 public void play(){} public void pause(){} public void flush(){} public void release(){} 
 public int write(short[] d,int o,int n){ synchronized(rec){ for(int i=0;i<n;i++){rec.write(d[o+i]&0xff); rec.write((d[o+i]>>8)&0xff);} } frames+=n; playedFrames=frames; try{ if(Boolean.getBoolean("rt")) Thread.sleep(0, 1); }catch(Exception e){} while(Boolean.getBoolean("throttle") && frames > (System.nanoTime()-t0)/1e9*44100 + 4096){ try{Thread.sleep(1);}catch(Exception e){} } return n; }
 static long t0=System.nanoTime();
 public int getPlaybackHeadPosition(){return (int)Math.max(0, frames-4096);} public boolean getTimestamp(AudioTimestamp t){return false;} }
