# Webflow handoff

> **Leave the dev server running** (`npm run dev`). Anything that stops it — a
> production build, a crash, a port clash — should be followed by starting it
> again, so there is always something to look at.

This project is authored in code and rebuilt in Webflow, so the CSS is written
to be transcribed rather than admired: **one rule, one class, no combinators.**
Every rule in a component stylesheet maps to exactly one Webflow class.

---

## Where styles live

| File | Scope | Webflow equivalent |
| --- | --- | --- |
| [`src/brand/tokens.css`](src/brand/tokens.css) | Colour, type, spacing tokens | Site settings → **Variables** |
| [`src/styles/global.css`](src/styles/global.css) | Reset, `html`, `body`, webfonts | **Body (All Pages)** tag selector + Project Settings → Fonts |
| [`src/components/loader/Loader.css`](src/components/loader/Loader.css) | The loader | Classes on the loader elements |
| [`src/components/hero/Hero.css`](src/components/hero/Hero.css) | The hero | Classes on the hero elements |
| [`src/components/hero/Rails.css`](src/components/hero/Rails.css) | The drafting margins | Classes on the two rails |
| [`src/components/nav/Nav.css`](src/components/nav/Nav.css) | The head rail — the navigation | Classes on the nav elements |
| [`src/components/sheet/Sheet.css`](src/components/sheet/Sheet.css) | The head every sheet shares | Classes on the section and its header |
| [`src/components/work/Work.css`](src/components/work/Work.css) | Sheet 01 — the plates | Classes on the project Link Blocks |
| [`src/components/about/About.css`](src/components/about/About.css) | Sheet 02 — the figure and the tables | Classes on the figure, the rows |
| [`src/components/contact/Contact.css`](src/components/contact/Contact.css) | Sheet 03 — the address and the colophon | Classes on the address, the footer |
| [`src/content/site.js`](src/content/site.js) | Every word on the site | **The CMS.** Each array is a collection |
| [`src/routes/HeroRoute.css`](src/routes/HeroRoute.css) | The page shell | One class |

The rule going forward: **global.css only holds things that change the whole
site at once.** Anything that styles a component lives in a `.css` file beside
that component and is imported by it, so a component is one folder and deleting
it takes its styles with it.

Class names use BEM — `block__element`. Webflow accepts these as-is; the double
underscore just reads as a normal class name in the Designer.

---

## Variables

Create these once in Webflow (Site settings → Variables) and select them in the
style panel instead of typing hex codes. Names match the CSS custom properties
with the leading dashes dropped.

**Colour** — every colour has two values. In Webflow, give the collection two
**modes**, Light and Dark, and fill each column in its mode. The site switches
with the visitor's system setting: add this in Site settings → Custom code →
Head, so the Dark mode's values take over on a dark system.

```html
<style>
  @media (prefers-color-scheme: dark) { :root { color-scheme: dark; } }
</style>
```

(Webflow's modes can also be bound to a class on the `body`; if you use that,
apply the Dark mode's class from that same media query instead.)

| Variable | Light | Dark | Used for |
| --- | --- | --- | --- |
| `ground` | `#ece7de` | `#141517` | Page background |
| `ground-raise` | `#f5f2ec` | `#1c1e21` | Raised surfaces |
| `ground-glow` | `#f4f1ea` | `#1f2125` | Backdrop centre (3D only) |
| `ground-edge` | `#dcd5c8` | `#0c0d0f` | Backdrop corners (3D only) |
| `ink` | `#17191d` | `#ede9e0` | Primary text |
| `ink-2` | `#4a4f57` | `#b3aea5` | Body copy |
| `ink-3` | `#7b8189` | `#7f7a72` | Labels, meta |
| `rule` | `#ccc5b8` | `#2c2f34` | Hairlines, rails |
| `accent` | `#1f7a6d` | `#62c9b4` | The accent |
| `figure` | `#2a2e35` | `#e7e2d8` | 3D letter faces (3D only) |
| `figure-shade` | `#0c0e11` | `#45414a` | 3D shade (3D only) |
| `figure-sky` | `#40454d` | `#6b676f` | 3D up-facing sides (3D only) |
| `figure-bounce` | `#b9b2a5` | `#6a655d` | 3D bounce light (3D only) |
| `figure-highlight` | `#8e949c` | `#ffffff` | 3D glint (3D only) |

The `ground-glow`, `ground-edge` and `figure-*` values never appear in the DOM —
they exist for the WebGL stage. Create them anyway so the two systems stay in
step.

**Type** — `font-display` = Aminute (one weight), `font-body` = Archivo 400/500.

Archivo comes from Google, so switch it on under Project Settings → Fonts →
Google Fonts. Aminute is a **custom upload**: take
`public/fonts/aminute.woff2` from this repo and add it under Project Settings →
Fonts → Custom Fonts, as weight 400 / normal. Do both before styling anything,
or the Designer falls back and every size you set is judged against the wrong
face. Never set the display face to bold — it has one weight, and Webflow will
happily synthesise a smeared one.

**Size**

| Variable | Value | Used for |
| --- | --- | --- |
| `rail` | `clamp(18px, 3.2vw, 56px)` | The width of a side margin |
| `rail-top` | `clamp(44px, 4.4vw, 64px)` | The height of the head rail the sides hang from |
| `gutter` | `clamp(16px, 2.4vw, 40px)` | Breathing room inside the margin |
| `frame-inset` | `calc(rail + gutter)` | Where page content is allowed to start |

---

## Responsiveness

**There is almost nothing to do per breakpoint.** The layout is fluid by
construction, so most of it scales continuously between a 320px phone and an
ultrawide with nothing to snap:

- **Type** is fluid `clamp()` — set it once on the Desktop tab and leave the
  other tabs alone. Each step is `clamp(min, rem + vw, max)` solved between
  320px and 1440px. Note the `rem` in the middle term: a pure `vw` size ignores
  the reader's own font-size setting, which is an accessibility failure that
  stays invisible until somebody relies on it.
- **The margins and the frame** come from `--rail` and `--gutter`, both fluid
  clamps. `--frame-inset` is `calc(--rail + --gutter)`, so the content always
  starts one clear gutter inside the margin at every width — nobody has to
  remember to update a second number.
- **The title block** folds the way a title block on a smaller sheet does:
  three columns across, then the subject and the practice sharing a row with
  the status running full width beneath, then one field per row. Only the grid
  template and the dividers' orientation change, so no content is dropped and
  the HTML never moves.
- **The 3D wordmark** measures the gap the chrome leaves between the rule and
  the footer, and sizes and centres itself in it. It cannot grow into the copy
  at any viewport.

### The three media queries that remain

None of them is a device, so none maps to a Webflow tab — put all three in the
custom-code embed alongside the rest:

| Query | Does | Why not a tab |
| --- | --- | --- |
| `max-width: 64em` | Block folds to two rows: subject and practice above, status full width below | Where three columns stop leaving the subject a readable measure — not a device |
| `max-width: 40em` | Block folds again: one field per row | Where two columns stop fitting a sentence |
| `max-width: 44em` | Head rail: the station words hide, the numerals stay | Where the row runs out of room, not a phone |
| `max-width: 30em` | Head rail: the clock hides | Same |
| `max-height: 34em` | Block tightens: body-size subject, wider measure, smaller gaps | A short window — phone on its side, split screen. Webflow has no height tabs at all |
| `max-height: 34em` **and** `min-width: 40em` | Block stays in three columns whatever the width says | Folding costs a whole row, and height is the one thing a short window has none of. Two conditions at once — Webflow tabs cannot express this |

If you would rather keep everything in the Designer, `64em` is near the Tablet
tab (991px) and `40em`/`44em`/`30em` near Mobile landscape (767px) and Mobile
portrait (479px). Neither `max-height` rule has an equivalent, and both must be
custom code.

---

## Building the loader in Webflow

The loader is a WebGL canvas with a single piece of DOM on top of it. Almost all
of it is script, not structure — so do not try to rebuild the animation with
Interactions. Build this much:

```
Section  .loader                 Div Block, fixed, full-bleed
├── Embed  .loader__canvas       <canvas class="loader__canvas"></canvas>
└── Div    .loader__readout      absolute, bottom right
    ├── Text  .loader__count     "099"
    └── Text  .loader__unit      "%"
```

Then add the built bundle from `npm run build` as a site-wide custom code
embed before `</body>`. The script finds the canvas, drives the count, and runs
its own exit — no Webflow Interaction is involved at any point.

### Properties the Designer cannot set

These have to go in a custom-code embed. They are few, and all are on the
loader:

| Property | Where | Why it matters |
| --- | --- | --- |
| `clip-path` | `.loader` | The exit wipe |
| `will-change` | `.loader`, `.loader__readout` | Keeps the exit off the main thread |
| `font-variant-numeric: tabular-nums` | `.loader__count` | Stops the number jittering as digits change width |
| `font-feature-settings: 'tnum' 1` | `.loader__count` | Same, for faces that need the explicit flag |
| `calc()` in the bottom offset | `.loader__readout` | Optical alignment of the count's baseline |
| `100svh` | `.site-shell` | `svh` accounts for mobile browser chrome; `vh` does not |
| `clamp()` sizes | type scale | Webflow's numeric fields do not take CSS functions |

The simplest route: paste the contents of `Loader.css` into one site-wide embed
and let it override the Designer classes. Keep the class names identical and
nothing fights.

---

## Building the hero in Webflow (current — Saad's layout)

```
Section  .hero                          relative, min-height 100svh, overflow hidden
├── H1     .hero__title                 visually hidden
├── Embed  .hero__canvas                <canvas>, absolute, 100% × 100svh
└── Div    .hero__frame                 grid, three rows, padded --frame-inset
    ├── Header .hero__top               grid: 1fr | auto | 1fr, centre-aligned
    │   ├── Link .hero__mark            the SA monogram, a coin: perspective 240px
    │   │   ├── Embed .hero__mark-letters   src/assets/monogram-letters.svg, currentColor, absolute
    │   │   └── Embed .hero__mark-ring      src/assets/monogram-ring.svg — spun rotateY by script under the pointer
    │   ├── Para .hero__meta.hero__meta--centre   "Karachi · 17:16 local" (.hero__clock inside)
    │   └── Div  .hero__rule.hero__rule--top      hairline, drawn in by script
    ├── Div    .hero__word              empty, min-height 30svh — the word is centred in it
    └── Footer .hero__bottom            grid: 1.1fr | auto | 1fr, bottom-aligned
        ├── Div  .hero__rule.hero__rule--bottom   hairline
        ├── Para .hero__bio             Archivo, --step-bio; <em .hero__bio-accent> in the accent
        ├── Div  .hero__middle
        │   ├── Para .hero__tools       two .hero__tools-row lines, mono labels
        │   └── Link .hero__scroll      "Scroll" + .hero__scroll-tick (1px, accent)
        └── Div  .hero__now
            ├── Para .hero__meta.hero__meta--end   "Currently"
            └── Para .hero__now-value   two .hero__now-line lines, Archivo, --step-now
```

Fonts: Aminute for the word (already uploaded), Archivo for everything else,
including the small uppercase labels. Folds: `max-width: 56em` puts the bio on
its own row with the middle and "Currently" beneath; `max-width: 40em` is one
column — bio, Currently, tools and scroll.

## Building the hero in Webflow (the plain one, superseded)

```
Section  .hero                          relative, min-height 100svh, overflow hidden
├── H1     .hero__title                 visually hidden — the real heading
├── Embed  .hero__canvas                <canvas>, absolute, 100% × 100svh (not inset 0)
└── Div    .hero__frame                 grid, four rows, padded --frame-inset
    ├── Div  .hero__word                empty box, 39svh — the letters are drawn to it
    ├── Nav  .hero__nav                 relative · flex, space-between, baseline
    │   ├── Div  .hero__line            the hairline, drawn in by script
    │   ├── Div  .hero__bead            5px, the accent — script
    │   ├── List .hero__links → Link .hero__link (×3)   Work · About · Contact
    │   └── Para .hero__time            "17:04 in Karachi"
    ├── Div  .hero__stage               relative, one column
    │   ├── Div  .hero__talk            flex column
    │   │   ├── H2   .hero__hello       "Hi, I'm Saad." — display face, --step-hello
    │   │   ├── Para .hero__intro       --step-talk
    │   │   └── Div  .hero__actions     Link .hero__btn (pill, ink fill) · Link .hero__more (underlined)
    │   └── Para .hero__note            absolute, top right, italic, rotated -3°
    │       ├── Embed .hero__arrow      inline SVG: .hero__arrow-path + .hero__arrow-head
    │       └── Text  .hero__note-text
    └── Para .hero__foot                flex, space-between: the free line · .hero__foot-right
```

The arrow draws itself in (stroke-dashoffset, script). Below 40em the note
moves above the greeting with a smaller arrow.

## Building the hero in Webflow (the dense version, superseded)

```
Section  .hero                          relative, min-height 100svh, overflow hidden
├── H1     .hero__title                 visually hidden — the real heading
├── Embed  .hero__canvas                <canvas>, absolute, 100% × 100svh (NOT inset 0 — see below)
└── Div    .hero__frame                 grid, three rows, padded --frame-inset
    ├── Div  .hero__word                empty box, height 39svh — the letters are drawn to it
    ├── Nav  .hero__nav                 relative · flex, space-between
    │   ├── Div  .hero__nav-rule        the line, 1px, drawn in by script
    │   ├── Div  .hero__nav-scale       embed: the tick graduations (two repeating gradients)
    │   ├── Div  .hero__nav-bead        5px, the accent — script
    │   ├── List .hero__nav-list .hero__nav-list--start    00 Home · 01 Work · 02 About
    │   │   └── Item .hero__nav-item → Link .hero__nav-link (with Text .hero__nav-index)
    │   └── List .hero__nav-list .hero__nav-list--end      03 Services · 04 Contact
    └── Div  .hero__lower               grid: 1.2fr | auto | .85fr
        ├── Div .hero__lead             flex column
        │   ├── Para .hero__eyebrow     dot · status · "Karachi 22:24 local" (.hero__clock)
        │   ├── H2   .hero__headline    three .hero__line masks, each with .hero__line-text
        │   ├── Div  .hero__actions     .hero__btn.hero__btn--fill, .hero__btn
        │   └── Para .hero__tagline     margin-top auto — pinned to the bottom
        ├── Figure .hero__plate
        │   ├── Div .hero__plate-frame  3:4, ruled; image at 270% + translate (custom code)
        │   │   ├── Image .hero__plate-img
        │   │   └── Div .hero__plate-corner (×4, --tl --tr --bl --br)
        │   └── Figcaption .hero__plate-caption   "FIG. 1" · "SAAD AZIZ"
        └── Div .hero__side
            ├── List .hero__chips → Item .hero__chip (with Div .hero__chip-mark)
            └── Para .hero__blurb       margin-top auto
```

**The canvas must be the viewport's height, not the section's.** The renderer
sizes its buffer to the window; if the canvas element is taller (the section
grows on phones), the letters stretch. `height: 100svh` keeps them true.

Sizes that need an embed: `--step-hero` uses `min()` inside `clamp()` so the
statement is bound by the viewport's height as well as its width; the plate's
width is `min(clamp(…), 31vh)` for the same reason. Both keep the hero to one
screen on laptops.

Folds: `max-width: 56em` moves the facts under the lead with the plate on the
right; `max-width: 40em` is one column — plate, lead, facts — and the page
scrolls.

## Building the hero in Webflow (the drawing-set version, kept)

```
Section  .hero                       relative, 100svh, overflow hidden
├── H1     .hero__title              visually hidden — the real heading
├── Embed  .hero__canvas             <canvas> for the 3D wordmark
├── Nav    .nav                      the head rail — see the next section
├── Div    .rail .rail--left         fixed drafting margin, top 0 to bottom 0
│   └── Div   .rail__scale           the ruled ticks
├── Div    .rail .rail--right        fixed drafting margin
│   └── Div   .rail__scale
└── Div    .hero__frame              the content safe area
    └── Div   .hero__foot            the spread — see the next section
```

The rails hold nothing. A margin is structure, not a shelf — build them as two
empty divs with the ruled background and leave them alone. They run the full
height of the viewport, top 0 to bottom 0. (`--rail-top` only matters if the
shelved head rail comes back; while it is off the page nothing hangs from it.)

`.hero__frame` is inset by `--frame-inset` on each side — the rail's width plus
one gutter of breathing room — so the content starts exactly where the margins
end. That relationship is the whole point of the rails, so if you change a
margin, change it in one place: `--rail` or `--gutter`.

`.hero__frame--visible` and `.rail--visible` are combo classes toggled by script
when the loader hands over. Build the base classes with `visibility: hidden` and
let the code add the combo.

### Extra properties needing an embed

| Property | Where | Why |
| --- | --- | --- |
| `repeating-linear-gradient` | `.rail__scale` | The ruled tick marks |
| `isolation: isolate` | `.hero` | Keeps the canvas's stacking context contained |
| `grid-template-areas` | `.hero__block` | Named areas — the Designer's grid panel can place them, but the folds per query are custom code |
| `text-wrap: balance` | `.hero__lede` | The subject holds one line, or breaks evenly when it cannot |
| `transform-origin` flip on hover | `.hero__cta-rule` | The underline draws in from the left and away to the right instead of rewinding |

---

## Building the title block in Webflow

The page is an engineering drawing, so its bottom edge is the thing that closes
one: a ruled table of lettered fields. The head rail numbers the sections
01–03; the block letters its fields A–C, so the sheet is indexed on both axes.
The block's top rule is the frame's fourth side — with the head rail above and
a side rail on each hand, the word is ruled in on all four.

```
Div      .hero__foot                     grid, gap 0, bottom-aligned
├── Div    .hero__foot-rule              the block's top edge, 1px, drawn by script
└── Div    .hero__block                  grid, three columns
    ├── Div  .hero__cell .hero__cell--subject
    │   ├── Para .hero__field            "A  Subject"
    │   │   └── Text .hero__field-key    the "A", in the accent
    │   ├── Para .hero__lede             the subject, with <em> on one word
    │   └── Para .hero__note             the supporting value
    ├── Div  .hero__cell .hero__cell--practice
    │   ├── Div  .hero__cell-rule .hero__cell-rule--b    the divider
    │   ├── Para .hero__field            "B  Practice"
    │   └── Para .hero__note
    └── Div  .hero__cell .hero__cell--status
        ├── Div  .hero__cell-rule .hero__cell-rule--c    the divider
        ├── Para .hero__field            "C  Status"
        ├── Para .hero__status           the availability line
        │   └── Div  .hero__status-dot   6px, the accent
        └── Link .hero__cta              href="#contact"
            ├── Text  .hero__cta-label   "Start a project"
            ├── Embed .hero__cta-arrow   the right arrow (inline SVG)
            └── Div   .hero__cta-rule    the underline, drawn on hover
```

**The dividers are divs, not borders.** `.hero__cell-rule` is absolutely
positioned along its cell's leading edge at 1px, so the reveal can rule it out
from its own corner with a transform — a border cannot be drawn on. Each has
its own modifier class (`--b`, `--c`) because the two turn on their side at
different widths as the block folds, and a shared class would need a combinator
to tell them apart.

Cells hang their values from the top (`align-content: start`), so every field
starts on the same line no matter how much it holds, and the dividers run the
full height of the tallest one.

The arrow is inline SVG with `fill: none; stroke: currentColor` — paste it as
an Embed so it takes the link's colour. `.hero__frame` does not take the
pointer; only `.hero__cta` sets `pointer-events: auto`, so the stage behind
stays reachable everywhere else.

The status line is the page's only claim about taking work on. It is a constant
at the top of `Hero.jsx` (`AVAILABLE`) with two copy variants — keep whichever
is true.

---

## Building the head rail in Webflow

The navigation is the third drafting margin: a ruled strip across the top that
the two side rails hang from. It is a ruler. The name is the zero at its left
end, the sections are numbered graduations along it, and the Karachi clock
closes the far end. One verdigris bead rides the bottom edge — it rests on the
current section's tick (or on the zero) and travels to whichever station the
pointer is over, then comes home.

```
Nav      .nav                        fixed, top 0, full width, height --rail-top
├── Link   .nav__origin              "Saad Aziz" — the zero, links home
├── List   .nav__stations            the graduations, centred
│   └── Item .nav__station           one per section (×3)
│       ├── Link .nav__link          href="#work" etc.
│       │   ├── Text .nav__index     "01" — the reading, in the accent
│       │   └── Text .nav__word      "Work"
│       └── Div  .nav__tick          the current section's major tick
├── Text   .nav__meta                "Karachi 11:12 local", with .nav__clock inside
├── Div    .nav__rule                the bottom edge, 1px
├── Div    .nav__scale               the ruled ticks
└── Div    .nav__bead                the cursor
```

The grid is three columns, `1fr auto 1fr`, so the stations sit on the centre of
the viewport like the wordmark below them. Padding is `0 --frame-inset`, which
lines the zero up with the blurb's left edge.

Combo classes toggled by script: `.nav--visible` when the loader hands over
(with `.rail--visible`), and `.nav__link--active` / `.nav__tick--active` on
the current section. Build the base classes hidden — the rule, the scale and the
bead at `scaleX(0)` / opacity 0 — and let the code draw them in.

The bead is script and stays script. It reads each station's position, moves
along `transform: translateX`, and stretches with its own speed; the built
bundle does this and needs only the class names above to be present.

### Extra properties needing an embed

| Property | Where | Why |
| --- | --- | --- |
| two `repeating-linear-gradient`s, `background-size`, `background-position` | `.nav__scale` | A minor tick every 12px, a major every 60px, zeroed on `--frame-inset` |
| `font-variant-numeric` | `.nav__index`, `.nav__clock` | The row must not shift as digits change width |
| `cubic-bezier(.12, 0, .05, 1)` | `.nav__tick` | The house `arrive` ease, for the tick rising |
| `clip-path` visually-hidden block | `.nav__word` at `max-width: 44em` | The words step aside on narrow screens; the numerals stay as the graduations, and the link keeps its name |
| `display: none` | `.nav__meta` at `max-width: 30em` | The clock yields to the stations |

---

## The drawing set — the sheets below the hero

Every section below the hero is a **sheet**, and every sheet has the same head:

```
Section  .sheet  (#work, #about, #contact)     padded --sheet-pad / --frame-inset
├── Header .sheet__head                       grid, two columns
│   ├── Div  .sheet__rule                     the top edge, drawn in on entry
│   ├── Para .sheet__meta                     "SHEET 01" left, the sheet's name right
│   │   ├── Text .sheet__no  (with .sheet__no-key "Sheet" in the accent)
│   │   └── Text .sheet__eyebrow
│   ├── H2   .sheet__title                    full width, display face
│   │   └── Div  .sheet__title-line (×n)      overflow hidden — the mask
│   │       └── Text .sheet__title-text       rises out of it
│   └── Para .sheet__intro                    right column
└── Div    .sheet__body
```

`.sheet--night` is a combo class on the section that flips the colour tokens
(see BRAND.md). Nothing inside the sheet changes.

**Scroll reveals** are attributes, not classes: `data-rule` on a hairline
(drawn from the left), `data-line` on a line of display type inside a mask
(rises), `data-rise` on anything else (fades and lifts; siblings stagger). Set
them as custom attributes in the element settings. Script does the rest, once,
as each element enters the lower part of the viewport.

**Smooth scrolling** is GSAP ScrollSmoother, and it needs two wrappers around
the whole page: `#smooth-wrapper > #smooth-content`. The head rail, the side
rails and the loader sit **outside** them, because they are fixed. Anything
`position: sticky` inside the content will not stick — the page moves by
transform — so Fig. 1 on the about sheet is pinned by script instead.

### Sheet 01 · Work — the plates

```
Div      .work__grid                      two columns
└── Link .plate  (×n)                     one project
    ├── Div  .plate__frame                4:3, ruled
    │   ├── Text .plate__no               "01", in the accent
    │   ├── Div  .plate__hatch            embed: diagonal repeating-linear-gradient
    │   ├── Text .plate__stamp            "Plate not yet issued", set 6° off square
    │   └── Image .plate__img             (when the project has one — replaces the two above)
    ├── Div  .plate__row                  title left, client · year right
    ├── Text .plate__summary
    └── Div  .plate__tags                 tags with accent middots, arrow at the end
```

### Sheet 02 · About — the figure and the record

```
Div      .about__body                     two columns, figure left
├── Figure .figure                        pinned by script on desktop
│   ├── Div  .figure__frame               3:4, ruled; the image is set at 240% and shifted (custom code)
│   │   ├── Image .figure__img
│   │   └── Div  .figure__corner (×4, --tl --tr --bl --br)   registration marks
│   └── Figcaption .figure__caption       "FIG. 1" · "Saad Aziz, Karachi."
└── Div    .about__record
    ├── Div  .about__story                .about__lede then .about__para
    ├── Div  .table  (revisions)          .table__field, .table__cols, .table__row (×n), .table__end
    │   └── .table__row: .table__rule, .table__rev, .table__date, .table__note
    └── Div  .table  (schedule)
        └── .table__row.table__row--schedule: .table__rule, .table__mark (SVG embed), .table__name, .table__note
```

### Sheet 03 · Contact — the address and the colophon

```
Div      .contact__body
├── Div  .contact__address                .contact__status (with dot), .contact__mail (display face)
└── List .contact__links                  only the links with an href
Footer   .colophon                        four columns; .colophon__rule, .colophon__line (×3),
                                          .colophon__line--end with .colophon__clock and .colophon__top
```

The placeholder mark `.ph` is one site-wide class (global.css): muted ink and
a dashed underline. Script adds it to any value from the content file that is
still in square brackets.

### Properties on the sheets that need an embed

| Property | Where | Why |
| --- | --- | --- |
| `repeating-linear-gradient` | `.plate__hatch` | The hatching on an unissued plate |
| `width: 240%` + `transform: translate()` | `.figure__img` | Crops the plate to head and shoulders without a second image |
| `text-wrap: pretty` | intros, notes, summaries | No lone word on a last line |
| `fill: currentColor` | `.table__mark svg` | The tool marks take the ink colour in both schemes |
| `font-variant-numeric: tabular-nums` | `.table__date`, `.colophon__clock` | Digits never shift a column |

## Adding a component

1. `src/components/<name>/<Name>.jsx`
2. `src/components/<name>/<Name>.css` — classes prefixed with the block name
3. `import './<Name>.css';` at the top of the JSX
4. Add a row to the table at the top of this file

Nothing new goes in `global.css` unless it genuinely changes the entire site.
