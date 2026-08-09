/**
 * Circular masonry scroll loop.
 *
 * A full virtual scroll: while active, real browser scrolling is disabled
 * (`overflow: hidden`) and a single JS position instead drives two
 * absolutely-positioned copies of the real tile content via CSS transform,
 * combined with modulo ("wrap") arithmetic — so the loop has no seam to
 * hide, by construction, rather than a jump timed to look clean. Once the
 * last row nears the bottom of the viewport, gravity takes over and the
 * position accelerates into a "fall" that lands exactly on the next lap.
 *
 * Every entry point is wrapped so a failure here degrades to ordinary
 * native scrolling — never to a stuck, unscrollable page. Setup failures
 * abort before anything is touched; a runtime error tears the whole thing
 * down and hands control straight back to the browser.
 */

const LOOP_ENABLED = true; // one-line kill switch

const VOID_GAP = 90; // space between the footer (end of packed content) and the fall trigger point
const EASE = 0.3; // eased following for wheel/keyboard input; dragging tracks 1:1
const LEDGE_TRIGGER = 0.82; // fall begins once the bottom edge has climbed this far up the viewport
const GRAVITY = 1.9;
const IMPACT = 34; // landing bounce amount, px
const MIN_FILLER = 90; // minimum height for a generated blank spacer tile
const RESIZE_DEBOUNCE_MS = 150;

export function initCircularLoop() {
  if (!LOOP_ENABLED) return;

  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const gridContainer = document.getElementById('grid-container');
    const projectsSection = document.getElementById('projects-section');
    const mainContent = document.querySelector('.main-content');
    const siteFooter = document.querySelector('.site-footer');
    const headerEl = document.querySelector('.site-header');
    if (!gridContainer || !projectsSection || !mainContent || !siteFooter) return;

    let active = false;
    let rafId = null;
    let stage = null;
    let wrapperEls = [];
    let cycleHeight = 1;
    let listeners = []; // [target, type, handler, options] — removed in deactivate()
    let resizeTimer = null;

    const state = {
      pos: 0, target: 0, dragging: false, lastPointerY: 0, dragVel: 0,
      falling: false, fallVel: 0, fallTo: 0, impact: 0, impactVel: 0,
    };

    const wrap = (v, m) => ((v % m) + m) % m;

    function on(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push([target, type, handler, options]);
    }

    function anyFilterActive() {
      return !!gridContainer.querySelector('.tile[data-filtered="true"]');
    }

    function tilesReady() {
      const first = gridContainer.querySelector('.tile');
      return !!(first && first.style.gridRowEnd);
    }

    // ---- packing: real tiles, real measured heights, derived from the
    // real grid's own computed column layout (single source of truth,
    // rather than a second copy of the CSS breakpoints in JS) ----

    function packTiles() {
      const cs = getComputedStyle(gridContainer);
      const columnWidths = cs.gridTemplateColumns.split(' ').map(parseFloat).filter((n) => !isNaN(n));
      const columnCount = columnWidths.length;
      if (columnCount < 1) throw new Error('circular-loop: could not read grid column count');
      const colWidth = columnWidths[0];

      const gapValue = getComputedStyle(document.documentElement).getPropertyValue('--grid-gap').trim();
      const gap = parseFloat(gapValue) || 20;

      const originX = gridContainer.getBoundingClientRect().left;

      const realTiles = Array.from(gridContainer.querySelectorAll('.tile'));
      if (realTiles.length === 0) throw new Error('circular-loop: no tiles to pack');

      const skyline = new Array(columnCount).fill(0);
      const placed = [];

      const spanTop = (col, span) => {
        let top = 0;
        for (let j = col; j < col + span; j++) top = Math.max(top, skyline[j]);
        return top;
      };

      for (const tile of realTiles) {
        const rect = tile.getBoundingClientRect();
        const rawSpan = tile.classList.contains('profile-tile') ? 2 : 1;
        const span = Math.min(rawSpan, columnCount);

        let bestCol = 0, bestTop = Infinity;
        for (let c = 0; c + span <= columnCount; c++) {
          const t = spanTop(c, span);
          if (t < bestTop) { bestTop = t; bestCol = c; }
        }

        placed.push({ tile, col: bestCol, span, y: bestTop, h: rect.height });
        for (let j = bestCol; j < bestCol + span; j++) skyline[j] = bestTop + rect.height + gap;
      }

      // Square off the ragged bottom with blank spacer tiles (same real
      // .tile styling, just empty) so the loop boundary is flush.
      const bottom = Math.max(...skyline);
      const spacers = [];
      for (let c = 0; c < columnCount; c++) {
        const deficit = bottom - skyline[c] - gap;
        if (deficit >= MIN_FILLER) {
          spacers.push({ col: c, span: 1, y: skyline[c], h: deficit });
        }
      }

      return { columnCount, colWidth, gap, originX, placed, spacers, mosaicHeight: bottom - gap };
    }

    function positionEl(el, packed, col, span, y, h) {
      const x = packed.originX + col * (packed.colWidth + packed.gap);
      const w = span * packed.colWidth + (span - 1) * packed.gap;
      el.style.position = 'absolute';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${w}px`;
      if (h != null) el.style.height = `${h}px`;
    }

    function buildWrapper(packed, footerY, footerHeight) {
      const wrapper = document.createElement('div');
      wrapper.className = 'circular-loop-copy';
      wrapper.style.cssText = 'position:absolute; left:0; top:0; width:100%; will-change:transform;';

      packed.placed.forEach(({ tile, col, span, y }) => {
        const clone = tile.cloneNode(true);
        clone.removeAttribute('id');
        clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
        // Real tiles fade in via an IntersectionObserver on the real
        // (now-hidden) grid — a clone made before that fired would inherit
        // opacity:0 permanently, since its trigger can never fire again.
        clone.classList.remove('tile-hiding');
        clone.classList.add('tile-visible');
        positionEl(clone, packed, col, span, y, null); // height stays auto (content-driven)
        wrapper.appendChild(clone);
      });

      packed.spacers.forEach(({ col, span, y, h }) => {
        const spacer = document.createElement('div');
        spacer.className = 'tile circular-loop-spacer';
        positionEl(spacer, packed, col, span, y, h);
        wrapper.appendChild(spacer);
      });

      const footerClone = siteFooter.cloneNode(true);
      footerClone.removeAttribute('id');
      footerClone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      footerClone.style.cssText = `position:absolute; left:0; top:${footerY}px; width:100%;`;
      wrapper.appendChild(footerClone);

      const ledge = document.createElement('div');
      ledge.className = 'circular-loop-ledge';
      ledge.style.cssText = `position:absolute; left:${packed.originX}px; top:${footerY + footerHeight + 24}px; width:${window.innerWidth - packed.originX * 2}px;`;
      wrapper.appendChild(ledge);

      return wrapper;
    }

    function render() {
      const base = -wrap(state.pos, cycleHeight) + state.impact;
      [0, 1].forEach((k) => {
        const y = base + k * cycleHeight;
        wrapperEls[k].style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
      });
    }

    function step() {
      const vh = window.innerHeight;
      const phase = wrap(state.pos, cycleHeight);
      const ledgeOnScreen = cycleHeight - VOID_GAP - phase; // bottom of footer's position on screen

      if (!state.falling && ledgeOnScreen < vh * LEDGE_TRIGGER) {
        state.falling = true;
        state.fallVel = Math.max(6, (state.target - state.pos) * EASE);
        state.fallTo = state.pos + (cycleHeight - phase);
      }

      if (state.falling) {
        state.fallVel += GRAVITY;
        state.pos += state.fallVel;
        if (state.pos >= state.fallTo) {
          state.pos = state.fallTo;
          state.target = state.pos;
          state.falling = false;
          state.fallVel = 0;
          state.impact = IMPACT;
        }
      } else {
        const delta = Math.max(0, (state.target - state.pos) * (state.dragging ? 1 : EASE));
        state.pos += delta;
      }

      state.impactVel += (0 - state.impact) * 0.2;
      state.impactVel *= 0.72;
      state.impact += state.impactVel;
      if (Math.abs(state.impact) < 0.05 && Math.abs(state.impactVel) < 0.05) {
        state.impact = state.impactVel = 0;
      }

      render();
    }

    function frame() {
      if (!active) return;
      try {
        step();
      } catch (err) {
        console.error('circular-loop runtime error, falling back to native scroll:', err);
        deactivate();
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    // ---- input ----

    function attachInput() {
      const isTyping = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
                              document.activeElement?.isContentEditable;

      on(stage, 'wheel', (e) => {
        if (e.deltaY <= 0 || isTyping()) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
        state.target += e.deltaY * unit;
      }, { passive: false });

      on(stage, 'pointerdown', (e) => {
        state.dragging = true;
        state.lastPointerY = e.clientY;
        state.dragVel = 0;
        state.target = state.pos;
        stage.classList.add('dragging');
        stage.setPointerCapture(e.pointerId);
      });

      on(stage, 'pointermove', (e) => {
        if (!state.dragging) return;
        const dy = e.clientY - state.lastPointerY;
        state.lastPointerY = e.clientY;
        if (dy < 0) state.target -= dy;
        state.dragVel = state.dragVel * 0.7 - dy * 0.3;
      });

      const endDrag = (e) => {
        if (!state.dragging) return;
        state.dragging = false;
        state.target += Math.min(Math.max(state.dragVel * 6, 0), 420);
        stage.classList.remove('dragging');
        if (e.pointerId !== undefined && stage.hasPointerCapture?.(e.pointerId)) {
          stage.releasePointerCapture(e.pointerId);
        }
      };
      on(stage, 'pointerup', endDrag);
      on(stage, 'pointercancel', endDrag);

      on(window, 'keydown', (e) => {
        if (isTyping()) return;
        if (e.key === 'ArrowDown') state.target += 110;
        else if (e.key === 'PageDown' || e.code === 'Space') state.target += window.innerHeight * 0.8;
        else return;
        e.preventDefault();
      });
    }

    // ---- lifecycle ----

    function activate() {
      if (active) return;

      const packed = packTiles();
      const footerHeight = siteFooter.getBoundingClientRect().height;
      const footerY = packed.mosaicHeight + packed.gap;
      cycleHeight = footerY + footerHeight + VOID_GAP;

      stage = document.createElement('div');
      stage.id = 'circular-loop-stage';

      const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
      stage.style.cssText = `position:fixed; left:0; right:0; top:${headerHeight}px; bottom:0; overflow:hidden; touch-action:none; z-index:1;`;

      wrapperEls = [0, 1].map(() => buildWrapper(packed, footerY, footerHeight));
      wrapperEls.forEach((w) => stage.appendChild(w));

      mainContent.style.display = 'none';
      document.body.appendChild(stage);
      document.documentElement.classList.add('circular-loop-active');
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';

      state.pos = 0;
      state.target = 0;
      state.falling = false;
      state.fallVel = 0;
      state.impact = 0;
      state.impactVel = 0;

      attachInput();
      render();

      active = true;
      rafId = requestAnimationFrame(frame);
    }

    function deactivate() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      active = false;

      listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
      listeners = [];

      if (stage) stage.remove();
      stage = null;
      wrapperEls = [];

      document.documentElement.classList.remove('circular-loop-active');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      mainContent.style.display = '';
    }

    function reconcile() {
      try {
        if (anyFilterActive() || !tilesReady()) {
          deactivate();
          return;
        }
        deactivate(); // clean rebuild — column count / tile heights may have changed
        activate();
      } catch (err) {
        console.error('circular-loop setup failed, falling back to native scroll:', err);
        deactivate();
      }
    }

    // Filters changing tile visibility, or a resize (which can change
    // column count), both require a full rebuild — or, while filtered, no
    // loop at all.
    const filterObserver = new MutationObserver(() => reconcile());
    filterObserver.observe(gridContainer, { attributes: true, attributeFilter: ['style', 'data-filtered'], subtree: true });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(reconcile, RESIZE_DEBOUNCE_MS);
    });

    // Expose a minimal API so keyboard-nav's gg/Shift+G can redirect here
    // instead of native scrollTo (which is inert once scrolling is
    // disabled) — falls back to native scroll on its own if this is absent.
    window.__circularLoop = {
      isActive: () => active,
      jumpToTop: () => { state.pos = 0; state.target = 0; },
      jumpToBottom: () => { state.pos = cycleHeight - VOID_GAP; state.target = state.pos; },
    };

    if (tilesReady()) {
      reconcile();
    } else {
      const readyObserver = new MutationObserver(() => {
        if (tilesReady()) {
          readyObserver.disconnect();
          reconcile();
        }
      });
      readyObserver.observe(gridContainer, { attributes: true, attributeFilter: ['style'], subtree: true });
    }

  } catch (err) {
    console.error('circular-loop init failed (non-fatal, native scroll unaffected):', err);
  }
}
