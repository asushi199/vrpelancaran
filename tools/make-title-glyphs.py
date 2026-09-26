"""Export the outlines of the 3D title letters for the VR scene.

Takes Kaushan Script (SIL OFL, assets/fonts) - a brush script close to the
lettering on the book cover - and writes the glyph outlines for "Jejak Impak"
to assets/fonts/title-glyphs.json. The scene extrudes them into gold 3D
letters (title-card in js/launch.js). A variable font can be used too: it is
instanced at WEIGHT first.

JSON: { unitsPerEm, capHeight, glyphs: { "J": { advance, commands: [...] } } }
where each command is ["M", x, y] | ["L", x, y] | ["Q", cx, cy, x, y] |
["C", c1x, c1y, c2x, c2y, x, y] | ["Z"], in font units, y up.

Usage: python tools/make-title-glyphs.py   (needs fontTools and skia-pathops)
"""
import json
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.varLib.instancer import OverlapMode, instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "fonts" / "KaushanScript-Regular.ttf"
OUTPUT = ROOT / "assets" / "fonts" / "title-glyphs.json"
TEXT = "Jejak Impak"
WEIGHT = 700  # only used for variable fonts


class CommandPen(BasePen):
    def __init__(self, glyph_set):
        super().__init__(glyph_set)
        self.commands = []

    def _moveTo(self, p):
        self.commands.append(["M", *p])

    def _lineTo(self, p):
        self.commands.append(["L", *p])

    def _qCurveToOne(self, p1, p2):
        self.commands.append(["Q", *p1, *p2])

    def _curveToOne(self, p1, p2, p3):
        self.commands.append(["C", *p1, *p2, *p3])

    def _closePath(self):
        self.commands.append(["Z"])


# Merge overlapping contours (needs skia-pathops), so each letter extrudes as
# one clean solid without seams where strokes overlap.
font = TTFont(SOURCE)
if "fvar" in font:
    font = instantiateVariableFont(font, {"wght": WEIGHT}, overlap=OverlapMode.REMOVE)
else:
    removeOverlaps(font)
glyph_set = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]

glyphs = {}
for char in sorted(set(TEXT)):
    name = cmap[ord(char)]
    pen = CommandPen(glyph_set)
    glyph_set[name].draw(pen)
    glyphs[char] = {
        "advance": hmtx[name][0],
        "commands": [[c[0], *[round(v, 1) for v in c[1:]]] for c in pen.commands],
    }

data = {
    "unitsPerEm": font["head"].unitsPerEm,
    "capHeight": getattr(font["OS/2"], "sCapHeight", 0) or font["hhea"].ascent,
    "glyphs": glyphs,
}
OUTPUT.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(glyphs)} glyphs, capHeight {data['capHeight']}/{data['unitsPerEm']}")
