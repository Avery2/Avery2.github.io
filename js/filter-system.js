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
 * Bounded Levenshtein distance — returns maxDistance + 1 as soon as it's
 * clear the true distance exceeds maxDistance, so long words bail out fast.
 */
function boundedLevenshtein(a, b, maxDistance) {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const currRow = [i];
    let rowMin = currRow[0];

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // deletion
        currRow[j - 1] + 1,  // insertion
        prevRow[j - 1] + cost // substitution
      );
      rowMin = Math.min(rowMin, currRow[j]);
    }

    if (rowMin > maxDistance) return maxDistance + 1;
    prevRow = currRow;
  }

  return prevRow[b.length];
}

/**
 * Score how well a single query word matches a single field word.
 * Exact/prefix/substring match first, then typo tolerance scaled to word
 * length — this keeps matching to "close enough" words instead of letting
 * a query match scattered characters spread across a whole sentence.
 * @returns {number} score, or -1 for no match
 */
function wordMatchScore(query, word) {
  if (!word) return -1;
  if (word === query) return 100;
  if (word.startsWith(query)) return 80 - Math.min(word.length - query.length, 20);
  if (word.includes(query)) return 50;

  const maxTypos = query.length <= 3 ? 0 : query.length <= 6 ? 1 : 2;
  if (maxTypos === 0) return -1;

  const distance = boundedLevenshtein(query, word, maxTypos);
  return distance <= maxTypos ? 40 - distance * 15 : -1;
}

/**
 * Split text into lowercase words for word-level matching
 */
function toWords(text) {
  return (text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Best match score for one query word against a list of field words
 */
function bestWordScore(queryWord, words) {
  let best = -1;
  for (const word of words) {
    const score = wordMatchScore(queryWord, word);
    if (score > best) best = score;
  }
  return best;
}

/**
 * Fuzzy score for a (possibly multi-word) query across a set of weighted
 * fields. Every query word must find some reasonably close word in at
 * least one field — this is word-level fuzzy (typos, prefixes, substrings),
 * not a full-text subsequence match, so it won't fire on letters scattered
 * across an unrelated paragraph.
 * @param {string} query - Lowercased search query
 * @param {Array<{text: string, weight: number}>} fields - Fields to search
 * @returns {number} combined score, or -1 if any query word finds no match
 */
function fuzzyScoreFields(query, fields) {
  const queryWords = query.split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return -1;

  const fieldWordLists = fields.map(({ text, weight }) => ({ words: toWords(text), weight }));

  let total = 0;
  for (const queryWord of queryWords) {
    let best = -1;
    for (const { words, weight } of fieldWordLists) {
      const score = bestWordScore(queryWord, words);
      if (score >= 0) best = Math.max(best, score * weight);
    }
    if (best < 0) return -1; // this query word matched nothing anywhere
    total += best;
  }

  return total;
}

/**
 * Evaluate a tile against active filters
 * @param {Object} tileData - Tile data object
 * @returns {{isMatch: boolean, score: number}} Whether it matches, and its search rank
 */
function evaluateTile(tileData) {
  // Tags filter (includes language, topics, and tags) — a categorical
  // selection, so it stays a hard AND filter rather than fuzzy-scored.
  if (activeFilters.tags && activeFilters.tags.length > 0) {
    const tileTags = [
      ...(tileData.tags || []),
      ...(tileData.topics || []),
      tileData.language
    ].filter(Boolean).map(t => t.toLowerCase());

    const hasMatch = activeFilters.tags.some(filterTag => tileTags.includes(filterTag.toLowerCase()));
    if (!hasMatch) return { isMatch: false, score: 0 };
  }

  if (activeFilters.search) {
    const score = fuzzyScoreFields(activeFilters.search, [
      { text: tileData.title, weight: 3 },
      { text: [...(tileData.tags || []), ...(tileData.topics || [])].join(' '), weight: 2 },
      { text: tileData.description, weight: 1 }
    ]);

    if (score < 0) return { isMatch: false, score: 0 };
    return { isMatch: true, score };
  }

  return { isMatch: true, score: 0 };
}

/**
 * Compare two tiles by the currently selected sort criterion
 * @param {Object} dataA - First tile's data
 * @param {Object} dataB - Second tile's data
 * @returns {number} Comparison result
 */
function compareByActiveSort(dataA, dataB) {
  switch (activeFilters.sort) {
    case 'stars':
      return dataB.stars - dataA.stars;
    case 'recent':
      return dataB.priority - dataA.priority; // Priority includes recency
    case 'alphabetical':
      return dataA.title.localeCompare(dataB.title);
    case 'priority':
    default:
      return dataB.priority - dataA.priority;
  }
}

/**
 * Apply active filters to all tiles: matches are sorted to the top (by
 * search rank when searching, else by the active sort), non-matches are
 * dimmed and sink to the bottom but stay visible and in the grid flow.
 */
function applyFilters() {
  const gridContainer = document.querySelector('.grid-container');
  const tileElements = Array.from(gridContainer.querySelectorAll('.tile'));

  const evaluated = tileElements.map(tileEl => {
    const data = getTileDataFromElement(tileEl);
    const { isMatch, score } = evaluateTile(data);
    return { tileEl, data, isMatch, score };
  });

  evaluated.sort((a, b) => {
    if (a.isMatch !== b.isMatch) return a.isMatch ? -1 : 1;
    if (activeFilters.search && b.score !== a.score) return b.score - a.score;
    return compareByActiveSort(a.data, b.data);
  });

  evaluated.forEach(({ tileEl, isMatch }) => {
    tileEl.dataset.filtered = isMatch ? 'false' : 'true';
    tileEl.classList.toggle('tile-dimmed', !isMatch);
    gridContainer.appendChild(tileEl);
  });

  // Recalculate masonry layout after reordering (dimmed tiles stay in flow)
  setTimeout(() => {
    calculateMasonryLayout(gridContainer);
  }, 50);
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
