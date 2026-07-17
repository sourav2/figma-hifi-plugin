import { logScan, logScanError } from '../utils/logger.js';
import {
  isContainer,
  getVisibleChildren,
  extractFeatures,
} from '../utils/nodeHelpers.js';
import { detectPatternWithDebug } from './patternDetector.js';
import {
  DISPLAY_MIN_CONFIDENCE,
  HIGH_CONFIDENCE,
  buildPatternSummary,
} from './confidenceLevels.js';
import { suggestDesignSystemCategory } from '../services/categoryMatcher.js';
import * as designSystemStore from '../services/designSystemStore.js';
import { PATTERN_DS_KEYWORDS } from './patterns.js';
import { matchPatternToComponent } from '../services/componentMatcher.js';
import { matchNodeToTokens } from '../services/tokenMatcher.js';

const MAX_DEPTH = 4;
const MIN_NODE_SIZE = 16;

const DESIGN_SYSTEM_WARNING =
  'This appears to be a design-system component rather than a low-fidelity wireframe.';

/**
 * Resolves the selected wireframe root (frame, section, component, or group).
 */
export function getSelectedFrameRoot() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return { error: 'Select a frame, section, or group to analyze.' };
  }

  if (selection.length > 1) {
    return { error: 'Select exactly one frame to analyze.' };
  }

  const node = selection[0];
  const allowed = new Set([
    'FRAME',
    'SECTION',
    'GROUP',
    'COMPONENT',
    'INSTANCE',
  ]);

  if (!allowed.has(node.type)) {
    return {
      error:
        'Selection must be a Frame, Section, Group, or Component instance.',
    };
  }

  const isDesignSystemComponent =
    node.type === 'COMPONENT' || node.type === 'INSTANCE';

  return {
    node: node,
    isDesignSystemComponent: isDesignSystemComponent,
    designSystemWarning: isDesignSystemComponent
      ? DESIGN_SYSTEM_WARNING
      : null,
  };
}

/**
 * Counts every visible node in the subtree by type.
 */
function collectNodeStats(root, maxDepth) {
  const typeCounts = {};
  let totalNodesScanned = 0;
  const queue = [{ node: root, depth: 0 }];
  const seen = new Set();

  while (queue.length > 0) {
    const item = queue.shift();
    const node = item.node;
    const depth = item.depth;

    if (seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);

    if (node.visible === false) {
      continue;
    }

    totalNodesScanned += 1;
    const nodeType = node.type;
    if (typeCounts[nodeType]) {
      typeCounts[nodeType] += 1;
    } else {
      typeCounts[nodeType] = 1;
    }

    if (depth >= maxDepth || !('children' in node)) {
      continue;
    }

    const children = getVisibleChildren(node);
    for (let i = 0; i < children.length; i++) {
      queue.push({ node: children[i], depth: depth + 1 });
    }
  }

  const sortedTypes = Object.keys(typeCounts).sort(function (a, b) {
    return typeCounts[b] - typeCounts[a];
  });

  return {
    totalNodesScanned: totalNodesScanned,
    nodeTypeCounts: typeCounts,
    nodeTypesSummary: sortedTypes.map(function (type) {
      return { type: type, count: typeCounts[type] };
    }),
  };
}

/**
 * Collects analyzable candidate nodes (BFS, skips tiny layers).
 */
function collectCandidates(root, maxDepth) {
  const candidates = [];
  const queue = [{ node: root, depth: 0 }];
  const seen = new Set();

  while (queue.length > 0) {
    const item = queue.shift();
    const node = item.node;
    const depth = item.depth;

    if (seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);

    if (
      node.id !== root.id &&
      isContainer(node) &&
      node.width >= MIN_NODE_SIZE &&
      node.height >= MIN_NODE_SIZE
    ) {
      candidates.push({ node: node, depth: depth });
    }

    if (depth >= maxDepth || !('children' in node)) {
      continue;
    }

    const children = getVisibleChildren(node);
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (isContainer(child)) {
        queue.push({ node: child, depth: depth + 1 });
      }
    }
  }

  return candidates;
}

/**
 * Checks if nodes are fully contained by a higher-confidence parent detection.
 */
function isInsideClaimedParent(node, claimed) {
  if (!('absoluteBoundingBox' in node) || !node.absoluteBoundingBox) {
    return false;
  }
  const box = node.absoluteBoundingBox;

  for (let i = 0; i < claimed.length; i++) {
    const c = claimed[i];
    if (c.nodeId === node.id) {
      continue;
    }
    if (!c.bounds) {
      continue;
    }
    const b = c.bounds;
    if (
      c.confidence >= HIGH_CONFIDENCE &&
      box.x >= b.x &&
      box.y >= b.y &&
      box.x + box.width <= b.x + b.width &&
      box.y + box.height <= b.y + b.height
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Searches scanned components in the design system to prepare matching candidates.
 */
export function findCandidateComponents(detectedType) {
  const database = designSystemStore.getDatabase();
  if (!database || !database.components) {
    return [];
  }

  const keywords = PATTERN_DS_KEYWORDS[detectedType] || [];
  if (keywords.length === 0) {
    return [];
  }

  const matches = [];
  for (const comp of database.components) {
    const nameLower = (comp.name || '').toLowerCase();
    let matchScore = 0;

    for (const kw of keywords) {
      if (nameLower.indexOf(kw.toLowerCase()) !== -1) {
        matchScore += 1;
        if (nameLower === kw.toLowerCase()) {
          matchScore += 2;
        }
      }
    }

    if (matchScore > 0) {
      matches.push({
        id: comp.id,
        name: comp.name,
        score: matchScore,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return matches.slice(0, 5);
}

/**
 * Layer 1: Geometry Tree Builder.
 */
export function buildGeometryTree(node, depth = 0) {
  if (!node || node.visible === false) return null;
  const isAutoLayout = 'layoutMode' in node && node.layoutMode !== 'NONE';
  const fills = 'fills' in node ? node.fills : [];
  const hasImageFill = Array.isArray(fills) && fills.some(f => f.type === 'IMAGE' && f.visible !== false);

  const treeNode = {
    id: node.id,
    name: node.name,
    type: node.type,
    x: 'x' in node ? node.x : 0,
    y: 'y' in node ? node.y : 0,
    width: node.width,
    height: node.height,
    isAutoLayout: isAutoLayout,
    layoutMode: isAutoLayout ? node.layoutMode : 'NONE',
    isImage: node.type === 'IMAGE' || hasImageFill,
    children: [],
  };

  if ('children' in node && depth < MAX_DEPTH) {
    const visibleChildren = node.children.filter(c => c.visible !== false);
    for (const child of visibleChildren) {
      const childTree = buildGeometryTree(child, depth + 1);
      if (childTree) {
        treeNode.children.push(childTree);
      }
    }
  }

  return treeNode;
}

/**
 * Layer 3: Page-level Pattern Graph Builder.
 */
export async function buildPatternGraph(rootNode, detections) {
  const rootPatternNode = {
    id: rootNode.id,
    name: rootNode.name,
    type: 'Screen',
    confidence: 1.0,
    bounds: {
      x: 0,
      y: 0,
      width: rootNode.width,
      height: rootNode.height,
    },
    children: [],
  };

  const nodeMap = {};
  nodeMap[rootNode.id] = rootPatternNode;

  // Create pattern nodes for all detections
  detections.forEach(det => {
    nodeMap[det.nodeId] = {
      id: det.nodeId,
      name: det.nodeName,
      type: det.detectedType,
      confidence: det.confidence,
      bounds: det.bounds,
      candidateComponents: det.candidateComponents || [],
      componentMatch: det.componentMatch || null,
      children: [],
    };
  });

  // Link parents
  for (const det of detections) {
    try {
      const node = await figma.getNodeByIdAsync(det.nodeId);
      if (!node) continue;

      let parentNode = null;
      let current = node.parent;
      while (current) {
        if (nodeMap[current.id]) {
          parentNode = nodeMap[current.id];
          break;
        }
        if (current.id === rootNode.id) {
          break;
        }
        current = current.parent;
      }

      if (!parentNode) {
        parentNode = rootPatternNode;
      }

      parentNode.children.push(nodeMap[det.nodeId]);
    } catch (err) {
      logScanError('buildPatternGraph() — figma.getNodeByIdAsync failed for ' + det.nodeId, err);
    }
  }

  return rootPatternNode;
}

/**
 * Analyzes a selected low-fidelity frame and returns detected UI patterns.
 */
export async function analyzeWireframeFrame(rootNode, options) {
  if (!options) {
    options = {};
  }

  logScan('analyzeWireframeFrame() — START', {
    frameId: rootNode.id,
    frameName: rootNode.name,
    rootType: rootNode.type,
  });

  try {
    const parentBounds = {
      x: 0,
      y: 0,
      width: rootNode.width,
      height: rootNode.height,
    };

    const nodeStats = collectNodeStats(rootNode, MAX_DEPTH);
    logScan('Node stats', nodeStats);

    const candidates = collectCandidates(rootNode, MAX_DEPTH);
    // Sort candidates top-down (shallowest first) to enable hierarchical analysis
    candidates.sort((a, b) => a.depth - b.depth);
    logScan('Candidates collected and sorted: ' + candidates.length);

    const detections = [];
    const detectionAttempts = [];
    const claimed = [];
    const detectedNodeTypes = {};

    // Layer 1: Geometry Tree
    const geometryTree = buildGeometryTree(rootNode);

    // Layer 2: Universal Pattern Detection
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const node = candidate.node;
      const candidateDepth = candidate.depth;

      const bounds =
        'absoluteBoundingBox' in node && node.absoluteBoundingBox
          ? {
              x: node.absoluteBoundingBox.x,
              y: node.absoluteBoundingBox.y,
              width: node.absoluteBoundingBox.width,
              height: node.absoluteBoundingBox.height,
            }
          : null;

      // Check if it resides inside an already claimed high-confidence parent container pattern
      let isNestedSectionChild = false;
      const CONTAINER_PATTERN_TYPES = new Set([
        'Form Section', 'Hero Section', 'Card Grid Section', 'Footer Section', 
        'Header Section', 'Image Grid Section', 'Navigation', 'Header', 
        'Carousel Section', 'Carousel', 'Feature List Section', 
        'Course Listing Section', 'Hero Carousel',
        'Card', 'Course Card', 'Content Card', 'Form', 'Form Group', 'Table', 'Card Grid',
        'Body Container'
      ]);
      for (const c of claimed) {
        if (c.confidence >= 0.5 && CONTAINER_PATTERN_TYPES.has(c.detectedType)) {
          const b = c.bounds;
          if (b && bounds) {
            const TOLERANCE = 2;
            if (bounds.x >= b.x - TOLERANCE &&
                bounds.y >= b.y - TOLERANCE &&
                bounds.x + bounds.width <= b.x + b.width + TOLERANCE &&
                bounds.y + bounds.height <= b.y + b.height + TOLERANCE &&
                c.nodeId !== node.id) {
              isNestedSectionChild = true;
              break;
            }
          }
        }
      }

      const isNested = isInsideClaimedParent(node, claimed);

      const features = extractFeatures(node, parentBounds, candidateDepth, detectedNodeTypes, detectPatternWithDebug);
      const debug = detectPatternWithDebug(features);

      if (debug.displayed && debug.detectedType) {
        detectedNodeTypes[node.id] = debug.detectedType;
      }

      const attemptEntry = {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        composition: debug.composition,
        displayed: debug.displayed,
        accepted: debug.accepted,
        skipped: false,
        isNested: isNested,
        detectedType: debug.detectedType,
        confidence: debug.confidence,
        confidenceLevel: debug.confidenceLevel,
        confidenceLevelId: debug.confidenceLevelId,
        displayMinConfidence: debug.displayMinConfidence,
        topMatch: debug.topMatch,
        secondMatch: debug.secondMatch,
        confidenceGap: debug.confidenceGap,
        explanation: debug.explanation,
        rejectedCategories: debug.rejectedCategories,
        allScores: debug.allScores,
        rejectionReason: debug.rejectionReason,
        textSemantics: debug.textSemantics || null,
        placeholderCount: debug.placeholderCount || 0,
        meaningfulCount: debug.meaningfulCount || 0,
        placeholderTypes: debug.placeholderTypes || [],
      };

      detectionAttempts.push(attemptEntry);

      if (!debug.displayed) {
        continue;
      }

      // Find matching design system component candidates
      const candidateComponents = findCandidateComponents(debug.detectedType);

      // Perform Phase 3 Design System Component Matching
      const componentMatch = matchPatternToComponent({
        detectedType: debug.detectedType,
        nodeName: node.name,
        bounds: bounds,
      }, designSystemStore.getDatabase());

      // Attempt token match if no component match or for typography style types
      let tokenMatch = null;
      const typographyTypes = ['Heading', 'Body Text', 'Paragraph', 'Description', 'Label', 'Text Block'];
      
      if (componentMatch.bestMatch === 'No suitable match found' || 
          typographyTypes.indexOf(debug.detectedType) !== -1 ||
          debug.detectedType === 'Image Block' ||
          debug.detectedType === 'PlaceholderContent') {
        tokenMatch = matchNodeToTokens(node, designSystemStore.getDatabase());
        if (tokenMatch) {
          // If no component match, let's set the token as the bestMatch
          if (componentMatch.bestMatch === 'No suitable match found') {
            const topToken = tokenMatch.typography || tokenMatch.background || tokenMatch.color || tokenMatch.spacing || tokenMatch.radius || tokenMatch.elevation;
            if (topToken) {
              componentMatch.bestMatch = 'Token: ' + topToken.name;
              componentMatch.confidence = 85;
            }
          }
        }
      }

      // Format Component and Token matches for diagnostics
      if (componentMatch.bestMatch && componentMatch.bestMatch !== 'No suitable match found') {
        debug.explanation.push({
          label: 'Component Matches: ' + componentMatch.bestMatch,
          passed: true,
          weight: 0,
          type: 'info'
        });
      }
      if (tokenMatch) {
        const tokenLines = [];
        if (tokenMatch.typography) tokenLines.push(tokenMatch.typography.name);
        if (tokenMatch.color) tokenLines.push(tokenMatch.color.name);
        if (tokenMatch.background) tokenLines.push(tokenMatch.background.name);
        if (tokenMatch.spacing) tokenLines.push(tokenMatch.spacing.name);
        if (tokenMatch.radius) tokenLines.push(tokenMatch.radius.name);
        if (tokenMatch.elevation) tokenLines.push(tokenMatch.elevation.name);
        
        if (tokenLines.length > 0) {
          debug.explanation.push({
            label: 'Token Matches: ' + tokenLines.join(', '),
            passed: true,
            weight: 0,
            type: 'info'
          });
        }
      }

      const entry = {
        nodeId: node.id,
        nodeName: node.name,
        detectedType: debug.detectedType,
        confidence: debug.confidence,
        confidenceLevel: debug.confidenceLevel,
        confidenceLevelId: debug.confidenceLevelId,
        suggestedCategory: suggestDesignSystemCategory(debug.detectedType),
        candidateComponents: candidateComponents,
        componentMatch: componentMatch,
        tokenMatch: tokenMatch,
        bounds: bounds,
        composition: debug.composition,
        topMatch: debug.topMatch,
        secondMatch: debug.secondMatch,
        confidenceGap: debug.confidenceGap,
        explanation: debug.explanation,
        rejectedCategories: debug.rejectedCategories,
        textSemantics: debug.textSemantics || null,
        placeholderCount: debug.placeholderCount || 0,
        meaningfulCount: debug.meaningfulCount || 0,
        placeholderTypes: debug.placeholderTypes || [],
        isNestedSectionChild: isNestedSectionChild,
      };

      detections.push(entry);
      claimed.push({
        nodeId: node.id,
        confidence: debug.confidence,
        bounds: bounds,
        detectedType: debug.detectedType,
      });
    }

    detections.sort(function (a, b) {
      return b.confidence - a.confidence;
    });

    // Layer 3: Page-level Pattern Graph
    const patternGraph = await buildPatternGraph(rootNode, detections);

    const isDesignSystemComponent =
      rootNode.type === 'COMPONENT' || rootNode.type === 'INSTANCE';

    const debugInfo = {
      totalNodesScanned: nodeStats.totalNodesScanned,
      candidatesEvaluated: candidates.length,
      nodeTypeCounts: nodeStats.nodeTypeCounts,
      nodeTypesSummary: nodeStats.nodeTypesSummary,
      detectionAttempts: detectionAttempts,
      displayMinConfidence: DISPLAY_MIN_CONFIDENCE,
      confidenceTiers:
        'High 70%+ · Medium 50–69% · Low 30–49% · Very Low below 30% (hidden)',
      evaluatorNote:
        'Pattern detection runs on Frame, Group, Section, Component, and Instance containers ≥16px. Top match shown when confidence ≥30%. Sorted by confidence descending.',
      designSystemWarning: isDesignSystemComponent
        ? DESIGN_SYSTEM_WARNING
        : options.designSystemWarning || null,
    };

    const patternSummary = buildPatternSummary(detections);

    const result = {
      frameId: rootNode.id,
      frameName: rootNode.name,
      frameType: rootNode.type,
      analyzedAt: new Date().toISOString(),
      geometryTree: geometryTree,
      patternGraph: patternGraph,
      patterns: detections.filter(d => !d.isNestedSectionChild),
      patternSummary: patternSummary,
      debug: debugInfo,
    };

    logScan('analyzeWireframeFrame() — FINISH', {
      patternCount: detections.length,
      totalNodesScanned: debugInfo.totalNodesScanned,
      attempts: detectionAttempts.length,
    });

    return result;
  } catch (error) {
    logScanError('analyzeWireframeFrame()', error);
    throw error;
  }
}
