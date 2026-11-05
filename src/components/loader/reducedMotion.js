/** The same answer as brand/motion.js, without bringing GSAP into the first file a visitor downloads. */
export const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
