/**
 * "What I do" cards.
 *  - Draw-on animation (dashed borders, corner brackets, flicker-in) plays when the cards enter the view.
 *  - Fine pointers: CSS hover expands one card and compresses the other.
 *  - Touch: tapping a card toggles it. The arrow is a real <button> with aria-expanded (works everywhere).
 */
const ARM_CLASS = 'whatido-armed';
const INVIEW_THRESHOLD = 0.25;

function setExpanded(cards, card, expanded) {
  cards.forEach((c) => {
    const isTarget = c === card;
    c.classList.toggle('what-content-active', isTarget && expanded);
    c.classList.toggle('what-sibling', !isTarget && expanded);
    const button = c.querySelector('.what-arrow');
    if (button) button.setAttribute('aria-expanded', String(isTarget && expanded));
  });
}

/**
 * Live avatar (html.whatbox-gated): the hero choreography reveals the cards and starts the draw
 * (avatar/choreography.js). Keyboard focus shows the cards early (whatido.css :focus-within),
 * so it starts the draw too. An IntersectionObserver here would fire before the cards show.
 */
function drawOnReveal(section, root) {
  const onFocusIn = () => section.classList.add('is-inview');
  section.addEventListener('focusin', onFocusIn);
  return () => {
    section.removeEventListener('focusin', onFocusIn);
    if (!section.classList.contains('is-inview')) root.classList.remove(ARM_CLASS);
  };
}

function observeDraw(section, env) {
  const root = document.documentElement;
  if (env.reduced || section.classList.contains('is-inview') || !('IntersectionObserver' in window)) {
    if (!section.classList.contains('is-inview')) root.classList.remove(ARM_CLASS);
    return () => {};
  }
  root.classList.add(ARM_CLASS);
  if (root.classList.contains('whatbox-gated')) return drawOnReveal(section, root);
  const target = section.querySelector('.what-box-in') || section;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    section.classList.add('is-inview');
    io.disconnect();
  }, { threshold: INVIEW_THRESHOLD });
  io.observe(target);
  return () => {
    io.disconnect();
    if (!section.classList.contains('is-inview')) root.classList.remove(ARM_CLASS);
  };
}

export function createWhatIDo(env) {
  const section = document.querySelector('.whatido');
  if (!section) return { destroy() {} };
  const cards = Array.from(section.querySelectorAll('.what-content'));
  const touch = !env.fine;
  cards.forEach((card) => card.classList.toggle('what-noTouch', !touch));

  const onClick = (event) => {
    const card = event.target.closest('.what-content');
    if (!card) return;
    const fromButton = Boolean(event.target.closest('.what-arrow'));
    if (!fromButton && (!touch || event.target.closest('a'))) return;
    setExpanded(cards, card, !card.classList.contains('what-content-active'));
  };
  section.addEventListener('click', onClick);
  const stopDraw = observeDraw(section, env);

  return {
    destroy() {
      section.removeEventListener('click', onClick);
      stopDraw();
      setExpanded(cards, null, false);
      cards.forEach((card) => card.classList.add('what-noTouch'));
    },
  };
}
