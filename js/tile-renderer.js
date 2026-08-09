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
 * Reorder tiles for horizontal-first layout in CSS columns
 * Converts column-major (vertical) to row-major (horizontal) ordering
 * Ensures bottom-priority tiles (negative priority) appear at visual bottom
 * @param {Array} tiles - Sorted array of tiles (by priority)
 * @param {number} columnCount - Number of columns
 * @returns {Array} Reordered tiles
 */
function reorderForColumns(tiles, columnCount) {
  if (!tiles || tiles.length === 0 || columnCount <= 1) {
    return tiles;
  }

  // Separate bottom tiles (negative priority) from normal tiles
  const bottomTiles = tiles.filter(t => (t.priority || 0) < 0);
  const normalTiles = tiles.filter(t => (t.priority || 0) >= 0);

  const numNormal = normalTiles.length;
  const numRows = Math.ceil(numNormal / columnCount);
  const reordered = new Array(numNormal);

  // Reorder normal tiles for horizontal-first layout
  for (let i = 0; i < numNormal; i++) {
    // Calculate new position: convert from row-major to column-major
    const row = Math.floor(i / columnCount);
    const col = i % columnCount;
    const newIndex = col * numRows + row;

    if (newIndex < numNormal) {
      reordered[newIndex] = normalTiles[i];
    }
  }

  // Filter out any undefined entries
  const reorderedNormal = reordered.filter(tile => tile !== undefined);

  // Append bottom tiles at the very end
  // This ensures they fill the shortest columns and appear at visual bottom
  return [...reorderedNormal, ...bottomTiles];
}

/**
 * Get current column count from computed styles
 * @param {HTMLElement} container - Grid container element
 * @returns {number} Number of columns
 */
function getCurrentColumnCount(container) {
  const computedStyle = window.getComputedStyle(container);
  const columnCount = computedStyle.columnCount;

  // Parse column count (could be 'auto' or a number)
  if (columnCount === 'auto') {
    return 1;
  }

  return parseInt(columnCount, 10) || 4;
}

/**
 * Render all tiles into the grid container
 * @param {Array} tiles - Array of tile data objects
 * @param {HTMLElement} container - Grid container element
 */
export function renderAllTiles(tiles, container) {
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
      container.appendChild(tileElement);
    }
  });

  // Mark container as loaded
  container.dataset.loading = 'false';

  // Calculate masonry layout after images load
  waitForImagesToLoad(container).then(() => {
    calculateMasonryLayout(container);
  });

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
  clearExplicitPlacement(visibleTiles);
  installLayoutDebugControls();

  // Clear stale spans as a group before measuring. Measuring and mutating one
  // card at a time made later cards inherit geometry from the previous layout.
  visibleTiles.forEach(tile => { tile.style.gridRowEnd = 'auto'; });
  const measurements = visibleTiles.map(tile => ({
    tile,
    rowSpan: Math.ceil((tile.getBoundingClientRect().height + gap) / rowHeight)
  }));

  if (shouldUseGroupedLayout(container)) {
    applyGroupedLayout(container, measurements);
    return;
  }

  measurements.forEach(({ tile, rowSpan }) => {
    tile.style.gridRowEnd = `span ${rowSpan}`;
  });
}

const GROUP_ORDER = ['intro', 'writing', 'experience', 'projects', 'links', 'navigation', 'other'];
const LAYOUT_PRESETS = {
  density: { groupDistance: 0.35, compactness: 0.03, holes: 0.4, readingOrder: 0.08, beamWidth: 80, requireConnected: false },
  balanced: { groupDistance: 2.2, compactness: 0.08, holes: 0.55, readingOrder: 0.15, beamWidth: 120, requireConnected: true },
  strong: { groupDistance: 8, compactness: 0.16, holes: 0.7, readingOrder: 0.25, beamWidth: 160, requireConnected: true }
};

function layoutMode() {
  const mode = new URLSearchParams(window.location.search).get('layout') || 'balanced';
  return ['masonry', ...Object.keys(LAYOUT_PRESETS)].includes(mode) ? mode : 'balanced';
}

function shouldUseGroupedLayout(container) {
  if (layoutMode() === 'masonry') return false;
  if (window.getComputedStyle(container).gridTemplateColumns.split(' ').length !== 3) return false;
  if (document.querySelector('.content-type-pill.active, .filter-pill.active')) return false;
  if (document.querySelector('.search-input')?.value.trim()) return false;
  return true;
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
  let beam = [{ heights: [...initialHeights], placements: [], groupRects: [], groupDistanceCost: 0, readingOrderCost: 0 }];

  cards.forEach(card => {
    const next = [];
    beam.forEach(state => {
      const span = card.tile.classList.contains('profile-tile') ? 2 : 1;
      const starts = span === 2 ? [0] : [0, 1, 2];
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

  let heights = [1, 1, 1];
  const placements = [];
  for (const group of GROUP_ORDER) {
    const cards = groups.get(group);
    if (!cards?.length) continue;
    const result = placeGroup(heights, cards, preset);
    heights = result.heights;
    result.placements.forEach(rect => {
      rect.tile.dataset.layoutGroup = group;
      placements.push(rect);
    });
  }

  placements.forEach(({ tile, col, span, row, height }) => {
    tile.style.gridColumnStart = String(col + 1);
    tile.style.gridColumnEnd = `span ${span}`;
    tile.style.gridRowStart = String(row);
    tile.style.gridRowEnd = `span ${height}`;
  });
  document.documentElement.dataset.groupedLayout = layoutMode();
  installLayoutDebugControls();
  renderSemanticRegions(container);
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function renderSemanticRegions(container) {
  const params = new URLSearchParams(window.location.search);
  container.querySelector('.semantic-region-layer')?.remove();
  if (params.get('layoutDebug') !== '1') return;

  cancelAnimationFrame(container._semanticRegionFrame);
  container._semanticRegionFrame = requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    const width = container.clientWidth;
    const height = container.scrollHeight;
    const groups = new Map();

    container.querySelectorAll('.tile[data-layout-group]').forEach(tile => {
      const group = tile.dataset.layoutGroup;
      if (!groups.has(group)) groups.set(group, []);
      const rect = tile.getBoundingClientRect();
      groups.get(group).push({
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height
      });
    });

    const svg = svgElement('svg', {
      class: 'semantic-region-layer',
      width,
      height,
      viewBox: `0 0 ${width} ${height}`,
      'aria-hidden': 'true'
    });
    const definitions = svgElement('defs');
    svg.appendChild(definitions);

    [...groups.entries()].forEach(([group, rects], index) => {
      const drawUnion = (spread, kind) => {
        const maskId = `semantic-region-${kind}-${index}`;
        const mask = svgElement('mask', {
          id: maskId,
          maskUnits: 'userSpaceOnUse',
          x: -24,
          y: -24,
          width: width + 48,
          height: height + 48
        });
        rects.forEach(rect => {
          mask.appendChild(svgElement('rect', {
            x: rect.x - spread,
            y: rect.y - spread,
            width: rect.width + spread * 2,
            height: rect.height + spread * 2,
            rx: 8 + spread,
            fill: 'white'
          }));
        });
        definitions.appendChild(mask);
        svg.appendChild(svgElement('rect', {
          class: `semantic-region semantic-region-${kind}`,
          'data-layout-group': group,
          x: -24,
          y: -24,
          width: width + 48,
          height: height + 48,
          mask: `url(#${maskId})`
        }));
      };

      // A paper-colored outer union makes a small channel only where distinct
      // semantic regions collide; the inner union remains seamless.
      drawUnion(19, 'separator');
      drawUnion(14, 'fill');
    });

    container.prepend(svg);
  });
}

function installLayoutDebugControls() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('layoutDebug') !== '1') return;
  document.documentElement.dataset.layoutDebug = 'true';
  if (document.querySelector('.layout-debug-controls')) return;
  const controls = document.createElement('nav');
  controls.className = 'layout-debug-controls';
  controls.setAttribute('aria-label', 'Layout experiment');
  controls.innerHTML = '<strong>Grouping:</strong> <a data-mode="masonry">Original</a><a data-mode="density">Mostly masonry</a><a data-mode="balanced">Balanced</a><a data-mode="strong">Strong</a>';
  controls.querySelectorAll('[data-mode]').forEach(link => {
    const mode = link.dataset.mode;
    const url = new URL(window.location.href);
    url.searchParams.set('layout', mode);
    url.searchParams.set('layoutDebug', '1');
    link.href = url;
    if (mode === layoutMode()) link.setAttribute('aria-current', 'page');
  });
  document.body.appendChild(controls);
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
