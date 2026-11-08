package android.graphics;
import java.awt.geom.*;
public class Path { GeneralPath gp=new GeneralPath();
 public void reset(){gp.reset();} public void moveTo(float x,float y){gp.moveTo(x,y);} public void lineTo(float x,float y){gp.lineTo(x,y);}
 public void quadTo(float a,float b,float c,float d){gp.quadTo(a,b,c,d);} public void close(){gp.closePath();} }
