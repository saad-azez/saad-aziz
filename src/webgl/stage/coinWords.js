import { ABOUT } from '../../content/site.js';
import { SIZE } from '../coinMarks.js';

/**
 * What the coin says through the process (content: ABOUT.process.coin; processTransition WORD_TURNS has when): two
 * lines of the display face, in two fixed slots on its face, the same size throughout. Each saying rolls up into the
 * slots as the last rolls out of them, a letter after a letter from the left, as a counter's figures go by: the steps,
 * then his words, MINE, then the reader's, YOURS, which stay.
 *
 * The stage's coin (DotStage coinSays, maskFor) and the puzzle it becomes (Puzzle place) both show this one drawing, so
 * either can stand in for the other.
 */
const COIN = ABOUT.process.coin;
const SAYINGS = [...COIN.says, COIN.mine, COIN.yours].map(lines => lines.map(line => line.toUpperCase()));
export const YOURS = SAYINGS.length - 1;
export const MINE = YOURS - 1;

/**
 * How wide the widest line of them all may run (of the face, which spans the canvas); how far apart the lines are; how
 * tall a slot is (of their size: just clear of the capitals, so they are cut off clean as they go in and out); and how
 * far a letter travels (far enough that one has wholly left its slot before the next comes into it: no two ever overlap).
 */
const FIT = { width: .74, lead: .96, slot: .9, travel: 1.68 };
/** Of a turn: how much of it the wave across the letters takes, and how much later the second line goes than the first. */
const ROLL = { wave: .5, second: .14 };

const clamp01 = v => Math.max(0, Math.min(1, v));
const smoother = v => { const t = clamp01(v); return t ** 3 * (t * (t * 6 - 15) + 10); };

/** The one setting all of them share, for a canvas `S` across: their font, its size, and each line's middle. */
function setting(c, S) {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim() || 'sans-serif';
  c.font = `400 100px ${family}`;
  const widest = Math.max(...SAYINGS.flat().map(line => c.measureText(line).width));
  const size = 100 * S * FIT.width / widest;
  return { size, font: `400 ${size}px ${family}`, ys: [S / 2 - size * FIT.lead / 2, S / 2 + size * FIT.lead / 2] };
}

/** Saying `say` still, on the cleared canvas. */
const still = (c, S, say, ys) => SAYINGS[say].forEach((line, l) => c.fillText(line, S / 2, ys[l]));

/**
 * One line of a saying in its slot, `away` of the way out of it upward (0 in place, 1 gone) or `coming` in from under
 * it: each letter its own clip on the whole line, so the type keeps its own fit, and later the further right it is.
 */
function rollLine(c, S, line, y, size, moved) {
  const width = c.measureText(line).width, left = S / 2 - width / 2, slot = size * FIT.slot, travel = size * FIT.travel;
  let x0 = Math.round(left - size * .1);
  [...line].forEach((_, i) => {
    const end = i === line.length - 1 ? left + width + size * .1 : left + c.measureText(line.slice(0, i + 1)).width;
    const x1 = Math.round(end), at = ((x0 + x1) / 2 - S * (1 - FIT.width) / 2) / (S * FIT.width);
    const shift = moved(clamp01(at)) * travel;
    if (Math.abs(shift) < travel) {
      c.save();
      c.beginPath();
      c.rect(x0, y - slot / 2, x1 - x0, slot);
      c.clip();
      c.fillText(line, S / 2, y + shift);
      c.restore();
    }
    x0 = x1;
  });
}

/**
 * The face (a SIZE² canvas spanning its circle, as a mark's does, in `colour`), `u` of the way (0 → 1) through a turn
 * from saying `from` to saying `to` (-1, nothing yet): only `to`, still, at the end of it. Going back runs it backwards.
 */
export function coinWords(canvas, colour, from, to, u = 1) {
  if (canvas.width !== SIZE) canvas.width = canvas.height = SIZE;
  const c = canvas.getContext('2d'), { size, font, ys } = setting(c, SIZE);
  c.clearRect(0, 0, SIZE, SIZE);
  c.font = font;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = colour;
  if (to < 0) return canvas;
  if (u >= 1) { still(c, SIZE, to, ys); return canvas; }
  const passed = (at, l) => smoother((u - l * ROLL.second - at * ROLL.wave) / (1 - ROLL.second - ROLL.wave));
  [0, 1].forEach(l => {
    if (from >= 0 && SAYINGS[from][l] === SAYINGS[to][l]) {
      c.fillText(SAYINGS[to][l], SIZE / 2, ys[l]);
      return;
    }
    if (from >= 0) rollLine(c, SIZE, SAYINGS[from][l], ys[l], size, at => -passed(at, l));
    rollLine(c, SIZE, SAYINGS[to][l], ys[l], size, at => 1 - passed(at, l));
  });
  return canvas;
}

/** Make sure the display face is here before it is drawn with. */
export const loadWordsFace = () => {
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
  return (document.fonts?.load(`400 60px ${family}`) ?? Promise.resolve()).catch(() => {});
};
