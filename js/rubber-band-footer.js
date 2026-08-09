/**
 * Rubber-Band Footer
 * Once the page is already scrolled to the very bottom, further scroll
 * input crossfades the footer message into a "Back to top" button with a
 * ring that fills as you keep pulling. A full ring + release triggers a
 * fast scroll back to the top. Never calls preventDefault — the page is
 * already at its scroll limit at that point, so there's nothing to
 * interfere with; this only ever adds behavior, never changes how normal
 * scrolling works anywhere else on the page.
 */

const PULL_DISTANCE = 500; // px of cumulative overscroll to fully arm
const RELEASE_IDLE_MS = 140; // wheel has no "end" event, so treat this long a pause as release
const BOTTOM_EPSILON = 40; // generous — scrollHeight vs. true max scroll position can drift by ~20px
const SCROLL_TOP_DURATION = 550;

let footerPull = null;
let pullProgress = 0;
let isArmed = false;
let isAnimatingScroll = false;
let releaseTimer = null;
let touchStartY = null;
let prefersReducedMotion = false;

export function initRubberBandFooter() {
  footerPull = document.getElementById('footer-pull');
  if (!footerPull) return;

  prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  window.addEventListener('wheel', handleWheel, { passive: true });
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });

  const backToTopBtn = document.getElementById('footer-back-to-top');
  backToTopBtn?.addEventListener('click', () => {
    if (isAnimatingScroll) return;
    scrollToTopFast();
  });
}

function isAtPageBottom() {
  return window.innerHeight + window.scrollY >= document.body.scrollHeight - BOTTOM_EPSILON;
}

function setPullProgress(value) {
  pullProgress = Math.max(0, Math.min(1, value));
  footerPull.style.setProperty('--pull-progress', pullProgress.toFixed(3));
  footerPull.classList.toggle('footer-pull-active', pullProgress > 0);

  const armed = pullProgress >= 1;
  if (armed !== isArmed) {
    isArmed = armed;
    footerPull.classList.toggle('armed', isArmed);
  }
}

function springBack() {
  clearTimeout(releaseTimer);
  footerPull.classList.add('footer-pull-resetting');
  setPullProgress(0);
  setTimeout(() => footerPull?.classList.remove('footer-pull-resetting'), 340);
}

/**
 * Lands exactly at scrollY 0, then double-checks shortly after. A wheel
 * gesture fast enough to arm the pull can still have momentum "in flight"
 * in the browser after our own scroll lands — this catches the residual
 * drift and corrects it once, without fighting the browser repeatedly.
 */
function settleAtTop() {
  window.scrollTo({ top: 0, behavior: 'instant' });
  setTimeout(() => {
    if (window.scrollY !== 0) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    isAnimatingScroll = false;
    springBack();
  }, 150);
}

function scrollToTopFast() {
  clearTimeout(releaseTimer);
  isAnimatingScroll = true;

  if (prefersReducedMotion) {
    settleAtTop();
    return;
  }

  const startY = window.scrollY;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / SCROLL_TOP_DURATION, 1);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    window.scrollTo({ top: startY * (1 - eased), behavior: 'instant' });

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      settleAtTop();
    }
  }

  requestAnimationFrame(step);
}

function scheduleRelease() {
  clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => {
    if (isArmed) {
      scrollToTopFast();
    } else {
      springBack();
    }
  }, RELEASE_IDLE_MS);
}

function handleWheel(e) {
  if (isAnimatingScroll || !footerPull) return;

  if (!isAtPageBottom()) {
    if (pullProgress > 0) springBack();
    return;
  }

  if (e.deltaY > 0) {
    footerPull.classList.remove('footer-pull-resetting');
    setPullProgress(pullProgress + e.deltaY / PULL_DISTANCE);
    scheduleRelease();
  } else if (e.deltaY < 0 && pullProgress > 0) {
    springBack();
  }
}

function handleTouchStart(e) {
  touchStartY = e.touches[0]?.clientY ?? null;
}

function handleTouchMove(e) {
  if (isAnimatingScroll || !footerPull || touchStartY === null) return;

  if (!isAtPageBottom()) {
    if (pullProgress > 0) springBack();
    return;
  }

  const currentY = e.touches[0]?.clientY ?? touchStartY;
  const pulledUpBy = touchStartY - currentY; // finger moving up past the bottom = pulling

  if (pulledUpBy > 0) {
    footerPull.classList.remove('footer-pull-resetting');
    setPullProgress(pulledUpBy / PULL_DISTANCE);
  } else if (pullProgress > 0) {
    springBack();
  }
}

function handleTouchEnd() {
  touchStartY = null;
  if (isAnimatingScroll || !footerPull) return;

  if (isArmed) {
    scrollToTopFast();
  } else if (pullProgress > 0) {
    springBack();
  }
}
