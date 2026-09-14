# SAADi Display

`public/fonts/SAADiDisplay-Regular.otf` is an installable OpenType/CFF font.
It contains S, A, D, i, lowercase a, space, and a missing-character glyph.
This is a logo display font, not a complete alphabet.

Version 1.1 redraws S, A, and D as standalone Bezier outlines in the reference's
high-contrast calligraphic style. It removes the neighboring A's extension from
S, restores the first A's continuous left stroke and enclosed counter, and
rebuilds the D foot without the adjacent A's wedge. Both A instances now use
one identical glyph. Advances include narrow spacing rather than overlapping
parts from the original connected logo. The i retains its circular dot.

`docs/saadi-font-specimen.html` displays the actual font as ordinary browser
text, with isolated letters and no WebGL, masking, or decorative connector.

## Editing and rebuilding

- Edit `assets/fonts/saadi-display.glyphs.json` for canonical outlines and advances.
  Outlines use SVG path coordinates, a 70-unit cap height, and downward Y.
- Run `npm run font` to regenerate the OTF and its browser data. This uses the
  existing local Python fontTools installation and existing opentype.js package.
  No new runtime dependency was added.
- Alternatively edit the OTF in a font editor, then run `npm run wordmark`.
  A later `npm run font` overwrites those direct OTF edits from the JSON source.

## 3D and animation

`WordmarkScene.js` loads the generated `saadi.typeface.json` with Three.js's
FontLoader. Each glyph becomes a separate beveled ExtrudeGeometry. The font
stores contours and spacing; the scene owns depth, bevel, materials, pivots,
and the independent coin-shaped dot. The lowercase a reveal also uses the font.
The original timing, D highlight, stars, and other symbol choreography remain.
The A-to-S flourish is a separate named mesh under the word group. It grows
right-to-left at the final spacing and is not included in either font glyph.
The earlier S-region clipping shader is removed.

OpenType is a 2D outline format. These are real 3D meshes generated from a real
font; it is not a special binary “3D font” format. Handwriting reveals and
topology-changing morphs still need authored masks or compatible geometry.
Adding a font does not make arbitrary morphs automatic or artifact-free.

The OTF can also be loaded with CSS `@font-face` using
`url('/fonts/SAADiDisplay-Regular.otf') format('opentype')`.

Version 1.2 smooths the S waist with aligned curve tangents, removing the remaining shoulder at the former join. The lowercase i now has a horizontal stem top and parallel upright sides, centered below its unchanged circular dot.
