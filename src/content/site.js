/**
 * Everything the site says, in one place.
 *
 * The page is an engineering drawing, and a drawing set is made of numbered
 * sheets. Each section below is a sheet. The head rail's stations are the
 * sheet numbers; the title block letters its fields.
 *
 * ── PLACEHOLDERS ────────────────────────────────────────────────────────────
 * Anything in [square brackets] is a placeholder and is rendered looking like
 * one. Nothing here invents a client, a date, a number or a quote — those are
 * yours to fill in. Search this file for "[" to find every gap.
 *
 * WEBFLOW: this file is the CMS. Every array below is a collection.
 */

export const PERSON = {
  name: 'Saad Aziz',
  mark: 'SAADi',
  role: 'Software engineer and freelance creative developer',
  city: 'Islamabad/Rawalpindi',
  timezone: 'Asia/Karachi',
  /** Shown on the contact sheet and nowhere else. Replace before launch. */
  email: 'saad.azieiz@gmail.com',
  /** Optional. Leave a string empty to hide that link. */
  links: [
    { label: 'LinkedIn', href: '' },
    { label: 'X', href: '' },
    { label: 'GitHub', href: '' },
  ],
};

/**
 * Availability.
 *
 * The page makes exactly one claim about whether work can be taken on, and
 * this is it — so it has to be true. Flip it the day it stops being.
 */
export const AVAILABLE = true;
export const STATUS = AVAILABLE
  ? 'Available for freelance work'
  : 'Booked — say hello anyway';

/** The sheets, in order. `id` is the anchor; `index` is the head rail station. */
export const SHEETS = [
  { id: 'work', index: '01', label: 'Work' },
  { id: 'about', index: '02', label: 'About' },
  { id: 'contact', index: '03', label: 'Contact' },
];

/** Sheet 00 — the hero. */
export const HERO = {
  headline: ['A website worth', 'remembering.'],
  description: 'I design and build distinctive websites for people who care how their business shows up.',
  invitation: 'Tell me what you’re making',
  discipline: 'Independent design & development',
};

/** The title block under the wordmark (retired from the hero; kept for the set). */
export const TITLE_BLOCK = {
  subject: {
    field: 'Subject',
    lede: ['The letters above are a ', 'shader', ' I wrote.'],
    note: 'No model, no image — outlines cut from the type, extruded, and lit by hand in GLSL.',
  },
  practice: {
    field: 'Practice',
    note: 'Software engineer and freelance creative developer — sites, interfaces, and the 3D inside them, end to end.',
  },
  status: {
    field: 'Status',
    cta: 'Start a project',
  },
};

/** Sheet 01 — selected work. */
export const WORK = {
  eyebrow: 'Selected work',
  title: ['Made by hand,', 'at depth.'],
  intro: 'A few of the sites, interfaces and 3D pieces. Each one was written rather than assembled, which is the only reason any of them behave the way they do.',
  /**
   * PLACEHOLDERS. One entry per project. `plate` is an image path; leave it
   * empty and the sheet shows a hatched plate marked "not yet issued".
   */
  projects: [
    { n: '01', title: '[Project name]', client: '[Client]', year: '[Year]', tags: ['Three.js', 'GLSL'], summary: '[One line on what was built, and the one thing about it that mattered.]', href: '#', plate: '' },
    { n: '02', title: '[Project name]', client: '[Client]', year: '[Year]', tags: ['Webflow', 'Motion'], summary: '[One line on what was built, and the one thing about it that mattered.]', href: '#', plate: '' },
    { n: '03', title: '[Project name]', client: '[Client]', year: '[Year]', tags: ['React', 'Interface'], summary: '[One line on what was built, and the one thing about it that mattered.]', href: '#', plate: '' },
    { n: '04', title: '[Project name]', client: '[Client]', year: '[Year]', tags: ['Spline', 'Framer'], summary: '[One line on what was built, and the one thing about it that mattered.]', href: '#', plate: '' },
  ],
};

/** Sheet 02 — about: the figure, the story, the revisions, the schedule. */
export const ABOUT = {
  eyebrow: 'About',
  title: ['The engineer', 'behind the shader.'],
  figure: {
    caption: 'Fig. 1',
    legend: 'Saad Aziz, Karachi.',
  },
  story: [
    'Software engineer first, creative developer by appetite. I build the site, the interface and the 3D inside it, and I write the shaders myself — a surface I understand is a surface I can make behave.',
    'Based in Karachi, working with teams wherever the clock allows. The one live thing on this page is that clock: it is the only number here that was not written down.',
  ],
  /**
   * The revision table — a drawing's own record of how it changed. This is
   * the timeline. PLACEHOLDERS: one row per year or turning point.
   */
  revisions: {
    field: 'Revisions',
    columns: ['Rev', 'Date', 'Description'],
    rows: [
      { rev: 'A', date: '[Year]', note: '[How it started — the first build, the first client, the first thing that went wrong.]' },
      { rev: 'B', date: '[Year]', note: '[The turn — when the work changed shape, or the tools did.]' },
      { rev: 'C', date: '[Year]', note: '[The proof — the project that changed how you work.]' },
      { rev: 'D', date: '2026', note: 'This page. The letters are a shader; the rest is what they stand on.' },
    ],
  },
  /**
   * The schedule — a drawing's list of what goes where. Here, what I build
   * with and what each is for. These are true.
   */
  schedule: {
    field: 'Schedule',
    rows: [
      { mark: 'threedotjs', name: 'Three.js & GLSL', use: '3D and shaders, written by hand' },
      { mark: 'react', name: 'React', use: 'Interfaces with state that behaves' },
      { mark: 'webflow', name: 'Webflow', use: 'Marketing sites a client can own' },
      { mark: 'framer', name: 'Framer', use: 'Animated sites straight from the design' },
      { mark: 'figma', name: 'Figma', use: 'The drawing before the build' },
    ],
  },
};

/** Sheet 03 — contact, and the colophon that closes the set. */
export const CONTACT = {
  eyebrow: 'Contact',
  title: ['Start', 'a project.'],
  intro: 'Tell me what you are building and where it needs depth. I read everything, and I reply from Karachi.',
  cta: 'Write to me',
  colophon: [
    'Set in Aminute and Archivo.',
    '3D in Three.js; every lit surface in hand-written GLSL.',
    'Drawn in Karachi, 2026.',
  ],
};
