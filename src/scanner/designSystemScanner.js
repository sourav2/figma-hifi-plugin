import { scanComponents } from './componentScanner.js';
import { scanAllStyles } from './styleScanner.js';
import { logScan, logScanError } from '../utils/logger.js';

/**
 * Creates an empty design system database with the expected shape.
 */
export function createEmptyDatabase() {
  return {
    components: [],
    variants: [],
    colors: [],
    typography: [],
    effects: [],
    grids: [],
    scannedAt: null,
    fileName: figma.root.name,
  };
}

/**
 * Counts PAGE nodes under the file root.
 */
function countPages() {
  let count = 0;
  for (const child of figma.root.children) {
    if (child.type === 'PAGE') {
      count += 1;
    }
  }
  return count;
}

/**
 * Main entry: loads all pages, scans components and styles, returns the full database.
 * This is Phase 1 — inventory only; no AI or layer matching.
 */
export async function scanDesignSystem() {
  logScan('scanDesignSystem() — START');

  try {
    logScan('Calling figma.loadAllPagesAsync()…');
    await figma.loadAllPagesAsync();
    logScan('figma.loadAllPagesAsync() — DONE');

    const pageCount = countPages();
    logScan('Pages found: ' + pageCount);

    logScan('Calling scanComponents()…');
    const componentResult = scanComponents();
    logScan('scanComponents() — DONE', {
      components: componentResult.components.length,
      componentSets: componentResult.variants.length,
    });

    logScan('Calling scanAllStyles()…');
    const styles = await scanAllStyles();
    logScan('scanAllStyles() — DONE', {
      colorStyles: styles.colors.length,
      textStyles: styles.typography.length,
      effectStyles: styles.effects.length,
      gridStyles: styles.grids.length,
    });

    const database = {
      components: componentResult.components,
      variants: componentResult.variants,
      colors: styles.colors,
      typography: styles.typography,
      effects: styles.effects,
      grids: styles.grids,
      scannedAt: new Date().toISOString(),
      fileName: figma.root.name,
    };

    logScan('scanDesignSystem() — database built', {
      components: database.components.length,
      componentSets: database.variants.length,
      colorStyles: database.colors.length,
      textStyles: database.typography.length,
      effectStyles: database.effects.length,
      gridStyles: database.grids.length,
      fileName: database.fileName,
    });

    logScan('scanDesignSystem() — FINISH');
    return database;
  } catch (error) {
    logScanError('scanDesignSystem()', error);
    throw error;
  }
}
