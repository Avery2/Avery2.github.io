# Architecture Documentation

## Overview

This portfolio website is built with vanilla HTML, CSS, and JavaScript - no frameworks, no build system. It features a tile-based architecture with GitHub Actions automation for metadata generation.

## Tech Stack

- **HTML5**: Semantic structure
- **CSS3**: Custom properties for theming, CSS columns for masonry layout
- **JavaScript ES6**: Native modules, no bundler
- **GitHub Actions**: Automated metadata generation
- **Python**: GitHub API integration for project data

## Core Concepts

### 1. Tile System

Everything on the site is a **tile** - a modular, reusable component displayed in a masonry grid.

**Tile Types:**

- `project` - Auto-generated from GitHub API (repositories)
- `link` - Manual tile linking to external resource (e.g., resume)
- `content` - Rich markdown content tile
- `widget` - Interactive component (future: analytics dashboard)

**Tile Properties:**
```yaml
id: unique-identifier
type: project|link|content|widget
title: Display title
description: Brief description
image: Path to image or null
url: Link destination (for link tiles)
priority: Sort order (higher = top)
tags: [tag1, tag2]
topics: [topic1, topic2]
```

### 2. Data Flow

```
GitHub API
    ↓
Python Script (.github/scripts/fetch-github-data.py)
    ↓
data/github-projects.yml (auto-generated)
    +
data/manual-tiles.yml (user-configured)
    ↓
JavaScript (data-loader.js)
    ↓
Merged Tile Data
    ↓
tile-renderer.js
    ↓
DOM (masonry grid)
```

### 3. File Structure

```
/
├── index.html                  # Main entry point
├── css/                        # Modular CSS files
│   ├── base.css               # Reset + base styles
│   ├── themes.css             # Light/dark theme variables
│   ├── grid.css               # Masonry layout
│   ├── tiles.css              # Tile component styles
│   ├── header.css             # Header/navigation/profile
│   ├── filters.css            # Filter UI
│   └── main.css               # Imports all CSS
├── js/                         # ES6 modules
│   ├── config.js              # Constants
│   ├── theme.js               # Theme toggle + localStorage
│   ├── data-loader.js         # YAML loading
│   ├── tile-renderer.js       # Tile rendering engine
│   ├── filter-system.js       # Filter/search logic
│   └── main.js                # App entry point
├── data/                       # YAML configuration
│   ├── site-config.yml        # Site metadata, curated repos
│   ├── manual-tiles.yml       # User-defined tiles
│   ├── github-projects.yml    # Auto-generated (Actions)
│   ├── filter-groups.yml      # Filter configuration
│   ├── social-media.yml       # Social links
│   ├── skills.yml             # Skills data
│   └── timeline.yml           # Timeline data
├── assets/images/              # All images
│   ├── profile/               # Profile photo
│   └── projects/              # Project screenshots
└── .github/
    ├── workflows/
    │   ├── generate-metadata.yml  # Fetch GitHub data
    │   └── deploy.yml             # Deploy to Pages
    └── scripts/
        └── fetch-github-data.py   # Python script
```

## Key Features

### Masonry Layout

Uses CSS columns for true masonry layout:

```css
.grid-container {
  column-count: 4;
  column-gap: var(--grid-gap);
}

.tile {
  break-inside: avoid;
  margin-bottom: var(--grid-gap);
  display: inline-block;
  width: 100%;
}
```

**Why CSS columns over CSS Grid?**
- True masonry: tiles flow up to fill gaps
- No JavaScript required for layout
- Responsive: column count changes with screen width
- Smooth animations when filtering

### Theme System

Uses CSS custom properties for light/dark modes:

```css
:root {
  --bg-primary: #ffffff;
  --text-primary: #212529;
  --accent-primary: #007bff;
  /* ... */
}

[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --text-primary: #e9ecef;
  --accent-primary: #4a9eff;
  /* ... */
}
```

Theme state stored in localStorage, applied on page load to prevent FOUC.

### Filter System

**Three filter types:**
1. **Tags** - Multi-select pills (sorted by frequency)
2. **Search** - Debounced text input
3. **Sort** - Dropdown (priority, stars, recent, A-Z)

**Filtering logic:**
- Tags: OR logic (show tiles matching any selected tag)
- Search: AND logic (search in title, description, tags, topics)
- Sort: Applied after filtering

**Smooth animations:**
- Filtered tiles: `display: none` (instant for smooth masonry reflow)
- No opacity fade to avoid "floating gaps" during transition

### GitHub Actions Automation

**Workflow: `generate-metadata.yml`**

**Triggers:**
- Weekly schedule (Sundays at 00:00 UTC)
- Manual dispatch
- Push to `main` (when data files change)

**Process:**
1. Fetch curated repo list from `site-config.yml`
2. For each repo, fetch from GitHub API:
   - Name, description, URL
   - Topics, language, stars
   - Created/updated dates
   - Traffic stats (14-day views/clones)
3. Link to images in `assets/images/projects/`
4. Calculate priority score
5. Output to `data/github-projects.yml`
6. Commit changes if any
7. Trigger GitHub Pages rebuild

**Priority calculation:**
```python
priority = (stars * 3) + (recency * 2) + has_description
```

## JavaScript Architecture

### Module Organization

**ES6 modules with native browser imports:**

```javascript
// main.js
import { initTheme } from './theme.js';
import { loadData } from './data-loader.js';
import { renderAllTiles } from './tile-renderer.js';
import { initFilterSystem } from './filter-system.js';
```

No bundler required - files served directly.

### Tile Rendering (Factory Pattern)

```javascript
const TileRenderers = {
  project: renderProjectTile,
  link: renderLinkTile,
  content: renderContentTile,
  widget: renderWidgetTile
};

function renderTile(tileData) {
  const renderer = TileRenderers[tileData.type];
  const element = renderer(tileData);
  applyCommonAttributes(element, tileData);
  return element;
}
```

### Data Loading

**YAML parsing with js-yaml (CDN):**

```javascript
async function loadData(path) {
  const response = await fetch(path);
  const text = await response.text();
  return jsyaml.load(text);
}
```

**Parallel loading:**
```javascript
const [siteConfig, githubProjects, manualTiles, filterGroups] =
  await Promise.all([
    loadData('data/site-config.yml'),
    loadData('data/github-projects.yml'),
    loadData('data/manual-tiles.yml'),
    loadData('data/filter-groups.yml')
  ]);
```

### Filter System

**State management:**
```javascript
let activeFilters = {
  tags: [],
  search: '',
  sort: 'priority'
};
```

**Filter application:**
```javascript
function applyFilters() {
  tileElements.forEach(tile => {
    const matches = evaluateFilters(getTileDataFromElement(tile));
    tile.style.display = matches ? '' : 'none';
  });
  sortTiles(activeFilters.sort);
}
```

## Performance Optimizations

1. **Lazy loading images**: `loading="lazy"` on all tile images
2. **Debounced search**: 300ms delay on search input
3. **Parallel data loading**: All YAML files loaded concurrently
4. **Minimal DOM queries**: Cache selectors, minimize reflows
5. **CSS-only animations**: No JavaScript for transitions
6. **Instant filtering**: No fade animations to avoid layout jank

## Accessibility

- **WCAG AA compliance**: 4.5:1 contrast ratio
- **Keyboard navigation**: All interactive elements focusable
- **Semantic HTML**: `<header>`, `<main>`, `<section>`, `<article>`
- **ARIA labels**: On buttons, toggles, filter controls
- **Alt text**: On all images
- **Focus indicators**: Visible outlines on all elements

## Browser Support

**Target:**
- Chrome 120+
- Firefox 121+
- Safari 17+
- Edge 120+

**Progressive enhancement:**
- CSS columns (all modern browsers)
- ES6 modules (all modern browsers)
- CSS custom properties (all modern browsers)
- No IE11 support needed

## Fork-Friendly Design

**Zero configuration for forkers:**
- GITHUB_TOKEN auto-scoped to fork owner
- Curated repo list in `site-config.yml`
- Images auto-detected from filesystem
- Traffic stats fail gracefully (not all forkers have admin access)

**Forker experience:**
1. Fork repo
2. Update `data/site-config.yml` with your info
3. Add images to `assets/images/`
4. Enable GitHub Actions
5. Enable GitHub Pages
6. Done! Site auto-generates weekly

## Future Enhancements

### Phase 2
- Analytics dashboard widget (views, clones, star growth)
- Blog functionality (markdown posts, RSS feed)
- Infinite scroll / pagination

### Phase 3
- Interactive project previews (hover demos)
- Project dependency graphs
- Contribution heatmap
- Skills radar chart

### Phase 4
- Multi-language support (i18n)
- PWA (offline mode)
- Export portfolio as PDF
- Customizable color themes

## Design Principles

1. **Simplicity**: No frameworks, no build system
2. **Performance**: Fast, lightweight, optimized
3. **Accessibility**: WCAG AA compliant
4. **Maintainability**: Modular, well-documented code
5. **Fork-friendliness**: Zero configuration needed
6. **Progressive enhancement**: Works everywhere, enhanced where supported

---

**Questions?** Open an issue or check [DEVELOPMENT.md](./DEVELOPMENT.md) for local setup.
