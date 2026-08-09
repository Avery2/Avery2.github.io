/**
 * Rubber-Band Footer
 * Once the page is already scrolled to the very bottom, further scroll
 * input grows a "Back to top" reveal in below the permanent footer
 * message, with a ring that fills as you keep pulling — quick initial
 * give that gets harder to push further, like real elastic. The instant
 * the ring completes, it fires (no waiting around for a "release"); if
 * you stop pulling before it's full, it springs back. Never calls
 * preventDefault — the page is already at its scroll limit at that
 * point, so there's nothing to interfere with; this only ever adds
 * behavior, never changes how normal scrolling works anywhere else.
 */

// Raw input (px) needed to fully arm. Progress = sqrt(rawPull / PULL_DISTANCE),
// so early pulling shows a lot of visible movement immediately, then it
// takes progressively more input to fill the last stretch — real tension.
const PULL_DISTANCE = 2200;
const SPRING_BACK_IDLE_MS = 140; // wheel has no "end" event — this long a pause with no progress means "let go"
const BOTTOM_EPSILON = 40; // generous — scrollHeight vs. true max scroll position can drift by ~20px
const SCROLL_TOP_DURATION = 600;
const RAPID_TICK_GAP_MS = 30; // wheel ticks firing faster than this look like a momentum train, not intent
const MIN_MOMENTUM_DAMPING = 0.12; // floor so a sustained fast train still creeps forward, just slowly

let footerPull = null;
let rawPull = 0;
let progress = 0;
let isArmed = false;
let isAnimatingScroll = false;
let idleTimer = null;
let touchStartY = null;
let lastWheelTime = 0;
let restingScrollHeight = null; // snapshot taken at gesture start, since our own reveal grows document height
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
  // Use the height captured at the start of this gesture, not a fresh
  // read — the reveal itself grows the footer/document height as it
  // opens up, which would otherwise make "at bottom" go false mid-pull.
  const reference = restingScrollHeight ?? document.body.scrollHeight;
  return window.innerHeight + window.scrollY >= reference - BOTTOM_EPSILON;
}

function beginGestureIfNeeded() {
  if (restingScrollHeight === null) {
    restingScrollHeight = document.body.scrollHeight;
  }
}

function progressFromRaw(raw) {
  const clamped = Math.max(0, Math.min(raw, PULL_DISTANCE));
  return Math.sqrt(clamped / PULL_DISTANCE);
}

function applyProgress(raw) {
  rawPull = Math.max(0, raw);
  progress = progressFromRaw(rawPull);
  footerPull.style.setProperty('--pull-progress', progress.toFixed(3));
  footerPull.classList.toggle('footer-pull-active', progress > 0);

  if (progress >= 1 && !isArmed) {
    isArmed = true;
    footerPull.classList.add('armed');
    scrollToTopFast(); // fires immediately — no waiting for a separate "release"
  }
}

function resetPullState(animate) {
  clearTimeout(idleTimer);
  if (animate) footerPull.classList.add('footer-pull-resetting');
  rawPull = 0;
  progress = 0;
  isArmed = false;
  lastWheelTime = 0;
  restingScrollHeight = null;
  footerPull.style.setProperty('--pull-progress', '0');
  footerPull.classList.remove('armed', 'footer-pull-active');
  if (animate) {
    setTimeout(() => footerPull?.classList.remove('footer-pull-resetting'), 340);
  }
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
    resetPullState(true);
  }, 150);
}

function scrollToTopFast() {
  clearTimeout(idleTimer);
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

function scheduleIdleSpringBack() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!isArmed && rawPull > 0) {
      resetPullState(true);
    }
  }, SPRING_BACK_IDLE_MS);
}

/**
 * Wheel events don't expose whether they're from active input or decaying
 * momentum/fling — but momentum trains fire at high, steady frequency,
 * while a deliberate scroll (or a single mouse-wheel notch) has more time
 * between ticks. Scaling contribution by that gap means a fast flick that
 * carries momentum into the bottom barely moves the needle, while
 * deliberate scrolling once things have settled counts close to fully.
 */
function momentumDamping(now) {
  const dt = lastWheelTime ? now - lastWheelTime : Infinity;
  lastWheelTime = now;
  if (dt >= RAPID_TICK_GAP_MS) return 1;
  return Math.max(MIN_MOMENTUM_DAMPING, dt / RAPID_TICK_GAP_MS);
}

function handleWheel(e) {
  if (isAnimatingScroll || !footerPull) return;

  if (!isAtPageBottom()) {
    if (rawPull > 0) resetPullState(true);
    lastWheelTime = 0;
    return;
  }

  if (e.deltaY > 0) {
    const damping = momentumDamping(performance.now());
    beginGestureIfNeeded();
    footerPull.classList.remove('footer-pull-resetting');
    applyProgress(rawPull + e.deltaY * damping);
    scheduleIdleSpringBack();
  } else if (e.deltaY < 0 && rawPull > 0) {
    resetPullState(true);
    lastWheelTime = 0;
  }
}

function handleTouchStart(e) {
  touchStartY = e.touches[0]?.clientY ?? null;
}

function handleTouchMove(e) {
  if (isAnimatingScroll || !footerPull || touchStartY === null) return;

  if (!isAtPageBottom()) {
    if (rawPull > 0) resetPullState(true);
    return;
  }

  const currentY = e.touches[0]?.clientY ?? touchStartY;
  const pulledUpBy = touchStartY - currentY; // finger moving up past the bottom = pulling

  if (pulledUpBy > 0) {
    beginGestureIfNeeded();
    footerPull.classList.remove('footer-pull-resetting');
    applyProgress(pulledUpBy);
  } else if (rawPull > 0) {
    resetPullState(true);
  }
}

function handleTouchEnd() {
  touchStartY = null;
  if (isAnimatingScroll || !footerPull) return;

  // If armed, scrollToTopFast() already fired the instant it filled —
  // nothing left to do here except let an unfinished pull spring back.
  if (!isArmed && rawPull > 0) {
    resetPullState(true);
  }
}
