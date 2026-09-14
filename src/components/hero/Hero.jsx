import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { EASE, reducedMotion } from '../../brand/motion.js';
import WordmarkScene from '../../webgl/hero/WordmarkScene.js';
import SketchClock from './SketchClock.jsx';
import { HERO, PERSON } from '../../content/site.js';
import ring from '../../assets/monogram-ring.svg?raw';
import letters from '../../assets/monogram-letters.svg?raw';
import './Hero.css';

export default function Hero({ reveal, animateText, onReady }) {
  const [playing, setPlaying] = useState(true);
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const wordRef = useRef(null);
  const markRef = useRef(null);
  const ringRef = useRef(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const scene = new WordmarkScene(canvasRef.current);
    sceneRef.current = scene;
    scene.onRest = () => setPlaying(false);
    scene.setVisible(false);
    scene.mount();
    readyRef.current?.();
    return () => { sceneRef.current = null; scene.dispose(); };
  }, []);

  useEffect(() => {
    // The word is centred in the space between the two hairlines.
    const measure = () => {
      const box = wordRef.current?.getBoundingClientRect();
      const left = document.querySelector('.rail--left')?.getBoundingClientRect();
      const right = document.querySelector('.rail--right')?.getBoundingClientRect();
      if (box) sceneRef.current?.setBand(box.top, box.bottom, left?.right ?? 0, right?.left ?? innerWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (wordRef.current) observer.observe(wordRef.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  useEffect(() => { sceneRef.current?.setVisible(reveal); }, [reveal]);

  // The monogram is a coin. Under the pointer its ring spins on the vertical
  // axis — winding up to speed, holding while the pointer stays, and coasting
  // to a stop on the next face-on turn once it leaves. The letters never move.
  useEffect(() => {
    const mark = markRef.current;
    const face = ringRef.current;
    if (!mark || !face || reducedMotion) return;
    const SPIN = 420; // degrees per second, once wound up
    const coin = { angle: 0, speed: 0 };
    let ticking = false;
    const paint = () => { face.style.transform = `rotateY(${coin.angle}deg)`; };
    const tick = (_, delta) => {
      const dt = Math.min(delta, 50) / 1000;
      coin.speed += (SPIN - coin.speed) * Math.min(1, dt * 5);
      coin.angle += coin.speed * dt;
      paint();
    };
    const enter = () => {
      gsap.killTweensOf(coin);
      if (!ticking) { ticking = true; gsap.ticker.add(tick); }
    };
    const leave = () => {
      gsap.ticker.remove(tick);
      ticking = false;
      const rest = Math.ceil((coin.angle + 1) / 360) * 360;
      gsap.to(coin, { angle: rest, speed: 0, duration: .8 + (rest - coin.angle) / 540, ease: 'power3.out', onUpdate: paint });
    };
    mark.addEventListener('pointerenter', enter);
    mark.addEventListener('pointerleave', leave);
    return () => {
      mark.removeEventListener('pointerenter', enter);
      mark.removeEventListener('pointerleave', leave);
      gsap.ticker.remove(tick);
      gsap.killTweensOf(coin);
    };
  }, []);

  useLayoutEffect(() => {
    if (!animateText) return;
    const context = gsap.context(() => {
      const root = rootRef.current;
      const lines = root.querySelectorAll('.hero__rule');
      const top = root.querySelectorAll('.hero__mark, .hero__meta, .hero__nav');
      const bottom = root.querySelectorAll('.hero__headline, .hero__intro');
      if (reducedMotion) {
        gsap.set(lines, { scaleX: 1 });
        gsap.to([...top, ...bottom], { autoAlpha: 1, duration: .2, ease: EASE.blend });
        return;
      }
      gsap.timeline({ defaults: { ease: EASE.arrive } })
        .fromTo(lines, { scaleX: 0 }, { scaleX: 1, duration: 1.2, stagger: .1 }, 0)
        .fromTo(top, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .08, clearProps: 'transform' }, .2)
        .fromTo(bottom, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .9, stagger: .1, clearProps: 'transform' }, .35);
    }, rootRef);
    return () => context.revert();
  }, [animateText]);

  return (
    <section className="hero" ref={rootRef} aria-labelledby="hero-title">
      <h1 id="hero-title" className="hero__title">{PERSON.mark} — {PERSON.role.toLowerCase()}</h1>
      <canvas ref={canvasRef} className="hero__canvas" aria-hidden="true" />

      <div className={`hero__frame${reveal ? ' hero__frame--visible' : ''}`}>
        <header className="hero__top">
          <a className="hero__mark" href="#top" aria-label={PERSON.name} ref={markRef}>
            <span className="hero__mark-letters" dangerouslySetInnerHTML={{ __html: letters }} />
            <span className="hero__mark-ring" ref={ringRef} dangerouslySetInnerHTML={{ __html: ring }} />
          </a>
          <SketchClock draw={animateText} />
          <nav className="hero__nav" aria-label="Main navigation">
            <a href={`mailto:${PERSON.email}`}>Let’s talk <span aria-hidden="true">↗</span></a>
          </nav>
          <span className="hero__rule hero__rule--top" aria-hidden="true" />
        </header>

        <div className="hero__word" ref={wordRef} aria-hidden="true" />

        <footer className="hero__bottom">
          <span className="hero__rule hero__rule--bottom" aria-hidden="true" />
          <div className="hero__headline">
            <p className="hero__discipline">{HERO.discipline}</p>
            <h2>{HERO.headline[0]}<br /><em>{HERO.headline[1]}</em></h2>
          </div>
          <div className="hero__intro">
            <p>{HERO.description}</p>
            <div className="hero__actions">
              <a className="text-link" href={`mailto:${PERSON.email}`}>{HERO.invitation} <span aria-hidden="true">↗</span></a>
              <button className="hero__replay" disabled={playing || reducedMotion} aria-label="Replay signature animation" title="Replay signature" onClick={() => {
                const scene = sceneRef.current;
                if (!scene || scene.entrance) return;
                setPlaying(true);
                scene.sequence.reset();
                scene.entrance = scene.sequence.play(0);
              }}>↻</button>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}
