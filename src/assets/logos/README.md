The monochrome tool marks use the Simple Icons SVG set.

Blender, GSAP and Vite were retrieved on 2026-09-24 from:
- https://github.com/simple-icons/simple-icons/blob/develop/icons/blender.svg
- https://github.com/simple-icons/simple-icons/blob/develop/icons/gsap.svg
- https://github.com/simple-icons/simple-icons/blob/develop/icons/vite.svg

Next.js, Shopify and LottieFiles (shown for Lottie) were retrieved on 2026-09-24 from
https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/ (nextdotjs.svg, shopify.svg,
lottiefiles.svg). Spline, Unicorn Studio and Lenis have no mark in the set; the coin
sets their names in type.

Set license: https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md

## The coin's copies (`../coin`)

The coin never draws these files itself. `npm run coin:marks` (scripts/build-coin-marks.mjs) renders each one to
`coin/<name>.png` (768², the ink centred and filling 62% of the face) and works out `coin/<name>.morph.png` (the
shape the about's five years melt between). Run it again after adding or changing a mark here.
