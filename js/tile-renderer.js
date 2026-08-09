/**
 * Tile Rendering Engine
 * Factory pattern for rendering different tile types
 */

/**
 * Tile renderer registry
 */
const TileRenderers = {
  project: renderProjectTile,
  experience: renderProjectTile,  // Use same renderer as project
  education: renderProjectTile,    // Use same renderer as project
  link: renderLinkTile,
  content: renderContentTile,
  widget: renderWidgetTile,
  profile: renderProfileTile
};

/**
 * Render a single tile based on its type
 * @param {Object} tileData - Tile configuration object
 * @returns {HTMLElement|null} Rendered tile element
 */
export function renderTile(tileData) {
  const renderer = TileRenderers[tileData.type];
  if (!renderer) {
    console.warn(`Unknown tile type: ${tileData.type}`);
    return null;
  }

  const tileElement = renderer(tileData);
  applyCommonTileAttributes(tileElement, tileData);
  return tileElement;
}

/**
 * Render all tiles into the grid container
 * @param {Array} tiles - Array of tile data objects
 * @param {HTMLElement} container - Grid container element
 */
export async function renderAllTiles(tiles, container) {
  // Clear existing tiles (keep loading spinner)
  const loadingSpinner = container.querySelector('.loading-spinner');
  container.innerHTML = '';
  if (loadingSpinner) {
    container.appendChild(loadingSpinner);
  }

  // Render all tiles in priority order (no reordering needed with CSS Grid)
  tiles.forEach(tileData => {
    const tileElement = renderTile(tileData);
    if (tileElement) {
      tileElement.classList.add('tile-visible');
      container.appendChild(tileElement);
    }
  });

  // Mark container as loaded
  container.dataset.loading = 'false';

  // Do not reveal generic card markup before its final grouped geometry exists.
  await waitForImagesToLoad(container);
  calculateMasonryLayout(container);
  await new Promise(resolve => requestAnimationFrame(resolve));

  // Store tiles for potential re-rendering on resize
  container._tilesData = tiles;
}

/**
 * Wait for all images in container to load
 * @param {HTMLElement} container - Container element
 * @returns {Promise} Promise that resolves when all images are loaded
 */
function waitForImagesToLoad(container) {
  const images = container.querySelectorAll('img');
  if (images.length === 0) {
    return Promise.resolve();
  }

  const promises = Array.from(images).map(img => {
    if (img.complete) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      img.addEventListener('load', resolve);
      img.addEventListener('error', resolve);
    });
  });

  return Promise.all(promises);
}

/**
 * Calculate masonry layout using grid-row spans
 * Based on: https://css-tricks.com/making-a-masonry-layout-that-works-today/
 * @param {HTMLElement} container - Grid container element
 */
export function calculateMasonryLayout(container) {
  const tiles = container.querySelectorAll('.tile');
  const rowHeight = 1; // Each row is 1px tall (grid-auto-rows: 0 + row-gap: 1px)

  applyLayoutDebugSettings();
  // Get the actual gap we want between tiles
  const computedStyle = window.getComputedStyle(document.documentElement);
  const gapValue = computedStyle.getPropertyValue('--grid-gap').trim();
  const gap = parseInt(gapValue) || 20;

  const visibleTiles = Array.from(tiles).filter(tile => tile.style.display !== 'none');
  Array.from(tiles).filter(tile => tile.style.display === 'none').forEach(tile => {
    tile.style.gridRowEnd = 'span 0';
  });

  // Clear stale placement as a group before measuring. This also prevents a
  // desktop column assignment from creating implicit columns after a resize.
  clearExplicitPlacement(Array.from(tiles));
  const useGroupedLayout = shouldUseGroupedLayout(container);
  if (useGroupedLayout) {
    document.documentElement.dataset.groupedLayout = layoutMode();
    visibleTiles.forEach(tile => { tile.dataset.layoutGroup = semanticGroup(tile); });
  }
  installLayoutDebugControls();

  // Clear stale spans as a group before measuring. Measuring and mutating one
  // card at a time made later cards inherit geometry from the previous layout.
  visibleTiles.forEach(tile => {
    tile.style.gridRowEnd = 'auto';
    tile.style.height = '';
  });
  const measurements = visibleTiles.map(tile => {
    const snappedHeight = Math.ceil(tile.getBoundingClientRect().height);
    tile.style.height = `${snappedHeight}px`;
    return { tile, rowSpan: (snappedHeight + gap) / rowHeight };
  });

  if (useGroupedLayout) {
    applyGroupedLayout(container, measurements);
    return;
  }

  measurements.forEach(({ tile, rowSpan }) => {
    tile.style.gridRowEnd = `span ${rowSpan}`;
  });
}

const CONTENT_GROUP_ORDER = ['writing', 'experience', 'links', 'projects'];
const GROUP_ORDER = ['intro', 'selection', ...CONTENT_GROUP_ORDER, 'other', 'filtered', 'utility'];
const LAYOUT_PRESETS = {
  density: { groupDistance: 0.35, compactness: 0.03, holes: 0.4, readingOrder: 0.08, beamWidth: 80, requireConnected: false },
  balanced: { groupDistance: 2.2, compactness: 0.08, holes: 0.55, readingOrder: 0.15, beamWidth: 120, requireConnected: true },
  strong: { groupDistance: 8, compactness: 0.16, holes: 0.7, readingOrder: 0.25, beamWidth: 160, requireConnected: true }
};
const LAYOUT_DEFAULTS = { groupGap: 30 };
const SURFACED_GROUPS = new Set(CONTENT_GROUP_ORDER.filter((_, index) => index % 2 === 0));

window.addEventListener('site-theme-change', () => {
  const container = document.querySelector('.grid-container');
  if (container && document.documentElement.hasAttribute('data-grouped-layout')) {
    scheduleSemanticRegions(container);
  }
});

function layoutMode() {
  const mode = new URLSearchParams(window.location.search).get('layout') || 'strong';
  return ['masonry', ...Object.keys(LAYOUT_PRESETS)].includes(mode) ? mode : 'strong';
}

function shouldUseGroupedLayout(container) {
  if (layoutMode() === 'masonry') return false;
  if (container.dataset.searchActive === 'true') return false;
  return gridColumnCount(container) > 0;
}

function gridColumnCount(container) {
  return window.getComputedStyle(container).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
}

function clearExplicitPlacement(tiles) {
  tiles.forEach(tile => {
    tile.style.gridColumnStart = '';
    tile.style.gridColumnEnd = '';
    tile.style.gridRowStart = '';
    delete tile.dataset.layoutGroup;
  });
  document.querySelectorAll('.semantic-region-layer').forEach(layer => layer.remove());
  document.documentElement.removeAttribute('data-grouped-layout');
}

function semanticGroup(tile) {
  const filterGroup = tile.closest('.grid-container')?.dataset.filterGroup;
  if (filterGroup) {
    if (tile.dataset.filtered === 'true') return 'filtered';
    return filterGroup;
  }
  if (tile.classList.contains('profile-tile')) return 'intro';
  const type = tile.dataset.contentType;
  return GROUP_ORDER.includes(type) ? type : 'other';
}

function cardDistance(a, b) {
  const horizontal = Math.max(0, Math.max(a.col - (b.col + b.span), b.col - (a.col + a.span)));
  const vertical = Math.max(0, Math.max(a.row - (b.row + b.height), b.row - (a.row + a.height)));
  return horizontal * 160 + vertical;
}

function groupShapeCost(rects, preset) {
  if (rects.length < 2) return 0;
  const minCol = Math.min(...rects.map(rect => rect.col));
  const maxCol = Math.max(...rects.map(rect => rect.col + rect.span));
  const minRow = Math.min(...rects.map(rect => rect.row));
  const maxRow = Math.max(...rects.map(rect => rect.row + rect.height));
  const occupiedArea = rects.reduce((sum, rect) => sum + rect.span * rect.height, 0);
  const boundingArea = (maxCol - minCol) * (maxRow - minRow);
  return Math.max(0, boundingArea - occupiedArea) * preset.compactness;
}

function stateCost(state, preset) {
  const pageHeight = Math.max(...state.heights);
  const holes = state.heights.reduce((sum, height) => sum + pageHeight - height, 0);
  return pageHeight + holes * preset.holes + state.groupDistanceCost * preset.groupDistance +
    state.readingOrderCost * preset.readingOrder + groupShapeCost(state.groupRects, preset);
}

function placeGroup(initialHeights, cards, preset) {
  const columnCount = initialHeights.length;
  let beam = [{ heights: [...initialHeights], placements: [], groupRects: [], groupDistanceCost: 0, readingOrderCost: 0 }];

  cards.forEach(card => {
    const next = [];
    beam.forEach(state => {
      // The permanent introduction is the one intentionally wide card. A
      // section selected through the quick filters reuses that DOM surface,
      // but should participate as a normal one-column masonry card.
      const isWideIntro = card.tile.classList.contains('profile-tile') &&
        !card.tile.classList.contains('section-spotlight');
      const span = isWideIntro ? Math.min(2, columnCount) : 1;
      const starts = Array.from({ length: columnCount - span + 1 }, (_, index) => index);
      starts.forEach(col => {
        const row = Math.max(...state.heights.slice(col, col + span));
        const rect = { tile: card.tile, col, span, row, height: card.rowSpan };
        const nearest = state.groupRects.length > 0
          ? Math.min(...state.groupRects.map(previous => cardDistance(rect, previous)))
          : 0;
        if (preset.requireConnected && state.groupRects.length > 0 && nearest > 0) return;
        const previous = state.placements.at(-1) || state.groupRects.at(-1);
        const readingOrderCost = state.readingOrderCost + (previous && row < previous.row ? previous.row - row : 0);
        const heights = [...state.heights];
        for (let index = col; index < col + span; index += 1) heights[index] = row + card.rowSpan;
        const candidate = {
          heights,
          placements: [...state.placements, rect],
          groupRects: [...state.groupRects, rect],
          groupDistanceCost: state.groupDistanceCost + nearest,
          readingOrderCost
        };
        candidate.cost = stateCost(candidate, preset);
        next.push(candidate);
      });
    });
    next.sort((a, b) => a.cost - b.cost);
    beam = next.slice(0, preset.beamWidth);
  });

  return beam[0];
}

function applyGroupedLayout(container, measurements) {
  const preset = LAYOUT_PRESETS[layoutMode()] || LAYOUT_PRESETS.balanced;
  const groups = new Map(GROUP_ORDER.map(group => [group, []]));
  measurements.forEach(card => groups.get(semanticGroup(card.tile)).push(card));

  const columnCount = gridColumnCount(container);
  const signature = [
    layoutMode(),
    columnCount,
    ...measurements.map(({ tile, rowSpan }) => `${tile.id}:${semanticGroup(tile)}:${rowSpan}`)
  ].join('|');
  const cached = container._groupLayoutCache?.get(signature);
  if (cached) {
    applyPlacements(cached);
    document.documentElement.dataset.groupedLayout = layoutMode();
    scheduleSemanticRegions(container);
    return;
  }

  let heights = Array(columnCount).fill(1);
  const placements = [];
  for (const group of GROUP_ORDER) {
    const cards = groups.get(group);
    if (!cards?.length) continue;
    const result = placeGroup(heights, cards, preset);
    heights = result.heights;
    result.placements.forEach(rect => {
      rect.tile.dataset.layoutGroup = group;
      rect.group = group;
      placements.push(rect);
    });
  }

  applyPlacements(placements);
  container._groupLayoutCache ||= new Map();
  container._groupLayoutCache.set(signature, placements);
  if (container._groupLayoutCache.size > 16) {
    container._groupLayoutCache.delete(container._groupLayoutCache.keys().next().value);
  }
  document.documentElement.dataset.groupedLayout = layoutMode();
  scheduleSemanticRegions(container);
}

function applyPlacements(placements) {
  placements.forEach(({ tile, col, span, row, height, group }) => {
    if (group) tile.dataset.layoutGroup = group;
    tile.style.gridColumnStart = String(col + 1);
    tile.style.gridColumnEnd = `span ${span}`;
    tile.style.gridRowStart = String(row);
    tile.style.gridRowEnd = `span ${height}`;
  });
}

function scheduleSemanticRegions(container) {
  cancelAnimationFrame(container._semanticRegionFrame);
  container._semanticRegionFrame = requestAnimationFrame(() => renderSemanticRegions(container));
}

function coverRegionEdge(region, edge, overlapStart, overlapEnd, tolerance) {
  region.neighbors[edge] = true;

  if (edge === 'left' || edge === 'right') {
    const topCorner = edge === 'left' ? 'topLeft' : 'topRight';
    const bottomCorner = edge === 'left' ? 'bottomLeft' : 'bottomRight';
    if (overlapStart <= region.top + tolerance) region.coveredCorners[topCorner] = true;
    if (overlapEnd >= region.bottom - tolerance) region.coveredCorners[bottomCorner] = true;
    return;
  }

  const leftCorner = edge === 'top' ? 'topLeft' : 'bottomLeft';
  const rightCorner = edge === 'top' ? 'topRight' : 'bottomRight';
  if (overlapStart <= region.left + tolerance) region.coveredCorners[leftCorner] = true;
  if (overlapEnd >= region.right - tolerance) region.coveredCorners[rightCorner] = true;
}

function connectOverlappingRegions(regions, overlapEpsilon) {
  const minimumSharedEdge = overlapEpsilon * 2 + 1;

  for (let firstIndex = 0; firstIndex < regions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < regions.length; secondIndex += 1) {
      const first = regions[firstIndex];
      const second = regions[secondIndex];
      if (first.group !== second.group) continue;

      const overlapX = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      if (overlapX <= 0 || overlapY <= 0) continue;

      /* The narrow overlap dimension crosses the card gap; the wider one is
         the shared edge. Requiring a real shared edge prevents diagonally
         touching corners from being treated as neighbors. */
      if (overlapX < overlapY && overlapY > minimumSharedEdge) {
        const firstIsLeft = first.centerX < second.centerX;
        const overlapTop = Math.max(first.top, second.top);
        const overlapBottom = Math.min(first.bottom, second.bottom);
        coverRegionEdge(first, firstIsLeft ? 'right' : 'left', overlapTop, overlapBottom, overlapEpsilon);
        coverRegionEdge(second, firstIsLeft ? 'left' : 'right', overlapTop, overlapBottom, overlapEpsilon);
      } else if (overlapY < overlapX && overlapX > minimumSharedEdge) {
        const firstIsAbove = first.centerY < second.centerY;
        const overlapLeft = Math.max(first.left, second.left);
        const overlapRight = Math.min(first.right, second.right);
        coverRegionEdge(first, firstIsAbove ? 'bottom' : 'top', overlapLeft, overlapRight, overlapEpsilon);
        coverRegionEdge(second, firstIsAbove ? 'top' : 'bottom', overlapLeft, overlapRight, overlapEpsilon);
      }
    }
  }
}

function applyRegionCorners({ region, neighbors, coveredCorners }) {
  const radius = 'var(--group-radius)';
  const square = '0';
  const topLeft = coveredCorners.topLeft ? square : radius;
  const topRight = coveredCorners.topRight ? square : radius;
  const bottomRight = coveredCorners.bottomRight ? square : radius;
  const bottomLeft = coveredCorners.bottomLeft ? square : radius;

  region.style.borderRadius = `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;
  region.dataset.neighbors = Object.entries(neighbors)
    .filter(([, connected]) => connected)
    .map(([edge]) => edge)
    .join(' ');
  region.dataset.coveredCorners = Object.entries(coveredCorners)
    .filter(([, covered]) => covered)
    .map(([corner]) => corner)
    .join(' ');
}

function renderSemanticRegions(container) {
  container.querySelectorAll('.semantic-region-layer').forEach(layer => layer.remove());
  // Alternating fields distinguish neighboring groups only on the complete
  // homepage mosaic. A filtered single-section view has nothing to alternate.
  if (container.dataset.filterGroup) return;

  const groupedTiles = Array.from(container.querySelectorAll('.tile[data-layout-group]'))
    .filter(tile => SURFACED_GROUPS.has(tile.dataset.layoutGroup));
  if (!groupedTiles.length) return;

  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap')) || LAYOUT_DEFAULTS.groupGap;
  const overlapEpsilon = 1;
  const spread = gap / 2 + overlapEpsilon;
  const containerRect = container.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'semantic-region-layer';
  layer.setAttribute('aria-hidden', 'true');

  const regions = groupedTiles.map(tile => {
    const rect = tile.getBoundingClientRect();
    const region = document.createElement('i');
    region.className = 'semantic-region';
    const left = rect.left - spread;
    const top = rect.top - spread;
    const right = rect.right + spread;
    const bottom = rect.bottom + spread;
    Object.assign(region.style, {
      left: `${left - containerRect.left}px`,
      top: `${top - containerRect.top}px`,
      width: `${right - left}px`,
      height: `${bottom - top}px`
    });
    layer.appendChild(region);
    return {
      region,
      group: tile.dataset.layoutGroup,
      left,
      top,
      right,
      bottom,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      neighbors: { top: false, right: false, bottom: false, left: false },
      coveredCorners: { topLeft: false, topRight: false, bottomRight: false, bottomLeft: false }
    };
  });

  connectOverlappingRegions(regions, overlapEpsilon);
  regions.forEach(applyRegionCorners);
  container.appendChild(layer);
}

function installLayoutDebugControls() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('layoutDebug') !== '1') return;
  document.documentElement.dataset.layoutDebug = 'true';
  if (document.querySelector('.layout-debug-controls')) return;

  applyLayoutDebugSettings();
  const controls = document.createElement('aside');
  controls.className = 'layout-debug-controls';
  controls.setAttribute('aria-label', 'Layout experiment');
  controls.innerHTML = `
    <button class="layout-debug-collapse" type="button" aria-expanded="true">Hide controls</button>
    <div class="layout-debug-modes"><strong>Layout</strong><a data-mode="masonry">Original</a><a data-mode="density">Mostly masonry</a><a data-mode="balanced">Balanced</a><a data-mode="strong">Strong</a></div>
    <div class="layout-debug-tuners">
      <label><span><strong>Card gap</strong><output data-output="groupGap">${params.get('groupGap') || LAYOUT_DEFAULTS.groupGap}px</output></span><input data-setting="groupGap" type="range" min="8" max="48" step="1" value="${params.get('groupGap') || LAYOUT_DEFAULTS.groupGap}"><small>Space between the outlined masonry cards.</small></label>
    </div>
    <div class="layout-debug-math" aria-live="polite"></div>
    <div class="layout-debug-actions"><button class="layout-debug-reset" type="button">Reset baseline</button><button class="layout-debug-copy" type="button">Copy configuration URL</button></div>`;

  controls.querySelector('.layout-debug-collapse').addEventListener('click', event => {
    const collapsed = controls.classList.toggle('layout-debug-controls-collapsed');
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    event.currentTarget.textContent = collapsed ? 'Show controls' : 'Hide controls';
  });

  controls.querySelectorAll('[data-mode]').forEach(link => {
    const mode = link.dataset.mode;
    const url = new URL(window.location.href);
    url.searchParams.set('layout', mode);
    url.searchParams.set('layoutDebug', '1');
    link.href = url;
    if (mode === layoutMode()) link.setAttribute('aria-current', 'page');
  });

  let relayoutFrame;
  controls.querySelectorAll('[data-setting]').forEach(input => {
    input.addEventListener('input', () => {
      const setting = input.dataset.setting;
      const value = input.value;
      controls.querySelector(`[data-output="${setting}"]`).textContent = `${value}px`;
      const url = new URL(window.location.href);
      url.searchParams.set(setting, value);
      history.replaceState(history.state, '', url);
      applyLayoutDebugSettings();
      updateLayoutDebugMath(controls);

      if (setting === 'groupGap') {
        cancelAnimationFrame(relayoutFrame);
        relayoutFrame = requestAnimationFrame(() => calculateMasonryLayout(document.querySelector('.grid-container')));
      }
    });
  });

  controls.querySelector('.layout-debug-copy').addEventListener('click', async event => {
    await navigator.clipboard.writeText(window.location.href);
    event.currentTarget.textContent = 'Copied';
    setTimeout(() => { event.currentTarget.textContent = 'Copy configuration URL'; }, 1200);
  });

  controls.querySelector('.layout-debug-reset').addEventListener('click', () => {
    const baselineUrl = new URL(window.location.href);
    baselineUrl.search = '';
    baselineUrl.hash = '';
    baselineUrl.searchParams.set('layout', 'strong');
    baselineUrl.searchParams.set('layoutDebug', '1');
    window.location.assign(baselineUrl);
  });

  document.body.appendChild(controls);
  updateLayoutDebugMath(controls);
}

function debugNumber(params, name, fallback) {
  const value = Number(params.get(name));
  return Number.isFinite(value) && params.has(name) ? value : fallback;
}

function applyLayoutDebugSettings() {
  const params = new URLSearchParams(window.location.search);
  const root = document.documentElement;
  const isBaselineDesktop = window.matchMedia('(min-width: 1201px) and (max-width: 1799px)').matches;

  if (params.get('layoutDebug') === '1' || isBaselineDesktop) {
    root.style.setProperty('--grid-gap', `${debugNumber(params, 'groupGap', LAYOUT_DEFAULTS.groupGap)}px`);
  } else {
    root.style.removeProperty('--grid-gap');
  }

}

function updateLayoutDebugMath(controls) {
  const params = new URLSearchParams(window.location.search);
  const gap = debugNumber(params, 'groupGap', LAYOUT_DEFAULTS.groupGap);
  controls.querySelector('.layout-debug-math').innerHTML = `Card gap: <strong>${gap}px</strong>`;
}

/**
 * Apply common attributes to all tile types
 * @param {HTMLElement} element - Tile element
 * @param {Object} tileData - Tile configuration
 */
function applyCommonTileAttributes(element, tileData) {
  element.id = `tile-${tileData.id}`;
  element.classList.add('tile'); // Add 'tile' class without removing existing classes
  element.dataset.type = tileData.type;
  element.dataset.priority = tileData.priority || 0;
  element.dataset.spanColumns = tileData.span_columns || 1;
  element.dataset.spanRows = tileData.span_rows || 1;
  element.dataset.tags = JSON.stringify(tileData.tags || []);
  element.dataset.contentType = tileData.content_type || inferContentType(tileData);
  element.dataset.contentTypes = JSON.stringify(tileData.content_types || [element.dataset.contentType].filter(Boolean));
  element.dataset.filterOnly = String(Boolean(tileData.filter_only));
  element.dataset.filtered = 'false';

  if (tileData.filter_only) {
    element.style.display = 'none';
  }

  // Add featured flag
  if (tileData.featured) {
    element.dataset.featured = 'true';
  }
  if (tileData.section_header) {
    element.dataset.sectionHeader = 'true';
  }

  // Add metadata for filtering
  if (tileData.language) {
    element.dataset.language = tileData.language.toLowerCase();
  }
  element.dataset.stars = tileData.stars || 0;
  if (tileData.topics) {
    element.dataset.topics = JSON.stringify(tileData.topics);
  }

  // Apply custom styling - only background and border colors, NEVER text color
  if (tileData.style) {
    if (tileData.style.background_color) {
      element.style.backgroundColor = tileData.style.background_color;
    }
    // Skip text_color - always use default
    if (tileData.style.border_color) {
      element.style.borderColor = tileData.style.border_color;
    }
  }
}

function inferContentType(tileData) {
  if (tileData.type === 'project') return 'projects';
  if (tileData.type === 'experience' || tileData.type === 'education') return 'experience';
  if ((tileData.tags || []).includes('writing')) return 'writing';
  if (tileData.type === 'link') return 'links';
  return '';
}

/**
 * Pages generated onto this site (project READMEs, resume detail pages) stay
 * in the current tab; anything pointing off-site opens in a new one.
 * @param {string} url - Destination URL
 * @returns {string} Anchor target/rel attributes
 */
function externalLinkAttributes(url) {
  const isInternal = /^(\.{0,2}\/|#)/.test(url || '');
  return isInternal ? '' : 'target="_blank" rel="noopener noreferrer"';
}

function cardFooterHTML(trailingHTML = '') {
  if (!trailingHTML) return '';
  return `<div class="tile-card-footer">
    <span class="tile-footer-detail">${trailingHTML}</span>
  </div>`;
}

function formatEditorialDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Render a project tile (GitHub repository)
 * @param {Object} data - Project data
 * @returns {HTMLElement} Article element
 */
function renderProjectTile(data) {
  const tile = document.createElement('article');

  // Build image HTML - only if image exists
  const imageHTML = data.image
    ? `<img src="${data.image}" alt="${data.title || data.name}" class="tile-image" loading="lazy">`
    : '';

  // Build description HTML - only if description exists
  const descriptionHTML = data.description
    ? `<p class="tile-description">${data.description}</p>`
    : '';

  // Format date - either created_at for projects or dates for experience/education.
  // Shown as a subtle corner note rather than in the main meta row.
  let dateHTML = '';

  if (data.type === 'experience' || data.type === 'education') {
    if (data.meta && data.meta.dates) {
      dateHTML = `<span class="tile-created">${data.meta.dates}</span>`;
    }
  } else if (data.created_at) {
    try {
      const date = new Date(data.created_at);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      dateHTML = `<span class="tile-created">${month} ${year}</span>`;
    } catch (e) {
      // If date parsing fails, skip it
    }
  }

  // Stars only get called out once a project has enough to mean something
  const starsHTML = data.stars > 3
    ? `<span class="tile-stars"><i class="fas fa-star"></i> ${data.stars}</span>`
    : '';

  // Build topics HTML - use tags (which include topics + language)
  // Don't show tags for experience/education tiles
  const allTags = [...new Set([...(data.tags || []), ...(data.topics || [])])];
  const topicsHTML = (allTags.length > 0 && data.type !== 'experience' && data.type !== 'education')
    ? `<div class="tile-topics">
         ${allTags.map(topic => `<span class="tile-topic">${topic}</span>`).join('')}
       </div>`
    : '';

  const footerHTML = cardFooterHTML(`${starsHTML}${dateHTML}`);

  tile.innerHTML = `
    <a href="${data.url}" class="tile-link" ${externalLinkAttributes(data.url)}>
      ${imageHTML}
      <div class="tile-content">
        <h3 class="tile-title">${data.title || data.name}</h3>
        ${descriptionHTML}
        ${topicsHTML}
        ${footerHTML}
      </div>
    </a>
  `;

  return tile;
}

/**
 * Render a link tile (custom link with optional image)
 * @param {Object} data - Link tile data
 * @returns {HTMLElement} Article element
 */
function renderLinkTile(data) {
  const tile = document.createElement('article');

  // Build image HTML if exists
  const imageHTML = data.image
    ? `<img src="${data.image}" alt="${data.title}" class="tile-image" loading="lazy">`
    : '';

  // Build icon HTML for inline display (next to title)
  const iconHTML = (data.icon && !data.image)
    ? `<i class="${data.icon} tile-title-icon"></i>`
    : '';

  const target = data.open_new_tab ? 'target="_blank" rel="noopener noreferrer"' : '';

  // Only include description if it exists
  const descriptionHTML = data.description
    ? `<p class="tile-description">${data.description}</p>`
    : '';
  const dateHTML = data.date ? `<span class="tile-created">${formatEditorialDate(data.date)}</span>` : '';
  const footerHTML = cardFooterHTML(dateHTML);

  tile.innerHTML = `
    <a href="${data.url}" class="tile-link" ${target}>
      ${imageHTML}
      <div class="tile-content">
        <h3 class="tile-title">${iconHTML}${data.title}</h3>
        ${descriptionHTML}
        ${footerHTML}
      </div>
    </a>
  `;

  return tile;
}

/**
 * Render a content tile (markdown content)
 * @param {Object} data - Content tile data
 * @returns {HTMLElement} Article element
 */
function renderContentTile(data) {
  const tile = document.createElement('article');

  // Parse markdown to HTML (using marked.js)
  const htmlContent = marked.parse(data.content_markdown || '');

  const imageHTML = data.image
    ? `<img src="${data.image}" alt="${data.title}" class="tile-image" loading="lazy">`
    : '';

  tile.innerHTML = `
    ${imageHTML}
    <div class="tile-content">
      <h3 class="tile-title">${data.title}</h3>
      <div class="tile-markdown-content">${htmlContent}</div>
    </div>
  `;

  return tile;
}

/**
 * Render a widget tile (interactive component)
 * @param {Object} data - Widget tile data
 * @returns {HTMLElement} Article element
 */
function renderWidgetTile(data) {
  const tile = document.createElement('article');

  tile.innerHTML = `
    <div class="tile-content">
      <h3 class="tile-title">${data.title}</h3>
      <div class="tile-widget" id="widget-${data.widget_id}">
        <p class="tile-description">Widget: ${data.widget_id}</p>
        <p><em>Widget functionality coming soon...</em></p>
      </div>
    </div>
  `;

  return tile;
}

/**
 * Render a profile tile (intro/about)
 * @param {Object} data - Profile tile data
 * @returns {HTMLElement} Article element
 */
function renderProfileTile(data) {
  const tile = document.createElement('article');

  // Special class for full-width profile tile
  tile.classList.add('profile-tile');

  const imageHTML = data.image
    ? `<img src="${data.image}" alt="Profile" class="profile-tile-image">`
    : '';

  const descriptionHTML = data.description
    ? `<p class="profile-tile-description">${data.description}</p>`
    : '';

  // Format title with "Avery" highlighted
  const formattedTitle = data.title.replace('"Avery"', '<span class="highlight-name">"Avery"</span>');

  tile.innerHTML = `
    <div class="profile-tile-content">
      ${imageHTML}
      <div class="profile-tile-info">
        <h1 class="profile-tile-title">${formattedTitle}</h1>
        ${descriptionHTML}
      </div>
    </div>
  `;

  return tile;
}
