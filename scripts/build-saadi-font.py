"""Build the editable logo glyphs into a real OpenType/CFF display font.
Offline build dependency: fontTools (already installed); no browser dependency.
"""
import json
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'assets/fonts/saadi-display.glyphs.json').read_text())
scale = 1000 / source['capHeight']
glyphs = [dict(name='.notdef', path='M0 0 L0 -60 L40 -60 L40 0 Z M5 -5 L35 -5 L35 -55 L5 -55 Z', advance=45),
          dict(name='space', unicode=32, path='', advance=22)] + source['glyphs']
builder = FontBuilder(1000, isTTF=False)
builder.setupGlyphOrder([g['name'] for g in glyphs])
builder.setupCharacterMap({g['unicode']: g['name'] for g in glyphs if 'unicode' in g})
charstrings, metrics = {}, {}
for glyph in glyphs:
    width = round(glyph['advance'] * scale)
    pen = T2CharStringPen(width, None)
    parse_path(glyph['path'], TransformPen(pen, (scale, 0, 0, -scale, 0, 0)))
    charstrings[glyph['name']] = pen.getCharString()
    metrics[glyph['name']] = (width, 0)
builder.setupCFF('SAADiDisplay-Regular', dict(FullName='SAADi Display Regular', FamilyName='SAADi Display', Weight='Regular'), charstrings, {})
builder.setupHorizontalMetrics(metrics)
builder.setupHorizontalHeader(ascent=1050, descent=-200)
builder.setupNameTable(dict(familyName='SAADi Display', styleName='Regular', uniqueFontIdentifier='SAADiDisplay-Regular-1.4', fullName='SAADi Display Regular', psName='SAADiDisplay-Regular', version='Version 1.4'))
builder.setupOS2(sTypoAscender=1050, sTypoDescender=-200, usWinAscent=1050, usWinDescent=200, sCapHeight=1000, sxHeight=660)
builder.setupPost()
output = ROOT / 'public/fonts/SAADiDisplay-Regular.otf'
output.parent.mkdir(parents=True, exist_ok=True)
builder.save(output)
print(f'Built {output} ({len(glyphs)} glyphs)')
