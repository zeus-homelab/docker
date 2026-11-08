package android.view;
public class SurfaceView { public SurfaceView(android.content.Context c){} public void setFocusable(boolean b){}
 public SurfaceHolder getHolder(){ return new SurfaceHolder(){ public void addCallback(Callback c){} public Surface getSurface(){return new Surface();} public android.graphics.Canvas lockCanvas(){return null;} public void unlockCanvasAndPost(android.graphics.Canvas c){} }; }
 public boolean onTouchEvent(MotionEvent e){return false;} }
