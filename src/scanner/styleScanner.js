import { solidPaintToColor } from '../utils/colorUtils.js';
import { logScan, logScanError } from '../utils/logger.js';

/**
 * Serializes Figma line height (fixed, percent, or auto) for storage.
 */
function serializeLineHeight(lineHeight) {
  if (lineHeight === figma.mixed || lineHeight == null) {
    return null;
  }
  if (typeof lineHeight === 'object') {
    if (lineHeight.unit === 'PIXELS') {
      return { unit: 'PIXELS', value: lineHeight.value };
    }
    if (lineHeight.unit === 'PERCENT') {
      return { unit: 'PERCENT', value: lineHeight.value };
    }
    if (lineHeight.unit === 'AUTO') {
      return { unit: 'AUTO' };
    }
  }
  return lineHeight;
}

/**
 * Serializes letter spacing for storage.
 */
function serializeLetterSpacing(letterSpacing) {
  if (letterSpacing === figma.mixed || letterSpacing == null) {
    return null;
  }
  if (typeof letterSpacing === 'object') {
    return {
      unit: letterSpacing.unit,
      value: letterSpacing.value,
    };
  }
  return letterSpacing;
}

/**
 * Collects local paint (color) styles from the current file.
 * Uses getLocalPaintStylesAsync for documentAccess: dynamic-page.
 */
export async function scanColorStyles() {
  logScan('scanColorStyles() — START');

  try {
    logScan('Awaiting figma.getLocalPaintStylesAsync()…');
    const styles = await figma.getLocalPaintStylesAsync();
    const colors = [];

    for (const style of styles) {
      const paints = style.paints;
      let colorData = null;

      if (paints.length > 0) {
        const firstSolid = paints.find((p) => p.type === 'SOLID');
        if (firstSolid) {
          colorData = solidPaintToColor(firstSolid);
        }
      }

      colors.push({
        name: style.name,
        id: style.id,
        description: style.description || '',
        rgb: colorData
          ? { r: colorData.r, g: colorData.g, b: colorData.b }
          : null,
        hex: colorData ? colorData.hex : null,
        paintCount: paints.length,
      });
    }

    logScan('scanColorStyles() — FINISH', { colorStyles: colors.length });
    return colors;
  } catch (error) {
    logScanError('scanColorStyles()', error);
    return [];
  }
}

/**
 * Collects local text (typography) styles from the current file.
 * Uses getLocalTextStylesAsync for documentAccess: dynamic-page.
 */
export async function scanTypographyStyles() {
  logScan('scanTypographyStyles() — START');

  try {
    logScan('Awaiting figma.getLocalTextStylesAsync()…');
    const styles = await figma.getLocalTextStylesAsync();
    const typography = [];

    for (const style of styles) {
      const fontName = style.fontName;
      typography.push({
        name: style.name,
        id: style.id,
        description: style.description || '',
        fontFamily:
          fontName && fontName !== figma.mixed ? fontName.family : null,
        fontSize: style.fontSize !== figma.mixed ? style.fontSize : null,
        fontWeight:
          fontName && fontName !== figma.mixed ? fontName.style : null,
        lineHeight: serializeLineHeight(style.lineHeight),
        letterSpacing: serializeLetterSpacing(style.letterSpacing),
      });
    }

    logScan('scanTypographyStyles() — FINISH', {
      textStyles: typography.length,
    });
    return typography;
  } catch (error) {
    logScanError('scanTypographyStyles()', error);
    return [];
  }
}

/**
 * Collects local effect styles from the current file.
 * Uses getLocalEffectStylesAsync for documentAccess: dynamic-page.
 */
export async function scanEffectStyles() {
  logScan('scanEffectStyles() — START');

  try {
    logScan('Awaiting figma.getLocalEffectStylesAsync()…');
    const styles = await figma.getLocalEffectStylesAsync();
    const effects = [];

    for (const style of styles) {
      const effectList = style.effects || [];
      effects.push({
        name: style.name,
        id: style.id,
        description: style.description || '',
        effectCount: effectList.length,
        effectTypes: effectList.map((e) => e.type),
      });
    }

    logScan('scanEffectStyles() — FINISH', { effectStyles: effects.length });
    return effects;
  } catch (error) {
    logScanError('scanEffectStyles()', error);
    return [];
  }
}

/**
 * Collects local grid (layout grid) styles from the current file.
 * Uses getLocalGridStylesAsync for documentAccess: dynamic-page.
 */
export async function scanGridStyles() {
  logScan('scanGridStyles() — START');

  try {
    logScan('Awaiting figma.getLocalGridStylesAsync()…');
    const styles = await figma.getLocalGridStylesAsync();
    const grids = [];

    for (const style of styles) {
      const layoutGrids = style.layoutGrids || [];
      grids.push({
        name: style.name,
        id: style.id,
        description: style.description || '',
        gridCount: layoutGrids.length,
        gridPatterns: layoutGrids.map((g) => g.pattern),
      });
    }

    logScan('scanGridStyles() — FINISH', { gridStyles: grids.length });
    return grids;
  } catch (error) {
    logScanError('scanGridStyles()', error);
    return [];
  }
}

/**
 * Scans all local style types in the file (async, dynamic-page safe).
 * Each category is isolated in try/catch so one failure does not block others.
 */
export async function scanAllStyles() {
  logScan('scanAllStyles() — START');

  const result = {
    colors: [],
    typography: [],
    effects: [],
    grids: [],
  };

  try {
    result.colors = await scanColorStyles();
  } catch (error) {
    logScanError('scanAllStyles() — color styles failed', error);
  }

  try {
    result.typography = await scanTypographyStyles();
  } catch (error) {
    logScanError('scanAllStyles() — typography styles failed', error);
  }

  try {
    result.effects = await scanEffectStyles();
  } catch (error) {
    logScanError('scanAllStyles() — effect styles failed', error);
  }

  try {
    result.grids = await scanGridStyles();
  } catch (error) {
    logScanError('scanAllStyles() — grid styles failed', error);
  }

  logScan('scanAllStyles() — FINISH', {
    colorStyles: result.colors.length,
    textStyles: result.typography.length,
    effectStyles: result.effects.length,
    gridStyles: result.grids.length,
  });

  return result;
}
