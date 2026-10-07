import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { CONTACT, PERSON } from '../../content/site.js';
import { stage } from '../../webgl/stage/DotStage.js';
import { EASE, reducedMotion } from '../../brand/motion.js';
import { useKarachiTime } from '../../lib/useKarachiTime.js';
import { sectionLink } from '../../lib/sectionLink.js';
import { copy } from '../work/EmailCard.jsx';
import RingButton from '../ui/RingButton.jsx';
import Hint from '../ui/Hint.jsx';
import { sealFace, initialsOf } from '../../webgl/coinMarks.js';
import { sendThroughWebflow } from '../../lib/webflowForm.js';
import './Contact.css';

const TAU = Math.PI * 2;
/** A press that moves less than this (px) is a tap, not a drag. */
const TAP = 6;
const EMPTY = { name: '', kind: '', budget: '', idea: '', email: '' };
const BUDGET = CONTACT.budget;
/** A budget as it is written: $4,500. */
const money = value => `$${Number(value).toLocaleString('en-US')}`;
const TODAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
const LINKS = PERSON.links.filter(link => link.href);
/** How long after the reader stops writing their name the coin turns over to their seal (ms). */
const SIGNED = 650;

/** What is missing from the letter, field by field (the note written beside each), or nothing. */
function check(values) {
  const missing = {};
  if (!values.name.trim()) missing.name = 'your name';
  if (!values.kind) missing.kind = 'circle one';
  if (!values.budget) missing.budget = 'slide it to a figure';
  if (values.idea.trim().length < 8) missing.idea = 'a line or two';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) missing.email = 'so I can write back';
  return missing;
}

/**
 * The letter as it is sent: its fields, under the Webflow form's own names
 * (CONTACT.fields), and the whole of it written out, for the email it becomes
 * if the form cannot take it.
 */
function letterOf(values) {
  const v = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value).trim()]));
  const kind = CONTACT.kinds.find(item => item.label === v.kind);
  const budget = v.budget ? money(v.budget) : '';
  const F = CONTACT.fields;
  const fields = { [F.name]: v.name, [F.email]: v.email, [F.kind]: kind?.short ?? v.kind, [F.budget]: budget, [F.idea]: v.idea };
  const subject = `A letter from ${v.name}: ${kind?.short ?? v.kind}`;
  const body = `Dear Saad,\n\nMy name is ${v.name}, ${CONTACT.lead} ${v.kind}, ${BUDGET.lead} ${budget}.\n\nHere’s the idea:\n${v.idea}\n\nWrite back to me at ${v.email}.\n\nYours,\n${v.name}`;
  return { fields, subject, body, mailto: `mailto:${PERSON.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}

/** The torn top edge of the page: a ragged line, the same on every visit (a seeded walk, not Math.random). */
function tornEdge(points = 46) {
  let seed = 7;
  const next = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const edge = Array.from({ length: points + 1 }, (_, i) => `${(i / points * 100).toFixed(2)}% ${(next() * 9 + (i % 2) * 3).toFixed(1)}px`);
  return `polygon(${edge.join(', ')}, 100% 100%, 0 100%)`;
}

/**
 * The letter: the last page of the journal, torn out, to be written on. The
 * live one is the form; the same, read-only (`copy`), is what folds when it is
 * sealed, so the paper never changes as it starts to move.
 */
function Letter({ values, set, missing = {}, copy: still = false, prefix, ringRef, hot, clip }) {
  // (`after`: the punctuation that follows it, kept on its line.)
  const field = (name, label, props = {}, after = '') => (
    <span className="letter__field" data-missing={Boolean(missing[name])}>
      <input className="letter__input" id={`${prefix}-${name}`} name={name} aria-label={label} value={values[name]}
        readOnly={still} tabIndex={still ? -1 : undefined} autoComplete={still ? 'off' : props.autoComplete}
        onChange={event => set?.(name, event.target.value)} aria-invalid={Boolean(missing[name])} {...props} />
      {after}
      {missing[name] && <span className="letter__missing" role={still ? undefined : 'alert'}>{missing[name]}</span>}
    </span>
  );
  return (
    <div className="letter-wrap">
      <div className="letter" style={{ clipPath: clip }}>
        <span className="letter__margin" aria-hidden="true" />
        <p className="letter__date">{TODAY}</p>
        <p className="letter__line letter__dear">Dear Saad,</p>
        <p className="letter__line">My name is {field('name', 'Your name', { placeholder: 'your name', autoComplete: 'name' }, ',')}</p>
        <fieldset className="letter__kinds" data-missing={Boolean(missing.kind)}>
          <legend className="letter__line">{CONTACT.lead}</legend>
          {CONTACT.kinds.map(({ label: kind }) => (
            <label className="letter__kind" key={kind}>
              <input type="radio" name={`${prefix}-kind`} value={kind} checked={values.kind === kind} disabled={still}
                onChange={() => set?.('kind', kind)} />
              <span>{kind}</span>
              {/* Circled by hand when chosen. */}
              <svg className="letter__circle" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
                <path pathLength="1" d="M70 5 C 30 1, 4 10, 5 24 C 6 38, 40 42, 72 40 C 104 38, 118 28, 114 15 C 110 4, 84 2, 52 6" />
              </svg>
            </label>
          ))}
          {missing.kind && <span className="letter__missing" role={still ? undefined : 'alert'}>{missing.kind}</span>}
        </fieldset>
        {/* The budget: a figure written in as the reader slides it along a ruled scale, $1k to $10k. */}
        <p className="letter__line letter__budget-line">
          <label htmlFor={`${prefix}-budget`}>{BUDGET.lead}</label>{' '}
          <output className="letter__budget" htmlFor={`${prefix}-budget`} data-set={Boolean(values.budget)}>
            {values.budget ? money(values.budget) : '$ ———'}
          </output>.
        </p>
        <span className="letter__field letter__field--budget" data-missing={Boolean(missing.budget)}>
          <input type="range" className="letter__range" id={`${prefix}-budget`} name="budget" min={BUDGET.min} max={BUDGET.max} step={BUDGET.step}
            value={values.budget || (BUDGET.min + BUDGET.max) / 2} disabled={still} tabIndex={still ? -1 : undefined} data-set={Boolean(values.budget)}
            aria-valuetext={values.budget ? `${money(values.budget)} US dollars` : 'not chosen yet'} aria-invalid={Boolean(missing.budget)}
            style={{ '--at': ((values.budget || (BUDGET.min + BUDGET.max) / 2) - BUDGET.min) / (BUDGET.max - BUDGET.min) }}
            onChange={event => set?.('budget', event.target.value)} />
          <span className="letter__scale" aria-hidden="true">
            <span>{money(BUDGET.min).replace(',000', 'k')}</span>
            <span>{money(BUDGET.max).replace(',000', 'k')}</span>
          </span>
          {missing.budget && <span className="letter__missing" role={still ? undefined : 'alert'}>{missing.budget}</span>}
        </span>
        <label className="letter__line" htmlFor={`${prefix}-idea`}>Here’s the idea:</label>
        <span className="letter__field letter__field--idea" data-missing={Boolean(missing.idea)}>
          <textarea className="letter__idea" id={`${prefix}-idea`} name="idea" rows={4} value={values.idea} readOnly={still}
            tabIndex={still ? -1 : undefined} placeholder="What it is, who it’s for, and when you’d like it live."
            onChange={event => set?.('idea', event.target.value)} aria-invalid={Boolean(missing.idea)} />
          {missing.idea && <span className="letter__missing" role={still ? undefined : 'alert'}>{missing.idea}</span>}
        </span>
        <p className="letter__line">Write back to me at {field('email', 'Your email', { type: 'email', placeholder: 'you@example.com', autoComplete: 'email', inputMode: 'email' }, '.')}</p>
        <div className="letter__foot">
          <p className="letter__sign">Yours,<span className="letter__signature">{values.name.trim() || ' '}</span></p>
          {/* Where the coin goes: a ring pressed into the paper, waiting for the seal. */}
          <div className="letter__seal" ref={ringRef} data-hot={hot} aria-hidden="true">
            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" pathLength="1" /></svg>
            <span>seal here</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The contact: write on the last page.
 *
 * The journal's last page, torn out, is the form: the reader writes on it
 * (their name, what they want built, circled, the idea, where to write back),
 * and the coin, which drops onto the desk beside it as the page comes into
 * view, is its seal: Saad's monogram, until they sign, when it turns over to
 * their own (their initials, their name round the rim). Dragged onto the ring
 * on the page (or tapped, or the button pressed), it seals it: the page folds
 * in half, an envelope comes up round it, the flap shuts, the coin stamps
 * their seal on it in gold, and off it flies, once it has gone: straight into
 * Saad's Webflow Forms, through the page's own Form Block (lib/webflowForm).
 * The envelope waits, hovering, until Webflow says it has it; if it cannot
 * take it, the letter says so, and offers itself as an email instead.
 *
 * The coin is drawn by the stage over `.contact__coin`, a stand-in the size of
 * the coin, which everything here moves (stage.setContact).
 */
export default function Contact() {
  const rootRef = useRef(null);
  const deskRef = useRef(null);
  const coinRef = useRef(null);
  const ringRef = useRef(null);
  const postRef = useRef(null);
  const formRef = useRef(null);
  const pose = useMemo(() => ({ shown: false, lift: 0, spin: 0, tiltX: 0, tiltY: 0, rest: true, seen: null, face: null }), []);
  const [values, setValues] = useState(EMPTY);
  const [missing, setMissing] = useState({});
  /** 'write', 'sealing' (folding into the envelope, sent, and off), 'sent', or 'failed' (it could not be sent). */
  const [phase, setPhase] = useState('write');
  const [hot, setHot] = useState(false);
  const [copied, setCopied] = useState(null);
  const time = useKarachiTime();
  const clip = useMemo(() => tornEdge(), []);
  const letter = letterOf(values);
  const rim = useId();
  const rimText = `${values.name.trim().toUpperCase().slice(0, 30)} · ${TODAY.toUpperCase()} · `;

  const set = (name, value) => {
    setValues(was => ({ ...was, [name]: value }));
    if (missing[name]) setMissing(({ [name]: _, ...rest }) => rest);
  };

  // The coin: the stage draws it wherever its stand-in is.
  useLayoutEffect(() => {
    stage.setContact({ proxy: coinRef.current, pose });
    return () => stage.setContact(null);
  }, [pose]);

  // It drops onto the desk the first time the letter comes into view, from above the screen, bouncing, turning.
  useEffect(() => {
    const coin = coinRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      pose.shown = true;
      if (reducedMotion) return;
      const above = coin.getBoundingClientRect().bottom + 40;
      gsap.fromTo(coin, { y: -above }, { y: 0, duration: 1.25, ease: 'bounce.out' });
      gsap.fromTo(pose, { spin: 0, tiltX: .9 }, { spin: TAU * 2, tiltX: 0, duration: 1.1, ease: 'power2.out' });
    }, { threshold: .3 });
    observer.observe(deskRef.current);
    return () => { observer.disconnect(); gsap.killTweensOf([coin, pose]); };
  }, [pose]);

  /**
   * Their seal: once they have stopped writing their name for a moment, the coin
   * turns over to it (their initials, their name round the rim), lifting a little
   * as it goes; with the name gone, back to Saad's monogram. The new face is put
   * on the side facing away first, so it is only ever seen coming round.
   */
  const signed = sealFace(values.name);
  const [own, setOwn] = useState(false);
  const turnTo = face => {
    if (face === pose.face) return;
    pose.face = face;
    const done = () => { pose.seen = pose.face; setOwn(Boolean(pose.face)); };
    // Not on the desk yet, or in the middle of dropping onto it: it simply is theirs when it lands.
    if (!pose.shown || reducedMotion || gsap.isTweening(pose)) { done(); return; }
    gsap.timeline({ onComplete: done })
      .to(pose, { spin: (Math.round(pose.spin / Math.PI) + 1) * Math.PI, duration: .75, ease: 'power2.inOut' }, 0)
      .to(pose, { keyframes: [{ lift: .18 }, { lift: 0 }], duration: .75, ease: 'power1.inOut' }, 0);
  };
  useEffect(() => {
    if (phase !== 'write') return undefined;
    const timer = setTimeout(() => turnTo(signed), SIGNED);
    return () => clearTimeout(timer);
  }, [signed, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The coin shakes its head: the letter is not ready. The first thing missing is shown and taken to. */
  const refuse = problems => {
    setMissing(problems);
    gsap.killTweensOf(coinRef.current);
    gsap.to(coinRef.current, { x: 0, y: 0, duration: .5, ease: EASE.land });
    gsap.timeline()
      .to(pose, { lift: 0, tiltX: 0, duration: .2 })
      .to(pose, { keyframes: [{ tiltY: .55 }, { tiltY: -.5 }, { tiltY: .35 }, { tiltY: -.2 }, { tiltY: 0 }], duration: .6, ease: 'power1.inOut' }, 0)
      .add(() => { pose.rest = true; });
    const first = ['name', 'kind', 'budget', 'idea', 'email'].find(name => problems[name]);
    const target = first === 'kind'
      ? formRef.current.querySelector('.letter__kind input')
      : formRef.current.querySelector(`[name="${first}"]`);
    target?.focus({ preventScroll: true });
  };

  /** Seal it, if it is ready: the envelope, the stamp, and off. */
  const seal = () => {
    if (phase !== 'write') return;
    const problems = check(values);
    if (Object.keys(problems).length) { refuse(problems); return; }
    // Sealed the moment they signed (before it had turned over by itself): their seal, all the same.
    if (pose.face !== signed) { pose.face = pose.seen = signed; setOwn(true); }
    setMissing({});
    setHot(false);
    setPhase('sealing');
  };

  // The sealing, once the folding copy of the page is in place over the page. The letter is sent as it starts.
  useLayoutEffect(() => {
    if (phase !== 'sealing') return undefined;
    let live = true, outcome = null, waiting = false;
    const sending = sendThroughWebflow(CONTACT.form, letter.fields).then(
      () => { outcome = 'sent'; if (live && waiting) { gsap.killTweensOf(post, 'y'); timeline.play(); } },
      () => { outcome = 'failed'; if (live && (waiting || reducedMotion)) setPhase('failed'); },
    );
    if (reducedMotion) {
      sending.then(() => { if (live && outcome === 'sent') setPhase('sent'); });
      return () => { live = false; };
    }
    const post = postRef.current, coin = coinRef.current;
    const q = selector => post.querySelector(selector);
    const top = q('.contact__half--top'), sheet = q('.contact__sheet'), flap = q('.contact__flap');
    const envelope = [q('.contact__env-back'), q('.contact__env-front'), flap];
    const imprint = q('.contact__imprint');
    // The copy is the page's own size (the page goes on taking its room in the flow, unseen, meanwhile).
    post.style.setProperty('--letter-h', `${formRef.current.querySelector('.letter-wrap').offsetHeight}px`);
    // From the coin's seat to where the seal goes, on the flap's tip, once it is shut.
    const toImprint = axis => {
      const a = imprint.getBoundingClientRect(), b = coin.parentElement.getBoundingClientRect();
      return axis === 'x' ? a.left + a.width / 2 - (b.left + b.width / 2) : a.top + a.height / 2 - (b.top + b.height / 2);
    };
    pose.rest = false;
    gsap.killTweensOf([coin, pose]);
    const timeline = gsap.timeline({ defaults: { ease: EASE.arrive }, onComplete: () => setPhase('sent') });
    timeline
      // The coin back to its seat meanwhile, if it was dropped on the ring.
      .to(coin, { x: 0, y: 0, duration: .55, ease: 'power3.inOut' }, 0)
      .to(pose, { lift: 0, tiltX: 0, tiltY: 0, duration: .4 }, 0)
      // The page folds in half, toward the reader.
      .to(top, { rotateX: -180, duration: .8, ease: 'power2.inOut' }, .1)
      // The envelope comes up round it, and it slides down in.
      .fromTo(envelope, { yPercent: 120, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .6, ease: 'power3.out' }, .45)
      .to(sheet, { yPercent: 5, duration: .45, ease: 'power2.in' }, .95)
      // The flap shuts over it (in front of the page from the moment it passes upright).
      .to(flap, { rotateX: 0, duration: .45, ease: 'power2.inOut' }, 1.3)
      .set(flap, { zIndex: 4 }, 1.52)
      // The coin is raised, turns over above the flap's tip, and is pressed down onto it: the seal.
      .to(pose, { lift: .4, duration: .3, ease: 'power2.out' }, 1.6)
      .to(coin, { x: () => toImprint('x'), y: () => toImprint('y'), duration: .45, ease: 'power2.inOut' }, 1.6)
      .to(pose, { spin: `+=${TAU}`, duration: .45, ease: 'power2.inOut' }, 1.6)
      .to(pose, { lift: -.06, duration: .12, ease: 'power3.in' }, 2.05)
      .fromTo(imprint, { scale: 1.25, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: .25, ease: 'power2.out' }, 2.17)
      .fromTo(post, { scale: 1 }, { keyframes: [{ scale: .985 }, { scale: 1 }], duration: .3 }, 2.17)
      .to(pose, { lift: 0, duration: .5, ease: EASE.landTight }, 2.17)
      .to(coin, { x: 0, y: 0, duration: .6, ease: 'power3.inOut' }, 2.35)
      // Sealed. It goes once Webflow has the letter: if it has not said so yet, the envelope waits, hovering.
      .add(() => {
        if (outcome === 'sent') return;
        timeline.pause();
        if (outcome === 'failed') { setPhase('failed'); return; }
        waiting = true;
        gsap.to(post, { y: -8, duration: .9, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      }, 2.45)
      // And off it goes, into Saad's inbox.
      .to(post, { x: () => window.innerWidth * .55, y: () => -window.innerHeight * .9, rotation: -16, scale: .55, duration: .85, ease: 'power3.in' }, 2.46)
      .add(() => { pose.rest = true; }, 2.9);
    return () => { live = false; timeline.kill(); gsap.killTweensOf(post); pose.rest = true; };
  }, [phase, pose]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Another letter: a fresh page. */
  const again = () => {
    setValues(EMPTY);
    setCopied(null);
    setPhase('write');
    requestAnimationFrame(() => formRef.current?.querySelector('[name="name"]')?.focus({ preventScroll: true }));
  };
  /** The same letter, back on the desk, to be sealed again. */
  const retry = () => {
    setCopied(null);
    setPhase('write');
    gsap.to(pose, { lift: 0, tiltX: 0, tiltY: 0, duration: .3, onComplete: () => { pose.rest = true; } });
  };
  const copyLetter = async () => { if (await copy(`To: ${PERSON.email}\nSubject: ${letter.subject}\n\n${letter.body}`)) setCopied('letter'); };

  /* ----- the coin in the hand ------------------------------------------ */

  const drag = useRef(null);
  const onPointerDown = event => {
    if (phase !== 'write' || event.button > 0) return;
    const coin = coinRef.current;
    coin.setPointerCapture(event.pointerId);
    gsap.killTweensOf(coin);
    drag.current = {
      id: event.pointerId, x0: event.clientX, y0: event.clientY,
      bx: Number(gsap.getProperty(coin, 'x')), by: Number(gsap.getProperty(coin, 'y')),
      moved: 0, lx: event.clientX, lt: performance.now(), vx: 0, vy: 0,
    };
    pose.rest = false;
    gsap.to(pose, { lift: .22, duration: .3, ease: 'power2.out' });
  };
  const onPointerMove = event => {
    const hand = drag.current;
    if (!hand || hand.id !== event.pointerId) return;
    const coin = coinRef.current, seat = coin.parentElement.getBoundingClientRect();
    let x = hand.bx + event.clientX - hand.x0, y = hand.by + event.clientY - hand.y0;
    hand.moved = Math.max(hand.moved, Math.hypot(event.clientX - hand.x0, event.clientY - hand.y0));
    // Near the ring it is drawn in toward it, a little, as a magnet would.
    const ring = ringRef.current.getBoundingClientRect();
    const rx = ring.left + ring.width / 2 - (seat.left + seat.width / 2), ry = ring.top + ring.height / 2 - (seat.top + seat.height / 2);
    const near = Math.hypot(x - rx, y - ry), reach = ring.width * 1.4;
    const pull = near < reach ? (1 - near / reach) * .45 : 0;
    x += (rx - x) * pull; y += (ry - y) * pull;
    gsap.set(coin, { x, y });
    setHot(near < ring.width * .75);
    // It leans into the way it is going.
    const now = performance.now(), dt = Math.max(8, now - hand.lt);
    hand.vx += ((event.clientX - hand.lx) / dt - hand.vx) * .3;
    hand.lx = event.clientX; hand.lt = now;
    pose.tiltY = gsap.utils.clamp(-.6, .6, hand.vx * .35);
  };
  const onPointerUp = event => {
    const hand = drag.current;
    if (!hand || hand.id !== event.pointerId) return;
    drag.current = null;
    const coin = coinRef.current;
    if (coin.hasPointerCapture(event.pointerId)) coin.releasePointerCapture(event.pointerId);
    // A tap, or dropped on the ring: seal it. Anywhere else: back to its seat.
    if (hand.moved < TAP || hot) { seal(); if (hand.moved < TAP) gsap.to(pose, { lift: 0, duration: .3 }); return; }
    gsap.to(coin, { x: 0, y: 0, duration: 1, ease: EASE.land });
    gsap.to(pose, { lift: 0, tiltY: 0, duration: .4, onComplete: () => { pose.rest = true; } });
  };

  const sealing = phase !== 'write';
  return (
    <section className="contact" id="contact" ref={rootRef} aria-labelledby="contact-title" data-phase={phase}>
      <div className="contact__body">
        <div className="contact__intro">
          <h2 className="contact__title" id="contact-title">{CONTACT.title}</h2>
          <p className="contact__lede">{CONTACT.lede}</p>
          <div className="contact__direct">
            <p className="contact__label">{CONTACT.direct}</p>
            <div className="contact__address">
              <a href={`mailto:${PERSON.email}`}>{PERSON.email}</a>
              <button type="button" className="contact__copy" aria-live="polite"
                onClick={async () => { if (await copy(PERSON.email)) setCopied('address'); }}>
                {copied === 'address' ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            {LINKS.length > 0 && <>
              <p className="contact__label contact__label--links">{CONTACT.elsewhere}</p>
              <ul className="contact__links">
                {LINKS.map(link => <li key={link.label}><a href={link.href} target="_blank" rel="noreferrer">{link.label} <span aria-hidden="true">↗</span></a></li>)}
              </ul>
            </>}
            <p className="contact__time">It’s <span>{time}</span> for me in Karachi.</p>
          </div>
        </div>

        <div className="contact__desk" ref={deskRef}>
          <div className="contact__page">
            {/* The page to write on. While it is sealed it is hidden under its folding copy (.contact__post). */}
            <form className="contact__form" ref={formRef} noValidate aria-label="A letter to Saad" inert={sealing ? '' : undefined}
              onSubmit={event => { event.preventDefault(); seal(); }}>
              <Letter values={values} set={set} missing={missing} prefix="letter" ringRef={ringRef} hot={hot} clip={clip} />
              <div className="contact__send">
                <RingButton as="button" type="submit" motion arrow>Seal it and send</RingButton>
              </div>
            </form>

            {phase === 'sealing' && (
              <div className="contact__post" ref={postRef} aria-hidden="true">
                <div className="contact__env-back" />
                {/* The page, folding in half: its top half (over its own back, blank paper), and its bottom half. */}
                <div className="contact__sheet">
                  <div className="contact__half contact__half--bottom">
                    <div className="contact__copy-of"><Letter values={values} copy prefix="bottom" clip={clip} /></div>
                  </div>
                  <div className="contact__half contact__half--top">
                    <div className="contact__copy-of"><Letter values={values} copy prefix="top" clip={clip} /></div>
                    <div className="contact__half-back" />
                  </div>
                </div>
                <svg className="contact__env-front" viewBox="0 0 100 60" preserveAspectRatio="none">
                  <path className="contact__pocket contact__pocket--side" d="M0 0 L50 33 L0 60 Z" />
                  <path className="contact__pocket contact__pocket--side" d="M100 0 L50 33 L100 60 Z" />
                  <path className="contact__pocket contact__pocket--foot" d="M0 60 L50 29 L100 60 Z" />
                </svg>
                <div className="contact__flap">
                  <svg className="contact__flap-out" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 0 H100 L50 100 Z" /></svg>
                  <svg className="contact__flap-in" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 100 H100 L50 0 Z" /></svg>
                  {/* Their seal, as the coin struck it: their initials, their name and the day round the rim. */}
                  <span className="contact__imprint">
                    <svg viewBox="0 0 100 100">
                      <defs><path id={rim} d="M50 50 m-38.5 0 a38.5 38.5 0 1 1 77 0 a38.5 38.5 0 1 1 -77 0" /></defs>
                      <circle className="contact__imprint-ring" cx="50" cy="50" r="31" />
                      <text className="contact__imprint-rim"><textPath href={`#${rim}`} textLength="240" lengthAdjust="spacing">{rimText}</textPath></text>
                      <text className="contact__imprint-initials" x="50" y="50" textAnchor="middle" dominantBaseline="central">{initialsOf(values.name)}</text>
                    </svg>
                  </span>
                </div>
              </div>
            )}

            {phase === 'sent' && (
              <div className="contact__sent" role="status">
                <p className="contact__sent-title">{CONTACT.sent.title}</p>
                <p className="contact__sent-text">{CONTACT.sent.text} <em>{values.email.trim()}</em>.</p>
                <div className="contact__sent-actions">
                  <RingButton as="button" onClick={again}>Write another</RingButton>
                </div>
              </div>
            )}

            {phase === 'failed' && (
              <div className="contact__sent contact__sent--failed" role="alert">
                <p className="contact__sent-title">{CONTACT.failed.title}</p>
                <p className="contact__sent-text">{CONTACT.failed.text}</p>
                <div className="contact__sent-actions">
                  <RingButton as="button" onClick={retry}>Try again</RingButton>
                  <RingButton href={letter.mailto} arrow>Send it by email</RingButton>
                  <RingButton as="button" onClick={copyLetter}>{copied === 'letter' ? 'Copied ✓' : 'Copy the letter'}</RingButton>
                </div>
              </div>
            )}
          </div>

          {/* The coin's seat on the desk, and the coin (the stage draws it over its stand-in). */}
          <div className="contact__rest">
            <Hint className="contact__nudge" kind="drag" on={phase === 'write'}>{own ? CONTACT.nudgeSigned : CONTACT.nudge}</Hint>
            <div className="contact__seat">
              <button type="button" className="contact__coin" ref={coinRef} data-cursor="Drag me onto the seal" data-cursor-icon="drag" aria-label={`${own ? `Your seal, ${initialsOf(values.name)}` : 'The seal'}. Drag it onto the letter, or press it, to seal the letter and send it.`}
                disabled={sealing} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); seal(); } }} />
            </div>
          </div>
        </div>
      </div>

      <footer className="contact__foot">
        <p>© {new Date().getFullYear()} {PERSON.name}</p>
        <p>{CONTACT.credit}</p>
        <a className="contact__top" {...sectionLink('top')}>Back to the top <span aria-hidden="true">↑</span></a>
      </footer>
    </section>
  );
}
