/**
 * Configuration Constants
 * Central configuration for the website
 */

const config = {
  // API configuration
  GITHUB_API_BASE: 'https://api.github.com',

  // Animation durations (ms)
  TRANSITION_DURATION: 300,
  DEBOUNCE_DELAY: 300,

  // Grid configuration
  GRID_MIN_TILE_WIDTH: 280,
  GRID_GAP: 20,
  GRID_MAX_WIDTH: 1400,

  // Breakpoints
  BREAKPOINTS: {
    MOBILE_SM: 600,
    MOBILE: 900,
    TABLET: 1200,
    DESKTOP: 1400
  },

  // Feature flags
  FEATURES: {
    ANALYTICS_DASHBOARD: false,
    LAZY_LOAD_IMAGES: true,
    INFINITE_SCROLL: false
  },

  // Cache configuration
  CACHE_DURATION: 1000 * 60 * 60, // 1 hour

  // Error messages
  ERRORS: {
    DATA_LOAD_FAILED: 'Failed to load data. Please try again later.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    PARSE_ERROR: 'Error parsing data files.'
  }
};

export default config;
