# Generates the launcher icon at every density (run by build.sh)
import os, sys, math
from PIL import Image, ImageDraw, ImageFilter
out = sys.argv[1]
S = 512
im = Image.new('RGBA', (S, S))
d = ImageDraw.Draw(im)
for y in range(S):  # synthwave sky
    t = y / S
    r = int(20 + 230 * t); gg = int(5 + 40 * t); b = int(60 + 80 * (1 - t))
    d.line([(0, y), (S, y)], fill=(r, gg, b, 255))
# sun
sun = Image.new('RGBA', (S, S)); sd = ImageDraw.Draw(sun)
sd.ellipse([96, 60, 416, 380], fill=(255, 200, 40, 255))
for i in range(6):
    y = 230 + i * 26
    sd.rectangle([0, y, S, y + 4 + i * 3], fill=(0, 0, 0, 0))
im.alpha_composite(sun)
# drum
d.ellipse([86, 300, 426, 470], fill=(120, 10, 40, 255))
d.rectangle([86, 300, 426, 385], fill=(255, 45, 85, 255))
d.ellipse([86, 215, 426, 385], fill=(255, 45, 85, 255))
d.ellipse([106, 230, 406, 370], fill=(245, 245, 255, 255))
for k in range(9):
    x = 86 + k * 42.5
    d.line([(x, 300), (x + 10, 420)], fill=(255, 220, 230, 255), width=6)
# sticks
d.line([(130, 80), (300, 300)], fill=(255, 230, 170, 255), width=22)
d.line([(382, 80), (212, 300)], fill=(255, 230, 170, 255), width=22)
d.ellipse([110, 60, 150, 100], fill=(255, 240, 200, 255))
d.ellipse([362, 60, 402, 100], fill=(255, 240, 200, 255))
# rounded mask
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=110, fill=255)
im.putalpha(mask)
for name, px in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)]:
    p = os.path.join(out, 'mipmap-' + name); os.makedirs(p, exist_ok=True)
    im.resize((px, px), Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'))
im.save(os.path.join(out, '..', 'icon_512.png'))
