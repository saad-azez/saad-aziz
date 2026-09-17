import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import './WordSwap.css';

// A word that takes turns with others, on its own. Each word sits in a masked
// line: its letters roll up out of the mask one after another, and the next
// word's letters roll up into place behind them. The slot eases to the new
// word's width, or holds the widest word's width when `reserve` is set, so
// the text around it never jumps. `lead` is the word before it, kept on the
// same line so the swapping word is never left alone on a line of its own.
export default function WordSwap({ words, lead, label = words[0], play, hold = 2.6, delay = 0, reserve = false }) {
  const stageRef = useRef(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const slots = [...stage.children];
    const letters = slots.map(slot => [...slot.children]);
    let index = 0;
    let swap = null;
    let wait = null;
    let live = true;

    const width = i => reserve ? Math.max(...slots.map(slot => slot.offsetWidth)) : slots[i].offsetWidth;
    const fit = () => { if (live && !swap?.isActive()) gsap.set(stage, { width: width(index) }); };

    const next = () => {
      const from = index;
      index = (index + 1) % slots.length;
      swap = reducedMotion
        ? gsap.timeline()
          .to(letters[from], { autoAlpha: 0, duration: .3, ease: EASE.blend })
          .set(stage, { width: width(index) })
          .to(letters[index], { autoAlpha: 1, duration: .3, ease: EASE.blend })
        : gsap.timeline()
          .to(letters[from], { yPercent: -100, duration: .45, ease: 'power3.in', stagger: .022 }, 0)
          .set(letters[from], { autoAlpha: 0 })
          .to(stage, { width: width(index), duration: .8, ease: EASE.arrive }, .15)
          .fromTo(letters[index], { yPercent: 100, autoAlpha: 1 }, { yPercent: 0, duration: .8, ease: EASE.arrive, stagger: .03 }, .22);
      wait = gsap.delayedCall(swap.duration() + hold, next);
    };

    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    if (play && slots.length > 1) wait = gsap.delayedCall(hold + delay, next);

    return () => {
      live = false;
      window.removeEventListener('resize', fit);
      wait?.kill();
      swap?.kill();
      gsap.set([stage, ...letters.flat()], { clearProps: 'all' });
    };
  }, [play, words, hold, delay, reserve]);

  return (
    <span className="word-swap">
      {lead && `${lead} `}
      <span className="word-swap__label">{label}</span>
      <span className="word-swap__stage" ref={stageRef} aria-hidden="true">
        {words.map(word => (
          <span className="word-swap__word" key={word}>
            {[...word].map((letter, i) => <span className="word-swap__letter" key={i}>{letter}</span>)}
          </span>
        ))}
      </span>
    </span>
  );
}
