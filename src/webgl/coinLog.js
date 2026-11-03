/**
 * Coin debugging: a console line when something about the coin changes (its
 * phase, the marks on its faces, its walk along the rope), never every frame.
 * On in the dev server only; set COIN_LOG to false to silence it.
 *
 * Kinds: `hero` (the dot on the i, SkillCoin), `stage` (the coin on the way to
 * the book and its row), `rope` (the coin tossed along the tightrope), `mark` (which
 * drawing a tool's face got, and whether it was an official mark or set in type).
 */
export const COIN_LOG = import.meta.env.DEV;

const last = new Map();

/** Log `details` under `[coin:kind]` when `key` differs from the last one logged for this kind. */
export function coinLog(kind, key, ...details) {
  if (!COIN_LOG || last.get(kind) === key) return;
  last.set(kind, key);
  console.log(`[coin:${kind}]`, ...details);
}
