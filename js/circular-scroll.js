const LOOP_ENABLED = true; // one-line kill switch

const MAX_PULL = 90; // px — asymptotic visual cap on how far content can visually shift while resisting
const POP_THRESHOLD = MAX_PULL * 0.9; // release the tension once pull gets this close to the cap
const DECAY_MS = 150; // if no new qualifying pull event arrives within this window, spring back
const SPRING_BACK_MS = 250; // CSS transition duration for the spring-back animation
const PER_EVENT_DELTA_CAP = 40; // clamp any single wheel/touch event's raw delta contribution
const TRIGGER_FRACTION = 0.4; // once released into the clone, snap to the real position this far (in viewports) in

export function initCircularScroll() {
  if (!LOOP_ENABLED) return;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; // full bypass for reduced-motion users

    const gridContainer = document.getElementById('grid-container');
    const projectsSection = document.getElementById('projects-section');
    const mainContent = document.querySelector('.main-content');
    if (!gridContainer || !projectsSection || !mainContent) return;

    const firstTile = gridContainer.querySelector('.tile');
    if (!firstTile) return; // no tiles rendered yet, nothing to loop

    function setup() {
      // Absolute scroll position where the real grid's content begins.
      const realGridTop = gridContainer.getBoundingClientRect().top + window.scrollY;

      // Absolute scroll position where the clone begins — i.e. the total
      // real page height right before we append it. Also doubles as the
      // boundary that defines "the real bottom" for the tension effect,
      // since past this point is entirely cloned content.
      const cloneStartY = document.documentElement.scrollHeight;

      // Clone the whole .projects-section (not just #grid-container) so it
      // inherits the real max-width/padding wrapping context — cloning the
      // grid alone left it without that context, so its columns rendered a
      // different width than the real grid's.
      const clone = projectsSection.cloneNode(true);
      clone.id = 'circular-scroll-clone';
      clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      clone.setAttribute('inert', ''); // excludes it from tab order, click interaction, and the accessibility tree
      clone.setAttribute('aria-hidden', 'true');
      mainContent.appendChild(clone);

      // A native scrollbar thumb can't coherently represent a page whose
      // scrollable length keeps being extended and snapped back — showing
      // one would give the loop away immediately regardless of how clean
      // the content jump is.
      document.documentElement.classList.add('circular-scroll-active');

      const hint = document.createElement('i');
      hint.id = 'circular-scroll-hint';
      hint.className = 'fas fa-rotate-right';
      hint.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hint);

      let pull = 0; // 0..MAX_PULL — both the accumulator and the visual offset in px
      let decayTimer = null;
      let released = false; // true once tension has given way and native scroll is carrying the user into the clone
      let isJumping = false;

      function isAtRealBottom() {
        return window.scrollY + window.innerHeight >= cloneStartY - 2;
      }

      function render() {
        mainContent.style.transform = pull > 0 ? `translateY(-${pull}px)` : '';
        hint.style.opacity = String(Math.min(pull / POP_THRESHOLD, 1));
      }

      function addPull(rawDelta) {
        const clamped = Math.min(Math.max(rawDelta, 0), PER_EVENT_DELTA_CAP);
        const remainingRatio = Math.max((MAX_PULL - pull) / MAX_PULL, 0); // 1 at pull=0, approaches 0 near MAX_PULL
        pull = Math.min(pull + clamped * remainingRatio, MAX_PULL);
      }

      function springBack() {
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
        hint.classList.remove('popping');
        void hint.offsetWidth; // force reflow so the animation restarts cleanly
        hint.classList.add('popping');
      }

      function release() {
        clearTimeout(decayTimer);
        mainContent.style.transition = 'none';
        pull = 0;
        render();
        flashHint();
        // From here on, wheel/touch pass through untouched — native scroll
        // carries the user straight into the already-appended clone.
        released = true;
      }

      function handleQualifyingPull(rawDelta) {
        mainContent.style.transition = 'none'; // guard against a stale springBack transition lagging a fresh pull
        addPull(rawDelta);
        render();
        resetDecayTimer();
        if (pull >= POP_THRESHOLD) {
          release();
        }
      }

      // --- Wheel (desktop mouse + trackpad) ---
      window.addEventListener('wheel', (e) => {
        if (released) return;
        const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
                          document.activeElement?.isContentEditable;
        if (isTyping) return;

        if (isAtRealBottom() && e.deltaY > 0) {
          e.preventDefault();
          handleQualifyingPull(e.deltaY);
        } else if (pull > 0 && e.deltaY < 0) {
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
        if (released || touchY === null) return;
        const currentY = e.touches[0].clientY;
        const rawDelta = touchY - currentY; // positive when finger moves up (still trying to scroll further down)
        touchY = currentY;

        if (isAtRealBottom() && rawDelta > 0) {
          e.preventDefault();
          handleQualifyingPull(rawDelta);
        } else if (pull > 0 && rawDelta < 0) {
          clearTimeout(decayTimer);
          springBack();
        }
      }, { passive: false });

      window.addEventListener('touchend', () => {
        touchY = null;
        if (pull > 0 && !released) {
          clearTimeout(decayTimer);
          springBack();
        }
      }, { passive: true });

      // Once released, native scroll carries the user into the clone with
      // zero interception (this is the part proven clean via direct
      // testing — driving the eventual correction from a passive 'scroll'
      // listener, never from inside an active wheel/touch handler, avoids
      // the browser's own wheel-momentum scroll smoothing entirely). Once
      // they're far enough into the clone, snap to the pixel-equivalent
      // real position.
      window.addEventListener('scroll', () => {
        if (isJumping) return;

        const intoClone = window.scrollY - cloneStartY;
        const triggerPx = window.innerHeight * TRIGGER_FRACTION;

        if (intoClone > triggerPx) {
          isJumping = true;
          const target = Math.max(0, realGridTop + intoClone);

          const previousScrollBehavior = document.documentElement.style.scrollBehavior;
          document.documentElement.style.scrollBehavior = 'auto';
          window.scrollTo({ top: target, behavior: 'auto' });

          const finish = () => {
            document.documentElement.style.scrollBehavior = previousScrollBehavior;
            isJumping = false;
            released = false; // re-arm tension for the next lap
          };
          if ('onscrollend' in window) {
            window.addEventListener('scrollend', finish, { once: true });
          } else {
            setTimeout(finish, 1000);
          }
        }
      }, { passive: true });
    }

    // The real grid's row-span layout is computed asynchronously, after its
    // images finish loading (see waitForImagesToLoad in tile-renderer.js).
    // Setting up immediately would clone tiles before they have their
    // grid-row-end spans set, collapsing the clone's height to near zero.
    // Wait for that to actually happen first.
    if (firstTile.style.gridRowEnd) {
      setup();
    } else {
      const observer = new MutationObserver(() => {
        if (firstTile.style.gridRowEnd) {
          observer.disconnect();
          setup();
        }
      });
      observer.observe(firstTile, { attributes: true, attributeFilter: ['style'] });
    }

  } catch (err) {
    console.error('circular-scroll init failed (non-fatal, native scroll unaffected):', err);
  }
}
