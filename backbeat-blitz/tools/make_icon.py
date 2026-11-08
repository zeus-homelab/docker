"""Draws the launcher icon (a snare drum with crossed sticks) at every density."""
import sys
from PIL import Image, ImageDraw

def icon(n):
    S = 4 * n
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.22, fill=(32, 10, 58, 255))
    d.ellipse([S*.08, S*.08, S*.92, S*.92], fill=(70, 20, 95, 255))
    # sticks
    w = int(S * 0.06)
    d.line([S*.2, S*.12, S*.62, S*.46], fill=(232, 196, 138, 255), width=w)
    d.line([S*.8, S*.12, S*.38, S*.46], fill=(232, 196, 138, 255), width=w)
    d.ellipse([S*.15, S*.07, S*.25, S*.17], fill=(240, 221, 176, 255))
    d.ellipse([S*.75, S*.07, S*.85, S*.17], fill=(240, 221, 176, 255))
    # shell
    d.rounded_rectangle([S*.2, S*.45, S*.8, S*.8], radius=S*.04, fill=(215, 38, 61, 255))
    pts = []
    for k in range(7):
        x = S*.22 + k * (S*.56/6)
        y = S*.5 if k % 2 == 0 else S*.75
        pts.append((x, y))
    d.line(pts, fill=(255, 244, 224, 255), width=int(S*.025))
    d.ellipse([S*.18, S*.36, S*.82, S*.52], fill=(201, 203, 214, 255))
    d.ellipse([S*.23, S*.385, S*.77, S*.495], fill=(246, 241, 231, 255))
    d.rounded_rectangle([S*.19, S*.77, S*.81, S*.83], radius=S*.02, fill=(201, 203, 214, 255))
    # eyes
    for ex in (0.4, 0.6):
        d.ellipse([S*(ex-.05), S*.56, S*(ex+.05), S*.66], fill=(255, 255, 255, 255))
        d.ellipse([S*(ex-.02), S*.59, S*(ex+.035), S*.645], fill=(21, 16, 31, 255))
    return im.resize((n, n), Image.LANCZOS)

out = sys.argv[1]
for name, n in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    icon(n).save(f"{out}/mipmap-{name}/ic_launcher.png")
icon(512).save(f"{out}/../icon-512.png")
