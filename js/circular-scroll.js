const CIRCULAR_SCROLL_ENABLED = true; // one-line kill switch

const MAX_PULL = 90; // px — asymptotic visual cap on how far content can visually shift
const POP_THRESHOLD = MAX_PULL * 0.9; // 81px — trigger the "pop" once pull gets this close to the cap
const DECAY_MS = 150; // if no new qualifying pull event arrives within this window, spring back
const SPRING_BACK_MS = 250; // CSS transition duration for the spring-back animation
const PER_EVENT_DELTA_CAP = 40; // clamp any single wheel/touch event's raw delta contribution, so one big mouse-wheel notch can't jump the pull too far at once

export function initCircularScroll() {
  if (!CIRCULAR_SCROLL_ENABLED) return;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // full bypass — no listeners at all for reduced-motion users

    const mainContent = document.querySelector('.main-content');
    if (!mainContent) return;

    const hint = document.createElement('i');
    hint.id = 'circular-scroll-hint';
    hint.className = 'fas fa-rotate-right';
    hint.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hint);

    let pull = 0; // 0..MAX_PULL — this is both the accumulator AND the visual offset in px
    let decayTimer = null;
    let isPopping = false;

    function isAtBottom() {
      const scrollableRange = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollableRange < 50) return false; // page too short to have a meaningful bottom edge
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      // -2px epsilon for subpixel rounding
    }

    function render() {
      mainContent.style.transform = pull > 0 ? `translateY(-${pull}px)` : '';
      hint.style.opacity = String(Math.min(pull / POP_THRESHOLD, 1));
    }

    function addPull(rawDelta) {
      const clamped = Math.min(Math.max(rawDelta, 0), PER_EVENT_DELTA_CAP);
      const remainingRatio = Math.max((MAX_PULL - pull) / MAX_PULL, 0); // 1 at pull=0, approaches 0 near MAX_PULL — this is what creates the "increasing resistance" feel
      pull = Math.min(pull + clamped * remainingRatio, MAX_PULL);
    }

    function springBack() {
      if (isPopping) return;
      mainContent.style.transition = `transform ${SPRING_BACK_MS}ms ease-out`;
      pull = 0;
      render();
      setTimeout(() => {
        mainContent.style.transition = 'none';
      }, SPRING_BACK_MS);
    }

    function resetDecayTimer() {
      clearTimeout(decayTimer);
      decayTimer = setTimeout(springBack, DECAY_MS);
    }

    function flashHint() {
      hint.classList.remove('popping'); // restart animation if already present
      void hint.offsetWidth; // force reflow so the animation restarts cleanly
      hint.classList.add('popping');
    }

    function triggerPop() {
      if (isPopping) return;
      isPopping = true;
      clearTimeout(decayTimer);
      mainContent.style.transition = 'none';
      pull = 0;
      render();
      flashHint();

      // A scroll originating from an active wheel gesture can end up
      // smoothed by the browser's own wheel-scroll handling regardless of
      // scroll-behavior overrides — that's a browser-internal behavior we
      // can't reliably force to be instant. So the pop embraces a smooth
      // scroll-to-top (matching the existing gg/Shift+G shortcuts) instead
      // of fighting for a teleport; isPopping is released via the standard
      // 'scrollend' event so it accurately reflects when the animation is
      // actually done, with a timeout fallback for browsers without it.
      const clearPopping = () => { isPopping = false; };
      if ('onscrollend' in window) {
        window.addEventListener('scrollend', clearPopping, { once: true });
      } else {
        setTimeout(clearPopping, 1000);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handleQualifyingPull(rawDelta) {
      if (isPopping) return;
      // A prior springBack() may have left a transition timeout pending;
      // force instant tracking now so this live pull isn't animated/laggy.
      mainContent.style.transition = 'none';
      addPull(rawDelta);
      render();
      resetDecayTimer();
      if (pull >= POP_THRESHOLD) {
        triggerPop();
      }
    }

    // --- Wheel (desktop mouse + trackpad) ---
    window.addEventListener('wheel', (e) => {
      if (isPopping) return;
      if (isAtBottom() && e.deltaY > 0) {
        e.preventDefault();
        handleQualifyingPull(e.deltaY);
      } else if (pull > 0 && e.deltaY < 0) {
        // user reversed direction while under tension — spring back immediately, let the upward scroll pass through natively
        clearTimeout(decayTimer);
        springBack();
      }
    }, { passive: false });

    // --- Touch (mobile) ---
    let touchY = null;

    window.addEventListener('touchstart', (e) => {
      touchY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (touchY === null || isPopping) return;
      const currentY = e.touches[0].clientY;
      const rawDelta = touchY - currentY; // positive when finger moves up (user still trying to scroll further down)
      touchY = currentY;

      if (isAtBottom() && rawDelta > 0) {
        e.preventDefault();
        handleQualifyingPull(rawDelta);
      } else if (pull > 0 && rawDelta < 0) {
        clearTimeout(decayTimer);
        springBack();
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      touchY = null;
      if (pull > 0 && !isPopping) {
        clearTimeout(decayTimer);
        springBack();
      }
    }, { passive: true });

  } catch (err) {
    console.error('circular-scroll init failed (non-fatal, native scroll unaffected):', err);
  }
}
