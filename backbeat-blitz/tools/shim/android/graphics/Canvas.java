package android.graphics;
import java.awt.*; import java.awt.geom.*; import java.util.ArrayDeque;
public class Canvas {
  public final Graphics2D g; ArrayDeque<AffineTransform> st=new ArrayDeque<>();
  public Canvas(Graphics2D g){this.g=g; g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,RenderingHints.VALUE_ANTIALIAS_ON); g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,RenderingHints.VALUE_TEXT_ANTIALIAS_ON);}
  public int save(){st.push(g.getTransform()); return st.size();}
  public void restore(){g.setTransform(st.pop());}
  public void translate(float x,float y){g.translate(x,y);}
  public void rotate(float d){g.rotate(Math.toRadians(d));}
  public void scale(float x,float y){g.scale(x,y);}
  void paint(Shape s, Paint p){ p.apply(g); if(p.style!=Paint.Style.STROKE) g.fill(s); if(p.style!=Paint.Style.FILL) g.draw(s);}
  public void drawRect(float l,float t,float r,float b,Paint p){paint(new Rectangle2D.Float(Math.min(l,r),Math.min(t,b),Math.abs(r-l),Math.abs(b-t)),p);}
  public void drawRect(RectF r,Paint p){drawRect(r.left,r.top,r.right,r.bottom,p);}
  public void drawRoundRect(RectF r,float rx,float ry,Paint p){paint(new RoundRectangle2D.Float(r.left,r.top,r.width(),r.height(),rx*2,ry*2),p);}
  public void drawOval(RectF r,Paint p){paint(new Ellipse2D.Float(r.left,r.top,r.width(),r.height()),p);}
  public void drawCircle(float x,float y,float r,Paint p){paint(new Ellipse2D.Float(x-r,y-r,2*r,2*r),p);}
  public void drawLine(float a,float b,float c,float d,Paint p){p.apply(g); g.draw(new Line2D.Float(a,b,c,d));}
  public void drawPath(Path pa,Paint p){paint(pa.gp,p);}
  public void drawArc(RectF r,float s,float sw,boolean uc,Paint p){paint(new Arc2D.Float(r.left,r.top,r.width(),r.height(),-s,-sw,uc?Arc2D.PIE:Arc2D.OPEN),p);}
  public void drawText(String s,float x,float y,Paint p){ p.apply(g); Font f=p.font(); g.setFont(f); float w=(float)f.getStringBounds(s,g.getFontRenderContext()).getWidth();
    if(p.align==Paint.Align.CENTER)x-=w/2; else if(p.align==Paint.Align.RIGHT)x-=w;
    if(p.style==Paint.Style.FILL) g.drawString(s,x,y); else { Shape o=f.createGlyphVector(g.getFontRenderContext(),s).getOutline(x,y); g.draw(o);} }
}
