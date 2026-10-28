/**
 * site.config.js
 *
 * Every piece of personal content on the site lives in this one file.
 * Edit a value, save, refresh the page. No other file needs to change.
 *
 * Lines marked "TODO" are content that is still missing. The site works
 * without them and shows a safe fallback until you fill them in.
 *
 * Writing rules for this site (keep them when you edit):
 *   - Say exactly what is true today. No "every", "all" or "never" unless it is proven.
 *   - No em dashes in visible text.
 */

const config = {
  meta: {
    title: 'SKOVA · Saeed Khoury, software developer and AI engineer',
    description:
      'SKOVA by Saeed Khoury, software developer and AI engineer from Kafr Kanna: websites in Arabic, Hebrew, and English, built with AI and checked by tests.',
    url: 'https://skova.dev/', // the live address
    themeColor: '#0b080c',
  },

  // Your startup brand: the header logo (top left), the loading screen title, the link-preview
  // site name and the footer credit. mark is the S for the dark site, markOnLight the one for the
  // light loading screen. The browser tab icons are in index.html (assets/img/brand/favicon-*.png).
  brand: {
    name: 'SKOVA',
    mark: 'assets/img/brand/skova-mark-light.webp',
    markOnLight: 'assets/img/brand/skova-mark-dark.webp',
  },

  person: {
    firstName: 'Saeed',
    lastName: 'Khoury',
    initials: 'SK',
    location: 'Kafr Kanna, Israel',
    email: 'saed.khoury10@gmail.com',
    whatsapp: 'https://wa.me/972505854855',
    linkedin: 'https://www.linkedin.com/in/saeed-khoury-a5a119359/',
    github: 'https://github.com/saeedkhoury',
    cv: 'assets/Saeed_Khoury_CV.pdf',
  },

  // The loading screen: the big words that slide behind the "Loading" pill.
  loader: {
    marquee: ['Software Developer', 'AI Engineer'],
  },

  // Hero. The right-hand title rolls between these roles every few seconds.
  hero: {
    greeting: "Hello! I'm",
    roles: [
      { article: 'a', accent: 'Software', rest: 'Developer' },
      { article: 'an', accent: 'AI', rest: 'Engineer' },
    ],
  },

  about: {
    title: 'About me',
    text:
      "I build software with AI, and I check what it writes. I'm a fourth-year Software Engineering student at Kinneret Academic College, from Kafr Kanna. Arabic is my first language, I'm fluent in Hebrew, and I work in English.",
  },

  whatIDo: [
    {
      title: 'Software Developer',
      subtitle: 'Websites for clinics, shops, and offices',
      details:
        'I build websites in Arabic, Hebrew, and English for local businesses, made to work well on phones, with pages Google can read in each language. You own your website: your domain, hosting, and code go into your own accounts.',
      tools: ['Astro', 'Next.js', 'React', 'TypeScript', 'Tailwind', 'Supabase', 'Cloudflare', 'Playwright'],
    },
    {
      title: 'AI Engineer',
      subtitle: 'I build with AI, and I check what it writes',
      details:
        'I write the rules first: what we are building, what must never break, and how we will check it. Claude Code writes most of the code inside those rules. I review the changes before they merge, and on my current projects automated checks run before anything deploys.',
      tools: ['Claude Code', 'GitHub Actions', 'Zod', 'Playwright', 'Python', 'Object detection', 'Roboflow'],
    },
  ],

  career: {
    titleStart: 'My career',
    titleEnd: 'experience',
    items: [
      {
        role: 'Open to internships',
        org: 'From March 2027',
        when: 'NOW',
        text: 'Part-time, 2 to 4 days a week. I can start any time between March and May 2027 and stay 26 weeks or longer. Anywhere in Israel.',
      },
      {
        role: 'Websites for local businesses',
        org: 'Dr. Khalil Kanani dental clinic',
        when: '2026',
        text: 'My first live client site, in Hebrew, Arabic, and English. Since launch week, every deploy waits for 10 automated checks, from type checks to browser tests in all three languages.',
      },
      {
        role: 'Websites for local businesses',
        org: 'YA Group, travel and personal services',
        when: '2026',
        text: 'A Hebrew and Arabic site with a full-screen film from the owner\'s office that plays as you scroll, live on Vercel.',
      },
      {
        role: 'Restaurant platform',
        org: 'Brinji, Kafr Yasif',
        when: '2026',
        text: 'A website in three languages and a manager app for a bar and restaurant. The architecture is approved and the foundation is being built.',
      },
      {
        role: 'Fuel station system',
        org: 'SMN, Station Management Network',
        when: '2025',
        text: 'Customer, manager, and worker apps for a fuel station, in React and TypeScript.',
      },
      {
        role: 'B.Sc. Software Engineering',
        org: 'Kinneret Academic College',
        when: '2023',
        text: 'Fourth-year student, graduating in July 2027. GPA so far: 85.1.',
      },
    ],
  },

  // "My Work" (the pinned horizontal gallery on the home page) and the "All Works" page
  // (works.html) both list these projects, in this order. Numbers (01, 02, ...) are added automatically.
  //   tools      the "Tools and features" text on the home page
  //   image      the home page screenshot (or null for a designed title card), with its size in pixels
  //   summary    the description on the All Works page; stack: its tech line
  //   card       the All Works picture (3 phone screens on a colour background, 1600 x 816)
  //   link       the live site, demo or code (null hides the link)
  work: [
    {
      title: 'YA Group',
      category: 'Live client site · 2026',
      tools: 'HTML, CSS, and JavaScript on Vercel. Hebrew and Arabic pages for a travel and personal services business, a full-screen film from the owner\'s office that plays as you scroll, and a consultation form that prepares a WhatsApp message.',
      summary: 'A Hebrew and Arabic website for a travel and personal services business. A full-screen film from the owner\'s office plays as you scroll, on computers and on phones, and the consultation form prepares a WhatsApp message instead of storing anything.',
      stack: 'HTML, CSS, JavaScript, Vercel',
      image: 'assets/img/work/ya-group.jpg',
      width: 1600, // image size in pixels (prevents layout shift)
      height: 1000,
      card: 'assets/img/works/ya-group.jpg',
      alt: 'Home page of the YA Group website in Hebrew',
      link: 'https://ya-group-wheat.vercel.app/',
    },
    {
      title: 'Sky Phone',
      category: 'Preview for a local shop · 2026',
      tools: 'Built twice: plain HTML, CSS, and JavaScript, then Next.js with unit and end-to-end tests. Catalog, search, and a bag that sends the order to WhatsApp.',
      summary: 'A storefront preview for a phone shop, built twice: first in plain HTML, CSS, and JavaScript, then in Next.js with unit and end-to-end tests. Browse the catalog, search it, and send the order from your bag to WhatsApp.',
      stack: 'Next.js, React, TypeScript, Vitest, Playwright',
      image: 'assets/img/work/sky-v2-desktop.jpg',
      width: 1600, // image size in pixels (prevents layout shift)
      height: 1000,
      card: 'assets/img/works/sky-phone.jpg',
      alt: 'Sky Phone storefront preview, version 2',
      link: 'https://saeedkhoury.github.io/skyphone-ca/',
    },
    {
      title: 'Brinji',
      category: 'Restaurant platform · demo · 2026',
      tools: 'Next.js, TypeScript, Cloudflare Workers. A website in Arabic, Hebrew, and English for a bar and restaurant in Kafr Yasif, with events, a menu, a gallery, and table requests, and a manager app for the staff. The live demo uses sample content.',
      summary: 'A website for a bar and restaurant in Kafr Yasif, in Arabic, Hebrew, and English: events you can reserve for, a menu, a gallery, and a table request form, plus a first look at the manager app for the staff. The live demo uses sample content.',
      stack: 'Next.js, React, TypeScript, Zod, Cloudflare Workers',
      image: 'assets/img/work/brinji.jpg',
      width: 1600, // image size in pixels (prevents layout shift)
      height: 1000,
      card: 'assets/img/works/brinji.jpg',
      alt: 'Home page of the Brinji restaurant demo in Arabic',
      link: 'https://brinji-demo.saed-khoury10.workers.dev/',
    },
    {
      title: 'Dr. Khalil Kanani',
      category: 'Live client site · 2026',
      tools: 'Astro, TypeScript, Zod, Playwright, GitHub Actions, Cloudflare Workers. Hebrew, Arabic, and English pages, WhatsApp appointment requests, and 10 checks before every deploy.',
      summary: 'The website of a dental clinic in Jadeidi-Makr, in Hebrew, Arabic, and English, with WhatsApp appointment requests. My first live client site: since launch week, every deploy waits for 10 automated checks, from type checks to browser tests in all three languages.',
      stack: 'Astro, TypeScript, Tailwind, Zod, Playwright, GitHub Actions, Cloudflare Workers',
      image: 'assets/img/work/clinic-en.jpg',
      width: 1600, // image size in pixels (prevents layout shift)
      height: 1000,
      card: 'assets/img/works/dr-khalil-kanani.jpg',
      alt: 'Home page of the Dr. Khalil Kanani dental clinic website in English',
      link: 'https://www.drkhalilkanani.com/',
    },
    {
      title: 'Khoury Law Office',
      category: 'Live · early site',
      tools: 'HTML, CSS, and JavaScript. Hebrew, Arabic, and English, an accessibility panel, and a contact form that prepares a WhatsApp message to the office.',
      summary: 'An early website for a law office, in Hebrew, Arabic, and English, with an accessibility panel and a contact form that prepares a WhatsApp message to the office.',
      stack: 'HTML, CSS, JavaScript',
      image: 'assets/img/work/law-desktop.jpg',
      width: 1600, // image size in pixels (prevents layout shift)
      height: 1000,
      card: 'assets/img/works/khoury-law.jpg',
      alt: 'Home page of the Khoury Law Office website',
      link: 'https://saeedkhoury.github.io/khoury-law-firm/',
    },
    {
      title: 'SMN',
      category: 'Station Management Network · 2025',
      tools: 'React, TypeScript, Vite, Tailwind. Three apps for a fuel station: customers (cars, refueling, receipts), the manager (fuel tanks, prices, workers, reports), and workers (shifts and problem reports). A front-end prototype, designed around license plate recognition.',
      summary: 'Three apps for a fuel station. Customers manage their cars, start refueling, and keep their receipts; the manager follows fuel tanks, prices, workers, and reports; workers see their shifts and report problems. A front-end prototype, designed around license plate recognition.',
      stack: 'React, TypeScript, Vite, Tailwind',
      image: 'assets/img/work/smn.jpg',
      width: 1600, // image size in pixels (prevents layout shift)
      height: 1000,
      card: 'assets/img/works/smn.jpg',
      alt: 'The SMN customer, manager, and worker apps side by side',
      link: 'https://github.com/saeedkhoury/SMN',
    },
  ],

  // The last box of "My Work": the button opens the All Works page.
  moreWork: {
    title: 'Want to see more?',
    text: 'Explore all of my projects and creations.',
    label: 'See all works →',
    href: 'works.html',
  },

  // The All Works page (works.html): its texts. The projects come from `work` above.
  worksPage: {
    back: 'Back to Home',
    titleStart: 'All',
    titleEnd: 'Works',
    text: 'A collection of all my projects and creations.',
    view: 'Click to View', // shown over a picture on hover; the picture opens full size
    visit: 'Visit site', // link label (code links on github.com say "View code")
    code: 'View code',
  },

  // Tech stack pyramid: one array per row, widest row first.
  tech: {
    title: 'Tech Stack',
    video: {
      webm: 'assets/video/tech-loop.webm',
      mp4: 'assets/video/tech-loop.mp4',
      poster: 'assets/video/tech-loop-poster.jpg',
    },
    rows: [
      [
        { name: 'Python', icon: 'assets/icons/python.svg', url: 'https://www.python.org' },
        { name: 'TypeScript', icon: 'assets/icons/typescript.svg', url: 'https://www.typescriptlang.org' },
        { name: 'JavaScript', icon: 'assets/icons/javascript.svg', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
        { name: 'Java', icon: 'assets/icons/java.svg', url: 'https://dev.java' },
        { name: 'C', icon: 'assets/icons/c.svg', url: 'https://en.cppreference.com/w/c' },
        { name: 'C++', icon: 'assets/icons/cplusplus.svg', url: 'https://isocpp.org' },
        { name: 'SQL', icon: 'assets/icons/mysql.svg', url: 'https://www.mysql.com' },
        { name: 'HTML', icon: 'assets/icons/html5.svg', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
        { name: 'CSS', icon: 'assets/icons/css3.svg', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS' },
      ],
      [
        { name: 'Astro', icon: 'assets/icons/astro.svg', url: 'https://astro.build' },
        { name: 'Next.js', icon: 'assets/icons/nextjs.svg', url: 'https://nextjs.org' },
        { name: 'React', icon: 'assets/icons/react.svg', url: 'https://react.dev' },
        { name: 'Tailwind', icon: 'assets/icons/tailwindcss.svg', url: 'https://tailwindcss.com' },
        { name: 'Zod', icon: 'assets/icons/zod.svg', url: 'https://zod.dev' },
        { name: 'Playwright', icon: 'assets/icons/playwright.svg', url: 'https://playwright.dev' },
        { name: 'Supabase', icon: 'assets/icons/supabase.svg', url: 'https://supabase.com' },
      ],
      [
        { name: 'GitHub Actions', icon: 'assets/icons/githubactions.svg', url: 'https://github.com/features/actions' },
        { name: 'Cloudflare', icon: 'assets/icons/cloudflare.svg', url: 'https://www.cloudflare.com' },
        { name: 'Docker', icon: 'assets/icons/docker.svg', url: 'https://www.docker.com' },
        { name: 'Linux', icon: 'assets/icons/linux.svg', url: 'https://kernel.org' },
        { name: 'Wireshark', icon: 'assets/icons/wireshark.svg', url: 'https://www.wireshark.org' },
      ],
      [
        { name: 'Claude Code', icon: 'assets/icons/claude.svg', url: 'https://www.anthropic.com/claude-code' },
        { name: 'Roboflow', icon: 'assets/icons/roboflow.svg', url: 'https://roboflow.com' },
        { name: 'GitHub', icon: 'assets/icons/github.svg', url: 'https://github.com/saeedkhoury' },
      ],
    ],
  },

  cta: {
    label: "Let's talk →",
    href: 'mailto:saed.khoury10@gmail.com',
  },

  contact: {
    note: 'Hiring an intern, or need a website for your business? On a phone, WhatsApp is fastest.',
    credit: 'Designed and Developed by',
    builtWith: 'Built with Claude Code in plain HTML, CSS, and JavaScript, with three.js and GSAP.',
  },

  /**
   * The character in the hero.
   *
   * mode: 'glb'       Your 3D avatar (a rigged .glb made from your avatar image): it sits at
   *                   a desk, follows the mouse, types and turns to its screen further down.
   *                   If the file fails to load, the still image (character.still) shows.
   *                   See README.md, "How the hero character works today".
   * mode: 'character' A stylized 3D clay character of you, built in code (no model file):
   *                   it follows the mouse, blinks, types and sits at a desk further down.
   *                   character.beard and character.hair switch the beard and hair.
   * mode: 'portrait'  Your real photo, cut out and given depth so it can turn
   *                   its head, breathe and react to the mouse. Your face pixels
   *                   come straight from the photo, nothing is redrawn. Its files are kept
   *                   out of the public site: copy review/portrait-mode/portrait/ back to
   *                   assets/img/portrait/ before you switch to this mode.
   * The still images (character.still, character.mobile) show in the 'glb' and 'character' modes
   * on phones held sideways, with reduced motion, in data-saver mode and without WebGL (and on
   * phones and tablets until the 3D avatar has loaded).
   */
  avatar: {
    mode: 'glb',
    character: {
      beard: true,
      hair: 'fade',
      outfit: 'polo',
      still: 'assets/img/character/character-hero.webp',
      mobile: 'assets/img/character/character-mobile.webp',
      alt: '3D avatar of Saeed Khoury',
    },
    portrait: {
      image: 'assets/img/portrait/saeed-bust.webp',
      depth: 'assets/img/portrait/saeed-bust-depth.png',
      mobile: 'assets/img/portrait/saeed-bust-mobile.webp',
      // Face position, head pivot and size inside the photo, measured once per photo.
      // If you swap the photo, regenerate this file (see README.md).
      meta: 'assets/img/portrait/saeed-bust.meta.json',
      alt: 'Saeed Khoury in a black suit and white shirt',
    },
    glb: {
      url: 'assets/models/saeed-avatar.glb', // your rigged avatar
      headBone: 'Head', // name of the head bone that follows the mouse
      neckBone: 'neck', // takes a small share of the head turn
      idleClip: 'Armature|Chair_Sit_Idle_M|baselayer', // the seated pose comes from this clip
      introClip: null, // not used: the intro is the head lifting as the lights come on
    },
  },
};

export default config;
