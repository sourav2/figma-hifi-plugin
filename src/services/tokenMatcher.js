import { logScan, logScanError } from '../utils/logger.js';

/**
 * Evaluates the node properties against style and token libraries in the design system.
 * 
 * @param {object} node Figma canvas node
 * @param {object} database Design system database
 * @returns {object|null} Matched token object or null
 */
export function matchNodeToTokens(node, database) {
  if (!database) return null;
  const tokens = {};

  // 1. Typography Match
  if (node.type === 'TEXT') {
    if (node.fontSize !== figma.mixed) {
      const fontSize = node.fontSize;
      const nodeNameLower = (node.name || '').toLowerCase();
      let bestStyle = null;
      let minDiff = Infinity;

      if (database.typography) {
        for (const style of database.typography) {
          if (typeof style.fontSize === 'number') {
            let diff = Math.abs(style.fontSize - fontSize) * 2;
            
            // Boost if names are similar
            const styleNameLower = (style.name || '').toLowerCase();
            if (nodeNameLower && styleNameLower) {
              if (nodeNameLower.indexOf('h1') !== -1 && styleNameLower.indexOf('h1') !== -1) diff -= 2;
              if (nodeNameLower.indexOf('h2') !== -1 && styleNameLower.indexOf('h2') !== -1) diff -= 2;
              if (nodeNameLower.indexOf('h3') !== -1 && styleNameLower.indexOf('h3') !== -1) diff -= 2;
              if (nodeNameLower.indexOf('body') !== -1 && styleNameLower.indexOf('body') !== -1) diff -= 2;
              if (nodeNameLower.indexOf('heading') !== -1 && styleNameLower.indexOf('heading') !== -1) diff -= 2;
              if (nodeNameLower.indexOf('paragraph') !== -1 && styleNameLower.indexOf('paragraph') !== -1) diff -= 2;
              if (nodeNameLower.indexOf('label') !== -1 && styleNameLower.indexOf('label') !== -1) diff -= 2;
            }

            if (diff < minDiff) {
              minDiff = diff;
              bestStyle = style;
            }
          }
        }
      }

      if (bestStyle) {
        tokens.typography = {
          name: 'Typography/' + bestStyle.name,
          id: bestStyle.id,
          type: 'Typography'
        };
      }
    }

    // Match text color
    if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
      const solid = node.fills.find(f => f.type === 'SOLID' && f.visible !== false);
      if (solid && database.colors) {
        let bestColor = null;
        let minDiff = Infinity;
        for (const style of database.colors) {
          if (style.rgb) {
            const diff = Math.abs(style.rgb.r - solid.color.r) + 
                         Math.abs(style.rgb.g - solid.color.g) + 
                         Math.abs(style.rgb.b - solid.color.b);
            if (diff < minDiff) {
              minDiff = diff;
              bestColor = style;
            }
          }
        }
        if (bestColor && minDiff < 0.3) {
          tokens.color = {
            name: 'Color/' + bestColor.name,
            id: bestColor.id,
            type: 'Color'
          };
        }
      }
    }
  }

  // 2. Image / Shape styling
  if (node.type !== 'TEXT') {
    // Radius
    if ('cornerRadius' in node && typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
      const radius = node.cornerRadius;
      let radiusName = 'Radius/Medium';
      if (radius <= 4) radiusName = 'Radius/Small';
      else if (radius > 12) radiusName = 'Radius/Large';
      tokens.radius = { name: radiusName, value: radius };
    }

    // Elevation / Shadow
    if ('effects' in node && Array.isArray(node.effects) && node.effects.length > 0 && database.effects && database.effects.length > 0) {
      const shadow = node.effects.find(e => (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') && e.visible !== false);
      if (shadow) {
        tokens.elevation = { name: 'Elevation/' + database.effects[0].name, id: database.effects[0].id };
      }
    }

    // Background Color
    if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
      const solid = node.fills.find(f => f.type === 'SOLID' && f.visible !== false);
      if (solid && database.colors) {
        let bestColor = null;
        let minDiff = Infinity;
        for (const style of database.colors) {
          if (style.rgb) {
            const diff = Math.abs(style.rgb.r - solid.color.r) + 
                         Math.abs(style.rgb.g - solid.color.g) + 
                         Math.abs(style.rgb.b - solid.color.b);
            if (diff < minDiff) {
              minDiff = diff;
              bestColor = style;
            }
          }
        }
        if (bestColor && minDiff < 0.3) {
          tokens.background = {
            name: 'Color/' + bestColor.name,
            id: bestColor.id,
            type: 'Color'
          };
        }
      }
    }
  }

  // 3. Spacing Match
  if ('layoutMode' in node && node.layoutMode !== 'NONE') {
    const spacing = node.itemSpacing;
    if (typeof spacing === 'number' && spacing > 0) {
      let spacingName = 'Spacing/Medium';
      if (spacing <= 4) spacingName = 'Spacing/XSmall';
      else if (spacing <= 8) spacingName = 'Spacing/Small';
      else if (spacing > 24) spacingName = 'Spacing/Large';
      tokens.spacing = { name: spacingName, value: spacing };
    }
  }

  return Object.keys(tokens).length > 0 ? tokens : null;
}
