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
    delete tile.dataset.groupBoundaryTop;
    delete tile.dataset.groupBoundaryRight;
    delete tile.dataset.groupBoundaryBottom;
    delete tile.dataset.groupBoundaryLeft;
    delete tile.dataset.groupNeighborTop;
    delete tile.dataset.groupNeighborRight;
    delete tile.dataset.groupNeighborBottom;
    delete tile.dataset.groupNeighborLeft;
    delete tile.dataset.groupNeighborTopRight;
    delete tile.dataset.groupNeighborBottomRight;
    delete tile.dataset.groupNeighborBottomLeft;
    delete tile.dataset.groupNeighborTopLeft;
    delete tile.dataset.groupCornerTopLeft;
    delete tile.dataset.groupCornerTopRight;
    delete tile.dataset.groupCornerBottomRight;
    delete tile.dataset.groupCornerBottomLeft;
  });
  document.querySelectorAll('.group-edge-debug-layer, .group-halo-underlay-layer, .group-halo-corner-fill-layer').forEach(layer => layer.remove());
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
  markGroupBoundaries(container);
}

function markGroupBoundaries(container) {
  cancelAnimationFrame(container._groupBoundaryFrame);
  container._groupBoundaryFrame = requestAnimationFrame(() => {
    const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap')) || 20;
    const halo = debugNumber(new URLSearchParams(window.location.search), 'halo', 9);
    renderGroupEdgeDiagnostics(container, gap, halo);
  });
}

function subtractIntervals(start, end, intervals) {
  const sorted = intervals
    .map(([from, to]) => [Math.max(start, from), Math.min(end, to)])
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  const exposed = [];
  let cursor = start;
  sorted.forEach(([from, to]) => {
    if (from > cursor) exposed.push([cursor, from]);
    cursor = Math.max(cursor, to);
  });
  if (cursor < end) exposed.push([cursor, end]);
  return exposed;
}

function renderGroupEdgeDiagnostics(container, gap, halo) {
  container.querySelector('.group-edge-debug-layer')?.remove();
  container.querySelector('.group-halo-underlay-layer')?.remove();
  container.querySelector('.group-halo-corner-fill-layer')?.remove();
  const showEdges = document.documentElement.dataset.showGroupEdges === 'true';
  const params = new URLSearchParams(window.location.search);
  const radius = debugNumber(params, 'radius', 8);

  const containerRect = container.getBoundingClientRect();
  const rects = [...container.querySelectorAll('.tile[data-layout-group]')].map(tile => {
    const rect = tile.getBoundingClientRect();
    return {
      tile,
      group: tile.dataset.layoutGroup,
      left: rect.left - containerRect.left - halo,
      right: rect.right - containerRect.left + halo,
      top: rect.top - containerRect.top - halo,
      bottom: rect.bottom - containerRect.top + halo
    };
  });
  const layer = document.createElement('div');
  layer.className = 'group-edge-debug-layer';
  layer.dataset.showLines = String(showEdges);
  const underlayLayer = document.createElement('div');
  underlayLayer.className = 'group-halo-underlay-layer';
  const cornerLayer = document.createElement('div');
  cornerLayer.className = 'group-halo-corner-fill-layer';
  const addHaloFill = (left, top, width, height, color) => {
    if (width <= 0 || height <= 0) return;
    const fill = document.createElement('i');
    fill.className = 'group-halo-corner-fill';
    Object.assign(fill.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      backgroundColor: color
    });
    cornerLayer.appendChild(fill);
  };
  rects.forEach(rect => {
    const underlay = document.createElement('i');
    underlay.className = 'group-halo-underlay';
    Object.assign(underlay.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.right - rect.left}px`,
      height: `${rect.bottom - rect.top}px`,
      borderRadius: `${radius}px`,
      backgroundColor: getComputedStyle(rect.tile).getPropertyValue('--layout-region-fill')
    });
    underlayLayer.appendChild(underlay);
    rect.tile.dataset.groupBoundaryTop = 'false';
    rect.tile.dataset.groupBoundaryRight = 'false';
    rect.tile.dataset.groupBoundaryBottom = 'false';
    rect.tile.dataset.groupBoundaryLeft = 'false';
  });

  const addSegment = (side, fixed, start, end, kind) => {
    if (end - start < 1) return;
    const line = document.createElement('i');
    const orientation = side === 'top' || side === 'bottom' ? 'horizontal' : 'vertical';
    line.className = `group-edge-debug-segment group-edge-debug-segment-${kind} group-edge-debug-segment-${orientation}`;
    if (side === 'top' || side === 'bottom') {
      Object.assign(line.style, { left: `${start}px`, top: `${fixed}px`, width: `${end - start}px` });
    } else {
      Object.assign(line.style, { left: `${fixed}px`, top: `${start}px`, height: `${end - start}px` });
    }
    layer.appendChild(line);
  };

  const facesOtherGroup = (rect, side, fixed, start, end) => rects.some(other => {
    if (other === rect || other.group === rect.group) return false;
    const projection = side === 'top' || side === 'bottom'
      ? Math.min(end, other.right) - Math.max(start, other.left)
      : Math.min(end, other.bottom) - Math.max(start, other.top);
    if (projection <= 0) return false;
    if (side === 'top') return other.top < fixed && fixed - other.bottom <= gap + halo;
    if (side === 'bottom') return other.bottom > fixed && other.top - fixed <= gap + halo;
    if (side === 'left') return other.left < fixed && fixed - other.right <= gap + halo;
    return other.right > fixed && other.left - fixed <= gap + halo;
  });

  rects.forEach(rect => {
    const same = rects.filter(other => other !== rect && other.group === rect.group);
    const sides = [
      { side: 'top', fixed: rect.top, start: rect.left, end: rect.right, covers: same.filter(other => other.top < rect.top && other.bottom >= rect.top).map(other => [other.left, other.right]) },
      { side: 'right', fixed: rect.right, start: rect.top, end: rect.bottom, covers: same.filter(other => other.left <= rect.right && other.right > rect.right).map(other => [other.top, other.bottom]) },
      { side: 'bottom', fixed: rect.bottom, start: rect.left, end: rect.right, covers: same.filter(other => other.top <= rect.bottom && other.bottom > rect.bottom).map(other => [other.left, other.right]) },
      { side: 'left', fixed: rect.left, start: rect.top, end: rect.bottom, covers: same.filter(other => other.left < rect.left && other.right >= rect.left).map(other => [other.top, other.bottom]) }
    ];
    const exposedBySide = {};
    sides.forEach(({ side, fixed, start, end, covers }) => {
      const exposed = subtractIntervals(start, end, covers);
      exposedBySide[side] = exposed;
      exposed.forEach(([segmentStart, segmentEnd]) => {
        const kind = facesOtherGroup(rect, side, fixed, segmentStart, segmentEnd) ? 'intergroup' : 'external';
        if (kind === 'intergroup') {
          const attribute = `groupBoundary${side[0].toUpperCase()}${side.slice(1)}`;
          rect.tile.dataset[attribute] = 'true';
        }
        addSegment(side, fixed, segmentStart, segmentEnd, kind);
      });
    });

    const cornerTouchesSameGroup = (x, y) => same.some(other =>
      x >= other.left - 0.5 && x <= other.right + 0.5 &&
      y >= other.top - 0.5 && y <= other.bottom + 0.5
    );
    const corners = [
      { name: 'TopLeft', x: rect.left, y: rect.top },
      { name: 'TopRight', x: rect.right, y: rect.top },
      { name: 'BottomRight', x: rect.right, y: rect.bottom },
      { name: 'BottomLeft', x: rect.left, y: rect.bottom }
    ];
    const color = getComputedStyle(rect.tile).getPropertyValue('--layout-region-fill');
    corners.forEach(corner => {
      const internal = cornerTouchesSameGroup(corner.x, corner.y);
      rect.tile.dataset[`groupCorner${corner.name}`] = String(!internal);
      if (!internal || halo <= 0) return;
      addHaloFill(
        corner.name.includes('Left') ? corner.x - 0.5 : corner.x - halo - 0.5,
        corner.name.includes('Top') ? corner.y - 0.5 : corner.y - halo - 0.5,
        halo + 1,
        halo + 1,
        color
      );
    });
  });

  // Exact shadow contacts can still expose a subpixel antialiasing seam.
  // Bridge only same-group facing edges, with one pixel of overlap per side.
  rects.forEach((a, index) => {
    rects.slice(index + 1).forEach(b => {
      if (a.group !== b.group) return;
      const color = getComputedStyle(a.tile).getPropertyValue('--layout-region-fill');
      const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const horizontalOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);

      const horizontalContact = a.right <= b.left ? [a.right, b.left] : (b.right <= a.left ? [b.right, a.left] : null);
      if (horizontalContact && horizontalContact[1] - horizontalContact[0] <= 2 && verticalOverlap > 0) {
        addHaloFill(horizontalContact[0] - 1, Math.max(a.top, b.top), horizontalContact[1] - horizontalContact[0] + 2, verticalOverlap, color);
      }

      const verticalContact = a.bottom <= b.top ? [a.bottom, b.top] : (b.bottom <= a.top ? [b.bottom, a.top] : null);
      if (verticalContact && verticalContact[1] - verticalContact[0] <= 2 && horizontalOverlap > 0) {
        addHaloFill(Math.max(a.left, b.left), verticalContact[0] - 1, horizontalOverlap, verticalContact[1] - verticalContact[0] + 2, color);
      }
    });
  });

  container.appendChild(underlayLayer);
  container.appendChild(cornerLayer);
  container.appendChild(layer);
}

function installLayoutDebugControls() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('layoutDebug') !== '1') return;
  if (params.has('boundary')) {
    params.delete('boundary');
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = params.toString();
    history.replaceState(history.state, '', cleanUrl);
  }
  document.documentElement.dataset.layoutDebug = 'true';
  if (document.querySelector('.layout-debug-controls')) return;
  applyLayoutDebugSettings();
  const controls = document.createElement('aside');
  controls.className = 'layout-debug-controls';
  controls.setAttribute('aria-label', 'Layout experiment');
  const computedGap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap')) || 20;
  controls.innerHTML = `
    <button class="layout-debug-collapse" type="button" aria-expanded="true">Hide controls</button>
    <div class="layout-debug-modes"><strong>Layout</strong><a data-mode="masonry">Original</a><a data-mode="density">Mostly masonry</a><a data-mode="balanced">Balanced</a><a data-mode="strong">Strong</a></div>
    <div class="layout-debug-tuners">
      <label><span><strong>Card gap</strong><output data-output="groupGap">${params.get('groupGap') || computedGap}px</output></span><input data-setting="groupGap" type="range" min="8" max="40" step="1" value="${params.get('groupGap') || computedGap}"><small>Base space between every masonry card.</small></label>
      <label><span><strong>Halo spread</strong><output data-output="halo">${params.get('halo') || 9}px</output></span><input data-setting="halo" type="range" min="0" max="24" step="1" value="${params.get('halo') || 9}"><small>How far each card expands its group color.</small></label>
      <label><span><strong>Halo radius</strong><output data-output="radius">${params.get('radius') || 8}px</output></span><input data-setting="radius" type="range" min="0" max="32" step="1" value="${params.get('radius') || 8}"><small>Corner radius of the current card-and-halo silhouette. Set to 0 to test fully square group geometry.</small></label>
      <label><span><strong>Radius mode</strong></span><select data-setting="radiusMode"><option value="smart" ${params.get('radiusMode') !== 'uniform' ? 'selected' : ''}>Smart same-color contact</option><option value="uniform" ${params.get('radiusMode') === 'uniform' ? 'selected' : ''}>Uniform/manual</option></select><small>Smart squares a corner only when that exact halo corner touches another halo of the same color.</small></label>
      <label><span><strong>Different-group horizontal padding</strong><output data-output="dividerX">${params.get('dividerX') || 1}px</output></span><input data-setting="dividerX" type="range" min="0" max="32" step="1" value="${params.get('dividerX') || 1}"><small>Real extra space shared by facing left/right card edges.</small></label>
      <label><span><strong>Different-group vertical padding</strong><output data-output="dividerY">${params.get('dividerY') || 1}px</output></span><input data-setting="dividerY" type="range" min="0" max="32" step="1" value="${params.get('dividerY') || 1}"><small>Real extra space shared by facing top/bottom card edges.</small></label>
      <label><span><strong>Perimeter cut</strong><output data-output="cutout">${params.get('cutout') || 5}px</output></span><input data-setting="cutout" type="range" min="0" max="16" step="1" value="${params.get('cutout') || 5}"><small>Background removed on each side of every group perimeter segment.</small></label>
      <label><span><strong>Blob softness</strong><output data-output="blobBlur">${params.get('blobBlur') || 1.5}px</output></span><input data-setting="blobBlur" type="range" min="0" max="8" step="0.5" value="${params.get('blobBlur') || 1.5}"><small>Softens only the colored underlay and fuses tiny seams.</small></label>
      <label><span><strong>Paper grain</strong><output data-output="grain">${params.get('grain') || 12}%</output></span><input data-setting="grain" type="range" min="0" max="40" step="1" value="${params.get('grain') || 12}"><small>Adds subtle texture to the colored regions, not the cards.</small></label>
      <label><span><strong>Channel softness</strong><output data-output="channelBlur">${params.get('channelBlur') || 0.5}px</output></span><input data-setting="channelBlur" type="range" min="0" max="4" step="0.5" value="${params.get('channelBlur') || 0.5}"><small>Softens the rounded background cuts between group regions.</small></label>
      <label><span><strong>Color</strong><output data-output="color">${params.get('color') || 42}%</output></span><input data-setting="color" type="range" min="10" max="90" step="1" value="${params.get('color') || 42}"><small>Debug color strength; it does not affect geometry.</small></label>
      <label class="layout-debug-check"><input data-setting="edges" type="checkbox" ${params.get('edges') === '0' ? '' : 'checked'}><span><strong>Show group dividers</strong><small>Red lines mark only boundaries between different semantic groups.</small></span></label>
    </div>
    <div class="layout-debug-math" aria-live="polite"></div>
    <button class="layout-debug-copy" type="button">Copy configuration URL</button>`;
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
      const value = input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value;
      const output = controls.querySelector(`[data-output="${setting}"]`);
      if (output) output.textContent = `${value}${setting === 'color' || setting === 'grain' ? '%' : 'px'}`;
      const url = new URL(window.location.href);
      url.searchParams.set(setting, value);
      history.replaceState(history.state, '', url);
      applyLayoutDebugSettings();
      updateLayoutDebugMath(controls);
      if (setting === 'groupGap') {
        cancelAnimationFrame(relayoutFrame);
        relayoutFrame = requestAnimationFrame(() => calculateMasonryLayout(document.querySelector('.grid-container')));
      } else if (setting === 'halo' || setting === 'radius' || setting === 'edges' || setting === 'dividerX' || setting === 'dividerY') {
        markGroupBoundaries(document.querySelector('.grid-container'));
      }
    });
  });
  controls.querySelector('.layout-debug-copy').addEventListener('click', async event => {
    await navigator.clipboard.writeText(window.location.href);
    event.currentTarget.textContent = 'Copied';
    setTimeout(() => { event.currentTarget.textContent = 'Copy configuration URL'; }, 1200);
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
  if (params.get('layoutDebug') !== '1') return;
  const root = document.documentElement;
  if (params.has('groupGap')) root.style.setProperty('--grid-gap', `${debugNumber(params, 'groupGap', 20)}px`);
  root.style.setProperty('--debug-group-halo', `${debugNumber(params, 'halo', 9)}px`);
  root.style.setProperty('--debug-halo-radius', `${debugNumber(params, 'radius', 8)}px`);
  root.style.setProperty('--debug-divider-x', `${debugNumber(params, 'dividerX', 1)}px`);
  root.style.setProperty('--debug-divider-y', `${debugNumber(params, 'dividerY', 1)}px`);
  root.style.setProperty('--debug-perimeter-cutout', `${debugNumber(params, 'cutout', 5)}px`);
  root.style.setProperty('--debug-blob-blur', `${debugNumber(params, 'blobBlur', 1.5)}px`);
  root.style.setProperty('--debug-group-grain', `${debugNumber(params, 'grain', 12) / 100}`);
  root.style.setProperty('--debug-channel-blur', `${debugNumber(params, 'channelBlur', 0.5)}px`);
  root.style.setProperty('--debug-group-color-strength', `${debugNumber(params, 'color', 42)}%`);
  root.dataset.showGroupEdges = params.get('edges') === '0' ? 'false' : 'true';
  root.dataset.haloRadiusMode = params.get('radiusMode') === 'uniform' ? 'uniform' : 'smart';
}

function updateLayoutDebugMath(controls) {
  const params = new URLSearchParams(window.location.search);
  const gap = debugNumber(params, 'groupGap', parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap')) || 20);
  const halo = debugNumber(params, 'halo', 9);
  const sameDelta = halo * 2 - gap;
  controls.querySelector('.layout-debug-math').innerHTML = `Same-group halos: <strong>${sameDelta >= 0 ? `${sameDelta}px overlap` : `${Math.abs(sameDelta)}px gap`}</strong><br><strong class="debug-red-label">Red</strong> = boundary between groups`;
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
