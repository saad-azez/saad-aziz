# Brand guidelines — Stone & Verdigris

A warm mineral ground — **limestone by day, graphite by night** — with one
object set in a lettered material and a single accent of **verdigris**, the
green of oxidised copper, that only ever appears on an edge or a label. Calm
everywhere, one place with a pulse.

Two schemes, one palette. Every role has a light value and a dark value. The
page does not follow the reader's system setting: it is light while it is day
in Islamabad and dark while it is night there (`src/brand/scheme.js`). The one
control is the pull cord hanging over the right rail — a light switch. Pull it
and the reader's choice overrules the sun, and is remembered between visits.

Every value below is declared once, in [`src/brand/tokens.css`](src/brand/tokens.css).
The page reads them as `var(--…)`; the WebGL stage reads the same declarations
back through [`src/brand/palette.js`](src/brand/palette.js), and reads them
again when the scheme flips. **Nothing else in the codebase writes a colour
down.** Change a token, and the shaders and the page both move.

---

## Colour

### Ground

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--ground` | `#ece7de` | `#141517` | The page ground, and the canvas ground. |
| `--ground-raise` | `#f5f2ec` | `#1c1e21` | Anything lifted off the ground. |
| `--ground-glow` | `#f4f1ea` | `#1f2125` | The lit middle of the backdrop. **3D only.** |
| `--ground-edge` | `#dcd5c8` | `#0c0d0f` | The backdrop's corners. **3D only.** |

### Ink

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--ink` | `#17191d` | `#ede9e0` | Primary. Display type, the count. |
| `--ink-2` | `#4a4f57` | `#b3aea5` | Secondary. Body copy. |
| `--ink-3` | `#7b8189` | `#7f7a72` | Muted. Labels, meta. |
| `--rule` | `#ccc5b8` | `#2c2f34` | Hairlines, dividers, the rails. |

### Accent

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--accent` | `#1f7a6d` | `#62c9b4` | **The signal.** Labels, the `%`, the word's silhouette edges. |

### Figure — the 3D word

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| `--figure` | `#2a2e35` | `#e7e2d8` | The letters' lit faces. |
| `--figure-shade` | `#0c0e11` | `#45414a` | Their down-facing sides. |
| `--figure-sky` | `#40454d` | `#6b676f` | Their up-facing sides. |
| `--figure-bounce` | `#b9b2a5` | `#6a655d` | Light bounced up off the ground. |
| `--figure-highlight` | `#8e949c` | `#ffffff` | The specular glint. |

All five are **3D only** — they never appear in the DOM.

### Rules

1. **The accent is the signal, and it lives on edges and labels.** The fresnel
   term tips every silhouette toward it, and it marks the `%` and the column
   labels. It is not a fill colour — an accent panel or an accent paragraph
   breaks the whole conceit.
2. **The word is an object in the room, not text on the page.** By day it is a
   graphite object on limestone; by night, a bone object on graphite. It never
   takes the ink colour directly — its faces are lit, not typeset.
3. **The shadow is a hemisphere, not a constant.** A face turned up catches
   `--figure-sky`; a face turned down falls to `--figure-shade`. Without this
   the flat sides of an extruded letter land in one dead tone.
4. **Shaders hand colour back the way they got it.** Tokens are decoded to
   linear on the way into a shader and encoded again on the way out, so a lit
   face is the token you typed, not a darker linear ghost of it.
5. **A missing token is loud, not silent.** `palette.js` returns magenta and
   warns rather than guessing, so a typo shows up immediately.

---

## Type

Two faces, no third. The pairing is the whole typographic idea: **an eccentric
wide display against a neutral workhorse.**

| Token | Face | Used for |
| --- | --- | --- |
| `--font-display` | Aminute, one weight | The count, the wordmark, anything with size. |
| `--font-body` | Archivo 400/500 | Everything else — body copy, UI, and micro-labels set uppercase with wide tracking. |

The display face is **self-hosted** from `public/fonts/`, so it is a real asset
of this project rather than a third-party request. It ships **one weight**:
never ask for a bold, because the browser will synthesise one by smearing the
outlines, and at display size that is plainly visible.

Aminute is doing the art direction, so Archivo must not compete: keep it at 400
for copy, 500 for labels, and never let it get large. There is deliberately no
mono in the system — Archivo's tabular figures cover data, and a third face
would dilute the pairing.

⚠️ The file as supplied carries **no name, designer or licence metadata**, and
came from a site redistributing commercial fonts. Before this goes public,
confirm the licence covers web embedding.

| Token | Value | Used for |
| --- | --- | --- |
| `--step-display` | `clamp(64px, 9.5vw, 148px)` | The count |
| `--step-unit` | `clamp(12px, 1.1vw, 16px)` | The `%` beside it |
| `--step-lede` | `clamp(15px, 0.8125rem + 0.625vw, 22px)` | The title block's subject field, the sheet intros, the call to action |
| `--step-title` | `clamp(44px, 1.1rem + 6.6vw, 120px)` | Sheet titles, in the display face |
| `--step-label` | `clamp(9px, 0.68vw, 11px)` | Micro-labels |
| `--tracking-display` | `0em` | The display face is narrow and tightly fitted already |
| `--tracking-label` | `0.18em` | Opening up uppercase Archivo |

---

## Motion

Declared in [`src/brand/motion.js`](src/brand/motion.js). Movement is weighty and
slightly springy — things arrive with mass behind them and settle, rather than
stopping dead.

| Token | Curve | Used for |
| --- | --- | --- |
| `EASE.arrive` | `sunOut` (custom) | Reveals, camera moves, curtain-up |
| `EASE.land` | `elastic.out(1, 0.62)` | Something with mass landing |
| `EASE.landTight` | `elastic.out(1, 0.42)` | A small object landing |
| `EASE.press` | `back.out(2.2)` | The squash on contact |
| `EASE.leave` | `power3.in` | Anything accelerating out of frame |
| `EASE.blend` | `power1.inOut` | Changes the eye should not catch |

| Token | Seconds | Meaning |
| --- | --- | --- |
| `DURATION.blink` | 0.26 | Below the threshold of being noticed |
| `DURATION.beat` | 0.6 | One beat of UI |
| `DURATION.gesture` | 1.25 | Something entering and settling |
| `DURATION.scene` | 2.0 | Scene-scale moves |

**Nothing linear** except continuous rotation. **Nothing bounces on the way
out** — springs are for arrivals; departures accelerate away and are gone. Every
timeline has a shortened, un-sprung path for `prefers-reduced-motion`.

---

## Space

Four tokens, all fluid clamps, and every other distance is derived from them:

| Token | Value | Role |
| --- | --- | --- |
| `--rail` | `clamp(18px, 3.2vw, 56px)` | The width of a side margin |
| `--rail-top` | `clamp(44px, 4.4vw, 64px)` | The height of the head rail the sides hang from |
| `--gutter` | `clamp(16px, 2.4vw, 40px)` | Breathing room inside a margin |
| `--frame-inset` | `calc(var(--rail) + var(--gutter))` | Where content is allowed to start |
| `--sheet-pad` | `clamp(72px, 9vw, 150px)` | The breathing room above and below each sheet |

### The night plate

One sheet — work — is set in the other scheme, the way a drawing set carries
the odd dark plate. `.sheet--night` (declared in `tokens.css`, with the rest
of the colours) re-declares the same roles with the other scheme's values: a
graphite plate in the limestone set by day, a limestone plate in the graphite
set by night. Nothing inside the sheet knows which scheme it is in.

---

## How the palette lands on the 3D stage

- **Ground** — the renderer clears to `--abyss`; the backdrop lays a wide wash of
  `--wash` over it that opens as loading advances, with corners falling to
  `--plum`.
- **Body** — `--chalk` mixed toward the toy's `tint` by its `tintAmount`.
- **Shadow** — a hemisphere from `--plum` (below) to `--wash` (above).
- **Bounce** — `--wash` off the fill direction, so nothing floats free of its ground.
- **Edges** — fresnel tips every silhouette toward `--ochre` at 34%; a tight
  specular adds `--chalk` at 34%.

---

## Changing something

- A colour, a font, a size → [`src/brand/tokens.css`](src/brand/tokens.css).
- A curve or a duration → [`src/brand/motion.js`](src/brand/motion.js).
- Which toy is tinted, how big it is, where it plays →
  [`src/webgl/loader/cast.js`](src/webgl/loader/cast.js).

If you are about to type a hex code anywhere else, it belongs in `tokens.css`.
