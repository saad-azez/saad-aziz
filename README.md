# Saad Aziz — portfolio

**Current state: the hero alone, one screen, to Saad's own layout.** The time
in Karachi, centred on a hairline at the top. SAADi in the middle — cut in 3D
from Aminute. A hairline, and three columns under it: the bio on the left, the
tools and a scroll cue in the middle, "Currently" on the right. Two faces:
Vector-traced reference outlines for the 3D signature, DM Serif Display for the hero headline, and self-hosted Manrope for supporting copy. Porcelain, ink, and muted wine form the palette.

`npm run wordmark` cuts the 3D word from Aminute (`WORDMARK_FONT` and
`WORDMARK` override the face and the word).

Everything the hero says lives in `HERO` in `src/content/site.js`. The sheets
below (work, about, contact) exist in `src/components` but are off the page —
`src/routes/HeroRoute.jsx` renders only the hero.

---

*The drawing-set version, kept for when the hero is accepted:*

A one-page portfolio built as an engineering drawing set. The first sheet is a
static Three.js wordmark in the original Aminute lettering, ruled in by three
drafting margins and closed by a title block; the sheets below it — work,
about, contact — share one head, one type scale and one set of tables, so the
page reads as a single document rather than a stack of bands.

**Everything the site says lives in one file: `src/content/site.js`.** Anything
there in `[square brackets]` is a placeholder and renders as one (muted, with a
dashed underline). Nothing in the file invents a client, a date, a number or a
quote — those gaps are yours to fill before launch. Search it for `[`.

## The sheets

| Sheet | Section | What it holds |
| --- | --- | --- |
| 00 | Hero | The wordmark, filling the band between the rails, and the title block: subject, practice (with the author's stamp), status and one call to action |
| 01 | Work | A night plate — the same tokens in the other scheme — holding a grid of project plates. A plate without an image is hatched and stamped "not yet issued" |
| 02 | About | Fig. 1 (the portrait, pinned while the record scrolls), the story, the **revisions** table (the timeline) and the **schedule** (what I build with, and what each is for) |
| 03 | Contact | The address at display size, the availability line, and the colophon that closes the set |

The head rail's stations are the sheet numbers. Its bead rests on whichever
sheet holds the middle of the viewport, and on the zero while the hero does.
Scrolling is smoothed (GSAP ScrollSmoother); every sheet's rules draw in and
its lettering rises as it enters, once. Reduced motion skips all of it.

## The hero
The centred, bevelled 3D text enters and then rests, ruled in on all four sides: two
drafting rails down the sides, a head rail across the top that they hang from,
and the title block's own rule along the bottom.

The page is an engineering drawing, so the bottom of it is a **title block** —
the ruled table of lettered fields that closes any drawing. Field A is the
subject, and it names the object above so a reader can check it by looking up.
Field B is the practice. Field C is the status and the single call to action.
The head rail numbers the sections 01–03 and the block letters its fields A–C,
so the sheet is indexed on both axes. The block folds as the sheet narrows —
three columns, then two rows, then one field per row — and nothing is dropped. The head rail is the navigation: a ruler with the name as its zero,
the sections as numbered graduations, the Karachi clock at the far end, and one
verdigris bead that rides the bottom edge to whichever station the pointer is
over and settles back on the current section's tick. The loader displays a centred 2D smile
traced from the supplied reference and a percentage counter while the page
becomes ready. The smile and Luffy's stitched cheek scar draw in plain ink with
the loading percentage, without highlighting. The scar follows the supplied
`images.jpg` reference, on the viewer's right, spaced above and outward from
the grin using the relaxed face's proportions.

At 100%, the mouth corners gently stretch and settle with the teeth together.
The grin stays straight and closed throughout, with both rows of creases
attached to the teeth. A tall glint in the site's original ink-and-paper colors
on the right-hand teeth follows the supplied `50402111-256-k22998.jpg` reference. It
twinkles twice, then expands into a star-shaped opening onto the hero.
The smile stays at its original size and is cleared by that same opening.
The simplified drawing has no tongue, mouth fill, or rotation.
Reduced motion uses a short fade. The loader has no dot or other 3D object.

The plain word is already still when the star reveals it. After the loader
clears, D switches to `</>`, the first A becomes a slash that tucks behind S,
the second A becomes `{}`, and i becomes `>_`. S changes to a rounded brushed-metal
3D form, then polished wine; that second change coincides with the first A
returning and D switching to three text lines with a moving caret. A wireframe
dissolve restores S while the first A takes a serif form and the terminal
unfurls into a pirate flag. D returns with a halo and three bevelled stars
that emerge and retreat behind it. The A returns, the flag folds into the
i-stem, and only the coin dot pops up and settles. There is no word lift or
letter entrance stagger. Final gaps are 2.2% of cap height; the visible symbol outlines
pack to the same tight gap throughout. Colors follow the brand palette. Reduced motion shows the resting word immediately.
See [the sequence timing](docs/signature-sequence.md) for the reference mapping.

Once the loader completes, the head rail draws in from its zero and its labels
rise as it passes under them. The title block is made in the order a drawing
is: its top rule draws across, its dividers rule down from that rule, the
subject rises line by line out of its own mask, and only then do the field
names and their values fill in. This stagger uses the loader's completion
callback and the existing GSAP arrival curve. Text transforms do not change
the hero's layout or wordmark position. Reduced motion uses a simultaneous fade.

- `npm run dev` starts the local preview.
- `npm run build` creates the production build.
- `npm run wordmark` cuts the wordmark's outlines — SAADi in Aminute by default;
  `WORDMARK_FONT` and `WORDMARK` override the face and the word.

The scene renders during the entrance, then only on mount, resize and colour-scheme changes.
Use `?loader=8000` to hold the loading screen for eight seconds.


The live page is the loader and hero only. Contact links use `saad.azieiz@gmail.com`. The signature has a traced high-contrast serif base, a sculpted variable-width S, pearl and rose-metal material studies, a directional wireframe dissolve, and smoothly packed horizontal substitutions. Playback takes 3.69 seconds after the loader aperture; replay starts immediately. Reduced-motion visitors see the resting word. No runtime dependencies were added.
