# Signature sequence

Reference: `Screen Recording 2026-09-12 223237.mp4`, 1916 × 894,
30 fps, 126 frames / 4.2 seconds. Every frame was decoded with FFmpeg and
inspected in consecutive contact sheets. The initial blank recording is not
part of the hero choreography. The first plain `mini` pose is at 1.30 s.

The loader reveals the original, stationary SAADi. The sequence clock starts
after the 1.10-second star aperture finishes. Supporting text retains its
existing loader-completion timing.

The table below uses the internal choreography clock, not wall time. Playback remaps it to 3.69 seconds, with satin and gloss studies (.34 and .38 seconds). The replay button starts immediately; the initial run waits for the loader aperture.

| Choreography clock | SAADi interpretation |
| --- | --- |
| 0–0.10 s | Plain original word, stationary |
| 0.10 s | D → wine `</>` |
| 0.133 s | First A → slate slash, closing behind S |
| 0.20 s | Second A → dusty rose `{}`; final i → plum `>_` |
| 0.233 s | S → rounded script form with pearl finish |
| 0.367 s | Simultaneous polished rose metal S, original first A, D → three rose lines and moving caret |
| 0.50–0.73 s | Gloss returns to satin, then wireframe and original S beneath; second A returns through an outline |
| 0.567–0.90 s | Terminal unfolds into a waving pirate flag |
| 0.60 s | First A changes to DM Serif Display |
| 0.73 s | Caret finishes as flag is approximately half open; D returns with a subtle surface highlight |
| 0.84–1.34 s | Three metallic beveled stars rise and turn above D; surface highlight fades |
| 1.25–1.66 s | D's tiny lift settles, first A restores, stars return behind the top rim |
| 1.63–1.83 s | Flag folds into the undotted i-stem |
| 1.86–2.80 s | Separate round coin dot rises, falls and makes a tiny final rebound |
| 2.90 s | Original SAADi, exact original transforms and equal gaps, rendering idle |

The reference's final whole-layout rise was deliberately removed following
the user's explicit no-jumping/no-stagger instruction. All main letter Y
positions remain fixed, apart from D's requested 1.5-unit lift (2.1% of cap
height). Only symbol widths reflow horizontally and the final dot bounces.
The S overlaps the slash in depth during the slash beat. Final gaps are
measured between the turned, bevelled glyph bounds: 1.54 font units.

`SignatureSequence.js` owns the one-shot choreography and its temporary
geometry. The existing Aminute and DM Serif assets supply vector outlines;
there is no runtime font parser. S is a custom flattened cast profile, with MeshPhysicalMaterial, fine
longitudinal brushing, clearcoat, anisotropy and four controlled studio
reflection cards. Satin titanium transitions into polished rose metal. The
symbols, surface highlight and metallic stars derive their colors from the brand tokens
and respond to color-scheme changes. The flag is a subdivided waving mesh with a drawn skull emblem.
These recreate the reference's roles; they are not the source font/texture
assets. No new dependency, cast shadow, persistent glow or permanent font
change was introduced. Reduced motion skips every transformation.

## Browser verification

Chromium: desktop 1440×900, mobile 320×568, dark 390×844, reduced motion,
and a fresh page reload. Instrumentation recorded all nine phases in order,
no body Y movement except the requested tiny D shift, unit letter/dot scales,
and the original SAADi lockup at completion. The desktop animation sample
recorded 173 active rAF frames, median 16.6 ms, maximum 17.8 ms between frames.
No interval exceeded 50 ms. These are local browser measurements, not a
guarantee of performance on every GPU or phone.

Stage screenshots were compared against the reference. Issues found and
fixed: a narrowed second-A slot overlapped its returning outline, the D
halo was offset from its silhouette, and the terminal needed its wider slot
before its first visible frame. A mid-sequence portrait-to-landscape resize
also completed correctly. The final four gaps are approximately
14.71 px at 1440×900 and 4.36 px at 320×568. No browser console errors or
horizontal page overflow were observed. Production build passes with the
existing Vite bundle-size warning.

The spacing refinement packs actual visible geometry during every symbol
change; the highlight/stars do not reserve empty letter slots. An 88-frame sweep
on desktop, mobile and dark layouts found no unintended silhouette
collisions. The intentional S/slash overlap remains. Reduced motion and
refresh replay were rechecked after the material and spacing refinements.


Hero refinement: the resting word now uses Manrope ExtraBold, generated at a 70-unit cap height with `npm run wordmark`. `assets/fonts/Manrope-ExtraBold.ttf` is the weight-800 instance of the self-hosted variable font (OFL in `public/fonts/manrope-OFL.txt`). The sculpted S has continuously changing thickness and closed tapered terminals. Its original form is recovered with a directional shader reveal, rather than a whole-letter opacity crossfade. A precomputed, symmetrically filtered layout track smooths horizontal cuts; the five letter groups remain at unit scale throughout. The extra approach/contact sections have been removed.


Typography-only pass: the resting SAADi now uses custom serif outlines in `assets/fonts/logo-wordmark.json`, drawn from the monogram’s tall proportions, thin left strokes, heavy bowls, and bracketed feet. This is a logo-inspired extension to D and lowercase i, not an identified commercial font. `npm run wordmark` regenerates these outlines by default; `WORDMARK_FONT` still supports a font override. Extrusion is 5 units with a .16-unit bevel to retain the hairlines. Choreography and timing are unchanged.


Reference match: `ChatGPT Image Sep 13, 2026, 10_18_48 PM.png` is now the source of the resting outline. `scripts/trace-wordmark.py` converts its alpha silhouette to simplified SVG paths (1.2 source-pixel tolerance), retaining original glyph origins and shared joins. The traced paths are checked in, so tracing libraries are not runtime dependencies. Both As retain the supplied crossbar shapes; the S retains its separate curled terminal. The word faces the camera to preserve these joins. The i-dot remains an independent round coin, as required, rather than reproducing the reference’s slightly oval raster dot.

First A refinement: the former DM Serif substitution is removed. The slash opens into a custom lowercase a (.30-.49 on the choreography clock), holds through 1.02, and reshapes into the uppercase form through 1.52, when the exact traced A resumes. Morph contours are sampled and prebuilt once, including a closed-counter intermediate construction to avoid self-intersections; letter-group scale stays at one. Other letter timings are unchanged.

Handwriting correction: the first A contour morph is removed. Slash, lowercase a, and the exact traced uppercase A now use static extruded geometry with stroke-time shader masks. The lowercase bowl writes first, followed by the downstroke; the capital writes its ascending stroke, descending stroke and curved crossbar. The lowercase strokes clear as the capital is written. No brush/cursor is shown, and no scale or vertex animation is used for this conversion.

Continuous-ink correction: stroke-time masks are replaced by growing calligraphic ribbon geometry. Width varies along each stroke; rounded leading edges and shared endpoints keep strokes continuous. The first A extrusion is completely hidden during writing, and resumes only after the full capital is drawn. The lowercase a and capital are hand-built stroke paths in the wordmark style, then the exact traced capital takes over. There is no brush object, clipping through side faces, or letter scaling.

Confirmed filled-letter approach: substitute calligraphic ribbons are removed. The lowercase filled outline and the exact original uppercase front-face triangles stay fixed while invisible cumulative coverage reveals them in handwriting order. Only original letter pixels can appear; the coverage cannot change the outline. Extruded side faces stay hidden until completion. The trace now assigns a detached S fragment back to S, preserving the assembled word but eliminating the fragment from the moving A.

D correction: the detached i components are segmented separately so the D curve is no longer sliced at the old x=1520 boundary. The highlight changes only the original D surface. Stars retain their original broad four-point geometry, brand-tinted metallic materials, and rise/rotate/return timing. They clip below the top rim to avoid showing through the counter.

A-to-S connector: the S flourish is masked from the initial frame. The A crossbar writes right-to-left; after the letter spacing settles at 1.83, the original connecting outline reveals from the A end back into S through 2.15. No letter scaling or substitute stroke geometry is used. Reduced-motion mode displays the completed lockup.

Standalone-glyph correction: S, A and D are redrawn as closed Bezier font contours, removing all remnants of the old logo joins. The S mask is deleted; a separate A-to-S flourish mesh handles the final connection. Both A instances use the same glyph. Native-font and WebGL specimens check the unmasked contours independently.
