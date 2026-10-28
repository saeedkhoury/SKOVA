# Icon credits

All logos are trademarks of their respective owners and are used only to identify the technologies listed in the tech stack section. Files are rendered with `<img>`, so internal gradient ids (for example `a`, `b`) do not collide; if you ever inline them into the HTML, make the ids unique first.

## devicon 2.17.0 (MIT License, https://github.com/devicons/devicon)
Source URL pattern: `https://cdn.jsdelivr.net/npm/devicon@2.17.0/icons/<name>/<file>` (taken from the npm tarball `https://registry.npmjs.org/devicon/-/devicon-2.17.0.tgz`).

| File | Source file | Change |
| --- | --- | --- |
| python.svg | icons/python/python-original.svg | none |
| typescript.svg | icons/typescript/typescript-original.svg | none |
| javascript.svg | icons/javascript/javascript-original.svg | none |
| java.svg | icons/java/java-original.svg | none |
| c.svg | icons/c/c-original.svg | none |
| cplusplus.svg | icons/cplusplus/cplusplus-original.svg | none |
| mysql.svg | icons/mysql/mysql-original.svg | dolphin fill `#00618A` changed to `#4479A1` (MySQL brand hex from simple-icons) so it reads on the near-black tile |
| html5.svg | icons/html5/html5-original.svg | none |
| css3.svg | icons/css3/css3-original.svg | none |
| astro.svg | icons/astro/astro-original.svg | dark body gradient stops (`#000014`, `#150426`) changed to `#eae5ec`; orange flame unchanged |
| nextjs.svg | icons/nextjs/nextjs-original.svg | inverted for dark tiles: circle filled `#eae5ec`, "N" gradient stops changed from `#fff` to `#0b080c` |
| react.svg | icons/react/react-original.svg | none |
| tailwindcss.svg | icons/tailwindcss/tailwindcss-original.svg | none |
| playwright.svg | icons/playwright/playwright-original.svg | none |
| supabase.svg | icons/supabase/supabase-original.svg | none |
| githubactions.svg | icons/githubactions/githubactions-original.svg | none |
| cloudflare.svg | icons/cloudflare/cloudflare-original.svg | none |
| docker.svg | icons/docker/docker-original.svg | none |
| linux.svg | icons/linux/linux-plain.svg | monochrome Tux, fill set to `#eae5ec` (the colored original is 194 KB and mostly near-black) |
| github.svg | icons/github/github-original.svg | fill `#181616` changed to `#eae5ec` |

## simple-icons 16.32.0 (CC0 1.0, https://github.com/simple-icons/simple-icons)
Source URL pattern: `https://cdn.jsdelivr.net/npm/simple-icons@16.32.0/icons/<slug>.svg` (from `https://registry.npmjs.org/simple-icons/-/simple-icons-16.32.0.tgz`). Fill added on the root `<svg>`: the brand hex from `data/simple-icons.json` when its contrast against `#0b080c` is at least 3:1, otherwise `#eae5ec`.

| File | Brand hex | Contrast on #0b080c | Fill used |
| --- | --- | --- | --- |
| zod.svg | #408AFF | 5.97 | #408AFF |
| claude.svg | #D97757 | 6.38 | #D97757 |
| roboflow.svg | #6706CE | 2.37 | #eae5ec |
| wireshark.svg | #1679A7 | 4.10 | #1679A7 |
