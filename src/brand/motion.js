import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

/**
 * Motion tokens.
 *
 * The brand's movement is weighty and a little springy — things arrive with
 * some mass behind them and settle rather than stopping dead. Reach for these
 * before writing a one-off ease, so the whole site moves as one hand.
 */

/** A long, decisive out-curve. The house ease for anything arriving. */
CustomEase.create('sunOut', 'M0,0 C0.12,0 0.05,1 1,1');

export const EASE = {
  /** Arrivals: reveals, camera moves, curtain-up. */
  arrive: 'sunOut',
  /** Things with mass landing — overshoots and settles. */
  land: 'elastic.out(1, 0.62)',
  /** A tighter landing, for small objects. */
  landTight: 'elastic.out(1, 0.42)',
  /** A shove into scale — the squash on contact. */
  press: 'back.out(2.2)',
  /** Departures: anything leaving frame, accelerating away. */
  leave: 'power3.in',
  /** Cross-fades and other changes the eye should not catch. */
  blend: 'power1.inOut',
};

/** Honour a reader's OS-level preference to keep motion small. */
export const reducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
