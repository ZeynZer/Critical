"""Génère toutes les icônes PWA depuis assets-src/icon-master.png (1024x1024).
Usage : python3 tools/make-icons.py   (nécessite Pillow : pip install pillow)
Si icon-master.png n'existe pas, une icône provisoire néon est dessinée."""
import math, os
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets-src', 'icon-master.png')

def placeholder(n=1024):
    img = Image.new('RGB', (n, n), (5, 6, 15))
    px = img.load()
    c = n / 2
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - c, y - c) / n
            v = max(0, 1 - d * 1.5)
            px[x, y] = (int(8 + 60 * v * v), int(8 + 20 * v), int(22 + 110 * v))
    glow = Image.new('RGB', (n, n), (0, 0, 0))
    g = ImageDraw.Draw(glow)
    for r, col in [(300, (255, 79, 216)), (230, (170, 120, 255)), (160, (77, 243, 255))]:
        g.ellipse([c - r, c - r, c + r, c + r], outline=col, width=26)
    for a in range(0, 360, 45):
        x2, y2 = c + 330 * math.cos(math.radians(a)), c + 330 * math.sin(math.radians(a))
        g.line([c, c, x2, y2], fill=(255, 194, 71) if a % 90 == 0 else (255, 79, 216), width=18)
    g.ellipse([c - 95, c - 95, c + 95, c + 95], fill=(255, 255, 255))
    blur = glow.filter(ImageFilter.GaussianBlur(34))
    from PIL import ImageChops
    img = ImageChops.add(img, blur)
    img = ImageChops.add(img, glow)
    return img

img = Image.open(SRC).convert('RGB').resize((1024, 1024), Image.LANCZOS) if os.path.exists(SRC) else placeholder()
if not os.path.exists(SRC):
    img.save(SRC)
out = os.path.join(ROOT, 'icons'); os.makedirs(out, exist_ok=True)
for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, name))
# maskable : le sujet reste dans la zone sûre (80 % centraux)
m = Image.new('RGB', (512, 512), img.resize((8, 8)).getpixel((0, 0)))
m.paste(img.resize((410, 410), Image.LANCZOS), (51, 51))
m.save(os.path.join(out, 'icon-maskable-512.png'))
print('icônes générées dans', out)
