/**
 * Keyboard Navigation Module
 * Provides keyboard shortcuts for site navigation and search
 */

let lastKey = null;
let lastKeyTime = 0;

// Throttle j/k tile moves so OS key-repeat (or fast manual tapping) can't
// outrun scrollIntoView — without this, each repeat restarts the smooth
// scroll before it can visually progress, so nothing appears to move
// until the key is released.
let lastTileMoveTime = 0;
const TILE_MOVE_THROTTLE_MS = 130;

/**
 * Initialize keyboard navigation
 */
export function initKeyboardNav() {
  // Build and append help overlay
  buildHelpOverlay();

  // Set up event listeners
  setupHelpOverlayListeners();
  setupKeydownHandler();
}

/**
 * Build help overlay DOM and append to body
 */
function buildHelpOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'keyboard-help-overlay';
  overlay.className = 'keyboard-help-overlay';
  overlay.setAttribute('hidden', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'keyboard-help-title');

  overlay.innerHTML = `
    <div class="keyboard-help-card">
      <button class="keyboard-help-close" aria-label="Close">×</button>
      <h2 id="keyboard-help-title">Keyboard Shortcuts</h2>
      <table>
        <tr><td><kbd>⌘K</kbd> or <kbd>/</kbd></td><td>Open search</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Close search or dismiss</td></tr>
        <tr><td><kbd>j</kbd> / <kbd>k</kbd></td><td>Next / previous tile (same as Tab)</td></tr>
        <tr><td><kbd>g</kbd> <kbd>g</kbd></td><td>Jump to top</td></tr>
        <tr><td><kbd>Shift</kbd>+<kbd>G</kbd></td><td>Jump to bottom</td></tr>
        <tr><td><kbd>Tab</kbd></td><td>Move between tiles</td></tr>
        <tr><td><kbd>Enter</kbd></td><td>Open focused tile</td></tr>
        <tr><td><kbd>?</kbd></td><td>Toggle this overlay</td></tr>
      </table>
    </div>
  `;

  document.body.appendChild(overlay);
}

/**
 * Get all tile links in DOM order
 */
function getTileLinks() {
  return Array.from(document.querySelectorAll('.tile-link'));
}

/**
 * Focus a tile link and bring it into view
 */
function focusTileLink(link) {
  if (!link) return;
  link.focus();
  link.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Focus the next tile link (same direction as Tab)
 */
function focusNextTile() {
  const links = getTileLinks();
  if (links.length === 0) return;
  const currentIndex = links.indexOf(document.activeElement);
  if (currentIndex === -1) {
    focusTileLink(links[0]);
  } else if (currentIndex < links.length - 1) {
    focusTileLink(links[currentIndex + 1]);
  }
}

/**
 * Focus the previous tile link (same direction as Shift+Tab)
 */
function focusPrevTile() {
  const links = getTileLinks();
  if (links.length === 0) return;
  const currentIndex = links.indexOf(document.activeElement);
  if (currentIndex === -1) {
    focusTileLink(links[0]);
  } else if (currentIndex > 0) {
    focusTileLink(links[currentIndex - 1]);
  }
}

/**
 * Check if search panel is expanded
 */
function isSearchExpanded() {
  return document.getElementById('filter-toggle-btn')?.getAttribute('aria-expanded') === 'true';
}

/**
 * Open search panel
 */
function openSearch() {
  if (!isSearchExpanded()) {
    document.getElementById('filter-toggle-btn')?.click();
  }
}

/**
 * Close search panel
 */
function closeSearch() {
  if (isSearchExpanded()) {
    document.getElementById('filter-toggle-btn')?.click();
    // The panel collapses via CSS, not display:none, so the input keeps
    // DOM focus unless explicitly blurred — which would otherwise block
    // j/k/? shortcuts right after closing search.
    document.querySelector('.search-input')?.blur();
  }
}

/**
 * Open help overlay
 */
function openHelpOverlay() {
  const overlay = document.getElementById('keyboard-help-overlay');
  if (overlay) {
    overlay.removeAttribute('hidden');
  }
}

/**
 * Close help overlay
 */
function closeHelpOverlay() {
  const overlay = document.getElementById('keyboard-help-overlay');
  if (overlay) {
    overlay.setAttribute('hidden', '');
  }
}

/**
 * Toggle help overlay
 */
function toggleHelpOverlay() {
  const overlay = document.getElementById('keyboard-help-overlay');
  if (overlay?.hasAttribute('hidden')) {
    openHelpOverlay();
  } else {
    closeHelpOverlay();
  }
}

/**
 * Show hint toast (only on first keyboard interaction)
 */
function maybeShowHint() {
  if (localStorage.getItem('kbnav_hint_shown')) {
    return;
  }

  localStorage.setItem('kbnav_hint_shown', 'true');

  const toast = document.createElement('div');
  toast.className = 'kbnav-toast';
  toast.textContent = 'Keyboard shortcuts available — press ? for help';

  document.body.appendChild(toast);

  // Click to dismiss
  toast.addEventListener('click', () => {
    toast.classList.add('exiting');
    setTimeout(() => toast.remove(), 300);
  });

  // Auto-dismiss after 6 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.classList.add('exiting');
      setTimeout(() => toast.remove(), 300);
    }
  }, 6000);
}

/**
 * Set up help overlay button listeners and backdrop click
 */
function setupHelpOverlayListeners() {
  const overlay = document.getElementById('keyboard-help-overlay');
  const closeBtn = overlay?.querySelector('.keyboard-help-close');
  const helpBtn = document.getElementById('keyboard-help-btn');
  const mobileHelpBtn = document.getElementById('mobile-keyboard-help-btn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeHelpOverlay);
  }

  // Close on backdrop click (click target is the overlay itself, not the card)
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeHelpOverlay();
      }
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', toggleHelpOverlay);
  }

  if (mobileHelpBtn) {
    mobileHelpBtn.addEventListener('click', toggleHelpOverlay);
  }
}

/**
 * Set up main keydown handler
 */
function setupKeydownHandler() {
  document.addEventListener('keydown', (e) => {
    // Priority 1: Cmd/Ctrl+K (ALWAYS active, even during typing) — toggles
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isSearchExpanded()) {
        closeSearch();
      } else {
        openSearch();
        maybeShowHint();
      }
      return;
    }

    // Priority 2: Escape (ALWAYS active)
    if (e.key === 'Escape') {
      if (!document.getElementById('keyboard-help-overlay')?.hasAttribute('hidden')) {
        closeHelpOverlay();
        return;
      }
      if (isSearchExpanded()) {
        closeSearch();
        return;
      }
      document.activeElement?.blur();
      return;
    }

    // For all other keys: check if user is typing
    const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) ||
                     document.activeElement?.isContentEditable;
    if (isTyping) {
      return;
    }

    // Priority 3: Slash (open search)
    if (e.key === '/') {
      e.preventDefault();
      openSearch();
      maybeShowHint();
      lastKey = null;
      return;
    }

    // Priority 4: Question mark (toggle help)
    if (e.key === '?') {
      toggleHelpOverlay();
      lastKey = null;
      return;
    }

    // Priority 5: j (next tile, same as Tab)
    if (e.key === 'j') {
      const now = Date.now();
      if (now - lastTileMoveTime >= TILE_MOVE_THROTTLE_MS) {
        lastTileMoveTime = now;
        focusNextTile();
        maybeShowHint();
      }
      lastKey = null;
      return;
    }

    // Priority 6: k (previous tile, same as Shift+Tab)
    if (e.key === 'k') {
      const now = Date.now();
      if (now - lastTileMoveTime >= TILE_MOVE_THROTTLE_MS) {
        lastTileMoveTime = now;
        focusPrevTile();
        maybeShowHint();
      }
      lastKey = null;
      return;
    }

    // Priority 7: g then g (jump to top)
    if (e.key === 'g') {
      if (lastKey === 'g' && (Date.now() - lastKeyTime) < 500) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        lastKey = null;
      } else {
        lastKey = 'g';
        lastKeyTime = Date.now();
      }
      return;
    }

    // Priority 8: Shift+G (jump to bottom)
    if (e.key === 'G' && e.shiftKey) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      lastKey = null;
      return;
    }

    // Reset lastKey for any unhandled key
    lastKey = null;
  });
}
