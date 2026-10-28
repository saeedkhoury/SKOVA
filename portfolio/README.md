# Saeed Khoury, portfolio (v2)

A static site: plain HTML, CSS and JavaScript modules. No build step and nothing to install.
All libraries (GSAP, Lenis, three.js) are saved in `assets/vendor/`, so the site does not
depend on other servers, except Google Fonts for the Geist font.

## Preview it on your computer

The page uses JavaScript modules, and browsers do not run modules from `file://`.
So double-clicking `index.html` will not work. Start a small local server instead:

```bash
cd portfolio
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Stop the server with Ctrl+C.

Handy test switches (add them to the address):

- `?avatar=0` shows the still picture instead of the live 3D character
- `?motion=reduce` shows the site as people with "reduce motion" switched on see it
- `?debug` prints the site's own warnings in the browser console

## Edit the content

Every word on the site lives in `site.config.js`: your name, roles, About text, the
"What I do" cards, career, projects, tech icons, links and the CV path. Change a value, save,
and refresh the page. You never need to touch the HTML for content.

- Keep the writing rules at the top of that file (only what is true today, no em dashes).
- Project screenshots for the home page go in `assets/img/work/`. Put the path in `image`, and its
  pixel size in `width` and `height`. Use `image: null` to show a designed title card instead.
- The same `work` list also fills the All Works page (see below).
- Your CV is `assets/Saeed_Khoury_CV.pdf`. Replace the file and keep the name, or change `person.cv`.

## The All Works page

"My Work" on the home page ends with a "Want to see more?" box. Its button (`moreWork` in
`site.config.js`) opens `works.html`, the All Works page, in the same tab. That page lists every
project in `work`, in the same order, numbered 01, 02, ... automatically.

- Where its content comes from: each card shows the project's `card` picture, `title`, `category`,
  `summary` (the description) and `stack` (the tools line), then a link to `link` in a new tab. The
  link says "Visit site", or "View code" when it goes to github.com. The page's own texts (the back
  button, the title, the line under it, "Click to View") are in `worksPage`. The footer uses
  `brand.name`, `contact.credit` and your name. Nothing about a project is written in the HTML,
  except the plain list for browsers without JavaScript (the `<noscript>` block in `works.html`):
  update that list by hand when you add, rename or remove a project.
- The card pictures go in `assets/img/works/` (for example `assets/img/works/brinji.jpg`), one per
  project: 1600 x 816 pixels (three phone screens on a colour background), JPEG. The page reserves
  that shape before a picture loads, so other sizes are cropped to it. Clicking a picture (or Enter
  on it) opens it large; Esc, the close button or a click beside it closes it. If a picture is
  missing or fails to load, the card shows a designed title card instead (no broken image).
- The first row of pictures loads at once and the rest load as you scroll. The cards fade up a
  little as they come into view, except with "reduce motion" (or `?motion=reduce`).
- On Vercel the page is at `/works`: `"cleanUrls": true` in `vercel.json` serves `works.html` there
  (and sends `/works.html` to `/works`). On your computer open http://localhost:8000/works.html.
  The links on the site say `works.html`, which works in both places.
- The page has no inline script (the security policy in `vercel.json` allows only the two in
  `index.html`); its code is `assets/js/works.js`, `assets/js/render/works-page.js` and
  `assets/js/works/`, its style `assets/css/works.css`.

## Your brand (SKOVA)

`brand` in `site.config.js` holds the startup name and the two versions of the S logo. They show in
the header logo (it links back to the top), the loading screen title, the footer credit
("© year SKOVA") and the link-preview site name. Your own name stays wherever it means you (the
hero, the contact section, the author tag).

- The logo files are in `assets/img/brand/`: `skova-mark-light.webp` for the dark site and
  `skova-mark-dark.webp` for the light loading screen (128 px tall, sharp on high-density screens).
  They were made from `review/brand/skova-mark-light.png` and `skova-mark-dark.png`.
- The browser tab icons are `assets/img/brand/favicon-16.png`, `favicon-32.png` and `favicon-48.png`,
  plus `apple-touch-icon.png` for iPhone home screens, `favicon-192.png` and `favicon-512.png` for
  `site.webmanifest`, and `favicon.ico` in this folder. They are listed in the `<head>` of
  `index.html`; if you replace them, keep the same names or update those lines. The 16 px icon
  draws the S a little larger on its tile than the bigger sizes, so it still reads as an S in a tab.
- The link preview image (`assets/img/og.jpg`) carries the light S mark and the name small in its
  top-left corner; `python3 review/v2-assets/make_og.py` draws it from `skova-mark-light.webp`.
- The loading screen title is also written in `index.html` (it shows before any script runs).
  If you rename the brand, change it there too, or it will switch once the page script starts.

## How the hero character works today

The character in the hero is your own 3D avatar, made from your avatar picture
(`review/avatar-refs/avatar-memoji.png`): an AI image-to-3D service turned a full-body version of
that picture into a textured 3D model with a skeleton (rig) and a seated idle animation. The model
is one file, `assets/models/saeed-avatar.glb` (3.9 MB, optimized from the 13.7 MB original that
stays in `review/avatar-3d/`). It sits on an office chair at a desk that are built in code
(`assets/js/avatar/glb-character/` places him, `assets/js/avatar/character/` builds the furniture).

What it does:

- "switches the lights on" after the loading screen: it starts dark with its head down, then
  looks up as the lights come on (a soft white key light so the skin keeps the warm tan of your
  avatar picture, lavender only in the rim lights and the glow behind it)
- follows the mouse with its head near the top of the page (on a touch screen it follows your
  finger, then looks back to the centre), and tilts its head in a friendly way when the mouse is
  over its face
- blinks like a person: every 2 to 6 seconds, now and then twice, when its head turns quickly and
  as the lights come on. The eyes are painted on the model, so the eyelids are drawn by the model's
  own shader over each painted eye (`glb-character/eyes.js` holds the measured eye shapes,
  `lids.js` draws the lids, `blink.js` times them)
- sits naturally upright with the open chest, broad level shoulders and short neck of the pose it
  was modelled in (the seated animation slumps; `pose.js` sets the spine, collarbones and neck back
  to that pose and keeps only the animation's hips and legs), breathes, and rests its hands on its
  thighs from the sides, elbows a little out (`layout.js` REST, `arms.js`), until the desk arrives
- follows the scroll story: it turns, the camera pulls back, a desk with a monitor rises in front of
  it, its hands go onto the keyboard and type, the screen lights up with your clinic website and
  flickers, and it leans in and looks down at its work. The typing is physical: the fingers curl
  onto the keys (the model has no finger bones, so `fingers.js` bends them in the shader), each tap
  lands exactly on a key top and takes that key down with it, in bursts like real typing, and
  nothing goes into the keyboard or the desk (`arms.js`, `touch.js`, `typing.js`)
- types like a relaxed person at a desk: he sits upright (a small lean, `TYPING_LEAN` in
  `layout.js`), his elbows hang down beside him a little out from his body (`ARMS.elbow`: the arm
  solver turns each arm around its shoulder-to-wrist line so the elbow points that way,
  `aimElbow` in `arms.js`), his forearms are about level, and his hands lie nearly flat over the
  keys with gently curved fingers (`ARMS.hand`, `ARMS.curl`), on a keyboard close to the desk's
  front edge. `review/avatar-3d/typing-lab/` measures the pose (arm angles, elbow height, arms
  against the thighs and the desk) and renders it from the side, the front and the hands:
  `review/avatar-3d/typing-lab/run.sh <name> 0.3` with the SKOVA folder served on port 5592

Where it runs: on desktops wider than 1024 px, and on phones and tablets held upright, wherever
WebGL works. On a phone or upright tablet it tells the same story, recomposed for a tall screen
(`assets/js/avatar/choreography-compact.js`): your name above his bust and your role below it;
then he turns and rises to the top while the About text holds in the lower half; then the camera
pulls back to him typing at his desk in the top half, with "What I do" under it, and the desk scene
scrolls away with that section. His head follows your finger at the top of the page. Phones held
sideways, people with "reduce motion" switched on, devices in data-saver mode or with very little
memory, and any device where WebGL fails see a still picture of the same avatar
(`assets/img/character/`). The model downloads while the loading screen runs and moves its progress
bar; the loading screen never waits more than 6 seconds. If the model arrives later, the still
picture shows first and the 3D avatar fades in over it only if the visitor is still at the top of
the page (the download stops once they scroll down, or if it takes too long). If the model cannot load
at all, the still picture stays.

To swap the model:

1. Put the new `.glb` in `assets/models/` and point `avatar.glb.url` in `site.config.js` at it.
2. It needs the same kind of skeleton (the names Hips, Spine02, Spine01, Spine, LeftShoulder,
   LeftArm, LeftForeArm, LeftHand and the same on the right; the head and neck bones are named in
   `avatar.glb.headBone` and `neckBone`) and a seated animation named in `avatar.glb.idleClip`.
   Its height, seat and desk placement are set in `assets/js/avatar/glb-character/layout.js`.
   The blink and the finger curl are measured on this model (`eyes.js`, and `HANDS` in
   `fingers.js`): for a new model, measure them again with `review/avatar-3d/eye-lab.html` and
   `review/avatar-3d/hand-lab.html` (the steps are at the top of each file).
3. Keep it small and without Draco, KTX2 or Meshopt compression (the site has no decoders for
   those). `review/avatar-3d/optimize-glb.sh` shows how the current file was optimized (WebP
   textures and quantized vertices, both read by three.js without extra code). Its first step,
   `fix-hem-weights.py`, is for this model only: the auto-rig tied the front of the sweater to the
   thighs, which crumpled the hem over the lap when seated; a new model may not need it.
4. Render the still pictures and the link preview again with the local server running:
   `node review/v2-assets/make_character_stills.mjs <port>`, then
   `python3 review/v2-assets/make_character_stills.py` (it prints the two numbers for
   `.avatar-fallback` in `assets/css/hero.css`), then `python3 review/v2-assets/make_og.py` for
   `assets/img/og.jpg`.

Other modes, still available in `site.config.js`:

- `avatar.mode: 'character'` is the stylized clay character built entirely in code (no model file;
  `avatar.character.beard`, `hair` and `outfit` switch its looks). It blinks, raises its eyebrows on
  hover and sits at the same desk.
- `avatar.mode: 'portrait'` is your photo, cut out and given depth so it can turn its head. Its
  files are not in the public site: copy `review/portrait-mode/portrait/` back to
  `assets/img/portrait/` first.

## A new photo

The photo assets are made by a script that is kept outside the site, in
`review/v2-assets/make_portrait.py` (it needs Python 3 with numpy, Pillow and scipy).

1. Start from a cut-out PNG of the new photo (transparent background, sharp, at least 1600 px tall).
2. Open the script and update `LANDMARKS` (hair top, eyes, nose tip, mouth, chin, neck, shoulders,
   in pixels of the new PNG) and `FACE_BOX` (a box inside the face that must never change).
3. Run `python3 review/v2-assets/make_portrait.py --src path/to/cutout.png` from the project folder.
   It rewrites `saeed-bust.webp`, `saeed-bust-mobile.webp`, `saeed-bust-depth.png` and
   `saeed-bust.meta.json` in `assets/img/portrait/`, prints checks (the face must stay identical)
   and saves preview images next to the script. Look at the previews before you publish.
4. Run `python3 review/v2-assets/make_og.py` to rebuild the share image (`assets/img/og.jpg`).

The face pixels always come straight from the photo. Nothing is redrawn or generated.

## Before you publish

- The live site is https://skova.dev, served by Cloudflare (where the domain is registered): an
  assets-only Worker named `skova` that uploads this folder (`cloudflare/wrangler.jsonc` in the SKOVA
  folder; `_headers` here sets the security headers and caching, `.assetsignore` keeps files such as
  this README out). Publish a change from the SKOVA folder with
  `npx wrangler@4.147.0 deploy --config cloudflare/wrangler.jsonc`. www.skova.dev is a second tiny
  Worker (`cloudflare/www-redirect/`) that sends visitors to https://skova.dev.
- The old Vercel address (skova.vercel.app) now redirects to https://skova.dev (`vercel.json`).

## Search engines and link previews

- `robots.txt` allows everything and points to `sitemap.xml` (the home page and /works; update
  `<lastmod>` when a page changes a lot). `404.html` is the page for unknown addresses (status 404).
- Both pages carry structured data (`<script type="application/ld+json">` in the head: data, not
  code, so the security policy does not apply): the home page describes the SKOVA website, SKOVA,
  you and the profile page; works.html lists the projects. Keep the works list in step with `work`
  in `site.config.js` (like the `<noscript>` list there).
- Link previews (LinkedIn, WhatsApp, X, Facebook) use the `og:` and `twitter:` tags and
  `assets/img/og.jpg` (1200 x 630). After changing them, ask LinkedIn to read the page again with
  its Post Inspector (https://www.linkedin.com/post-inspector/).
- Google: add skova.dev in Google Search Console as a Domain property (it can verify through
  Cloudflare in one click), then submit `https://skova.dev/sitemap.xml` and request indexing of
  the home page.
- Bing and other IndexNow engines: the key file at the site root (`<key>.txt`, the key is also in
  `review/indexnow-key.txt`) lets you announce changed pages: POST
  `{"host":"skova.dev","key":"<key>","keyLocation":"https://skova.dev/<key>.txt","urlList":[...]}`
  to https://api.indexnow.org/indexnow.
- If you change the inline scripts in `index.html`, update their sha256 hashes in BOTH `_headers`
  and `vercel.json` (the security policy blocks any inline script it does not know).
- The `review` folder (photos, source images, QA records and the tools named above) stays on your
  computer: it is listed in `.gitignore` and is not part of the public repository.
- When you have a domain, set `meta.url` in `site.config.js` and fill in `og:url` in `index.html`
  and `works.html` (and their canonical links), and make `og:image` a full address on that domain,
  so link previews show your share image.
- If you add, rename or remove a file in `assets/js`, update the list of
  `<link rel="modulepreload">` lines in `index.html` (and in `works.html` for the files the
  All Works page imports) to match.
