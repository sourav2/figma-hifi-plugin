import { logScan, logScanError } from '../utils/logger.js';

/**
 * Scans all pages for components and component sets (variants).
 * Requires figma.loadAllPagesAsync() to be called before scanning.
 */

/**
 * Maps a single Component node to a structured record.
 */
function mapComponent(node, pageName) {
  const parentSet =
    node.parent && node.parent.type === 'COMPONENT_SET' ? node.parent : null;

  return {
    name: node.name,
    id: node.id,
    description: node.description || '',
    width: node.width,
    height: node.height,
    variantProperties: node.variantProperties
      ? Object.assign({}, node.variantProperties)
      : {},
    parentComponentSet: parentSet
      ? { id: parentSet.id, name: parentSet.name }
      : null,
    pageName,
  };
}

/**
 * Maps a Component Set (variant group) to a structured record.
 */
function getVariantPropertyNames(componentSet) {
  if (componentSet.componentPropertyDefinitions) {
    return Object.keys(componentSet.componentPropertyDefinitions);
  }
  if (componentSet.variantGroupProperties) {
    return Object.keys(componentSet.variantGroupProperties);
  }
  return [];
}

function mapComponentSet(node, pageName) {
  const variantPropertyNames = getVariantPropertyNames(node);

  return {
    name: node.name,
    id: node.id,
    description: node.description || '',
    width: node.width,
    height: node.height,
    variantPropertyNames,
    childCount: node.children.length,
    pageName,
  };
}

/**
 * Walks every page in the file and collects components and component sets.
 * @returns {{ components: object[], variants: object[] }}
 */
export function scanComponents() {
  logScan('scanComponents() — START');

  try {
    const components = [];
    const variants = [];
    const seenComponentIds = new Set();
    const seenVariantIds = new Set();
    let pagesScanned = 0;

    for (const page of figma.root.children) {
      if (page.type !== 'PAGE') {
        continue;
      }

      pagesScanned += 1;
      const pageName = page.name;
      logScan('Scanning page: ' + pageName);

      const nodes = page.findAll(
        (node) => node.type === 'COMPONENT' || node.type === 'COMPONENT_SET',
      );

      logScan('Nodes on page "' + pageName + '": ' + nodes.length);

      for (const node of nodes) {
        if (node.type === 'COMPONENT_SET') {
          if (!seenVariantIds.has(node.id)) {
            seenVariantIds.add(node.id);
            variants.push(mapComponentSet(node, pageName));
          }
        } else if (node.type === 'COMPONENT') {
          if (!seenComponentIds.has(node.id)) {
            seenComponentIds.add(node.id);
            components.push(mapComponent(node, pageName));
          }
        }
      }
    }

    logScan('scanComponents() — FINISH', {
      pagesScanned,
      components: components.length,
      componentSets: variants.length,
    });

    return { components, variants };
  } catch (error) {
    logScanError('scanComponents()', error);
    throw error;
  }
}
