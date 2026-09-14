import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { EASE, reducedMotion } from '../brand/motion.js';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll reveals for a sheet.
 *
 * Three vocabularies, all declared in the markup so a sheet never has to write
 * its own timeline:
 *
 *   data-rule   a hairline — drawn in from its left edge
 *   data-line   a line of display type inside an `overflow: hidden` parent —
 *               rises out of its mask; siblings stagger
 *   data-rise   anything else — fades and lifts into place; nearby siblings
 *               stagger through ScrollTrigger.batch
 *
 * Everything fires once, as it enters the lower part of the viewport, in the
 * order a drawing is made: rules first, then the lettering. Reduced motion
 * skips straight to the resting state.
 *
 * Returns the cleanup.
 */
export function revealSheet(root) {
  if (!root) return () => {};
  const context = gsap.context(() => {
    const rules = root.querySelectorAll('[data-rule]');
    const lines = root.querySelectorAll('[data-line]');
    const rises = root.querySelectorAll('[data-rise]');

    if (reducedMotion) {
      gsap.set(rules, { scaleX: 1 });
      gsap.set(lines, { yPercent: 0 });
      gsap.set(rises, { autoAlpha: 1, y: 0 });
      return;
    }

    gsap.set(rules, { scaleX: 0, transformOrigin: 'left center' });
    gsap.set(lines, { yPercent: 112 });
    gsap.set(rises, { autoAlpha: 0, y: 14 });

    rules.forEach(rule => gsap.to(rule, {
      scaleX: 1, duration: 1.1, ease: EASE.arrive,
      scrollTrigger: { trigger: rule, start: 'top 92%', once: true },
    }));

    // Lines stagger with their siblings: group by the nearest heading.
    const groups = new Map();
    lines.forEach(line => {
      const key = line.closest('h1, h2, h3, p, .sheet__title') ?? line.parentElement;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(line);
    });
    groups.forEach((members, key) => gsap.to(members, {
      yPercent: 0, duration: 1, ease: EASE.arrive, stagger: .09,
      scrollTrigger: { trigger: key, start: 'top 88%', once: true },
    }));

    ScrollTrigger.batch(rises, {
      start: 'top 90%', once: true,
      onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: .85, ease: EASE.arrive, stagger: .06, overwrite: true }),
    });
  }, root);
  return () => context.revert();
}

/** True when a string is an unfilled placeholder from the content file. */
export const isPlaceholder = value => typeof value === 'string' && /^\[.*\]$/.test(value.trim());
