# SKOVA

The portfolio of Saeed Khoury, software developer and AI engineer, and the home of SKOVA.

The site is in [`portfolio/`](portfolio/): plain HTML, CSS and JavaScript modules with no build step.
A 3D avatar (three.js) sits at a desk and follows the scroll story (GSAP ScrollTrigger, Lenis),
on desktops and on phones held upright.

Run it locally:

```bash
cd portfolio
python3 -m http.server 8000
```

Then open http://localhost:8000. Every piece of content lives in `portfolio/site.config.js`;
`portfolio/README.md` explains how the site and the avatar work.
