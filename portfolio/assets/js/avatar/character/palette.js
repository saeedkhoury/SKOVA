/**
 * Saeed's colours for the character, in LINEAR light (vertex colours are not converted), sampled
 * from his photos and stylized (review/v2-assets/likeness-notes.md). sRGB in the comments.
 */
export const PALETTE = Object.freeze({
  skin: Object.freeze([0.6724, 0.3712, 0.2307]), // #d6a484 warm light olive tan
  skinWarm: Object.freeze([0.6724, 0.2623, 0.162]), // #d68c70 thin parts: ears, nose tip
  stubble: Object.freeze([0.0137, 0.0116, 0.0109]), // #1f1c1b the fade and sideburns at their darkest
  lip: Object.freeze([0.5149, 0.162, 0.1274]), // #be7064
  hair: Object.freeze([0.0044, 0.0033, 0.0033]), // #0e0b0b
  hairEdge: Object.freeze([0.0103, 0.0084, 0.008]), // #1a1716 where the fade meets the top
  beard: Object.freeze([0.0343, 0.0273, 0.0252]), // #342e2c
  beardEdge: Object.freeze([0.0685, 0.0497, 0.0423]), // #4a3f3a thin edge of the beard (skin shows through)
  brow: Object.freeze([0.0116, 0.0086, 0.0075]), // #1c1715 (not darker than the hair)
  ink: Object.freeze([0.016, 0.0185, 0.0252]), // #22252c tattoo ink
  sole: Object.freeze([0.6172, 0.6038, 0.5906]), // #ceccca sneaker sole
});
