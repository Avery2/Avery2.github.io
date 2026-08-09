/**
 * Data Loader Module
 * Handles loading and parsing YAML data files
 */

import config from './config.js';

// Cache for loaded data
const dataCache = new Map();

/**
 * Load data from a YAML file
 * @param {string} path - Path to the YAML file
 * @returns {Promise<any>} Parsed YAML data
 */
export async function loadData(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const yamlText = await response.text();
    const data = jsyaml.load(yamlText);  // Using global js-yaml library

    return data;
  } catch (error) {
    console.error(`Failed to load ${path}:`, error);
    throw error;
  }
}

/**
 * Load data from a YAML file with caching
 * @param {string} path - Path to the YAML file
 * @returns {Promise<any>} Parsed YAML data
 */
export async function loadDataCached(path) {
  if (dataCache.has(path)) {
    return dataCache.get(path);
  }

  const data = await loadData(path);
  dataCache.set(path, data);
  return data;
}

/**
 * Load markdown content from external files for content tiles
 * @param {Array} tiles - Array of tile objects
 * @returns {Promise<Array>} Tiles with loaded markdown content
 */
export async function loadMarkdownContent(tiles) {
  if (!tiles) return [];

  const processedTiles = await Promise.all(
    tiles.map(async (tile) => {
      // If tile has content_file, fetch and load the markdown
      if (tile.content_file) {
        try {
          const response = await fetch(tile.content_file);
          if (!response.ok) {
            console.warn(`Failed to load ${tile.content_file}: ${response.status}`);
            return tile;
          }
          const markdownContent = await response.text();
          return {
            ...tile,
            content_markdown: markdownContent
          };
        } catch (error) {
          console.error(`Error loading ${tile.content_file}:`, error);
          return tile;
        }
      }
      return tile;
    })
  );

  return processedTiles;
}

/**
 * Merge GitHub projects with manual tiles and resume tiles
 * @param {Array} githubProjects - Auto-generated project tiles
 * @param {Array} manualTiles - User-defined manual tiles
 * @param {Array} resumeTiles - Auto-generated resume tiles (experience/education)
 * @returns {Array} Combined and sorted tile array
 */
export function mergeData(githubProjects, manualTiles, resumeTiles = []) {
  // Combine auto-generated projects with manual tiles and resume tiles
  const allTiles = [
    ...(githubProjects || []).map(p => ({ ...p, source: 'github' })),
    ...(manualTiles || []).map(t => ({ ...t, source: 'manual' })),
    ...(resumeTiles || []).map(r => ({ ...r, source: 'resume' }))
  ];

  // Keep the mixed masonry legible as a set of loose sections. The two
  // negative-priority utility tiles remain pinned at the absolute end.
  const sectionOrder = { writing: 1, experience: 2, projects: 3, links: 4, navigation: 5 };
  const sectionFor = tile => {
    if (tile.type === 'profile') return 0;
    if ((tile.priority || 0) < 0) return 99;
    if (tile.content_type) return sectionOrder[tile.content_type] || 50;
    if (tile.type === 'experience' || tile.type === 'education') return sectionOrder.experience;
    if (tile.type === 'project') return sectionOrder.projects;
    if ((tile.tags || []).includes('writing')) return sectionOrder.writing;
    if (tile.type === 'link') return sectionOrder.links;
    return 50;
  };

  allTiles.sort((a, b) => {
    const sectionDifference = sectionFor(a) - sectionFor(b);
    if (sectionDifference !== 0) return sectionDifference;
    return (b.priority || 0) - (a.priority || 0);
  });

  return allTiles;
}

/**
 * Clear the data cache
 */
export function clearCache() {
  dataCache.clear();
}
