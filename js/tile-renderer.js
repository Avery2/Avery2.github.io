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

  // Clear stale spans as a group before measuring. Measuring and mutating one
  // card at a time made later cards inherit geometry from the previous layout.
  visibleTiles.forEach(tile => { tile.style.gridRowEnd = 'auto'; });
  const measurements = visibleTiles.map(tile => ({
    tile,
    rowSpan: Math.ceil((tile.getBoundingClientRect().height + gap) / rowHeight)
  }));
  measurements.forEach(({ tile, rowSpan }) => {
    tile.style.gridRowEnd = `span ${rowSpan}`;
  });
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

function cardSectionLabel(data) {
  if (data.section_header) return '';
  if (data.content_type === 'writing' || (data.tags || []).includes('writing')) return 'Writing';
  if (data.type === 'experience' || data.type === 'education' || data.content_type === 'experience') return 'Experience';
  if (data.type === 'project' || data.content_type === 'projects') return 'Projects';
  return '';
}

function cardFooterHTML(sectionLabel, trailingHTML = '') {
  if (!sectionLabel && !trailingHTML) return '';
  return `<div class="tile-card-footer">
    <span class="tile-section-label">${sectionLabel}</span>
    <span class="tile-footer-detail">${trailingHTML}</span>
  </div>`;
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

  const footerHTML = cardFooterHTML(cardSectionLabel(data), `${starsHTML}${dateHTML}`);

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
  const isWriting = data.content_type === 'writing' || (data.tags || []).includes('writing');
  const descriptionHTML = data.description
    ? `<p class="tile-description">${data.description}${isWriting ? ' <span class="tile-read-more">Read more <span aria-hidden="true">→</span></span>' : ''}</p>`
    : '';
  const footerHTML = cardFooterHTML(cardSectionLabel(data));

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
