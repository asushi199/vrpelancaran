"""Cut the Jata Negara emblem out of the JPN Perak logo for the dark VR sky.

Input:  assets/logo-jpn-source.png  (white background, as supplied by JPN)
Output: assets/logo-jata-negara.png (emblem only, transparent background)

The white background becomes transparent, including the gaps enclosed by the
tigers, the crescent and the scroll; only the white panels inside the shield
stay white. The two text lines under the
emblem are not used: the VR scene sets them in a real font, in white, so they
read on the dark sky (see title-card in js/launch.js).

Usage: python tools/make-logo.py   (needs Pillow)
"""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "logo-jpn-source.png"
OUTPUT = ROOT / "assets" / "logo-jata-negara.png"

EMBLEM_ROWS = (80, 432)  # the emblem sits on rows 88-424; the text starts at 456
WHITE = 232  # a pixel whose darkest channel is above this counts as background
FEATHER = 2  # px of soft edge where the emblem meets the background
# White regions entirely inside this box (source image coords) are the shield's
# own white panels and are kept; every other white region is background.
SHIELD = (385, 235, 546, 400)

im = Image.open(SOURCE).convert("RGB")
im = im.crop((0, EMBLEM_ROWS[0], im.width, EMBLEM_ROWS[1]))
W, H = im.size
src = im.load()

# Label every connected white region; all are background except the shield's.
background = [[False] * W for _ in range(H)]
seen = [[False] * W for _ in range(H)]
sx0, sy0, sx1, sy1 = SHIELD[0], SHIELD[1] - EMBLEM_ROWS[0], SHIELD[2], SHIELD[3] - EMBLEM_ROWS[0]
for y in range(H):
    for x in range(W):
        if seen[y][x] or min(src[x, y]) <= WHITE:
            continue
        region = []
        queue = deque([(x, y)])
        seen[y][x] = True
        while queue:
            cx, cy = queue.popleft()
            region.append((cx, cy))
            for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                if 0 <= nx < W and 0 <= ny < H and not seen[ny][nx] and min(src[nx, ny]) > WHITE:
                    seen[ny][nx] = True
                    queue.append((nx, ny))
        xs = [p[0] for p in region]
        ys = [p[1] for p in region]
        inside_shield = min(xs) >= sx0 and max(xs) <= sx1 and min(ys) >= sy0 and max(ys) <= sy1
        if not inside_shield:
            for px_, py_ in region:
                background[py_][px_] = True


def near_background(x, y):
    for dy in range(-FEATHER, FEATHER + 1):
        for dx in range(-FEATHER, FEATHER + 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and background[ny][nx]:
                return True
    return False


out = Image.new("RGBA", (W, H))
dst = out.load()
for y in range(H):
    for x in range(W):
        r, g, b = src[x, y]
        if background[y][x]:
            dst[x, y] = (0, 0, 0, 0)
            continue
        if near_background(x, y):
            # Edge pixels were blended with white: recover coverage and colour,
            # so no white fringe shows against the dark sky.
            alpha = min(1.0, (255 - min(r, g, b)) / (255 - 150))
            if alpha <= 0.02:
                dst[x, y] = (0, 0, 0, 0)
                continue
            unblend = lambda c: max(0, min(255, round((c - 255 * (1 - alpha)) / alpha)))
            dst[x, y] = (unblend(r), unblend(g), unblend(b), round(alpha * 255))
        else:
            dst[x, y] = (r, g, b, 255)

bbox = out.getbbox()
out = out.crop(bbox)
out.save(OUTPUT)
print(f"Wrote {OUTPUT.relative_to(ROOT)} {out.size[0]}x{out.size[1]}")
