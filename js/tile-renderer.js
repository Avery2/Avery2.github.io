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
  clearExplicitPlacement(Array.from(tiles));
  const useGroupedLayout = shouldUseGroupedLayout(container);
  if (useGroupedLayout) {
    document.documentElement.dataset.groupedLayout = layoutMode();
    visibleTiles.forEach(tile => { tile.dataset.layoutGroup = semanticGroup(tile); });
  }
  installLayoutDebugControls();

  // Clear stale spans as a group before measuring. Measuring and mutating one
  // card at a time made later cards inherit geometry from the previous layout.
  visibleTiles.forEach(tile => { tile.style.gridRowEnd = 'auto'; });
  const measurements = visibleTiles.map(tile => ({
    tile,
    rowSpan: Math.ceil((tile.getBoundingClientRect().height + gap) / rowHeight)
  }));

  if (useGroupedLayout) {
    applyGroupedLayout(container, measurements);
    return;
  }

  measurements.forEach(({ tile, rowSpan }) => {
    tile.style.gridRowEnd = `span ${rowSpan}`;
  });
}

const GROUP_ORDER = ['intro', 'writing', 'experience', 'links', 'projects', 'navigation', 'other'];
const LAYOUT_PRESETS = {
  density: { groupDistance: 0.35, compactness: 0.03, holes: 0.4, readingOrder: 0.08, beamWidth: 80, requireConnected: false },
  balanced: { groupDistance: 2.2, compactness: 0.08, holes: 0.55, readingOrder: 0.15, beamWidth: 120, requireConnected: true },
  strong: { groupDistance: 8, compactness: 0.16, holes: 0.7, readingOrder: 0.25, beamWidth: 160, requireConnected: true }
};
const BLOB_DEBUG_DEFAULTS = {
  groupGap: 40,
  halo: 21.5,
  topologyHalo: 26.5,
  color: 90,
  radius: 0,
  dividerX: 0,
  dividerY: 0,
  cutout: 6,
  cutoutEnd: 6,
  cutoutRadius: 0,
  blobBlur: 0,
  grain: 0,
  channelBlur: 0
};

function layoutMode() {
  const mode = new URLSearchParams(window.location.search).get('layout') || 'strong';
  return ['masonry', ...Object.keys(LAYOUT_PRESETS)].includes(mode) ? mode : 'strong';
}

function shouldUseGroupedLayout(container) {
  if (layoutMode() === 'masonry') return false;
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
  const columnCount = initialHeights.length;
  let beam = [{ heights: [...initialHeights], placements: [], groupRects: [], groupDistanceCost: 0, readingOrderCost: 0 }];

  cards.forEach(card => {
    const next = [];
    beam.forEach(state => {
      const span = card.tile.classList.contains('profile-tile') ? Math.min(2, columnCount) : 1;
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
  let heights = Array(columnCount).fill(1);
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
  markGroupBoundaries(container);
}

function markGroupBoundaries(container) {
  cancelAnimationFrame(container._groupBoundaryFrame);
  container._groupBoundaryFrame = requestAnimationFrame(() => {
    const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--grid-gap')) || 20;
    const params = new URLSearchParams(window.location.search);
    const styledHalo = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--debug-group-halo'));
    const halo = debugNumber(params, 'halo', Number.isFinite(styledHalo) ? styledHalo : gap / 2 + 1.5);
    const topologyHalo = debugNumber(params, 'topologyHalo', gap * BLOB_DEBUG_DEFAULTS.topologyHalo / BLOB_DEBUG_DEFAULTS.groupGap);
    renderGroupEdgeDiagnostics(container, gap, halo, topologyHalo);
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

function expandedTopologySignature(container, gap, topologyHalo) {
  const containerRect = container.getBoundingClientRect();
  const cards = [...container.querySelectorAll('.tile[data-layout-group]')].map(tile => {
    const rect = tile.getBoundingClientRect();
    return [tile.id, tile.dataset.layoutGroup, rect.left - containerRect.left, rect.top - containerRect.top, rect.width, rect.height].join(':');
  });
  return `${gap}|${topologyHalo}|${cards.join('|')}`;
}

/**
 * Preserve the known-good expanded-rectangle detector, but expose its result as
 * data. topologyHalo belongs to classification only; visible halo styling is
 * deliberately absent from this function.
 */
function classifyExpandedRectangleTopology(container, gap, topologyHalo) {
  const signature = expandedTopologySignature(container, gap, topologyHalo);
  if (container._expandedGroupTopology?.signature === signature) return container._expandedGroupTopology;

  const containerRect = container.getBoundingClientRect();
  const cards = [...container.querySelectorAll('.tile[data-layout-group]')].map(tile => {
    const measured = tile.getBoundingClientRect();
    const raw = {
      left: measured.left - containerRect.left,
      right: measured.right - containerRect.left,
      top: measured.top - containerRect.top,
      bottom: measured.bottom - containerRect.top
    };
    return {
      tile,
      group: tile.dataset.layoutGroup,
      raw,
      left: raw.left - topologyHalo,
      right: raw.right + topologyHalo,
      top: raw.top - topologyHalo,
      bottom: raw.bottom + topologyHalo,
      segments: [],
      corners: {}
    };
  });

  const facesOtherGroup = (card, side, fixed, start, end) => cards.some(other => {
    if (other === card || other.group === card.group) return false;
    const projection = side === 'top' || side === 'bottom'
      ? Math.min(end, other.right) - Math.max(start, other.left)
      : Math.min(end, other.bottom) - Math.max(start, other.top);
    if (projection <= 0) return false;
    if (side === 'top') return other.top < fixed && fixed - other.bottom <= gap + topologyHalo;
    if (side === 'bottom') return other.bottom > fixed && other.top - fixed <= gap + topologyHalo;
    if (side === 'left') return other.left < fixed && fixed - other.right <= gap + topologyHalo;
    return other.right > fixed && other.left - fixed <= gap + topologyHalo;
  });

  cards.forEach(card => {
    const same = cards.filter(other => other !== card && other.group === card.group);
    const sides = [
      { side: 'top', fixed: card.top, start: card.left, end: card.right, covers: same.filter(other => other.top < card.top && other.bottom >= card.top).map(other => [other.left, other.right]) },
      { side: 'right', fixed: card.right, start: card.top, end: card.bottom, covers: same.filter(other => other.left <= card.right && other.right > card.right).map(other => [other.top, other.bottom]) },
      { side: 'bottom', fixed: card.bottom, start: card.left, end: card.right, covers: same.filter(other => other.top <= card.bottom && other.bottom > card.bottom).map(other => [other.left, other.right]) },
      { side: 'left', fixed: card.left, start: card.top, end: card.bottom, covers: same.filter(other => other.left < card.left && other.right >= card.left).map(other => [other.top, other.bottom]) }
    ];
    sides.forEach(({ side, fixed, start, end, covers }) => {
      const exposed = subtractIntervals(start, end, covers);
      subtractIntervals(start, end, exposed).forEach(([segmentStart, segmentEnd]) => {
        card.segments.push({ side, fixed, start: segmentStart, end: segmentEnd, kind: 'internal' });
      });
      exposed.forEach(([segmentStart, segmentEnd]) => {
        const kind = facesOtherGroup(card, side, fixed, segmentStart, segmentEnd) ? 'intergroup' : 'external';
        card.segments.push({ side, fixed, start: segmentStart, end: segmentEnd, kind });
      });
    });

    const cornerTouchesSameGroup = (x, y) => same.some(other =>
      x >= other.left - 0.5 && x <= other.right + 0.5 &&
      y >= other.top - 0.5 && y <= other.bottom + 0.5
    );
    card.corners = {
      TopLeft: cornerTouchesSameGroup(card.left, card.top),
      TopRight: cornerTouchesSameGroup(card.right, card.top),
      BottomRight: cornerTouchesSameGroup(card.right, card.bottom),
      BottomLeft: cornerTouchesSameGroup(card.left, card.bottom)
    };
  });

  const joins = [];
  cards.forEach((a, index) => {
    cards.slice(index + 1).forEach(b => {
      if (a.group !== b.group) return;
      const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const horizontalOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const horizontalContact = a.right <= b.left ? [a.right, b.left] : (b.right <= a.left ? [b.right, a.left] : null);
      if (horizontalContact && horizontalContact[1] - horizontalContact[0] <= 2 && verticalOverlap > 0) joins.push({ a, b, orientation: 'vertical' });
      const verticalContact = a.bottom <= b.top ? [a.bottom, b.top] : (b.bottom <= a.top ? [b.bottom, a.top] : null);
      if (verticalContact && verticalContact[1] - verticalContact[0] <= 2 && horizontalOverlap > 0) joins.push({ a, b, orientation: 'horizontal' });
    });
  });

  const topology = { signature, gap, topologyHalo, cards, joins };
  container._expandedGroupTopology = topology;
  return topology;
}

function renderGroupEdgeDiagnostics(container, gap, halo, topologyHalo = BLOB_DEBUG_DEFAULTS.topologyHalo) {
  container.querySelector('.group-edge-debug-layer')?.remove();
  container.querySelector('.group-halo-underlay-layer')?.remove();
  container.querySelector('.group-halo-corner-fill-layer')?.remove();
  const showEdges = document.documentElement.dataset.showGroupEdges === 'true';
  const showJoins = document.documentElement.dataset.showGroupJoins === 'true';
  const params = new URLSearchParams(window.location.search);
  const radius = debugNumber(params, 'radius', BLOB_DEBUG_DEFAULTS.radius);
  const cutout = debugNumber(params, 'cutout', BLOB_DEBUG_DEFAULTS.cutout);
  const cutoutEnd = debugNumber(params, 'cutoutEnd', cutout);

  const topology = classifyExpandedRectangleTopology(container, gap, topologyHalo);
  const rects = topology.cards.map(card => ({
    ...card,
    left: card.raw.left - halo,
    right: card.raw.right + halo,
    top: card.raw.top - halo,
    bottom: card.raw.bottom + halo
  }));
  const visibleByTile = new Map(rects.map(rect => [rect.tile, rect]));
  const layer = document.createElement('div');
  layer.className = 'group-edge-debug-layer';
  layer.dataset.showLines = String(showEdges);
  layer.dataset.showJoins = String(showJoins);
  const underlayLayer = document.createElement('div');
  underlayLayer.className = 'group-halo-underlay-layer';
  underlayLayer.setAttribute('aria-hidden', 'true');
  const cornerLayer = document.createElement('div');
  cornerLayer.className = 'group-halo-corner-fill-layer';
  cornerLayer.setAttribute('aria-hidden', 'true');
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
    const endExtension = kind === 'internal' ? 0 : cutoutEnd;
    line.className = `group-edge-debug-segment group-edge-debug-segment-${kind} group-edge-debug-segment-${orientation}`;
    if (side === 'top' || side === 'bottom') {
      Object.assign(line.style, { left: `${start - endExtension}px`, top: `${fixed}px`, width: `${end - start + endExtension * 2}px` });
    } else {
      Object.assign(line.style, { left: `${fixed}px`, top: `${start - endExtension}px`, height: `${end - start + endExtension * 2}px` });
    }
    layer.appendChild(line);
  };

  rects.forEach(rect => {
    const topologyCard = topology.cards.find(card => card.tile === rect.tile);
    const baselineGeometry = halo === topologyHalo;
    const horizontalScale = (rect.right - rect.left) / (topologyCard.right - topologyCard.left);
    const verticalScale = (rect.bottom - rect.top) / (topologyCard.bottom - topologyCard.top);
    const mapHorizontal = value => baselineGeometry ? value : rect.left + (value - topologyCard.left) * horizontalScale;
    const mapVertical = value => baselineGeometry ? value : rect.top + (value - topologyCard.top) * verticalScale;
    topologyCard.segments.forEach(segment => {
      const horizontal = segment.side === 'top' || segment.side === 'bottom';
      const fixed = segment.side === 'top' ? rect.top
        : segment.side === 'right' ? rect.right
          : segment.side === 'bottom' ? rect.bottom : rect.left;
      const start = horizontal ? mapHorizontal(segment.start) : mapVertical(segment.start);
      const end = horizontal ? mapHorizontal(segment.end) : mapVertical(segment.end);
      if (segment.kind === 'intergroup') {
        const attribute = `groupBoundary${segment.side[0].toUpperCase()}${segment.side.slice(1)}`;
        rect.tile.dataset[attribute] = 'true';
      }
      addSegment(segment.side, fixed, start, end, segment.kind);
    });

    const corners = [
      { name: 'TopLeft', x: rect.left, y: rect.top },
      { name: 'TopRight', x: rect.right, y: rect.top },
      { name: 'BottomRight', x: rect.right, y: rect.bottom },
      { name: 'BottomLeft', x: rect.left, y: rect.bottom }
    ];
    const color = getComputedStyle(rect.tile).getPropertyValue('--layout-region-fill');
    corners.forEach(corner => {
      const internal = topologyCard.corners[corner.name];
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
  topology.joins.forEach(join => {
      const a = visibleByTile.get(join.a.tile);
      const b = visibleByTile.get(join.b.tile);
      const color = getComputedStyle(a.tile).getPropertyValue('--layout-region-fill');
      const verticalOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const horizontalOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);

      const horizontalContact = a.right <= b.left ? [a.right, b.left] : (b.right <= a.left ? [b.right, a.left] : null);
      if (join.orientation === 'vertical' && horizontalContact && horizontalContact[1] - horizontalContact[0] <= 2 && verticalOverlap > 0) {
        addHaloFill(horizontalContact[0] - 1, Math.max(a.top, b.top), horizontalContact[1] - horizontalContact[0] + 2, verticalOverlap, color);
      }

      const verticalContact = a.bottom <= b.top ? [a.bottom, b.top] : (b.bottom <= a.top ? [b.bottom, a.top] : null);
      if (join.orientation === 'horizontal' && verticalContact && verticalContact[1] - verticalContact[0] <= 2 && horizontalOverlap > 0) {
        addHaloFill(Math.max(a.left, b.left), verticalContact[0] - 1, horizontalOverlap, verticalContact[1] - verticalContact[0] + 2, color);
      }
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
  const computedGap = BLOB_DEBUG_DEFAULTS.groupGap;
  controls.innerHTML = `
    <button class="layout-debug-collapse" type="button" aria-expanded="true">Hide controls</button>
    <div class="layout-debug-modes"><strong>Layout</strong><a data-mode="masonry">Original</a><a data-mode="density">Mostly masonry</a><a data-mode="balanced">Balanced</a><a data-mode="strong">Strong</a></div>
    <div class="layout-debug-tuners">
      <label><span><strong>Card gap</strong><output data-output="groupGap">${params.get('groupGap') || computedGap}px</output></span><input data-setting="groupGap" type="range" min="8" max="40" step="1" value="${params.get('groupGap') || computedGap}"><small>Base space between every masonry card.</small></label>
      <label><span><strong>Topology halo</strong><span class="layout-debug-number-wrap"><input class="layout-debug-number" data-number-setting="topologyHalo" type="number" min="0" max="32" step="0.01" value="${params.get('topologyHalo') || BLOB_DEBUG_DEFAULTS.topologyHalo}"><span>px</span></span></span><input data-setting="topologyHalo" type="range" min="0" max="32" step="0.01" value="${params.get('topologyHalo') || BLOB_DEBUG_DEFAULTS.topologyHalo}"><small>Classification only. The 26.5px baseline adds tolerance without changing the visible 21.5px halo.</small></label>
      <label><span><strong>Halo spread</strong><span class="layout-debug-number-wrap"><input class="layout-debug-number" data-number-setting="halo" type="number" min="0" max="32" step="0.01" value="${params.get('halo') || BLOB_DEBUG_DEFAULTS.halo}"><span>px</span></span></span><input data-setting="halo" type="range" min="0" max="32" step="0.01" value="${params.get('halo') || BLOB_DEBUG_DEFAULTS.halo}"><small>Per-card expansion. Half the card gap is exact contact; hundredth-pixel steps allow a microscopic seam overlap.</small></label>
      <label><span><strong>Halo radius</strong><output data-output="radius">${params.get('radius') || BLOB_DEBUG_DEFAULTS.radius}px</output></span><input data-setting="radius" type="range" min="0" max="80" step="1" value="${params.get('radius') || BLOB_DEBUG_DEFAULTS.radius}"><small>Visible outer radius of each card halo. Topology is unaffected.</small></label>
      <label><span><strong>Radius mode</strong></span><select data-setting="radiusMode"><option value="smart" ${params.get('radiusMode') !== 'uniform' ? 'selected' : ''}>Smart same-color contact</option><option value="uniform" ${params.get('radiusMode') === 'uniform' ? 'selected' : ''}>Uniform/manual</option></select><small>Smart squares a corner only when that exact halo corner touches another halo of the same color.</small></label>
      <label><span><strong>Different-group horizontal padding</strong><output data-output="dividerX">${params.get('dividerX') || BLOB_DEBUG_DEFAULTS.dividerX}px</output></span><input data-setting="dividerX" type="range" min="0" max="32" step="1" value="${params.get('dividerX') || BLOB_DEBUG_DEFAULTS.dividerX}"><small>Real extra space shared by facing left/right card edges.</small></label>
      <label><span><strong>Different-group vertical padding</strong><output data-output="dividerY">${params.get('dividerY') || BLOB_DEBUG_DEFAULTS.dividerY}px</output></span><input data-setting="dividerY" type="range" min="0" max="32" step="1" value="${params.get('dividerY') || BLOB_DEBUG_DEFAULTS.dividerY}"><small>Real extra space shared by facing top/bottom card edges.</small></label>
      <label><span><strong>Perimeter cut</strong><output data-output="cutout">${params.get('cutout') || BLOB_DEBUG_DEFAULTS.cutout}px</output></span><input data-setting="cutout" type="range" min="0" max="16" step="1" value="${params.get('cutout') || BLOB_DEBUG_DEFAULTS.cutout}"><small>Background removed on each side of every group perimeter segment.</small></label>
      <label><span><strong>Perimeter end cut</strong><output data-output="cutoutEnd">${params.get('cutoutEnd') || params.get('cutout') || BLOB_DEBUG_DEFAULTS.cutoutEnd}px</output></span><input data-setting="cutoutEnd" type="range" min="0" max="24" step="1" value="${params.get('cutoutEnd') || params.get('cutout') || BLOB_DEBUG_DEFAULTS.cutoutEnd}"><small>Background removed beyond both endpoints of every perimeter segment.</small></label>
      <label><span><strong>Cut radius</strong><output data-output="cutoutRadius">${params.get('cutoutRadius') || 0}px</output></span><input data-setting="cutoutRadius" type="range" min="0" max="48" step="1" value="${params.get('cutoutRadius') || 0}"><small>Rounds the channel cuts without changing their classified segments.</small></label>
      <label><span><strong>Blob softness</strong><output data-output="blobBlur">${params.get('blobBlur') || BLOB_DEBUG_DEFAULTS.blobBlur}px</output></span><input data-setting="blobBlur" type="range" min="0" max="8" step="0.5" value="${params.get('blobBlur') || BLOB_DEBUG_DEFAULTS.blobBlur}"><small>Softens only the colored underlay and fuses tiny seams.</small></label>
      <label><span><strong>Paper grain</strong><output data-output="grain">${params.get('grain') || BLOB_DEBUG_DEFAULTS.grain}%</output></span><input data-setting="grain" type="range" min="0" max="40" step="1" value="${params.get('grain') || BLOB_DEBUG_DEFAULTS.grain}"><small>Adds subtle texture to the colored regions, not the cards.</small></label>
      <label><span><strong>Channel softness</strong><output data-output="channelBlur">${params.get('channelBlur') || BLOB_DEBUG_DEFAULTS.channelBlur}px</output></span><input data-setting="channelBlur" type="range" min="0" max="4" step="0.5" value="${params.get('channelBlur') || BLOB_DEBUG_DEFAULTS.channelBlur}"><small>Softens the rounded background cuts between group regions.</small></label>
      <label><span><strong>Color</strong><output data-output="color">${params.get('color') || BLOB_DEBUG_DEFAULTS.color}%</output></span><input data-setting="color" type="range" min="10" max="90" step="1" value="${params.get('color') || BLOB_DEBUG_DEFAULTS.color}"><small>Debug color strength; it does not affect geometry.</small></label>
      <label class="layout-debug-check"><input data-setting="edges" type="checkbox" ${params.get('edges') === '1' ? 'checked' : ''}><span><strong>Show group dividers</strong><small>Red lines mark only boundaries between different semantic groups.</small></span></label>
      <label class="layout-debug-check"><input data-setting="joins" type="checkbox" ${params.get('joins') === '1' ? 'checked' : ''}><span><strong>Show same-group joins</strong><small>Cyan lines mark internal edges where same-color halos overlap and fuse.</small></span></label>
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
      const value = input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value;
      if (setting === 'halo' || setting === 'topologyHalo') controls.querySelector(`[data-number-setting="${setting}"]`).value = value;
      const output = controls.querySelector(`[data-output="${setting}"]`);
      if (output) output.textContent = `${value}${setting === 'color' || setting === 'grain' ? '%' : 'px'}`;
      const url = new URL(window.location.href);
      url.searchParams.set(setting, value);
      if (setting === 'cutout' && !url.searchParams.has('cutoutEnd')) {
        url.searchParams.set('cutoutEnd', value);
        const endInput = controls.querySelector('[data-setting="cutoutEnd"]');
        endInput.value = value;
        controls.querySelector('[data-output="cutoutEnd"]').textContent = `${value}px`;
      }
      history.replaceState(history.state, '', url);
      applyLayoutDebugSettings();
      updateLayoutDebugMath(controls);
      if (setting === 'groupGap') {
        cancelAnimationFrame(relayoutFrame);
        relayoutFrame = requestAnimationFrame(() => calculateMasonryLayout(document.querySelector('.grid-container')));
      } else if (setting === 'halo' || setting === 'topologyHalo' || setting === 'radius' || setting === 'cutout' || setting === 'cutoutEnd' || setting === 'edges' || setting === 'joins' || setting === 'dividerX' || setting === 'dividerY') {
        markGroupBoundaries(document.querySelector('.grid-container'));
      }
    });
  });
  controls.querySelectorAll('[data-number-setting]').forEach(numberInput => {
    numberInput.addEventListener('input', event => {
      const slider = controls.querySelector(`[data-setting="${event.currentTarget.dataset.numberSetting}"]`);
      slider.value = event.currentTarget.value;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
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
    baselineUrl.searchParams.set('edges', '1');
    baselineUrl.searchParams.set('topologyHalo', String(BLOB_DEBUG_DEFAULTS.topologyHalo));
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
  const isThreeColumnLayout = window.matchMedia('(min-width: 1201px) and (max-width: 1799px)').matches;
  if (!isThreeColumnLayout && params.get('layoutDebug') !== '1') {
    root.style.removeProperty('--grid-gap');
    const responsiveGap = parseFloat(getComputedStyle(root).getPropertyValue('--grid-gap')) || 16;
    root.style.setProperty('--debug-group-halo', `${responsiveGap / 2 + 1.5}px`);
    return;
  }
  root.style.setProperty('--grid-gap', `${debugNumber(params, 'groupGap', BLOB_DEBUG_DEFAULTS.groupGap)}px`);
  root.style.setProperty('--debug-group-halo', `${debugNumber(params, 'halo', BLOB_DEBUG_DEFAULTS.halo)}px`);
  root.style.setProperty('--debug-halo-radius', `${debugNumber(params, 'radius', BLOB_DEBUG_DEFAULTS.radius)}px`);
  root.style.setProperty('--debug-divider-x', `${debugNumber(params, 'dividerX', BLOB_DEBUG_DEFAULTS.dividerX)}px`);
  root.style.setProperty('--debug-divider-y', `${debugNumber(params, 'dividerY', BLOB_DEBUG_DEFAULTS.dividerY)}px`);
  root.style.setProperty('--debug-perimeter-cutout', `${debugNumber(params, 'cutout', BLOB_DEBUG_DEFAULTS.cutout)}px`);
  root.style.setProperty('--debug-cutout-radius', `${debugNumber(params, 'cutoutRadius', BLOB_DEBUG_DEFAULTS.cutoutRadius)}px`);
  root.style.setProperty('--debug-blob-blur', `${debugNumber(params, 'blobBlur', BLOB_DEBUG_DEFAULTS.blobBlur)}px`);
  root.style.setProperty('--debug-group-grain', `${debugNumber(params, 'grain', BLOB_DEBUG_DEFAULTS.grain) / 100}`);
  root.style.setProperty('--debug-channel-blur', `${debugNumber(params, 'channelBlur', BLOB_DEBUG_DEFAULTS.channelBlur)}px`);
  root.style.setProperty('--debug-group-color-strength', `${debugNumber(params, 'color', BLOB_DEBUG_DEFAULTS.color)}%`);
  root.dataset.showGroupEdges = params.get('edges') === '1' ? 'true' : 'false';
  root.dataset.showGroupJoins = params.get('joins') === '1' ? 'true' : 'false';
  root.dataset.haloRadiusMode = params.get('radiusMode') === 'uniform' ? 'uniform' : 'smart';
}

function updateLayoutDebugMath(controls) {
  const params = new URLSearchParams(window.location.search);
  const gap = debugNumber(params, 'groupGap', BLOB_DEBUG_DEFAULTS.groupGap);
  const halo = debugNumber(params, 'halo', BLOB_DEBUG_DEFAULTS.halo);
  const topologyHalo = debugNumber(params, 'topologyHalo', BLOB_DEBUG_DEFAULTS.topologyHalo);
  const sameDelta = halo * 2 - gap;
  controls.querySelector('.layout-debug-math').innerHTML = `Classifier: <strong>${topologyHalo}px topology halo</strong><br>Visible halos: <strong>${sameDelta >= 0 ? `${sameDelta}px overlap` : `${Math.abs(sameDelta)}px gap`}</strong><br><strong class="debug-red-label">Red</strong> = boundary between groups`;
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
