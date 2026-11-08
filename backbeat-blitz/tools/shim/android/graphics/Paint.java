package android.graphics;
import java.awt.*;
public class Paint {
  public static final int ANTI_ALIAS_FLAG=1;
  public enum Style{FILL,STROKE,FILL_AND_STROKE} public enum Cap{BUTT,ROUND,SQUARE} public enum Join{MITER,ROUND,BEVEL} public enum Align{LEFT,CENTER,RIGHT}
  int color=0xFF000000; Style style=Style.FILL; float sw=1; Cap cap=Cap.BUTT; Join join=Join.MITER; float ts=12; Align align=Align.LEFT; Shader shader;
  public Paint(){} public Paint(int f){}
  public void setColor(int c){color=c;} public void setStyle(Style s){style=s;} public void setStrokeWidth(float w){sw=w;}
  public void setStrokeCap(Cap c){cap=c;} public void setStrokeJoin(Join j){join=j;} public void setTextSize(float s){ts=s;} public void setTextAlign(Align a){align=a;}
  public Typeface setTypeface(Typeface t){return t;} public Shader setShader(Shader s){shader=s;return s;}
  Font font(){return new Font("DejaVu Sans",Font.BOLD,Math.max(1,Math.round(ts)));}
  public float measureText(String s){ return (float)font().getStringBounds(s,new java.awt.font.FontRenderContext(null,true,true)).getWidth();}
  void apply(Graphics2D g){ if(shader instanceof LinearGradient){LinearGradient l=(LinearGradient)shader; g.setPaint(new GradientPaint(l.x0,l.y0,new Color(l.c0,true),l.x1,l.y1,new Color(l.c1,true)));} else g.setColor(new Color(color,true));
    g.setStroke(new BasicStroke(sw, cap==Cap.ROUND?BasicStroke.CAP_ROUND:cap==Cap.SQUARE?BasicStroke.CAP_SQUARE:BasicStroke.CAP_BUTT, join==Join.ROUND?BasicStroke.JOIN_ROUND:join==Join.BEVEL?BasicStroke.JOIN_BEVEL:BasicStroke.JOIN_MITER)); }
}
