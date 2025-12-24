/**
 * Theme Management System
 * Handles light/dark/auto theme switching with localStorage persistence
 */

const THEME_KEY = 'site-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto'
};

let currentTheme = THEMES.AUTO;

/**
 * Initialize the theme system
 * Loads saved theme and sets up event listeners
 */
export function initTheme() {
  // Load saved theme or default to auto
  const savedTheme = localStorage.getItem(THEME_KEY);
  currentTheme = savedTheme || THEMES.AUTO;

  applyTheme(currentTheme);
  setupThemeToggle();
  setupSystemThemeListener();
}

/**
 * Apply the specified theme
 * @param {string} theme - Theme to apply (light, dark, or auto)
 */
function applyTheme(theme) {
  const root = document.documentElement;

  if (theme === THEMES.AUTO) {
    // Use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = prefersDark ? THEMES.DARK : THEMES.LIGHT;
  } else {
    root.dataset.theme = theme;
  }

  updateToggleButton();
}

/**
 * Set up theme toggle button event listener
 */
function setupThemeToggle() {
  const toggleButton = document.getElementById('theme-toggle');
  if (!toggleButton) return;

  toggleButton.addEventListener('click', () => {
    // Cycle: light → dark → auto
    if (currentTheme === THEMES.LIGHT) {
      currentTheme = THEMES.DARK;
    } else if (currentTheme === THEMES.DARK) {
      currentTheme = THEMES.AUTO;
    } else {
      currentTheme = THEMES.LIGHT;
    }

    localStorage.setItem(THEME_KEY, currentTheme);
    applyTheme(currentTheme);
  });
}

/**
 * Listen for system theme changes (only applies when theme is AUTO)
 */
function setupSystemThemeListener() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === THEMES.AUTO) {
      applyTheme(THEMES.AUTO);
    }
  });
}

/**
 * Update the theme toggle button icon and title
 */
function updateToggleButton() {
  const toggleButton = document.getElementById('theme-toggle');
  if (!toggleButton) return;

  // Update button icon/text
  const icons = {
    [THEMES.LIGHT]: '☀️',
    [THEMES.DARK]: '🌙',
    [THEMES.AUTO]: '🌗'
  };

  toggleButton.textContent = icons[currentTheme];
  toggleButton.title = `Theme: ${currentTheme}`;
}

/**
 * Get the current theme
 * @returns {string} Current theme (light, dark, or auto)
 */
export function getCurrentTheme() {
  return currentTheme;
}
