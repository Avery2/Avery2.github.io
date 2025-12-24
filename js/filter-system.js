/**
 * Filter System Module
 * Handles filtering, searching, and sorting of tiles
 */

import config from './config.js';
import { calculateMasonryLayout } from './tile-renderer.js';

let activeFilters = {
  tags: [],
  search: '',
  sort: 'priority'
};

let allTiles = [];
let filterConfig = null;

/**
 * Initialize the filter system
 * @param {Array} tiles - Array of tile elements or data
 * @param {Object} config - Filter configuration from filter-groups.yml
 */
export function initFilterSystem(tilesData, config) {
  allTiles = tilesData;
  filterConfig = config;

  // Set default sort
  if (config.filters) {
    const sortFilter = config.filters.find(f => f.id === 'sort');
    if (sortFilter && sortFilter.default) {
      activeFilters.sort = sortFilter.default;
    }
  }

  renderFilterUI();
  setupFilterEventListeners();
}

/**
 * Calculate tag frequency across all tiles
 * @returns {Map} Map of tag -> frequency
 */
function calculateTagFrequency() {
  const tagCounts = new Map();

  allTiles.forEach(tile => {
    // Create a Set to count each tag only once per tile
    const uniqueTags = new Set();

    // Add from tags array (already includes language + topics from Python script)
    if (tile.tags) {
      tile.tags.forEach(tag => uniqueTags.add(tag.toLowerCase()));
    }

    // Add from topics array (for any tiles that don't have tags)
    if (tile.topics) {
      tile.topics.forEach(topic => uniqueTags.add(topic.toLowerCase()));
    }

    // Add language if not already in tags
    if (tile.language) {
      uniqueTags.add(tile.language.toLowerCase());
    }

    // Count each unique tag once per tile
    uniqueTags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return tagCounts;
}

/**
 * Render the filter UI
 */
function renderFilterUI() {
  const filterContainer = document.getElementById('filters');
  if (!filterContainer || !filterConfig || !filterConfig.filters) return;

  let searchHTML = '';
  let otherFiltersHTML = '';

  filterConfig.filters.forEach(filter => {
    if (!filter.enabled) return;

    let filterHTML = '';
    if (filter.type === 'multi-select') {
      filterHTML = renderMultiSelectFilter(filter);
    } else if (filter.type === 'radio') {
      filterHTML = renderRadioFilter(filter);
    } else if (filter.type === 'search') {
      filterHTML = renderSearchFilter(filter);
    }

    // Separate search from other filters
    if (filter.type === 'search') {
      searchHTML += filterHTML;
    } else {
      otherFiltersHTML += filterHTML;
    }
  });

  // Search first, then tags/sort in a row below
  filterContainer.innerHTML = `
    ${searchHTML}
    <div class="filter-groups-row">
      ${otherFiltersHTML}
    </div>
  `;
}

/**
 * Gather all unique tags from all tiles
 * @returns {Set} Set of unique tag values
 */
function getAllUniqueTags() {
  const allTagValues = new Set();

  allTiles.forEach(tile => {
    // Gather from tags array
    if (tile.tags) {
      tile.tags.forEach(tag => allTagValues.add(tag.toLowerCase()));
    }

    // Gather from topics array
    if (tile.topics) {
      tile.topics.forEach(topic => allTagValues.add(topic.toLowerCase()));
    }

    // Gather from language field
    if (tile.language) {
      allTagValues.add(tile.language.toLowerCase());
    }
  });

  return allTagValues;
}

/**
 * Render a multi-select filter (pill buttons)
 * @param {Object} filter - Filter configuration
 * @returns {string} HTML string
 */
function renderMultiSelectFilter(filter) {
  let options = filter.options || [];

  // For tags filter, dynamically gather all tags
  if (filter.id === 'tags' && allTiles.length > 0) {
    const tagFrequency = calculateTagFrequency();
    const allUniqueTags = getAllUniqueTags();

    // Separate priority tags (from YAML) from discovered tags
    const priorityTagValues = new Set(options.map(opt => opt.value.toLowerCase()));
    const discoveredTags = new Set();

    allUniqueTags.forEach(tag => {
      if (!priorityTagValues.has(tag)) {
        discoveredTags.add(tag);
      }
    });

    // Create options for discovered tags
    const discoveredOptions = Array.from(discoveredTags).map(tag => ({
      value: tag,
      label: tag
    }));

    // Sort discovered tags by frequency
    discoveredOptions.sort((a, b) => {
      const freqA = tagFrequency.get(a.value.toLowerCase()) || 0;
      const freqB = tagFrequency.get(b.value.toLowerCase()) || 0;
      return freqB - freqA;
    });

    // Combine: priority tags first, then discovered tags sorted by frequency
    options = [...options, ...discoveredOptions];
  }

  // Show first 8 tags, rest in "show more"
  const visibleCount = 8;
  const visibleOptions = options.slice(0, visibleCount);
  const hiddenOptions = options.slice(visibleCount);

  // Get tag frequency for displaying counts
  const tagFrequency = filter.id === 'tags' ? calculateTagFrequency() : new Map();

  return `
    <div class="filter-group" data-filter-id="${filter.id}">
      <label class="filter-label">${filter.label}</label>
      <div class="filter-options">
        ${visibleOptions.map(opt => {
          const count = tagFrequency.get(opt.value.toLowerCase()) || 0;
          const label = filter.id === 'tags' && count > 0 ? `${opt.label} (${count})` : opt.label;
          return `
            <button
              class="filter-pill"
              data-value="${opt.value}"
              data-filter-id="${filter.id}"
              ${opt.color ? `data-color="${opt.color}" style="--pill-color: ${opt.color}"` : ''}
              aria-pressed="false"
            >
              ${label}
            </button>
          `;
        }).join('')}
        ${hiddenOptions.length > 0 ? `
          <div class="filter-more-container">
            <button class="filter-more-toggle" aria-label="Show more tags">
              <span class="more-text">+${hiddenOptions.length} more</span>
              <i class="fas fa-chevron-down"></i>
            </button>
            <div class="filter-more-dropdown" style="display: none;">
              ${hiddenOptions.map(opt => {
                const count = tagFrequency.get(opt.value.toLowerCase()) || 0;
                const label = filter.id === 'tags' && count > 0 ? `${opt.label} (${count})` : opt.label;
                return `
                  <button
                    class="filter-pill"
                    data-value="${opt.value}"
                    data-filter-id="${filter.id}"
                    ${opt.color ? `data-color="${opt.color}" style="--pill-color: ${opt.color}"` : ''}
                    aria-pressed="false"
                  >
                    ${label}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render a radio/select filter (dropdown)
 * @param {Object} filter - Filter configuration
 * @returns {string} HTML string
 */
function renderRadioFilter(filter) {
  return `
    <div class="filter-group" data-filter-id="${filter.id}">
      <label class="filter-label" for="filter-${filter.id}">${filter.label}</label>
      <select class="filter-select" id="filter-${filter.id}" data-filter-id="${filter.id}">
        ${filter.options.map(opt => `
          <option value="${opt.value}" ${opt.value === filter.default ? 'selected' : ''}>
            ${opt.label}
          </option>
        `).join('')}
      </select>
    </div>
  `;
}

/**
 * Render a search filter (input field)
 * @param {Object} filter - Filter configuration
 * @returns {string} HTML string
 */
function renderSearchFilter(filter) {
  return `
    <div class="filter-group filter-search" data-filter-id="${filter.id}">
      <input
        type="search"
        class="search-input"
        placeholder="${filter.placeholder}"
        data-filter-id="${filter.id}"
        aria-label="${filter.label}"
      />
    </div>
  `;
}

/**
 * Set up event listeners for filter controls
 */
function setupFilterEventListeners() {
  // Multi-select pill toggles
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const filterId = pill.dataset.filterId;
      const value = pill.dataset.value;
      const isCurrentlyActive = pill.classList.contains('active');

      // Toggle the active state
      if (isCurrentlyActive) {
        pill.classList.remove('active');
        pill.setAttribute('aria-pressed', 'false');
      } else {
        pill.classList.add('active');
        pill.setAttribute('aria-pressed', 'true');
      }

      // Ensure the filter array exists
      if (!activeFilters[filterId]) activeFilters[filterId] = [];

      if (!isCurrentlyActive) {
        // Was inactive, now active - add to filter
        if (!activeFilters[filterId].includes(value)) {
          activeFilters[filterId].push(value);
        }
      } else {
        // Was active, now inactive - remove from filter
        activeFilters[filterId] = activeFilters[filterId].filter(v => v !== value);
      }

      applyFilters();
    });
  });

  // "Show more" toggle
  document.querySelectorAll('.filter-more-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = toggle.nextElementSibling;
      const isVisible = dropdown.style.display !== 'none';

      dropdown.style.display = isVisible ? 'none' : 'flex';
      toggle.classList.toggle('active', !isVisible);

      const icon = toggle.querySelector('i');
      icon.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    });
  });

  // Radio/select filters
  document.querySelectorAll('.filter-select').forEach(select => {
    select.addEventListener('change', () => {
      const filterId = select.dataset.filterId;
      activeFilters[filterId] = select.value;
      applyFilters();
    });
  });

  // Search input (debounced)
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        activeFilters.search = e.target.value.toLowerCase();
        applyFilters();
      }, config.DEBOUNCE_DELAY);
    });
  }
}

/**
 * Apply active filters to all tiles
 */
function applyFilters() {
  const gridContainer = document.querySelector('.grid-container');

  // Get all tiles from grid
  const allTileElements = Array.from(gridContainer.querySelectorAll('.tile'));

  allTileElements.forEach(tileEl => {
    const tileData = getTileDataFromElement(tileEl);
    const matches = evaluateFilters(tileData);

    if (matches) {
      // Show tile
      tileEl.dataset.filtered = 'false';
      tileEl.style.display = '';
      tileEl.classList.remove('tile-hiding');
      tileEl.classList.add('tile-visible');
    } else {
      // Hide tile
      tileEl.dataset.filtered = 'true';
      tileEl.style.display = 'none';
      tileEl.classList.remove('tile-visible');
      tileEl.classList.add('tile-hiding');
    }
  });

  // Add padding if filters are active to prevent content hiding behind filter panel
  const hasActiveFilters = (activeFilters.tags && activeFilters.tags.length > 0) || activeFilters.search;
  const projectsContainer = document.querySelector('.projects-container');

  if (hasActiveFilters) {
    const filterWrapper = document.getElementById('filter-wrapper');
    if (filterWrapper && filterWrapper.classList.contains('expanded')) {
      const filterHeight = filterWrapper.offsetHeight;
      projectsContainer.style.paddingTop = `${filterHeight + 20}px`;
      projectsContainer.style.transition = 'padding-top 0.3s ease';
    }
  } else {
    projectsContainer.style.paddingTop = '';
  }

  // Recalculate masonry layout after filtering (skip hidden tiles)
  setTimeout(() => {
    calculateMasonryLayout(gridContainer);
  }, 50);

  // Re-sort if needed
  if (activeFilters.sort) {
    sortTiles(activeFilters.sort);
  }
}

/**
 * Evaluate if a tile matches the active filters
 * @param {Object} tileData - Tile data object
 * @returns {boolean} Whether the tile matches all active filters
 */
function evaluateFilters(tileData) {
  // Tags filter (includes language, topics, and tags)
  if (activeFilters.tags && activeFilters.tags.length > 0) {
    const tileTags = [
      ...(tileData.tags || []),
      ...(tileData.topics || []),
      tileData.language // Include language
    ].filter(Boolean).map(t => t.toLowerCase());

    const hasMatch = activeFilters.tags.some(filterTag => tileTags.includes(filterTag.toLowerCase()));
    if (!hasMatch) return false;
  }

  // Search filter
  if (activeFilters.search) {
    const searchableText = [
      tileData.title,
      tileData.description,
      ...(tileData.tags || []),
      ...(tileData.topics || [])
    ].join(' ').toLowerCase();

    if (!searchableText.includes(activeFilters.search)) {
      return false;
    }
  }

  return true;
}

/**
 * Extract tile data from a DOM element
 * @param {HTMLElement} tileEl - Tile element
 * @returns {Object} Tile data object
 */
function getTileDataFromElement(tileEl) {
  return {
    id: tileEl.id,
    type: tileEl.dataset.type,
    title: tileEl.querySelector('.tile-title')?.textContent || '',
    description: tileEl.querySelector('.tile-description')?.textContent || '',
    language: tileEl.dataset.language,
    stars: parseInt(tileEl.dataset.stars || '0'),
    tags: JSON.parse(tileEl.dataset.tags || '[]'),
    topics: JSON.parse(tileEl.dataset.topics || '[]'),
    priority: parseInt(tileEl.dataset.priority || '0')
  };
}

/**
 * Sort tiles by the specified criteria
 * @param {string} sortBy - Sort criterion (priority, stars, recent, alphabetical)
 */
function sortTiles(sortBy) {
  const gridContainer = document.querySelector('.grid-container');
  const tileElements = Array.from(gridContainer.querySelectorAll('.tile'));

  tileElements.sort((a, b) => {
    const dataA = getTileDataFromElement(a);
    const dataB = getTileDataFromElement(b);

    switch (sortBy) {
      case 'stars':
        return dataB.stars - dataA.stars;
      case 'recent':
        return dataB.priority - dataA.priority;  // Priority includes recency
      case 'alphabetical':
        return dataA.title.localeCompare(dataB.title);
      case 'priority':
      default:
        return dataB.priority - dataA.priority;
    }
  });

  // Re-append in sorted order
  tileElements.forEach(tile => gridContainer.appendChild(tile));
}

/**
 * Reset all filters to default state
 */
export function resetFilters() {
  activeFilters = {
    tags: [],
    search: '',
    sort: 'priority'
  };

  // Reset UI
  document.querySelectorAll('.filter-pill.active').forEach(pill => {
    pill.classList.remove('active');
    pill.setAttribute('aria-pressed', 'false');
  });

  const searchInput = document.querySelector('.search-input');
  if (searchInput) searchInput.value = '';

  applyFilters();
}
