/**
 * The coin's tour of a project's tools, on the tightrope (DotStage draws it:
 * balance).
 *
 * The coin is tossed from tag to tag. Standing over a tag it shows that tool;
 * then it crouches into the rope, the rope giving under it, and is tossed to
 * the next, turning end over end, and comes down showing that one, the rope
 * taking it and ringing out. A coin has two sides: the tool it is going to is
 * always put on the one turned away, so no mark ever changes in view; it is
 * turned up. It goes along the rope and back again, a tag at a time (never the
 * long way round to start over), and once it has stood at every tag the tour
 * is `done`: only then does the book, turning by itself, turn on (DotStage
 * turnDue), so a project with many tools is on show for as long as they take.
 *
 * Another project come round (by itself, or by the reader's hand), it is
 * tossed high from wherever it is, the tags changing under it while it is in
 * the air, and comes down on the nearer end of the new project's row, to go
 * along it from there: it never jumps across the rope. Tossed again while it
 * is still up (the reader flicking through the projects), it is kept up, a
 * coin juggled.
 *
 * A toss is for turning up another tool. Where the tool it is going to is the
 * one it shows already, it is not tossed: with nowhere to go (a project of one
 * tool; another project with the same tool in the same place) it is spun
 * where it stands, as a coin is spun on a table, round its upright and slowing,
 * the same mark coming round on both its sides; with a way to go (another
 * project, the same tool hung elsewhere) it rolls there along the rope on its
 * edge, whole turns, to stand upright on its tag.
 *
 * All by the clock, in plain numbers: nothing here draws. Lengths are in the
 * coin's radii unless they say px.
 */
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;
const smoother = v => { const t = clamp(v, 0, 1); return t ** 3 * (t * (t * 6 - 15) + 10); };

export const TOSS = {
  /** Standing at a tag (s), the last `crouch` of it crouched into the rope to go; and on a project at least `least` s, however few its tools. */
  hold: 1.3, crouch: .22, least: 3,
  /** The air: gravity (radii/s²), and how fast it turns over (half-turns/s). */
  gravity: 34, rate: 5.2,
  /** How high a toss goes: to the next tag, `hop[0]` and `hop[1]` of the way there, at most `hop[2]`; on to another project, `high`. */
  hop: [1.1, .22, 2.3], high: 3.3,
  /**
   * To the tool it shows already it is not tossed. Spun where it stands: `spin[0]` turns round its upright over
   * `spin[1]` s, after winding back `spin[2]` of a turn. Rolled to another tag: over `roll` s.
   */
  spin: [2, 1.25, .06], roll: .95,
  /** The tags hang evenly along the rope, this much of it clear of each post (Work.css .work__tool). */
  inset: .08,
  /**
   * The rope under it: how much further it gives under the crouch; let go, it whips back and rings out (`recoil`:
   * Hz, damping /s); a landing drives it down at `impact` radii/s (a hop, a high toss), and it takes the coin's weight
   * on its spring (`give`: rad/s, damping).
   */
  sag: .32, recoil: [3.1, 6], impact: [5.5, 8.5], give: [15, .3],
  /** The coin itself: how far it squats to go, and how far it is flattened landing (and how fast that dies away /s, and rings rad/s). */
  squat: .2, splat: [.3, 9, 20],
};

/** How long a toss to `top` radii is in the air (s), thrown from the rope. */
const airTime = top => 2 * Math.sqrt(2 * top / TOSS.gravity);
/** The high toss's time in the air (s): the book's turn is timed to it (DotStage tourWant). */
export const HIGH_TIME = airTime(TOSS.high);

/** Where along the rope (0 → 1) the tag of the `i`th of `count` tools hangs. */
export const stationAt = (i, count) => TOSS.inset + (1 - 2 * TOSS.inset) * (mod(i, count) + .5) / count;

/** The tag (its index in `tools`) that a coin at `c` along the rope, showing `tool`, stands at; -1 for none of them. */
const tagAt = (tools, c, tool) => tools.findIndex((name, i) => name === tool && Math.abs(stationAt(i, tools.length) - c) < 1e-3);

/** The side turned to the reader (0 or 1: `marks` has what each shows). */
const facing = tour => mod(Math.round(tour.turns), 2);
/** The tool on the side turned to the reader. */
export const tourShown = tour => tour.marks[facing(tour)];
/** Where along the rope it stands, or is coming down. */
export const tourFooting = tour => (tour.phase === 'air' ? tour.toss.c1 : tour.phase === 'roll' ? tour.move.c1 : tour.c);

/**
 * A tour begun: the coin standing at `c` along the rope (0 → 1), showing `tool`, the rope sagging `dip` px under it
 * already, with `project`'s `tools` hung on the rope. If that is not one of their tags (the project changed while
 * the coin was away), it is tossed onto the row at once.
 *
 * Read by the stage every frame: `c` and `h` (where it is along the rope, and how high over it), `sag` (px its
 * footing is below the rope's line), `turns` (half-turns end over end), `twirl` (turns round its upright, spun) and
 * `roll` (turns on its edge, rolling), `marks` (the tool on each side, the one it began on first), `sx` and `sy`
 * (its squash), `lean` (-1 → 1, the way it is going) and `kick` (a landing's knock,
 * the frame it lands), `rope` (where the rope is loaded, and how far it gives there, px), `lit` (the tag it stands
 * over, null in the air) and `done`.
 */
export function startTour(project, tools, c, tool, dip = 0) {
  const at = tagAt(tools, c, tool);
  return {
    project, tools, at, dir: at > 0 && at === tools.length - 1 ? -1 : 1,
    phase: 'stand', t: 0, age: 0, seen: new Set(), done: false, toss: null, way: 0,
    c, h: 0, sag: dip, turns: 0, twirl: 0, roll: 0, move: null, marks: [tool, tool], lit: at < 0 ? null : tool,
    sx: 1, sy: 1, lean: 0, kick: 0, landed: 0,
    rope: { c, dip, give: dip, v: null, from: 0, since: 0 },
  };
}

/** Where it is tossed next: on along the row (turning back at its ends), or, on no tag of this project's, onto the row's nearer end. */
function aim(tour) {
  const n = tour.tools.length;
  if (tour.at < 0) {
    // (As near either: the first.)
    const to = n > 1 && Math.abs(stationAt(n - 1, n) - tour.c) < Math.abs(stationAt(0, n) - tour.c) - 1e-6 ? n - 1 : 0;
    return { to, dir: to ? -1 : 1, high: true };
  }
  if (n < 2) return { to: tour.at, dir: 1, high: false };
  const dir = tour.at + tour.dir < 0 || tour.at + tour.dir >= n ? -tour.dir : tour.dir;
  return { to: tour.at + dir, dir, high: false };
}

/**
 * Off from where it stands, for where it is going next (aim): squatting to be tossed there, if that is another tool;
 * to the one it shows already, spun where it stands, or rolled there.
 */
function leave(tour, room) {
  const { to, dir } = aim(tour), c1 = stationAt(to, tour.tools.length), way = Math.sign(c1 - tour.c);
  if (tour.tools[to] !== tourShown(tour)) Object.assign(tour, { phase: 'crouch', t: 0, way });
  else if (Math.abs(c1 - tour.c) < 1e-3) spin(tour, room);
  else {
    // On its edge, a whole number of turns for the way (one at least), so it stands upright there.
    const turns = Math.max(1, Math.round(Math.abs(c1 - tour.c) * room.span / (TAU * room.r)));
    Object.assign(tour, { phase: 'roll', t: 0, dir, way, lit: null, move: { c0: tour.c, c1, turns } });
  }
}

/** Spun where it stands: the side turned away shows the same tool, and the rope shivers under it. */
function spin(tour, room) {
  tour.marks[1 - facing(tour)] = tourShown(tour);
  Object.assign(tour, { phase: 'spin', t: 0, way: 0 });
  if (tour.rope.v != null) tour.rope.v += TOSS.impact[0] * room.r * .3;
}

/**
 * Tossed, from wherever it is (on the rope, or in the air already): up to the toss's height and down onto its tag,
 * as a thrown thing goes; turning over at its rate, a whole number of half-turns, to land on the side turned away
 * now, which takes the tool it is going to.
 */
function launch(tour, room) {
  const { to, dir, high } = aim(tour), g = TOSS.gravity;
  const c1 = stationAt(to, tour.tools.length), reach = Math.abs(c1 - tour.c) * room.span / room.r;
  const top = high ? TOSS.high : Math.min(TOSS.hop[2], TOSS.hop[0] + TOSS.hop[1] * reach);
  // (Higher than that already, it only falls.)
  const v = Math.sqrt(2 * g * Math.max(0, top - tour.h));
  const time = (v + Math.sqrt(v * v + 2 * g * tour.h)) / g;
  const away = 1 - facing(tour), spun = tour.turns + TOSS.rate * time;
  let turns = Math.round(spun);
  if (mod(turns, 2) !== away) turns += turns > spun ? -1 : 1;
  if (turns - tour.turns < .75) turns += 2;
  tour.marks[away] = tour.tools[to];
  if (tour.phase !== 'air') Object.assign(tour.rope, { from: tour.rope.dip, since: 0 });
  tour.toss = { to, high, c0: tour.c, c1, h0: tour.h, v, time, n0: tour.turns, n1: turns, sag0: tour.sag };
  Object.assign(tour, { phase: 'air', t: 0, dir, way: Math.sign(c1 - tour.c), lit: null });
}

/**
 * The tour moved on by `dt` seconds. `want`: the project the book is on, or turning to (`project`, its `tools`),
 * whether the coin may go to it yet (`ready`: the book's own turn is timed so the page changes under the coin in the
 * air), and whether the book turns on by itself once the tour is done (`auto`: then the coin waits for it). `room`:
 * the coin's radius, the rope's length and how far it sags by itself and under the coin's weight, px
 * (`r`, `span`, `droop`, `weight`). Returns 'toss', 'spin' or 'roll' on the frame it sets off, 'land' on the frame
 * it is on its tag again, else null.
 */
export function stepTour(tour, dt, want, room) {
  const { r, droop, weight } = room;
  let event = null;
  tour.age += dt;
  tour.landed += dt;
  tour.kick = 0;
  // Another project's tags on the rope: from the air it is tossed again, where it is; standing, it crouches to go.
  if (want.project !== tour.project && want.ready) {
    const tool = tourShown(tour);
    Object.assign(tour, { project: want.project, tools: want.tools, age: 0, done: false });
    tour.seen.clear();
    tour.at = tour.phase === 'air' ? -1 : tagAt(tour.tools, tour.c, tool);
    if (tour.phase === 'air') { launch(tour, room); event = 'toss'; }
    // (Its own tool, where it stands already: it is spun there, for the change.)
    else if (tour.phase === 'stand' && tour.at >= 0) { spin(tour, room); event = 'spin'; }
  }
  const waiting = want.project !== tour.project || (tour.done && want.auto);

  if (tour.phase === 'stand') {
    tour.t += dt;
    let go = tour.at < 0;
    if (!go && tour.t >= TOSS.hold - TOSS.crouch) {
      // It has stood here. Once it has stood at them all, and the project has been on show long enough, the tour is done.
      tour.seen.add(tour.at);
      if (tour.seen.size >= tour.tools.length && tour.age >= TOSS.least - TOSS.crouch) tour.done = true;
      go = !(waiting || (tour.done && want.auto));
    }
    if (go) {
      leave(tour, room);
      if (tour.phase !== 'crouch') event = tour.phase;
    }
  } else if (tour.phase === 'crouch') {
    tour.t += dt;
    if (tour.t >= TOSS.crouch) { launch(tour, room); event = 'toss'; }
  } else if (tour.phase === 'spin') {
    // Round its upright: wound back a little, let go, and slowing to a stop square to the reader.
    const [turns, time, wind] = TOSS.spin, k = (tour.t += dt) / time, a = .16;
    if (k >= 1) Object.assign(tour, { phase: 'stand', t: 0, twirl: 0 });
    else tour.twirl = k < a ? -wind * smoother(k / a) : -wind + (turns + wind) * (1 - (1 - (k - a) / (1 - a)) ** 3);
  } else if (tour.phase === 'roll') {
    const move = tour.move, k = smoother((tour.t += dt) / TOSS.roll);
    if (tour.t < TOSS.roll) {
      tour.c = mix(move.c0, move.c1, k);
      tour.roll = -tour.way * move.turns * k;
    } else {
      // There (if the project has not changed again meanwhile: then it is on no tag, and goes on).
      const at = tagAt(tour.tools, move.c1, tourShown(tour));
      Object.assign(tour, { phase: 'stand', t: 0, c: move.c1, roll: 0, at, lit: at < 0 ? null : tour.tools[at], age: 0, kick: tour.way * .6 });
      event = 'land';
    }
  } else {
    const toss = tour.toss;
    tour.t += dt;
    if (tour.t < toss.time) {
      const t = tour.t, k = t / toss.time;
      tour.c = mix(toss.c0, toss.c1, k);
      tour.h = Math.max(0, toss.h0 + toss.v * t - TOSS.gravity * t * t / 2);
      tour.turns = mix(toss.n0, toss.n1, k);
      // (Over the rope where it left it, then where it will meet it: not the rope ringing under it meanwhile.)
      tour.sag = mix(toss.sag0, droop * 4 * toss.c1 * (1 - toss.c1), k);
    } else {
      // Down, on its tag: the rope takes it.
      Object.assign(tour, {
        phase: 'stand', t: 0, at: toss.to, c: toss.c1, h: 0, turns: mod(toss.n1, 2), lit: tour.tools[toss.to],
        landed: 0, kick: tour.way,
      });
      if (toss.high) tour.age = 0;
      Object.assign(tour.rope, { c: tour.c, give: 0, v: TOSS.impact[toss.high ? 1 : 0] * r });
      event = 'land';
    }
  }

  // The rope: loose and ringing out while the coin is in the air (still by the time it comes down); under it, on
  // its spring, and pressed further by the crouch.
  const rope = tour.rope;
  if (tour.phase === 'air') {
    rope.since += dt;
    const [hz, damping] = TOSS.recoil;
    rope.dip = rope.from * Math.exp(-damping * rope.since) * Math.cos(TAU * hz * rope.since) * clamp((tour.toss.time - tour.t) / .2, 0, 1);
  } else {
    // (The first landing of all, off the book: it comes down on a rope not yet under it.)
    rope.v ??= TOSS.impact[0] * r;
    const [w, z] = TOSS.give, steps = Math.max(1, Math.ceil(dt * 240)), h = dt / steps;
    for (let i = 0; i < steps; i++) {
      rope.v += (w * w * (weight - rope.give) - 2 * z * w * rope.v) * h;
      rope.give += rope.v * h;
    }
    rope.c = tour.c;
    rope.dip = rope.give + (tour.phase === 'crouch' ? TOSS.sag * r * smoother(tour.t / TOSS.crouch) : 0);
    tour.sag = rope.dip + droop * 4 * tour.c * (1 - tour.c);
  }

  // The coin: squatting to go (and up again as it pushes off), leaning the way it is going; flattened as it lands.
  let squash = 0;
  tour.lean = 0;
  if (tour.phase === 'crouch') {
    const k = tour.t / TOSS.crouch;
    squash = TOSS.squat * (k < .7 ? smoother(k / .7) : 1 - smoother((k - .7) / .3));
    tour.lean = tour.way * smoother(k);
  } else if (tour.phase === 'air') {
    tour.lean = tour.way * (1 - tour.t / tour.toss.time);
  } else if (tour.phase === 'roll') {
    tour.lean = tour.way * Math.sin(Math.PI * clamp(tour.t / TOSS.roll, 0, 1));
  } else {
    const [amount, decay, ring] = TOSS.splat;
    squash = amount * Math.exp(-decay * tour.landed) * Math.sin(ring * tour.landed);
  }
  tour.sy = 1 - squash;
  tour.sx = 1 + squash * .5;
  return event;
}

/**
 * The tour over (the coin leaving the rope): a toss in the air is brought down where it was going, a roll is there,
 * a spin is still. Returns where it
 * stands on the rope (`c`), the tool it shows, and whether that is on the other side from the one it began on.
 */
export function endTour(tour) {
  if (tour.phase === 'air') Object.assign(tour, { c: tour.toss.c1, turns: mod(tour.toss.n1, 2), h: 0 });
  if (tour.phase === 'roll') tour.c = tour.move.c1;
  Object.assign(tour, { twirl: 0, roll: 0 });
  return { c: tour.c, tool: tourShown(tour), over: facing(tour) === 1 };
}
