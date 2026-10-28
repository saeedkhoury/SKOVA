# Vendored libraries

Self-hosted, pinned. Nothing here is loaded from a CDN at runtime. Tarballs fetched from https://registry.npmjs.org on 2026-10-15.

| Path | Version | Source | License | Bytes |
| --- | --- | --- | --- | --- |
| gsap/gsap.min.js | gsap 3.15.0 | https://registry.npmjs.org/gsap/-/gsap-3.15.0.tgz (`dist/gsap.min.js`) | GSAP Standard "no charge" license, https://gsap.com/standard-license | 72927 |
| gsap/ScrollTrigger.min.js | gsap 3.15.0 | same tarball (`dist/ScrollTrigger.min.js`) | same | 44575 |
| gsap/SplitText.min.js | gsap 3.15.0 | same tarball (`dist/SplitText.min.js`) | same | 7732 |
| gsap/LICENSE-NOTE.md | gsap 3.15.0 | License section of the package `README.md` (the package ships no LICENSE file) | same | 210 |
| lenis/lenis.min.js | lenis 1.3.26 | https://registry.npmjs.org/lenis/-/lenis-1.3.26.tgz (`dist/lenis.min.js`, UMD, sets `window.Lenis`) | MIT | 18722 |
| lenis/lenis.min.js.map | lenis 1.3.26 | same tarball (`dist/lenis.min.js.map`, kept so the sourceMappingURL resolves) | MIT | 63933 |
| lenis/lenis.css | lenis 1.3.26 | same tarball (`dist/lenis.css`) | MIT | 513 |
| lenis/LICENSE | lenis 1.3.26 | same tarball (`LICENSE`) | MIT | 1096 |
| three/three.module.min.js | three 0.186.0 | https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.min.js (see note) | MIT | 392746 |
| three/three.core.min.js | three 0.186.0 | https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.core.min.js (see note) | MIT | 415723 |
| three/examples/jsm/loaders/GLTFLoader.js | three 0.186.0 | https://registry.npmjs.org/three/-/three-0.186.0.tgz (`examples/jsm/loaders/GLTFLoader.js`) | MIT | 117570 |
| three/examples/jsm/utils/BufferGeometryUtils.js | three 0.186.0 | same tarball (imported by GLTFLoader as `../utils/BufferGeometryUtils.js`) | MIT | 37712 |
| three/examples/jsm/utils/SkeletonUtils.js | three 0.186.0 | same tarball (imported by GLTFLoader as `../utils/SkeletonUtils.js`) | MIT | 11535 |
| three/LICENSE | three 0.186.0 | same tarball (`LICENSE`) | MIT | 1081 |

## Notes on three

- The npm package three@0.186.0 does not ship `.min.js` builds (its `build/` has only `three.module.js`, `three.core.js`, `three.cjs`, and the WebGPU/TSL builds). The two minified files come from jsDelivr, which generates them from the official `build/three.module.js` and `build/three.core.js` with Terser 5.48.0 (stated in each file's header comment).
- Two local edits to those minified files: (1) in `three.module.min.js` the two specifiers `"./three.core.js"` were rewritten to `"./three.core.min.js"`; (2) the trailing `//# sourceMappingURL=/sm/...` comments (absolute jsDelivr paths that would 404 on our host) were removed from both files. No code was changed.
- `GLTFLoader.js`, `BufferGeometryUtils.js` and `SkeletonUtils.js` are unmodified. Their bare `'three'` imports resolve through the page import map:
  `<script type="importmap">{"imports":{"three":"./assets/vendor/three/three.module.min.js"}}</script>`
  (relative to `portfolio/index.html`). Import `GLTFLoader` by relative path, for example `import('../../vendor/three/examples/jsm/loaders/GLTFLoader.js')` from `assets/js/avatar/glb.js`; there is no `three/addons/` mapping.
- GLTFLoader does not import DRACOLoader, KTX2Loader or MeshoptDecoder itself; a GLB that uses those compressions would need those files vendored too.

## Verified

Headless Chrome test (scratch page served next to this folder with the import map above): `THREE.REVISION === "186"`, `GLTFLoader` parsed an inline one-triangle glTF into a scene with 1 mesh, `window.gsap.version === "3.15.0"`, `window.ScrollTrigger`, `window.SplitText` (split a heading into chars) and `window.Lenis` (instantiated and destroyed) all present, no console errors from these files.
