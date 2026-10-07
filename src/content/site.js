/**
 * Everything the site says, in one place.
 *
 * The page is the hero, the work, the about and the contact.
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
  /**
   * The profiles, in the contact. Optional: leave a string empty to hide that
   * link. (No WhatsApp: it would mean putting a personal number on the page.)
   */
  links: [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/saad-azieiz/' },
    { label: 'GitHub', href: 'https://github.com/saad-azez' },
    { label: 'X', href: '' },
    { label: 'Instagram', href: '' },
    { label: 'Facebook', href: '' },
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

/**
 * The work.
 *
 * Each project supplies a name, summary, tools, a link and pictures of the
 * site. The work shows the top of the site as a picture
 * (public/work/top/<id>.webp, or `picture` to use another); the site itself
 * is never loaded. `page` is one tall screenshot of the whole site (1440 CSS
 * px wide, saved at 1200 px), which `npm run previews` photographs from each
 * project's `href` (scripts/capture-previews.mjs); the top pictures are cut
 * from those.
 *
 * `role` is what I did on it, in a few plain words.
 * While the project is on show, the coin turns through its tools (those it
 * has a logo for, see webgl/coinMarks.js), first one first.
 * `credit` names a collaborator, with a link.
 */
export const WORK = {
  title: 'Open it anywhere.',
  projects: [
    {
      id: 'blackletter',
      title: 'Blackletter',
      role: 'Design, 3D and development',
      summary: 'The whole site, end to end: from the Figma design, to the 3D modelled in Blender, to a fully custom build in Webflow.',
      tools: ['Blender', 'Figma', 'Webflow'],
      page: '/work/blackletter.webp',
      href: 'https://blackletter-296c86.webflow.io/',
    },
    {
      id: 'zuhayr-creative',
      title: 'Zuhayr Creative',
      role: 'Custom development',
      summary: 'A fully custom site in Next.js and React. A Unicorn Studio 3D background, the logo drawn on like a signature with Lottie, Three.js, GSAP for the animation and Lenis for the smooth scroll.',
      tools: ['Next.js', 'React', 'Three.js', 'Unicorn Studio', 'Lottie', 'GSAP', 'Lenis'],
      page: '/work/zuhayr-creative.webp',
      href: 'https://zuhayrcreative.vercel.app/',
    },
    {
      id: 'sensalab',
      title: 'SensaLab',
      role: 'Webflow development and 3D',
      summary: 'Built with the Mexican design agency Brutal Brand: they designed it, I made it a live Webflow site, with Spline scenes, custom Three.js shapes and GSAP animation.',
      tools: ['Webflow', 'Spline', 'Three.js', 'GSAP'],
      credit: { label: 'Brutal Brand', href: 'https://www.instagram.com/brutalbrandmx/' },
      page: '/work/sensalab.webp',
      href: 'https://www.sensalab.io/',
    },
    {
      id: 'pearl-towers',
      title: 'Pearl Towers',
      role: '3D and scroll animation',
      summary: 'I modelled the client’s building in Spline and rendered it as an image sequence, then optimised the frames and played them on scroll with GSAP in Webflow — it reads as 3D without loading a 3D model.',
      tools: ['Spline', 'GSAP', 'Webflow'],
      page: '/work/pearl-towers.webp',
      href: 'https://ptc-b4c1e3.webflow.io/',
    },
    {
      id: 'poseidon-waters',
      title: 'Poseidon Waters',
      role: 'Webflow development and Shopify',
      summary: 'The client’s Figma design built in Webflow. I recreated the animations they referenced with GSAP, added Lenis smooth scrolling, and integrated their Shopify store into the site.',
      tools: ['Webflow', 'Figma', 'GSAP', 'Lenis', 'Shopify'],
      page: '/work/poseidon-waters.webp',
      href: 'https://poseidon-waters.webflow.io/',
    },
    {
      id: 'circles',
      title: 'Circles',
      role: 'Custom interaction',
      summary: 'A custom zoom into a picture: click part of it and the view flies into that area to show its content, with a way back out. Webflow, custom code and GSAP.',
      tools: ['GSAP', 'Webflow', 'JavaScript'],
      page: '/work/circles.webp',
      href: 'https://circles-fed3c7.webflow.io/',
    },
    {
      id: 'cognichip',
      title: 'Cognichip',
      role: 'Spline scene and scroll animation',
      summary: 'A Spline scene built into their Webflow site and animated on scroll with Webflow’s Spline interactions.',
      tools: ['Spline', 'Webflow'],
      page: '/work/cognichip.webp',
      href: 'https://www.cognichip.ai/',
    },
    {
      id: 'iqmediaos',
      title: 'IQMediaOS',
      role: 'Spline scene',
      summary: 'A Spline scene designed from the client’s own details and brief, and integrated into their website.',
      tools: ['Spline'],
      page: '/work/iqmediaos.webp',
      href: 'https://iqmediaos.com/',
    },
    {
      id: 'pro-marketing',
      title: 'Pro Marketing',
      role: 'Webflow development',
      summary: 'The complete site in Webflow for a marketing agency in Wollongong, Australia, built to the standard of an Awwwards-winning site the client chose as the reference, and animated with Webflow’s own interactions.',
      tools: ['Webflow', 'Webflow Interactions'],
      page: '/work/pro-marketing.webp',
      href: 'https://www.promarketingwollongong.com.au/',
    },
    {
      id: 'builders',
      title: 'Builders',
      role: '3D logo and template changes',
      summary: 'A custom 3D logo made in Spline and set into their Webflow site, with the client’s changes made to the template they chose.',
      tools: ['Spline', 'Webflow'],
      page: '/work/builders.webp',
      href: 'https://at.builders/',
    },
    {
      id: 'tiraki',
      title: 'Tiraki',
      role: '3D product models',
      summary: '3D models of their wine bottles, one for each variety, made in Spline and handed over to their team. The models only — not the site.',
      tools: ['Spline'],
      page: '/work/tiraki.webp',
      href: 'https://www.tiraki.nz/',
    },
    {
      id: 'this-site',
      title: 'This site',
      role: 'Design, 3D and development',
      summary: 'The letters at the top are a shader I wrote — outlines cut from the type, extruded, and lit by hand in GLSL. The coin in the middle is the dot of the i.',
      tools: ['Three.js', 'GLSL', 'React', 'GSAP', 'Vite'],
      page: '/work/this-site.webp',
      href: '',
    },
  ],
};

/**
 * The about: the other side of the coin.
 *
 * Every date is from Saad's resume, every quote from his Fiverr reviews, word
 * for word (their spelling kept), every number counted from those reviews as
 * they stood in October 2026. Nothing is rounded up.
 *
 * `card`: the chapter's title, the coin turned over to his portrait under it.
 * `line`: the tower the coin climbs (webgl/stage/tower.js), a stop for each
 * step of the way, in order up the road wound round it, the last at the
 * summit; `year` cut into the column at the stop, `face` the tool the coin
 * shows there (webgl/coinMarks.js), `span` how long it lasted, beside the
 * year in the words about it. (`at` and `until`, in years, and `from`, `to`
 * and `now` date each stop: 2022.75 is October 2022, `until` 'now' today.)
 * `process`: how a project goes; `figure` names the drawing of the coin
 * beside it at that step.
 * `numbers` and `bench`: the page after it, in plain flow.
 */
export const ABOUT = {
  index: '02',
  label: 'About',
  card: {
    eyebrow: 'The other side of the coin',
    title: ['Clients call me', 'Saadi.'],
    /**
     * The proof of the title: what clients said, a line or two of each, word
     * for word ("…" where a review is cut short), on the ring of glass round
     * the coin (webgl/stage/ReviewRing), the name circled where they used it.
     * The only reviews on the page.
     */
    called: {
      label: 'What clients said',
      quotes: [
        { text: 'Saadi truly EXCELS in website design', by: 'aspiredesigns', from: 'Pakistan' },
        { text: 'I highly recommend Saad for 3D work.', by: 'mahmoudelgml', from: 'Egypt' },
        { text: 'Saadi did an exceptional job', by: 'miracle_brooks', from: 'United States' },
        { text: 'You can tell there’s care in every detail.', by: 'raivif', from: 'Spain' },
        { text: 'Saadi is really a skilled artist', by: 'jplourenco' },
        { text: 'The Spline 3D elements made it feel super interactive and unique.', by: 'adeyonugenesis1', from: 'Nigeria' },
        { text: 'Saadi was very hard working', by: 'ellarose_hammon' },
        { text: 'Super good work … Glad i picked him.', by: 'ivanchanlatte22', from: 'Dominican Republic' },
        { text: 'I hired Saadi for a very challenging Spline 3D animation project', by: 'aspiredesigns', from: 'Pakistan' },
        { text: 'You had great ideas to get this done!', by: 'htmlbundle99', from: 'United States' },
      ],
    },
    lede: 'I’m Saad, a software engineer who fell for 3D. I model the scene and write the code that ships it, so nothing gets lost between the artist and the developer.',
    /**
     * The coin's two sides, under it as each comes up: his face in code, and his
     * face in polygons (DotStage: the engineer, the artist).
     */
    sides: {
      engineer: { label: 'Side A', title: 'The engineer', text: 'This side is code: every mark on it is a character. Five years of React, Angular and TypeScript.' },
      artist: { label: 'Side B', title: 'The 3D artist', text: 'This side is a model: every facet is a polygon. Blender and Spline, scene after scene.' },
    },
    /** What can be done with the coin (with a mouse, and on a touch screen). */
    hint: 'Drag to flip · hover to see the real me',
    hintTouch: 'Tap to flip · drag to spin',
  },
  line: {
    title: 'Five years, five stops.',
    lede: 'From fixing layouts to building worlds.',
    from: 2021,
    to: 2027,
    now: 2026.79,
    stops: [
      {
        id: 'protech', year: '2021', at: 2021.58, until: 2022.08, span: '6 months',
        where: 'Protech Logics', role: 'Web developer, intern', place: 'Rawalpindi', face: 'Angular',
        text: 'Where it started: an Angular team, a pile of cross-browser bugs, and my first layouts that behaved on every screen.',
      },
      {
        id: 'vu', year: '2022', at: 2022.25, until: 'now', span: 'still studying',
        where: 'Virtual University of Pakistan', role: 'BS, Software Engineering', place: 'Online', face: 'Custom code',
        text: 'I started my degree in software engineering and have studied alongside client work ever since. The theory keeps the code honest.',
      },
      {
        id: 'maplin', year: '2022', at: 2022.75, until: 2023.58, span: '10 months',
        where: 'Maplin Studio', role: 'Front-end developer', place: 'London, remote', face: 'React',
        text: 'My first studio. I led front-end work in React and Material UI, brought TypeScript into the codebase, and kept the Git history tidy for a remote team.',
      },
      {
        id: 'fiverr', year: '2024', at: 2024.5, until: 'now', span: 'two years, 24 reviews',
        where: 'Fiverr', role: 'Freelance', place: 'Clients in 12 countries', face: 'Spline',
        text: 'I went independent. Webflow builds turned into Spline scenes, Spline scenes into full 3D sites, and 24 reviews later the 3D became the job.',
      },
      {
        id: 'now', year: 'Now', at: 2026.79,
        where: 'Here', role: 'Creative developer', place: 'Remote, worldwide', face: 'Blender',
        text: 'Today I build interactive 3D websites end to end: modelled in Blender or Spline, built in Three.js, Webflow or Framer, and made fast enough to enjoy.',
      },
    ],
  },
  process: {
    title: 'From the model to the code.',
    lede: 'Four steps, one person, no hand-offs. Here’s how a project runs.',
    steps: [
      {
        id: 'listen', title: 'Listen', figure: 'Sketched',
        text: 'A short brief, a few references, and the right questions, until I can see what you’re picturing.',
      },
      {
        id: 'model', title: 'Model', figure: 'Modelled',
        text: 'I model it myself in Blender or Spline, built for the browser from the first vertex: light enough to load fast, detailed enough to hold attention.',
      },
      {
        id: 'build', title: 'Build', figure: 'Built',
        text: 'Then I wire the scene into your site, in Webflow, Framer or custom code, so it moves with the scroll and answers the pointer.',
      },
      {
        id: 'finish', title: 'Finish', figure: 'Finished',
        text: 'The last ten percent is where it shows: the details, the phones, the load times, and a handover your team can actually use.',
      },
    ],
  },
  /** Counted from the Fiverr reviews: 24 of them, 23 at five stars and one at 4.3. Check the count against the profile. */
  numbers: [
    { value: 24, label: 'reviews on Fiverr' },
    { value: 4.97, decimals: 2, label: 'average, out of 5' },
    { value: 12, label: 'countries' },
    { value: 2, label: 'clients came back for more' },
    { value: 5, label: 'years writing code, since 2021' },
  ],
  bench: {
    title: 'Also on the bench.',
    items: [
      { title: 'A scene for the site you have', text: 'A Spline scene made to your brief and set into your existing site.' },
      { title: '3D product models', text: 'Your product modelled in Spline, handed over to your team.' },
      { title: 'Stores', text: 'A Shopify store brought into a Webflow site.' },
      { title: 'Sound and motion', text: 'Lottie, howler.js and GSAP, for a site that moves and sounds right.' },
      { title: 'App upkeep', text: 'Angular and Capacitor upgrades for iOS and Android apps, the builds fixed.' },
    ],
  },
};

/**
 * The contact: the last page of the journal, torn out for the reader to write
 * on. The letter is the form; the coin is its seal, and once they sign, it is
 * their seal: it turns over to their initials. Sealed, the letter folds into an
 * envelope, the coin stamps it shut with them, and off it goes: straight to
 * Saad's Webflow Forms, through the page's own Form Block named `form`
 * (lib/webflowForm; WEBFLOW.md, "The letter").
 *
 * `kinds`: what they can say they are looking for, to circle on the letter
 * (`short` is how it reads in the Forms tab). `budget`: the slider under it, in
 * US dollars. `fields`: the Webflow form's field names, for each part of the letter.
 */
export const CONTACT = {
  index: '03',
  label: 'Contact',
  title: 'Write on the last page.',
  lede: 'Every page before this one went live. Tell me about yours, seal it with the coin, and the letter comes straight to me.',
  lead: 'and I’m looking for',
  kinds: [
    { label: 'a 3D website, built in Webflow', short: '3D website, Webflow' },
    { label: 'a 3D website, built in Framer', short: '3D website, Framer' },
    { label: 'a custom-coded 3D website', short: '3D website, custom code' },
    { label: 'a 3D scene alone, in Blender or Spline', short: '3D scene, Blender or Spline' },
  ],
  budget: { lead: 'with a budget of around', min: 1000, max: 10000, step: 500 },
  nudge: 'drag the coin onto the seal',
  /** Once they have signed, and the coin has turned over to their own seal. */
  nudgeSigned: 'it’s your seal now: drag it onto the letter',
  direct: 'Rather write it yourself?',
  elsewhere: 'Elsewhere',
  form: 'Letter',
  fields: { name: 'Name', email: 'Email', kind: 'Project', budget: 'Budget', idea: 'Message' },
  sent: {
    title: 'Sealed and sent.',
    text: 'Your letter is with me now. I’ll write back to',
  },
  failed: {
    title: 'It didn’t go.',
    text: 'The letter couldn’t be sent just now. Try once more, or send it to me by email: it’s all written out for you.',
  },
  credit: 'Designed, modelled and built by me.',
};
