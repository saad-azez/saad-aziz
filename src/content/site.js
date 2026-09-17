/**
 * Everything the site says, in one place.
 *
 * The page is the hero alone for now; the sections below it (work, about,
 * contact) were removed on purpose, to be rebuilt to Saad's own brief.
 *
 * Nothing here invents a client, a date, a number or a quote.
 *
 * WEBFLOW: this file is the CMS. Every array below is a collection.
 */

export const PERSON = {
  name: 'Saad Aziz',
  mark: 'SAADi',
  role: 'Creative developer',
  city: 'Islamabad/Rawalpindi',
  timezone: 'Asia/Karachi',
  /** The address behind "Let's talk". */
  email: 'saad.azieiz@gmail.com',
  /** Optional. Leave a string empty to hide that link. */
  links: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/saad-azieiz/' },
    { label: 'X', href: '' },
    { label: 'GitHub', href: '' },
  ],
};

/** The hero. */
export const HERO = {
  /** Left: who I am. The name is already the 3D word, so it is not repeated. */
  /** The cities take turns on their own (WordSwap), exactly like the platforms below; the label is what screen readers hear.
      The comma rides with the city, as the full stop rides with the platform. Unlike the platforms, the slot is NOT held at the widest
      word: words follow the city, and a held slot leaves a visible hole after "Islamabad,". It eases to each word's width instead. */
  greeting: { before: 'Creative developer, based', lead: 'near', words: ['Islamabad,', 'Rawalpindi,'], label: 'Islamabad and Rawalpindi,', after: ' Pakistan.' },
  /** What I do. */
  headline: ['I build interactive 3D websites,', 'from the model to the code.'],
  /** Right: why I do it, what I use, and proof. The one call to action is Let’s talk in the header. */
  /** The platforms take turns on their own (WordSwap); the label is what screen readers hear. */
  offer: {
    before: 'I enjoy bringing depth and motion to the web. I model in Blender, create real-time scenes in Three.js or Spline, and ship fast sites in Webflow, Framer or custom code. I’ve worked remotely with a London-based studio, and with clients',
    lead: 'on',
    words: ['Fiverr.', 'Upwork.', 'Contra.'],
    label: 'Fiverr, Upwork and Contra.',
  },
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
