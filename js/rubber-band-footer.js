/**
 * Rubber-Band Footer
 * Once the page is already scrolled to the very bottom, further scroll
 * input reveals a "Back to top" button in place, right under the
 * permanent footer message, with a ring that fills as you keep pulling —
 * quick initial give that gets harder to push further, like real elastic.
 * The reveal is an absolutely-positioned overlay, not layout growth, so
 * the page's scrollable height never changes during the gesture — it
 * reads as something appearing in place, not the page growing/scrolling
 * to make room. The instant the ring completes, it fires (no waiting
 * around for a "release"); if you stop pulling before it's full, it
 * springs back. Never calls preventDefault — the page is already at its
 * scroll limit at that point, so there's nothing to interfere with; this
 * only ever adds behavior, never changes how normal scrolling works
 * anywhere else.
 *
 * TUNING is exported as a single object (values tuned live against a
 * temporary dev panel, since removed) so it's easy to see and adjust every
 * tunable in one place.
 */

export const TUNING = {
  pullDistance: 300, // raw px of scroll input needed to fully arm
  curveExponent: 0.25, // progress = rawPull^curveExponent; 0.5 = sqrt (quick early give, resists near the end)
  springBackIdleMs: 130, // wheel has no "end" event — this long a pause with no progress means "let go"
  bottomEpsilon: 40, // generous — scrollHeight vs. true max scroll position can drift by ~20px
  referenceVelocity: 1.3, // px/ms — at or below this, ticks count fully; above it, damping kicks in
  momentumCurveExponent: 25, // how hard damping crushes ticks past referenceVelocity (higher = more brutal)
  minMomentumDamping: 0.02 // floor so a sustained fast train still creeps forward, just barely
};

let footerPull = null;
let rawPull = 0;
let progress = 0;
let isArmed = false;
let isAnimatingScroll = false;
let idleTimer = null;
let touchStartY = null;
let lastWheelTime = 0;
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
  return window.innerHeight + window.scrollY >= document.body.scrollHeight - TUNING.bottomEpsilon;
}

function progressFromRaw(raw) {
  const clamped = Math.max(0, Math.min(raw, TUNING.pullDistance));
  return Math.pow(clamped / TUNING.pullDistance, TUNING.curveExponent);
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

/**
 * Reads the CSS spring-back duration so the JS cleanup timer always
 * matches, even though that duration is a live-tunable CSS var (dev panel).
 */
function springBackDurationMs() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--footer-spring-back-duration').trim();
  const ms = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
  return Number.isFinite(ms) ? ms : 380;
}

function resetPullState(animate) {
  clearTimeout(idleTimer);
  if (animate) footerPull.classList.add('footer-pull-resetting');
  rawPull = 0;
  progress = 0;
  isArmed = false;
  footerPull.style.setProperty('--pull-progress', '0');
  footerPull.classList.remove('armed', 'footer-pull-active');
  if (animate) {
    setTimeout(() => footerPull?.classList.remove('footer-pull-resetting'), springBackDurationMs() + 30);
  }
}

/**
 * Corrects any residual drift and resets the pull visuals once the scroll
 * has actually finished. A wheel gesture fast enough to arm the pull can
 * still have real browser momentum "in flight" after our own scroll lands
 * — this catches that and fixes it once, without fighting the browser
 * repeatedly.
 */
function finishScrollToTop() {
  if (window.scrollY !== 0) {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  isAnimatingScroll = false;
  resetPullState(true);
}

/**
 * Waits for scrollY to stop changing, for browsers without 'scrollend'
 * (Safari < 17.4). Capped so it can't spin forever on some edge case.
 */
function pollUntilScrollSettles(callback, maxFrames = 240) {
  let lastY = window.scrollY;
  let stableFrames = 0;
  let framesElapsed = 0;

  function check() {
    framesElapsed++;
    const y = window.scrollY;
    if (y === lastY) {
      stableFrames++;
    } else {
      stableFrames = 0;
      lastY = y;
    }

    if (stableFrames >= 3 || framesElapsed >= maxFrames) {
      callback();
      return;
    }
    requestAnimationFrame(check);
  }

  requestAnimationFrame(check);
}

/**
 * Native smooth scroll instead of a hand-rolled easing loop — matches the
 * feel of the site's plain "Back to Top" tile (data/manual-tiles.yml),
 * which is just a bare `<a href="#">` relying entirely on the browser's
 * own scroll-behavior:smooth. The browser's own animation is the same
 * subsystem that owns any in-flight wheel momentum, so it doesn't fight
 * itself the way our old rAF loop (a second, competing driver of scrollTop)
 * sometimes did.
 */
function scrollToTopFast() {
  clearTimeout(idleTimer);
  isAnimatingScroll = true;

  if (prefersReducedMotion || window.scrollY === 0) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    finishScrollToTop();
    return;
  }

  if ('onscrollend' in window) {
    window.addEventListener('scrollend', finishScrollToTop, { once: true });
  } else {
    pollUntilScrollSettles(finishScrollToTop);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function scheduleIdleSpringBack() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!isArmed && rawPull > 0) {
      resetPullState(true);
    }
  }, TUNING.springBackIdleMs);
}

/**
 * Wheel events don't expose whether they're from active input or decaying
 * momentum/fling — but continuous physical scrolling (trackpad contact)
 * fires ticks at similar *frequency* whether you're moving gently or
 * flinging fast, so timing alone can't tell the two apart. What actually
 * differs is speed: px moved per ms. Below referenceVelocity a tick counts
 * fully (this is what makes deliberate scrolling at rest feel sensitive);
 * above it, damping ramps in smoothly, shaped by momentumCurveExponent —
 * same idea as curveExponent, just for "how fast is too fast" instead of
 * "how far is full."
 */
// No timing reference exists for the very first tick of an interaction —
// rather than giving it a free undamped pass (which, combined with a low
// pullDistance, would let a single lucky fast tick nearly arm it by
// itself), judge it by magnitude against this assumed reasonable pace.
const ASSUMED_FIRST_TICK_DT_MS = 50;

function momentumDamping(deltaY, dt) {
  const effectiveDt = Number.isFinite(dt) && dt > 0 ? dt : ASSUMED_FIRST_TICK_DT_MS;
  const velocity = Math.abs(deltaY) / effectiveDt; // px/ms
  if (velocity <= TUNING.referenceVelocity) return 1;

  const ratio = TUNING.referenceVelocity / velocity; // (0, 1) — smaller the faster you're going
  const damping = Math.pow(ratio, TUNING.momentumCurveExponent);
  return Math.max(TUNING.minMomentumDamping, damping);
}

function handleWheel(e) {
  // Track timing across every wheel event, not just qualifying ones — a
  // fast fling's first tick *at* the bottom should still read as fast,
  // because it's measured against the ticks that scrolled it down to get
  // there, not treated as a fresh, momentum-free sample.
  const now = performance.now();
  const dt = lastWheelTime ? now - lastWheelTime : Infinity;
  lastWheelTime = now;

  if (isAnimatingScroll || !footerPull) return;

  if (!isAtPageBottom()) {
    if (rawPull > 0) resetPullState(true);
    return;
  }

  if (e.deltaY > 0) {
    const damping = momentumDamping(e.deltaY, dt);
    footerPull.classList.remove('footer-pull-resetting');
    applyProgress(rawPull + e.deltaY * damping);
    scheduleIdleSpringBack();
  } else if (e.deltaY < 0 && rawPull > 0) {
    resetPullState(true);
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
