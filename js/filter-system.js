/**
 * Filter System Module
 * Handles filtering, searching, and sorting of tiles
 */

import config from './config.js';
import { calculateMasonryLayout } from './tile-renderer.js';

let activeFilters = {
  content_type: '',
  tags: [],
  search: '',
  sort: 'priority'
};

let allTiles = [];
let filterConfig = null;

// README text is too bulky to stash on the tile elements themselves, so it
// lives here keyed by element id and is looked up during search scoring.
let readmeWordsByTileId = new Map();

/**
 * Initialize the filter system
 * @param {Array} tiles - Array of tile elements or data
 * @param {Object} config - Filter configuration from filter-groups.yml
 */
export function initFilterSystem(tilesData, config) {
  allTiles = tilesData;
  filterConfig = config;

  // Tokenized once at startup: READMEs are long enough that re-splitting
  // them on every keystroke would be wasteful, and deduping shrinks each
  // one to a couple hundred distinct words.
  readmeWordsByTileId = new Map(
    tilesData
      .filter(tile => tile.readme_text)
      .map(tile => [`tile-${tile.id}`, [...new Set(toWords(tile.readme_text))]])
  );

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
  let contentTypeHTML = '';

  filterConfig.filters.forEach(filter => {
    if (!filter.enabled) return;

    let filterHTML = '';
    if (filter.type === 'multi-select') {
      filterHTML = renderMultiSelectFilter(filter);
    } else if (filter.type === 'single-select') {
      filterHTML = renderContentTypeFilter(filter);
    } else if (filter.type === 'radio') {
      filterHTML = renderRadioFilter(filter);
    } else if (filter.type === 'search') {
      filterHTML = renderSearchFilter(filter);
    }

    // Separate search from other filters
    if (filter.type === 'search') {
      searchHTML += filterHTML;
    } else if (filter.type === 'single-select') {
      contentTypeHTML += filterHTML;
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

  const quickFilters = document.getElementById('header-quick-filters');
  if (quickFilters) quickFilters.innerHTML = contentTypeHTML;
}

function renderContentTypeFilter(filter) {
  return `
    <div class="filter-content-types" data-filter-id="${filter.id}">
      <div class="filter-options" role="group" aria-label="Portfolio section">
        ${filter.options.map(opt => `
          <button class="content-type-pill" data-value="${opt.value}" aria-pressed="false">
            ${opt.label}
          </button>
        `).join('')}
      </div>
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

  const renderPill = (opt, defaultIndex) => {
    const count = tagFrequency.get(opt.value.toLowerCase()) || 0;
    const label = filter.id === 'tags' && count > 0 ? `${opt.label} (${count})` : opt.label;
    return `
      <button
        class="filter-pill"
        data-value="${opt.value}"
        data-filter-id="${filter.id}"
        data-default-index="${defaultIndex}"
        aria-pressed="false"
      >
        ${label}
      </button>
    `;
  };

  return `
    <div class="filter-group" data-filter-id="${filter.id}">
      <label class="filter-label">${filter.label}</label>
      <div class="filter-options">
        ${visibleOptions.map((opt, i) => renderPill(opt, i)).join('')}
        ${hiddenOptions.length > 0 ? `
          <button class="filter-more-toggle" aria-label="Show more tags" aria-expanded="false">
            <span class="more-text">+${hiddenOptions.length} more</span>
            <i class="fas fa-chevron-down"></i>
          </button>
        ` : ''}
      </div>
      ${hiddenOptions.length > 0 ? `
        <div class="filter-more-dropdown" style="display: none;">
          ${hiddenOptions.map((opt, i) => renderPill(opt, visibleCount + i)).join('')}
        </div>
      ` : ''}
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
  document.querySelectorAll('.content-type-pill').forEach(pill => {
    pill.addEventListener('click', (event) => {
      event.preventDefault();
      const nextValue = activeFilters.content_type === pill.dataset.value ? '' : pill.dataset.value;
      activeFilters.content_type = nextValue;
      document.querySelectorAll('.content-type-pill').forEach(option => {
        const active = option.dataset.value === nextValue;
        option.classList.toggle('active', active);
        option.setAttribute('aria-pressed', String(active));
      });
      applyFilters();
    });
  });

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

  // "Show more" toggle — dropdown is a sibling of .filter-options within
  // the same .filter-group, not nested under the toggle itself, so it can
  // flex-basis:100% onto its own full-width row instead of floating.
  document.querySelectorAll('.filter-more-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      const dropdown = toggle.closest('.filter-group')?.querySelector('.filter-more-dropdown');
      if (!dropdown) return;
      const isVisible = dropdown.style.display !== 'none';

      dropdown.style.display = isVisible ? 'none' : 'flex';
      toggle.classList.toggle('active', !isVisible);
      toggle.setAttribute('aria-expanded', String(!isVisible));

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
 * @param {Array<{text?: string, words?: string[], weight: number}>} fields -
 *   Fields to search; `words` skips tokenization for pre-split fields
 * @returns {number} combined score, or -1 if any query word finds no match
 */
function fuzzyScoreFields(query, fields) {
  const queryWords = query.split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return -1;

  const fieldWordLists = fields.map(({ text, words, weight }) => ({
    words: words || toWords(text),
    weight
  }));

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
  // Intro/profile chrome isn't searchable content. While just browsing or
  // tag-filtering it stays pinned and undimmed, but a text search means
  // the user is looking for something specific — it isn't a result, so it
  // gets hidden outright rather than dimmed alongside real non-matches.
  if (tileData.type === 'profile') {
    if (activeFilters.content_type) return { isMatch: true, score: Infinity };
    if (activeFilters.search) {
      return { isMatch: false, score: 0, hide: true };
    }
    return { isMatch: true, score: Infinity };
  }

  // The active section overview is promoted into the permanent profile slot,
  // so its ordinary card leaves the grid until the section filter is cleared.
  if (activeFilters.content_type && tileData.sectionHeader && tileData.contentTypes.includes(activeFilters.content_type)) {
    return { isMatch: false, score: 0, hide: true };
  }

  if (tileData.filterOnly && activeFilters.content_type !== tileData.contentType) {
    return { isMatch: false, score: 0, hide: true };
  }

  if (activeFilters.content_type && !tileData.contentTypes.includes(activeFilters.content_type)) {
    return { isMatch: false, score: 0 };
  }

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
      { text: tileData.description, weight: 1 },
      { text: tileData.date, weight: 1 },
      // README body ranks below every curated field: it makes a project
      // findable by its contents without outranking a real title match.
      { words: tileData.readmeWords, weight: 0.5 }
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
      return compareByPortfolioOrder(dataA, dataB);
  }
}

function compareByPortfolioOrder(dataA, dataB) {
  const sectionOrder = { writing: 1, experience: 2, links: 3, projects: 4, navigation: 5 };
  const rank = data => {
    if (data.type === 'profile') return 0;
    if (data.priority < 0) return 99;
    return sectionOrder[data.contentType] || 50;
  };
  return rank(dataA) - rank(dataB) || dataB.priority - dataA.priority;
}

/**
 * Re-rank tag pills against the active search text: pills whose value
 * fuzzy-matches the query are highlighted and float to the front (promoted
 * out of the "+more" section into the visible row if needed); the rest
 * stay clickable and available, just further back. Doesn't touch which
 * pills are .active (that's the separate, hard tag-filter selection) —
 * with no search text this just restores the original priority/frequency
 * order via each pill's data-default-index.
 */
function updateTagAffordances() {
  const tagsGroup = document.querySelector('.filter-group[data-filter-id="tags"]');
  if (!tagsGroup) return;

  const optionsContainer = tagsGroup.querySelector('.filter-options');
  const dropdown = tagsGroup.querySelector('.filter-more-dropdown');
  const toggle = tagsGroup.querySelector('.filter-more-toggle');
  if (!optionsContainer) return;

  const query = activeFilters.search;
  const pills = Array.from(tagsGroup.querySelectorAll('.filter-pill'));

  const ranked = pills.map(pill => {
    const defaultIndex = parseInt(pill.dataset.defaultIndex || '0', 10);
    if (!query) return { pill, isMatch: false, score: -1, defaultIndex };
    const score = fuzzyScoreFields(query, [{ text: pill.dataset.value, weight: 1 }]);
    return { pill, isMatch: score >= 0, score, defaultIndex };
  });

  ranked.sort((a, b) => {
    if (query && a.isMatch !== b.isMatch) return a.isMatch ? -1 : 1;
    if (query && a.isMatch && b.score !== a.score) return b.score - a.score;
    return a.defaultIndex - b.defaultIndex;
  });

  const VISIBLE_COUNT = 8;
  const visible = ranked.slice(0, VISIBLE_COUNT);
  const hidden = ranked.slice(VISIBLE_COUNT);

  visible.forEach(({ pill, isMatch }) => {
    pill.classList.toggle('filter-pill-match', Boolean(query) && isMatch);
    optionsContainer.insertBefore(pill, toggle || null);
  });

  hidden.forEach(({ pill, isMatch }) => {
    pill.classList.toggle('filter-pill-match', Boolean(query) && isMatch);
    dropdown?.appendChild(pill);
  });

  if (toggle) {
    if (hidden.length === 0) {
      toggle.style.display = 'none';
      if (dropdown) dropdown.style.display = 'none';
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      toggle.style.display = '';
      const moreText = toggle.querySelector('.more-text');
      if (moreText) moreText.textContent = `+${hidden.length} more`;
    }
  }
}

/**
 * Apply active filters to all tiles: matches are sorted to the top (by
 * search rank when searching, else by the active sort), non-matches are
 * dimmed and sink to the bottom but stay visible in the grid flow.
 */
function applyFilters() {
  const gridContainer = document.querySelector('.grid-container');
  updateProfileSpotlight(gridContainer);

  const tileElements = Array.from(gridContainer.querySelectorAll('.tile'));

  const evaluated = tileElements.map(tileEl => {
    const data = getTileDataFromElement(tileEl);
    const { isMatch, score, hide } = evaluateTile(data);
    return { tileEl, data, isMatch, score, hide: Boolean(hide) };
  });

  evaluated.sort((a, b) => {
    if (a.isMatch !== b.isMatch) return a.isMatch ? -1 : 1;
    if (activeFilters.search && b.score !== a.score) return b.score - a.score;
    return compareByActiveSort(a.data, b.data);
  });

  evaluated.forEach(({ tileEl, isMatch, hide }) => {
    tileEl.style.display = hide ? 'none' : '';
    tileEl.dataset.filtered = isMatch ? 'false' : 'true';
    tileEl.classList.toggle('tile-dimmed', !isMatch && !hide);
    gridContainer.appendChild(tileEl);
  });

  updateTagAffordances();
  updateSearchTriggerSummary();

  // Recalculate masonry layout after reordering (dimmed tiles stay in flow)
  setTimeout(() => {
    calculateMasonryLayout(gridContainer);
  }, 50);
}

function updateProfileSpotlight(gridContainer) {
  const profile = gridContainer.querySelector('.profile-tile');
  if (!profile) return;

  if (!profile._originalHTML) profile._originalHTML = profile.innerHTML;

  if (!activeFilters.content_type) {
    profile.innerHTML = profile._originalHTML;
    profile.classList.remove('section-spotlight');
    delete profile.dataset.spotlight;
    return;
  }

  const sectionOverview = Array.from(gridContainer.querySelectorAll('[data-section-header="true"]')).find(tile => {
    const types = JSON.parse(tile.dataset.contentTypes || '[]');
    return types.includes(activeFilters.content_type);
  });

  if (sectionOverview) {
    profile.innerHTML = sectionOverview.innerHTML;
  } else {
    const sectionLabel = document.querySelector('.content-type-pill.active')?.textContent.trim() || 'Section';
    const description = activeFilters.content_type === 'links'
      ? 'Places to find me and my work.'
      : `Browse ${sectionLabel.toLowerCase()}.`;
    profile.innerHTML = `<div class="spotlight-content"><h1 class="profile-tile-title">${sectionLabel}</h1><p class="profile-tile-description">${description}</p></div>`;
  }

  profile.classList.add('section-spotlight');
  profile.dataset.spotlight = activeFilters.content_type;
}

function updateSearchTriggerSummary() {
  const label = document.querySelector('.filter-toggle-label');
  if (!label) return;

  const parts = [];
  const activeSection = document.querySelector('.content-type-pill.active')?.textContent.trim();
  if (activeSection) parts.push(activeSection);

  const searchInput = document.querySelector('.search-input');
  const query = searchInput?.value.trim();
  if (query) parts.push(`“${query}”`);

  if (activeFilters.tags.length > 0) {
    parts.push(activeFilters.tags.length === 1 ? activeFilters.tags[0] : `${activeFilters.tags.length} tags`);
  }

  label.textContent = parts.length > 0 ? parts.join(' · ') : 'Search portfolio';
  label.parentElement.title = parts.length > 0 ? `Active filters: ${parts.join(', ')}` : 'Search portfolio';
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
    date: tileEl.querySelector('.tile-created')?.textContent || '',
    language: tileEl.dataset.language,
    stars: parseInt(tileEl.dataset.stars || '0'),
    tags: JSON.parse(tileEl.dataset.tags || '[]'),
    topics: JSON.parse(tileEl.dataset.topics || '[]'),
    contentType: tileEl.dataset.contentType || '',
    contentTypes: JSON.parse(tileEl.dataset.contentTypes || '[]'),
    filterOnly: tileEl.dataset.filterOnly === 'true',
    sectionHeader: tileEl.dataset.sectionHeader === 'true',
    priority: parseInt(tileEl.dataset.priority || '0'),
    readmeWords: readmeWordsByTileId.get(tileEl.id)
  };
}

/**
 * Reset all filters to default state
 */
export function resetFilters() {
  activeFilters = {
    content_type: '',
    tags: [],
    search: '',
    sort: 'priority'
  };

  // Reset UI
  document.querySelectorAll('.filter-pill.active').forEach(pill => {
    pill.classList.remove('active');
    pill.setAttribute('aria-pressed', 'false');
  });
  document.querySelectorAll('.content-type-pill.active').forEach(pill => {
    pill.classList.remove('active');
    pill.setAttribute('aria-pressed', 'false');
  });

  const searchInput = document.querySelector('.search-input');
  if (searchInput) searchInput.value = '';

  applyFilters();
}
