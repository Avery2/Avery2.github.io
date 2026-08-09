/**
 * Theme Management System
 * Follows the OS light/dark preference by default. Auto is not a selectable
 * mode — it's just what happens when there's no override. Clicking the
 * toggle sets an override for the current tab session only (sessionStorage),
 * so a fresh visit always starts from the system preference again.
 */

const OVERRIDE_KEY = 'site-theme-override';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

let sessionOverride = null;

/**
 * Initialize the theme system
 * Loads any session override and sets up event listeners
 */
export function initTheme() {
  sessionOverride = sessionStorage.getItem(OVERRIDE_KEY);
  applyTheme();
  setupThemeToggle();
  setupSystemThemeListener();
}

/**
 * Whether the OS is currently set to dark mode
 */
function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * The theme actually in effect: the session override if set, else system preference
 */
function resolvedTheme() {
  return sessionOverride || (systemPrefersDark() ? THEMES.DARK : THEMES.LIGHT);
}

/**
 * Apply the resolved theme to the document
 */
function applyTheme() {
  const theme = resolvedTheme();
  document.documentElement.dataset.theme = theme;
  updateToggleButton();
  window.dispatchEvent(new CustomEvent('site-theme-change', { detail: { theme } }));
}

/**
 * Set up theme toggle button event listener
 */
function setupThemeToggle() {
  const toggleButton = document.getElementById('theme-toggle');
  if (!toggleButton) return;

  toggleButton.addEventListener('click', () => {
    // Flip whatever is currently showing and pin it as this session's override
    sessionOverride = resolvedTheme() === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
    sessionStorage.setItem(OVERRIDE_KEY, sessionOverride);
    applyTheme();
  });
}

/**
 * Live-update when the OS preference changes, but only while unoverridden
 */
function setupSystemThemeListener() {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!sessionOverride) {
      applyTheme();
    }
  });
}

/**
 * Update the theme toggle button icon and title
 */
function updateToggleButton() {
  const toggleButton = document.getElementById('theme-toggle');
  if (!toggleButton) return;

  const theme = resolvedTheme();
  toggleButton.textContent = theme === THEMES.DARK ? '🌙' : '☀️';
  toggleButton.title = sessionOverride
    ? `Theme: ${theme} (session override)`
    : `Theme: ${theme} (system)`;
}

/**
 * Get the theme currently in effect
 * @returns {string} Current theme (light or dark)
 */
export function getCurrentTheme() {
  return resolvedTheme();
}
