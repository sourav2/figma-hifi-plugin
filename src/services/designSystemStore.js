import { logScan } from '../utils/logger.js';

/** @type {object | null} In-memory design system database from the last scan. */
let database = null;

const SAMPLE_LIMIT = 5;

/**
 * Persists the scanned design system in memory for the plugin session.
 */
export function setDatabase(data) {
  database = data;
  logScan('designSystemStore.setDatabase()', {
    components: data.components.length,
    componentSets: data.variants.length,
    colorStyles: data.colors.length,
    textStyles: data.typography.length,
  });
}

/**
 * Returns the full database or null if no scan has run.
 */
export function getDatabase() {
  return database;
}

/**
 * Whether a scan result is available.
 */
export function hasDatabase() {
  return database !== null;
}

/**
 * Counts for the results panel.
 */
export function getSummary() {
  if (!database) {
    return {
      components: 0,
      variants: 0,
      colors: 0,
      typography: 0,
      effects: 0,
      grids: 0,
      scannedAt: null,
      fileName: null,
    };
  }

  return {
    components: database.components.length,
    variants: database.variants.length,
    colors: database.colors.length,
    typography: database.typography.length,
    effects: database.effects.length,
    grids: database.grids.length,
    scannedAt: database.scannedAt,
    fileName: database.fileName,
  };
}

/**
 * Returns a small preview of each category for the UI sample section.
 */
export function getSamples(limit = SAMPLE_LIMIT) {
  if (!database) {
    return null;
  }

  return {
    components: database.components.slice(0, limit),
    variants: database.variants.slice(0, limit),
    colors: database.colors.slice(0, limit),
    typography: database.typography.slice(0, limit),
    effects: database.effects.slice(0, limit),
    grids: database.grids.slice(0, limit),
  };
}

/**
 * Payload sent to the UI after scan or when viewing results.
 */
export function getResultsPayload() {
  const payload = {
    summary: getSummary(),
    samples: getSamples(),
  };
  logScan('designSystemStore.getResultsPayload()', payload);
  return payload;
}
