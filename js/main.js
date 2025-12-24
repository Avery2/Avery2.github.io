/**
 * Main Application Entry Point
 * Initializes the website
 */

import config from './config.js';
import { initTheme } from './theme.js';
import { loadData, mergeData } from './data-loader.js';
import { renderAllTiles, calculateMasonryLayout } from './tile-renderer.js';
import { initFilterSystem } from './filter-system.js';

/**
 * Initialize the application
 */
async function init() {
  console.log('Initializing site...');

  // Initialize theme system first (prevents FOUC)
  initTheme();

  try {
    // Load all data files in parallel
    const [siteConfig, githubProjects, manualTiles, resumeTiles, filterGroups] = await Promise.all([
      loadData('data/site-config.yml'),
      loadData('data/github-projects.yml'),
      loadData('data/manual-tiles.yml'),
      loadData('data/resume-tiles.yml').catch(() => ({ tiles: [] })), // Graceful fallback
      loadData('data/filter-groups.yml')
    ]);

    console.log('Data loaded successfully:', {
      siteConfig,
      githubProjects: githubProjects.projects?.length || 0,
      manualTiles: manualTiles.tiles?.length || 0,
      resumeTiles: resumeTiles.tiles?.length || 0
    });

    // Populate social links
    await populateSocialLinks(siteConfig);

    // Merge manual tiles with auto-generated projects and resume tiles
    const allTiles = mergeData(githubProjects.projects, manualTiles.tiles, resumeTiles.tiles);

    console.log(`Total tiles: ${allTiles.length}`);

    // Render tiles into grid
    const gridContainer = document.querySelector('.grid-container');
    renderAllTiles(allTiles, gridContainer);

    // Initialize filtering system
    initFilterSystem(allTiles, filterGroups);

    // Setup additional interactions
    setupScrollBehavior();
    setupFilterToggle();
    setupMobileMenu();
    setupScrollAnimations();
    setupResponsiveRerender(allTiles, gridContainer);

    console.log('✅ Site initialized successfully!');

  } catch (error) {
    console.error('Failed to initialize:', error);
    showErrorMessage(config.ERRORS.DATA_LOAD_FAILED);
  }
}

/**
 * Populate social links in header
 * @param {Object} siteConfig - Site configuration object
 */
async function populateSocialLinks(siteConfig) {
  if (!siteConfig.navigation || !siteConfig.navigation.show_social_in_header) {
    return;
  }

  const socialLinksContainer = document.getElementById('social-links');
  if (!socialLinksContainer) return;

  const author = siteConfig.author;
  if (!author) return;

  // Load social media config
  const socialMediaConfig = await loadData('data/social-media.yml');
  const platforms = socialMediaConfig.platforms || {};

  // Social links to display
  const socialLinks = [];

  // GitHub
  if (author.github) {
    socialLinks.push({
      url: `${platforms.github?.url_base || 'https://github.com/'}${author.github}`,
      icon: platforms.github?.icon || 'fab fa-github',
      label: 'GitHub'
    });
  }

  // LinkedIn
  if (author.linkedin) {
    socialLinks.push({
      url: `${platforms.linkedin?.url_base || 'https://linkedin.com/in/'}${author.linkedin}`,
      icon: platforms.linkedin?.icon || 'fab fa-linkedin-in',
      label: 'LinkedIn'
    });
  }

  // Email
  if (author.email) {
    socialLinks.push({
      url: `${platforms.email?.url_base || 'mailto:'}${author.email}`,
      icon: platforms.email?.icon || 'fas fa-envelope',
      label: 'Email'
    });
  }

  // Resume
  if (author.resume_url) {
    socialLinks.push({
      url: author.resume_url,
      icon: platforms.resume?.icon || 'fas fa-file',
      label: 'Resume'
    });
  }

  // Render social links
  socialLinks.forEach(link => {
    const a = document.createElement('a');
    a.href = link.url;
    a.className = 'social-link';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.title = link.label;
    a.innerHTML = `<i class="${link.icon}"></i>`;
    socialLinksContainer.appendChild(a);
  });

  // Also populate mobile social links
  const mobileSocialLinksContainer = document.getElementById('mobile-social-links');
  if (mobileSocialLinksContainer) {
    socialLinks.forEach(link => {
      const a = document.createElement('a');
      a.href = link.url;
      a.className = 'social-link';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = link.label;
      a.innerHTML = `<i class="${link.icon}"></i>`;
      mobileSocialLinksContainer.appendChild(a);
    });
  }
}

/**
 * Set up filter toggle functionality
 */
function setupFilterToggle() {
  const toggleBtn = document.getElementById('filter-toggle-btn');
  const filterWrapper = document.getElementById('filter-wrapper');
  const header = document.querySelector('.site-header');

  if (!toggleBtn || !filterWrapper || !header) return;

  toggleBtn.addEventListener('click', () => {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      // Collapse
      toggleBtn.setAttribute('aria-expanded', 'false');
      filterWrapper.classList.remove('expanded');
      header.classList.remove('filters-expanded');
    } else {
      // Expand
      toggleBtn.setAttribute('aria-expanded', 'true');
      filterWrapper.classList.add('expanded');
      header.classList.add('filters-expanded');

      // Auto-focus search input
      setTimeout(() => {
        const searchInput = filterWrapper.querySelector('.search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }, 100); // Small delay to let animation start
    }
  });
}

/**
 * Set up mobile menu toggle functionality
 */
function setupMobileMenu() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const menuDropdown = document.getElementById('mobile-menu-dropdown');
  const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
  const mainThemeToggle = document.getElementById('theme-toggle');

  if (!menuToggle || !menuDropdown) return;

  // Toggle mobile menu
  menuToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuDropdown.classList.remove('active');
    } else {
      menuToggle.setAttribute('aria-expanded', 'true');
      menuDropdown.classList.add('active');
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!menuDropdown.contains(e.target) && !menuToggle.contains(e.target)) {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuDropdown.classList.remove('active');
    }
  });

  // Sync mobile theme toggle with main theme toggle
  if (mobileThemeToggle && mainThemeToggle) {
    mobileThemeToggle.addEventListener('click', () => {
      mainThemeToggle.click();
    });
  }
}

/**
 * Set up smooth scroll behavior for anchor links
 */
function setupScrollBehavior() {
  // Header scroll effect
  const header = document.querySelector('.site-header');
  const siteTitle = document.querySelector('.site-title');
  const headerLeft = document.querySelector('.header-left');
  let lastScrollY = window.scrollY;

  function updateHeaderOnScroll() {
    const scrollY = window.scrollY;
    const maxScroll = 100; // Distance over which to animate (in pixels)

    // Calculate scroll progress (0 to 1)
    const scrollProgress = Math.min(scrollY / maxScroll, 1);

    // Interpolate font size from 1.5rem to 1.25rem
    const startFontSize = 1.5;
    const endFontSize = 1.25;
    const currentFontSize = startFontSize - (startFontSize - endFontSize) * scrollProgress;

    // Apply interpolated font size
    if (siteTitle) {
      siteTitle.style.fontSize = `${currentFontSize}rem`;
    }

    // Keep scrolled class for background styling
    if (scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    lastScrollY = scrollY;
  }

  // Initial check
  updateHeaderOnScroll();

  // Listen to scroll events
  window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });

  // Scroll to top when clicking site title
  if (siteTitle) {
    siteTitle.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

/**
 * Show error message to the user
 * @param {string} message - Error message to display
 */
function showErrorMessage(message) {
  const errorDiv = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');

  if (errorDiv && errorText) {
    errorText.textContent = message;
    errorDiv.style.display = 'flex';
  }

  // Also hide loading spinner
  const gridContainer = document.querySelector('.grid-container');
  if (gridContainer) {
    gridContainer.dataset.loading = 'false';
  }
}

/**
 * Set up scroll animations for tiles
 */
function setupScrollAnimations() {
  const tiles = document.querySelectorAll('.tile');

  // Create intersection observer with earlier trigger
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('tile-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0,  // Trigger as soon as any part is visible
    rootMargin: '100px 0px 100px 0px'  // Trigger 100px before entering viewport
  });

  // Observe all tiles
  tiles.forEach(tile => {
    // Immediately show tiles already in viewport on page load
    const rect = tile.getBoundingClientRect();
    const isInViewport = (
      rect.top < window.innerHeight &&
      rect.bottom > 0
    );

    if (isInViewport) {
      // Tile already in viewport - show immediately
      tile.classList.add('tile-visible');
    } else {
      // Tile not in viewport - observe for scroll
      observer.observe(tile);
    }
  });
}

/**
 * Set up responsive masonry layout recalculation
 * @param {Array} allTiles - All tile data
 * @param {HTMLElement} gridContainer - Grid container element
 */
function setupResponsiveRerender(allTiles, gridContainer) {
  let resizeTimeout;

  // Use ResizeObserver for efficient layout recalculation
  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      calculateMasonryLayout(gridContainer);
    }, 100); // Debounce for performance
  });

  resizeObserver.observe(gridContainer);
}

/**
 * Start initialization when DOM is ready
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
