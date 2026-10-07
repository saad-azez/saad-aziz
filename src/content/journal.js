/**
 * The book's covers: Saad's journal.
 *
 * Set in type on the covers (webgl/stage/journal/coverArt.js), with a few
 * stickers the reader can peel off and put back anywhere on the book
 * (webgl/stage/journal/Stickers.js); the coin sits in the middle of the
 * front, in a ring pressed into the cover for it. Everything here is Saad's
 * own: his name, his lines from the site, his city, his face. Few things, set
 * well.
 *
 * Places: `u` across the cover as it is seen (0 its left → 1 its right, the
 * middle of the cover if left out), `v` down it (0 the top → 1 the bottom);
 * `side` 'front' or 'back'. A sticker moved by a reader stays where they put
 * it, in their own browser.
 */
export const JOURNAL = {
  /**
   * The type on the covers. `style`: 'mark' (the SAADi face), 'serif' (DM
   * Serif Display), 'caps' (small capitals, spaced) or 'body'. `size` in px
   * of a cover 1536 wide, which shows about 330 px wide on a laptop (a fifth
   * of it on screen), so nothing smaller than about 40 here. `finish`: 'foil'
   * (gold), 'blind' (pressed into the leather, no ink) or 'ink' (cream);
   * `dim` a little quieter. `under`: hidden under that sticker until it is
   * peeled. `link: 'email'`: clicked, it offers to write to Saad or copy his
   * address (components/work/EmailCard.jsx).
   */
  type: [
    { side: 'front', v: .14, text: 'SAADi', style: 'mark', size: 236, finish: 'foil' },
    { side: 'front', v: .19, text: 'Field notes · vol. ∞', style: 'caps', size: 46, finish: 'foil' },
    { side: 'front', v: .912, text: 'Saad Aziz', style: 'serif', size: 92, finish: 'foil' },
    { side: 'front', v: .948, text: 'Creative developer', style: 'caps', size: 48, finish: 'ink', dim: true },

    { side: 'front', u: .31, v: .655, text: 'You found it.', style: 'serif', size: 96, finish: 'ink', under: 'polaroid' },
    { side: 'front', u: .31, v: .7, text: 'Let’s build', style: 'body', size: 58, finish: 'ink', under: 'polaroid' },
    { side: 'front', u: .31, v: .73, text: 'something together.', style: 'body', size: 58, finish: 'ink', under: 'polaroid' },
    { side: 'front', u: .31, v: .78, text: 'saad.azieiz@gmail.com', style: 'body', size: 50, finish: 'foil', under: 'polaroid', link: 'email' },

    { side: 'back', v: .11, text: 'If found, please return to', style: 'caps', size: 48, finish: 'ink', dim: true },
    { side: 'back', v: .175, text: 'Saad Aziz', style: 'serif', size: 150, finish: 'foil' },
    { side: 'back', v: .222, text: 'saad.azieiz@gmail.com', style: 'body', size: 58, finish: 'ink', link: 'email' },
    { side: 'back', v: .252, text: 'Islamabad, Pakistan', style: 'body', size: 50, finish: 'ink', dim: true },
    { side: 'back', v: .39, text: 'I build interactive', style: 'serif', size: 104, finish: 'ink' },
    { side: 'back', v: .44, text: '3D websites, from', style: 'serif', size: 104, finish: 'ink' },
    { side: 'back', v: .49, text: 'the model to the code.', style: 'serif', size: 104, finish: 'ink' },
    { side: 'back', v: .95, text: 'SAADi · field notes', style: 'caps', size: 46, finish: 'ink', dim: true },
  ],

  /**
   * The stickers: 'polaroid' (the portrait, `caption` under it), 'hat' (the
   * straw hat off the S), 'stamp' (a postage stamp from home) and 'hello' (a
   * name tag); 'monogram', 'star' (`text`) and 'tool' (`tool`) are there to
   * add. `size` of the cover's width; `tilt` in radians.
   */
  stickers: [
    { id: 'polaroid', kind: 'polaroid', side: 'front', u: .31, v: .73, size: .36, tilt: -.1, caption: 'that’s me.' },
    { id: 'hat', kind: 'hat', side: 'front', u: .66, v: .31, size: .27, tilt: .2 },
    { id: 'stamp', kind: 'stamp', side: 'front', u: .69, v: .745, size: .23, tilt: .09 },
    { id: 'hello', kind: 'hello', side: 'back', u: .52, v: .77, size: .32, tilt: -.06 },
  ],
};
