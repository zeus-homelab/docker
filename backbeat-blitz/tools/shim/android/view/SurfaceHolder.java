package android.view;
public interface SurfaceHolder { void addCallback(Callback c); Surface getSurface(); android.graphics.Canvas lockCanvas(); void unlockCanvasAndPost(android.graphics.Canvas c);
 interface Callback { void surfaceCreated(SurfaceHolder h); void surfaceChanged(SurfaceHolder h,int f,int w,int hh); void surfaceDestroyed(SurfaceHolder h);} }
