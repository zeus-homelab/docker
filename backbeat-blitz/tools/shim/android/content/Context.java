package android.content;
import java.util.HashMap;
public class Context { public final HashMap<String,Object> m=new HashMap<>();
 public SharedPreferences getSharedPreferences(String n,int mode){ return new SharedPreferences(){
  public int getInt(String k,int d){Object o=m.get(k);return o==null?d:(Integer)o;} public boolean getBoolean(String k,boolean d){Object o=m.get(k);return o==null?d:(Boolean)o;}
  public Editor edit(){return new Editor(){public Editor putInt(String k,int v){m.put(k,v);return this;} public Editor putBoolean(String k,boolean v){m.put(k,v);return this;} public void apply(){}};}};}}
