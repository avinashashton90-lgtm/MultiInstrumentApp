#!/usr/bin/env python3
"""Makes the Android launcher icons (adaptive + legacy) and splash images from icon-512.png.
Run once after changing the icon: python3 tools/make-android-icons.py  (needs Pillow). The results are committed."""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
BG = (29, 42, 42, 255)          # the icon's own dark green (#1d2a2a)
SPLASH_BG = (239, 233, 220, 255)  # manifest background_color (#efe9dc)
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

src = Image.open(os.path.join(ROOT, 'icon-512.png')).convert('RGBA')
# The keyboard glyph alone, on a transparent background, for the adaptive foreground layer
glyph = Image.new('RGBA', src.size, (0, 0, 0, 0))
px, gp = src.load(), glyph.load()
for y in range(src.height):
    for x in range(src.width):
        r, g, b, a = px[x, y]
        if abs(r - BG[0]) + abs(g - BG[1]) + abs(b - BG[2]) > 24:
            gp[x, y] = (r, g, b, a)
glyph = glyph.crop(glyph.getbbox())

def fit(img, box):
    s = min(box / img.width, box / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)

def centre(canvas, img):
    canvas.alpha_composite(img, ((canvas.width - img.width) // 2, (canvas.height - img.height) // 2))
    return canvas

for d, k in DENS.items():
    out = os.path.join(RES, 'mipmap-' + d)
    os.makedirs(out, exist_ok=True)
    # Adaptive foreground: 108 dp canvas, glyph inside the 66 dp safe circle (about 48 dp wide)
    fg = round(108 * k)
    centre(Image.new('RGBA', (fg, fg), (0, 0, 0, 0)), fit(glyph, round(48 * k))).save(os.path.join(out, 'ic_launcher_foreground.png'))
    # Legacy square and round icons: 48 dp
    n = round(48 * k)
    sq = src.resize((n, n), Image.LANCZOS)
    sq.save(os.path.join(out, 'ic_launcher.png'))
    mask = Image.new('L', (n * 4, n * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, n * 4 - 1, n * 4 - 1), fill=255)
    rd = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    rd.paste(sq, (0, 0), mask.resize((n, n), Image.LANCZOS))
    rd.save(os.path.join(out, 'ic_launcher_round.png'))

# Splash for Android 11 and older (Android 12+ draws its own from the theme): icon centred on the app background
for orient, (w, h) in {'land': (480, 320), 'port': (320, 480)}.items():
    for d, k in DENS.items():
        out = os.path.join(RES, 'drawable-%s-%s' % (orient, d))
        os.makedirs(out, exist_ok=True)
        W, H = round(w * k), round(h * k)
        centre(Image.new('RGBA', (W, H), SPLASH_BG), fit(src, round(120 * k))).convert('RGB').save(os.path.join(out, 'splash.png'))
centre(Image.new('RGBA', (480, 480), SPLASH_BG), fit(src, 120)).convert('RGB').save(os.path.join(RES, 'drawable', 'splash.png'))
print('android icons and splash written')
