/**
 * The brand palette, for anything that cannot read CSS — i.e. the WebGL stage.
 *
 * The values are not repeated here. They are read back out of the tokens
 * declared in `src/brand/tokens.css`, so `tokens.css` stays the one place a
 * colour is ever written down — and because those tokens change with day and
 * night at home (see `scheme.js`), a scene reads them again whenever the
 * scheme changes (see `onSchemeChange`).
 */

export { onSchemeChange } from './scheme.js';

const ROLES = {
  ground: '--ground',
  groundGlow: '--ground-glow',
  groundEdge: '--ground-edge',
  ink: '--ink',
  accent: '--accent',
  figure: '--figure',
  figureShade: '--figure-shade',
  figureSky: '--figure-sky',
  figureBounce: '--figure-bounce',
  figureHighlight: '--figure-highlight',
};

/** Unmissable stand-in, so a mistyped token is loud instead of silently wrong. */
const MISSING = '#ff00ff';

/** The current values of every role, straight from the stylesheet. */
export function brandPalette() {
  const styles = getComputedStyle(document.documentElement);

  return Object.fromEntries(Object.entries(ROLES).map(([role, token]) => {
    const value = styles.getPropertyValue(token).trim();
    if (!value) console.warn(`[brand] ${token} is not declared in tokens.css`);
    return [role, value || MISSING];
  }));
}
