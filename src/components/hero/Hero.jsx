import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import WordmarkScene from '../../webgl/hero/WordmarkScene.js';
import { stage } from '../../webgl/stage/DotStage.js';
import WordSwap from './WordSwap.jsx';
import { HERO, PERSON } from '../../content/site.js';
import './Hero.css';

export default function Hero({ reveal, animateText, onReady }) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const wordRef = useRef(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const scene = new WordmarkScene(canvasRef.current);
    sceneRef.current = scene;
    // Once the entrance has settled, the stage may borrow the dot of the i.
    scene.onRest = () => stage.heroAtRest();
    stage.attachHero(scene);
    scene.setVisible(false);
    scene.mount();
    scene.enableOrbit(wordRef.current);
    readyRef.current?.();
    return () => { sceneRef.current = null; stage.attachHero(null); scene.dispose(); };
  }, []);

  useEffect(() => {
    // The word is centred in the space between the two hairlines.
    const measure = () => {
      const box = wordRef.current?.getBoundingClientRect();
      const left = document.querySelector('.rail--left')?.getBoundingClientRect();
      const right = document.querySelector('.rail--right')?.getBoundingClientRect();
      if (box) sceneRef.current?.setBand(box.top, box.bottom,
        left?.right ?? 0, right?.left ?? innerWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (wordRef.current) observer.observe(wordRef.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => { sceneRef.current?.setVisible(reveal); }, [reveal]);

  // Any scroll, key, click or touch during the introduction skips to its end.
  useEffect(() => {
    if (!reveal) return;
    const events = ['wheel', 'keydown', 'pointerdown', 'touchstart'];
    const skip = () => {
      sceneRef.current?.skipIntro();
      events.forEach(type => window.removeEventListener(type, skip, true));
    };
    events.forEach(type => window.addEventListener(type, skip, { capture: true, passive: true }));
    return () => events.forEach(type => window.removeEventListener(type, skip, true));
  }, [reveal]);

  useLayoutEffect(() => {
    if (!animateText) return;
    const context = gsap.context(() => {
      const root = rootRef.current;
      const lines = root.querySelectorAll('.hero__rule');
      const bottom = root.querySelectorAll('.hero__headline, .hero__intro');
      if (reducedMotion) {
        gsap.set(lines, { scaleX: 1 });
        gsap.to(bottom, { autoAlpha: 1, duration: .2, ease: EASE.blend });
        return;
      }
      gsap.timeline({ defaults: { ease: EASE.arrive } })
        .fromTo(lines, { scaleX: 0 }, { scaleX: 1, duration: 1.2, stagger: .1 }, 0)
        .fromTo(bottom, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .9, stagger: .1, clearProps: 'transform' }, .35);
    }, rootRef);
    return () => context.revert();
  }, [animateText]);

  return (
    <section className="hero" ref={rootRef} aria-labelledby="hero-title">
      <h1 id="hero-title" className="hero__title">{PERSON.mark} — {PERSON.role.toLowerCase()}</h1>
      <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />

      <div className={`hero__frame${reveal ? ' hero__frame--visible' : ''}`}>
        {/* The header's room: the header itself is the site's, fixed over every chapter (components/header). */}
        <div className="hero__top hero__top--spacer" aria-hidden="true" />

        <div className="hero__word" ref={wordRef} aria-hidden="true" />

        <footer className="hero__bottom">
          <span className="hero__rule hero__rule--bottom" aria-hidden="true" />
          <div className="hero__headline">
            <p className="hero__greeting">{HERO.greeting.before} <WordSwap lead={HERO.greeting.lead} words={HERO.greeting.words} label={HERO.greeting.label} play={animateText} hold={4.5} delay={3.5} />{HERO.greeting.after}</p>
            <h2>{HERO.headline[0]}<br /><em>{HERO.headline[1]}</em></h2>
          </div>
          <div className="hero__intro">
            <p>{HERO.offer.before} <WordSwap lead={HERO.offer.lead} words={HERO.offer.words} label={HERO.offer.label} play={animateText} hold={4.5} delay={5.8} reserve /></p>
          </div>
        </footer>
      </div>
    </section>
  );
}
