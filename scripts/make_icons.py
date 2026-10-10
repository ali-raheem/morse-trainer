#!/usr/bin/env python3
"""Draw the app icons (icon.svg plus the PNG sizes): "–·–·" (C, for CW) in brass on
near-black. Pillow only."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent / 'icons'
BG = (11, 10, 8)
BRASS = (255, 200, 97)
# (x, width) of each element across a 0..1 line: dah dit dah dit
ELEMENTS = [(0.06, 0.27), (0.39, 0.09), (0.54, 0.27), (0.87, 0.09)]


def bars(s, inset):
    m = s * inset
    w = s - 2 * m
    h = w * 0.11
    y = m + w * 0.5 - h / 2
    return [(m + x * w, y, m + (x + bw) * w, y + h) for x, bw in ELEMENTS], h


def png(size, inset, rounded):
    s = size * 4
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=s * 0.22, fill=BG)
    else:
        d.rectangle((0, 0, s, s), fill=BG)
    rects, h = bars(s, inset + 0.06)
    for r in rects:
        d.rounded_rectangle(r, radius=h / 2, fill=BRASS)
    return img.resize((size, size), Image.LANCZOS)


def svg():
    s = 512
    rects, h = bars(s, 0.06)
    body = ''.join(f'<rect x="{a:.1f}" y="{b:.1f}" width="{c - a:.1f}" height="{e - b:.1f}" rx="{h / 2:.1f}" fill="rgb{BRASS}"/>' for a, b, c, e in rects)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}">'
            f'<rect width="{s}" height="{s}" rx="{s * 0.22:.0f}" fill="rgb{BG}"/>{body}</svg>\n')


ROOT.mkdir(exist_ok=True)
(ROOT / 'icon.svg').write_text(svg())
png(192, 0.0, True).save(ROOT / 'icon-192.png')
png(512, 0.0, True).save(ROOT / 'icon-512.png')
png(512, 0.12, False).save(ROOT / 'icon-maskable-512.png')
png(180, 0.04, False).convert('RGB').save(ROOT / 'apple-touch-icon.png')
print('wrote', ', '.join(sorted(p.name for p in ROOT.iterdir())))
