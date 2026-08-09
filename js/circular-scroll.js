const LOOP_ENABLED = true; // one-line kill switch
const TRIGGER_FRACTION = 0.4; // trigger the jump once scrolled this fraction of one viewport height into the clone

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

    function createClone() {
      // Absolute scroll position where the real grid's content begins
      // (accounts for the header etc. above it) — the clone aligns to this
      // exact point once we jump, since it's a duplicate of what's there.
      const realGridTop = gridContainer.getBoundingClientRect().top + window.scrollY;

      // Absolute scroll position where the clone will begin — i.e. the
      // total page height right before we append it.
      const cloneStartY = document.documentElement.scrollHeight;

      // Clone the whole .projects-section (not just #grid-container) so the
      // clone inherits the real max-width/padding wrapping context —
      // cloning the grid alone left it without that context, so its columns
      // rendered a different width than the real grid's.
      const clone = projectsSection.cloneNode(true);
      clone.id = 'circular-scroll-clone';
      clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      clone.setAttribute('inert', ''); // excludes it from tab order, click interaction, and the accessibility tree
      clone.setAttribute('aria-hidden', 'true');
      mainContent.appendChild(clone);

      let isJumping = false;

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
    // Cloning immediately would capture tiles before they have their
    // grid-row-end spans set, collapsing the clone's height to near zero.
    // Wait for that to actually happen before cloning.
    if (firstTile.style.gridRowEnd) {
      createClone();
    } else {
      const observer = new MutationObserver(() => {
        if (firstTile.style.gridRowEnd) {
          observer.disconnect();
          createClone();
        }
      });
      observer.observe(firstTile, { attributes: true, attributeFilter: ['style'] });
    }

  } catch (err) {
    console.error('circular-scroll init failed (non-fatal, native scroll unaffected):', err);
  }
}
