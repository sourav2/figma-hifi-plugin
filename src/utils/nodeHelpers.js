/**
 * Helpers for inspecting Figma nodes during wireframe analysis.
 */

const CONTAINER_TYPES = new Set([
  'FRAME',
  'GROUP',
  'COMPONENT',
  'INSTANCE',
  'SECTION',
]);

const SHAPE_TYPES = new Set([
  'RECTANGLE',
  'ELLIPSE',
  'POLYGON',
  'STAR',
  'VECTOR',
  'LINE',
]);

const PLACEHOLDER_REGEX = /placeholder|enter |search|email|password|username|type here/i;

const NAV_WORDS = ['home', 'about', 'contact', 'courses', 'pricing', 'blog', 'login', 'features', 'services', 'product', 'sign in', 'sign up', 'dashboard', 'faq', 'support', 'careers'];
const CTA_WORDS = ['buy', 'get started', 'subscribe', 'join', 'try now', 'learn more', 'order', 'download', 'checkout', 'submit', 'apply', 'send', 'register'];

function findMatchingKeywords(text, keywords) {
  const matches = [];
  const normalized = text.toLowerCase().trim();
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    if (normalized === kw) {
      matches.push(kw);
    } else if (normalized.indexOf(kw) !== -1) {
      const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp('\\b' + escaped + '\\b', 'i');
      if (regex.test(normalized)) {
        matches.push(kw);
      }
    }
  }
  return matches;
}

function detectAdjacentAvatarOrIcon(node) {
  if (!('children' in node)) {
    return false;
  }
  const children = getVisibleChildren(node);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const name = (child.name || '').toLowerCase();
    if (/avatar|profile|menu|icon|hamburger|user|nav/i.test(name)) {
      return true;
    }
    if (child.type === 'ELLIPSE' && child.width >= 16 && child.width <= 60 && Math.abs(child.width - child.height) < 5) {
      return true;
    }
    if (child.type === 'VECTOR' && child.width <= 48 && child.height <= 48) {
      return true;
    }
    if (CONTAINER_TYPES.has(child.type)) {
      const grandChildren = getVisibleChildren(child);
      for (let j = 0; j < grandChildren.length; j++) {
        const gc = grandChildren[j];
        const gcName = (gc.name || '').toLowerCase();
        if (/avatar|profile|menu|icon|hamburger|user/i.test(gcName)) {
          return true;
        }
        if (gc.type === 'ELLIPSE' && gc.width >= 16 && gc.width <= 60 && Math.abs(gc.width - gc.height) < 5) {
          return true;
        }
        if (gc.type === 'VECTOR' && gc.width <= 48 && gc.height <= 48) {
          return true;
        }
      }
    }
  }
  return false;
}

const LOREM_IPSUM_REGEX = /lorem|ipsum|dolor|sit|amet|consectetur|adipiscing|elit|placeholder|skeleton|shimmer|loading|^[\s\-._]*$/i;

function hasGrayFill(node) {
  if (!('fills' in node) || node.fills === figma.mixed || !Array.isArray(node.fills)) {
    return false;
  }
  for (let i = 0; i < node.fills.length; i++) {
    const fill = node.fills[i];
    if (fill.type === 'SOLID' && fill.visible !== false) {
      const color = fill.color;
      const diff1 = Math.abs(color.r - color.g);
      const diff2 = Math.abs(color.g - color.b);
      const diff3 = Math.abs(color.r - color.b);
      const avg = (color.r + color.g + color.b) / 3;
      if (diff1 < 0.05 && diff2 < 0.05 && diff3 < 0.05 && avg > 0.5 && avg < 0.98) {
        return true;
      }
    }
  }
  return false;
}

function hasCrossedLines(node) {
  if (!('children' in node)) {
    return false;
  }
  const children = getVisibleChildren(node);
  let lineCount = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === 'LINE' || child.type === 'VECTOR') {
      lineCount++;
    }
    if (/(cross|line|vector|x)/i.test(child.name || '')) {
      return true;
    }
  }
  return lineCount >= 2;
}

function checkNodeIsPlaceholder(node) {
  const name = (node.name || '').toLowerCase();
  
  if (node.type === 'LINE') {
    return 'Decorative Line';
  }
  if ((node.type === 'RECTANGLE' || node.type === 'VECTOR') && (node.height <= 2 || node.width <= 2)) {
    return 'Decorative Line';
  }
  
  if (node.type === 'TEXT') {
    const chars = (node.characters || '').trim();
    if (LOREM_IPSUM_REGEX.test(chars) || chars.length <= 1) {
      return 'Text Placeholder';
    }
  }
  if (node.type === 'RECTANGLE' && node.height >= 4 && node.height <= 18 && node.width >= 40) {
    const isGray = hasGrayFill(node);
    if (isGray || /placeholder|text|line|bar|skeleton/i.test(name)) {
      return 'Text Placeholder';
    }
  }
  
  if (/image|img|photo|pic/i.test(name) && /placeholder|empty|crossed|temp/i.test(name)) {
    return 'Image Placeholder';
  }
  if (node.type === 'RECTANGLE' && node.width >= 40 && node.height >= 40) {
    if (/placeholder|temp|empty|avatar-holder/i.test(name)) {
      return 'Image Placeholder';
    }
    if (hasCrossedLines(node) || name === 'x' || name.indexOf('crossed') !== -1) {
      return 'Image Placeholder';
    }
  }
  
  if (/skeleton|shimmer|loading/i.test(name)) {
    return 'Skeleton Placeholder';
  }
  if ((node.type === 'RECTANGLE' || node.type === 'FRAME' || node.type === 'GROUP') && hasGrayFill(node)) {
    if (/skeleton|shimmer|loading|block|holder/i.test(name)) {
      return 'Skeleton Placeholder';
    }
  }
  
  return null;
}

function checkNodeIsMeaningful(node) {
  if (node.type === 'TEXT') {
    const chars = (node.characters || '').trim();
    if (chars.length >= 2 && !LOREM_IPSUM_REGEX.test(chars)) {
      return 'Meaningful Text';
    }
  }
  if ('fills' in node && node.fills !== figma.mixed && Array.isArray(node.fills)) {
    for (let i = 0; i < node.fills.length; i++) {
      const fill = node.fills[i];
      if (fill.type === 'IMAGE' && fill.visible !== false) {
        return 'Meaningful Image';
      }
    }
  }
  if ((node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'COMPONENT') && node.width >= 60 && node.height >= 24) {
    const name = (node.name || '').toLowerCase();
    if (/button|btn|cta|submit|apply/i.test(name)) {
      return 'Meaningful Button';
    }
  }
  return null;
}

export function detectPlaceholders(node) {
  const placeholders = [];
  const meaningful = [];
  
  function traverse(currentNode, depth) {
    if (depth > 4 || !currentNode) return;
    
    const isPlaceholder = checkNodeIsPlaceholder(currentNode);
    if (isPlaceholder) {
      placeholders.push(isPlaceholder);
    } else {
      const isMeaningful = checkNodeIsMeaningful(currentNode);
      if (isMeaningful) {
        meaningful.push(isMeaningful);
      }
    }
    
    if ('children' in currentNode) {
      const children = getVisibleChildren(currentNode);
      for (let i = 0; i < children.length; i++) {
        traverse(children[i], depth + 1);
      }
    }
  }
  
  traverse(node, 0);
  
  return {
    placeholders: placeholders,
    meaningful: meaningful,
  };
}

/**
 * Whether the node is a layout container we can classify.
 */
export function isContainer(node) {
  return CONTAINER_TYPES.has(node.type);
}

/**
 * Direct visible children (SceneNodes only).
 */
export function getVisibleChildren(node) {
  if (!('children' in node)) {
    return [];
  }
  return node.children.filter(function (child) {
    return child.visible !== false;
  });
}

/**
 * Collects text nodes in subtree (max depth).
 */
export function collectTextNodes(node, maxDepth, depth) {
  if (maxDepth === undefined) {
    maxDepth = 4;
  }
  if (depth === undefined) {
    depth = 0;
  }
  const results = [];
  if (node.type === 'TEXT') {
    results.push(node);
    return results;
  }
  if (depth >= maxDepth || !('children' in node)) {
    return results;
  }
  for (const child of getVisibleChildren(node)) {
    results.push.apply(results, collectTextNodes(child, maxDepth, depth + 1));
  }
  return results;
}

/**
 * Whether subtree contains an image fill or likely image layer.
 */
export function hasImageInSubtree(node, maxDepth, depth) {
  if (maxDepth === undefined) {
    maxDepth = 3;
  }
  if (depth === undefined) {
    depth = 0;
  }
  if ('fills' in node && node.fills !== figma.mixed) {
    const fills = node.fills;
    for (let i = 0; i < fills.length; i++) {
      if (fills[i].type === 'IMAGE' && fills[i].visible !== false) {
        return true;
      }
    }
  }
  if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') {
    if ('fills' in node && node.fills !== figma.mixed) {
      for (let j = 0; j < node.fills.length; j++) {
        if (node.fills[j].type === 'IMAGE') {
          return true;
        }
      }
    }
  }
  if (depth >= maxDepth || !('children' in node)) {
    return false;
  }
  for (const child of getVisibleChildren(node)) {
    if (hasImageInSubtree(child, maxDepth, depth + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Large rectangle in subtree (image placeholder).
 */
function hasImagePlaceholder(node, maxDepth, depth) {
  if (maxDepth === undefined) {
    maxDepth = 2;
  }
  if (depth === undefined) {
    depth = 0;
  }
  if (node.type === 'RECTANGLE' && node.width >= 40 && node.height >= 40) {
    return true;
  }
  if (hasImageInSubtree(node, 1, 0)) {
    return true;
  }
  if (depth >= maxDepth || !('children' in node)) {
    return false;
  }
  for (const child of getVisibleChildren(node)) {
    if (hasImagePlaceholder(child, maxDepth, depth + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Counts shape-like layers in subtree.
 */
export function countShapes(node, maxDepth, depth) {
  if (maxDepth === undefined) {
    maxDepth = 2;
  }
  if (depth === undefined) {
    depth = 0;
  }
  let count = 0;
  if (SHAPE_TYPES.has(node.type)) {
    count += 1;
  }
  if (depth >= maxDepth || !('children' in node)) {
    return count;
  }
  for (const child of getVisibleChildren(node)) {
    count += countShapes(child, maxDepth, depth + 1);
  }
  return count;
}

/**
 * Auto-layout info if present.
 */
export function getAutoLayout(node) {
  if (!('layoutMode' in node)) {
    return null;
  }
  if (node.layoutMode === 'NONE') {
    return null;
  }
  return {
    mode: node.layoutMode,
    childCount: 'children' in node ? getVisibleChildren(node).length : 0,
  };
}

/**
 * Approximate largest text font size in subtree.
 */
export function getMaxFontSize(node) {
  const texts = collectTextNodes(node, 4);
  let max = 0;
  for (const t of texts) {
    if (t.fontSize !== figma.mixed && typeof t.fontSize === 'number') {
      if (t.fontSize > max) {
        max = t.fontSize;
      }
    }
  }
  return max;
}

/**
 * Whether text appears centered in the container.
 */
function isTextLikelyCentered(node) {
  if ('counterAxisAlignItems' in node && node.counterAxisAlignItems === 'CENTER') {
    return true;
  }
  if ('primaryAxisAlignItems' in node && node.primaryAxisAlignItems === 'CENTER') {
    return true;
  }

  const texts = collectTextNodes(node, 2);
  if (
    texts.length === 1 &&
    'absoluteBoundingBox' in texts[0] &&
    texts[0].absoluteBoundingBox &&
    'absoluteBoundingBox' in node &&
    node.absoluteBoundingBox
  ) {
    const t = texts[0].absoluteBoundingBox;
    const n = node.absoluteBoundingBox;
    const tcx = t.x + t.width / 2;
    const ncx = n.x + n.width / 2;
    const tcy = t.y + t.height / 2;
    const ncy = n.y + n.height / 2;
    return (
      Math.abs(tcx - ncx) < n.width * 0.2 &&
      Math.abs(tcy - ncy) < n.height * 0.25
    );
  }
  return false;
}

/**
 * Large image block or placeholder (≥40% width and ≥20% height of parent).
 */
function hasLargeImageArea(node) {
  if (!('children' in node)) {
    return false;
  }

  const parentW = node.width;
  const parentH = node.height;
  if (parentW <= 0 || parentH <= 0) {
    return false;
  }

  const children = getVisibleChildren(node);
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.type === 'RECTANGLE' || child.type === 'ELLIPSE') {
      if (
        child.width >= parentW * 0.4 &&
        child.height >= parentH * 0.2
      ) {
        return true;
      }
      if ('fills' in child && child.fills !== figma.mixed) {
        for (let j = 0; j < child.fills.length; j++) {
          if (
            child.fills[j].type === 'IMAGE' &&
            child.width >= parentW * 0.35
          ) {
            return true;
          }
        }
      }
    }
  }

  return hasImageInSubtree(node, 2) && parentH >= 100;
}

/**
 * Detects a small button-like child (CTA) inside a card-like container.
 */
function hasCtaButtonChild(node) {
  if (!('children' in node)) {
    return false;
  }
  const children = getVisibleChildren(node);
  for (let i = 0; i < children.length; i++) {
    const c = children[i];
    if (!isContainer(c) && c.type !== 'RECTANGLE') {
      continue;
    }
    if (
      c.width >= 60 &&
      c.width <= 200 &&
      c.height >= 28 &&
      c.height <= 52
    ) {
      const t = collectTextNodes(c, 2);
      if (t.length >= 1) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Node name hint score 0–1 for a keyword list.
 */
export function nameHintScore(node, keywords) {
  const name = (node.name || '').toLowerCase();
  for (let i = 0; i < keywords.length; i++) {
    if (name.indexOf(keywords[i]) !== -1) {
      return 0.12;
    }
  }
  return 0;
}

/**
 * Aspect ratio width/height.
 */
export function aspectRatio(node) {
  if (!node.height) {
    return 1;
  }
  return node.width / node.height;
}

/**
 * Feature snapshot used by pattern detectors.
 */
export function extractFeatures(node, parentBounds, candidateDepth, detectedNodeTypes, detectFn) {
  if (candidateDepth === undefined) {
    candidateDepth = 1;
  }
  const children = isContainer(node) ? getVisibleChildren(node) : [];
  const textNodes = collectTextNodes(node, 4);
  const layout = getAutoLayout(node);

  const childButtons = [];
  const childInputs = [];
  const childCards = [];
  const childImages = [];
  const childTexts = [];
  const childPlaceholders = [];
  const childLinks = [];
  const childAvatars = [];
  const childMenus = [];
  const childNavigations = [];
  const childCourseCards = [];
  const childContentCards = [];
  const childCategorySelectors = [];
  const childFilterGroups = [];
  const childHeroCarousels = [];

  if (detectedNodeTypes) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      let childType = detectedNodeTypes[child.id];
      
      if (!childType && detectFn) {
        const childFeatures = extractFeatures(child, parentBounds, candidateDepth + 1, detectedNodeTypes, detectFn);
        const childDebug = detectFn(childFeatures);
        if (childDebug && childDebug.displayed && childDebug.detectedType) {
          childType = childDebug.detectedType;
          detectedNodeTypes[child.id] = childType;
        }
      }
      
      // Fallback for leaf nodes or unclassified child containers
      if (!childType) {
        if (child.type === 'TEXT') {
          const isPlaceholder = checkNodeIsPlaceholder(child);
          childType = isPlaceholder ? 'PlaceholderContent' : 'Text Block';
        } else if (child.type === 'RECTANGLE' || child.type === 'ELLIPSE') {
          const isPlaceholder = checkNodeIsPlaceholder(child);
          if (isPlaceholder) {
            childType = 'PlaceholderContent';
          } else if (hasImageInSubtree(child, 1, 0)) {
            childType = 'Image Block';
          } else if (child.width >= 16 && child.width <= 60 && Math.abs(child.width - child.height) < 5) {
            childType = 'Avatar';
          }
        }
      }

      if (childType === 'Button' || childType === 'CTA Group' || childType === 'CTA Section') {
        childButtons.push(child);
      } else if (childType === 'Input Field' || childType === 'Form Group' || childType === 'Search Bar' || childType === 'Dropdown') {
        childInputs.push(child);
      } else if (childType === 'Card' || childType === 'Course Card' || childType === 'Content Card') {
        childCards.push(child);
        if (childType === 'Course Card') childCourseCards.push(child);
        if (childType === 'Content Card') childContentCards.push(child);
      } else if (childType === 'Image Block') {
        childImages.push(child);
      } else if (childType === 'Text Block' || childType === 'Content Block') {
        childTexts.push(child);
      } else if (childType === 'PlaceholderContent') {
        childPlaceholders.push(child);
      } else if (childType === 'Link Group' || childType === 'Navigation Links' || childType === 'Footer Links') {
        childLinks.push(child);
      } else if (childType === 'Avatar') {
        childAvatars.push(child);
      } else if (childType === 'Dropdown' || childType === 'Tabs' || childType === 'Category Selector' || childType === 'Filter Group') {
        childMenus.push(child);
        if (childType === 'Category Selector') childCategorySelectors.push(child);
        if (childType === 'Filter Group') childFilterGroups.push(child);
      } else if (childType === 'Navigation' || childType === 'Header' || childType === 'Sidebar' || childType === 'Header Section' || childType === 'Hero Carousel' || childType === 'Carousel Section' || childType === 'Carousel') {
        childNavigations.push(child);
        if (childType === 'Hero Carousel') childHeroCarousels.push(child);
      }
    }
  }

  const fontSizes = [];
  const textLengths = [];
  let hasPlaceholderText = false;
  let navKeywordsDetected = [];
  let ctaKeywordsDetected = [];
  let shortTextLabelCount = 0;
  let meaningfulShortTextCount = 0;

  const texts = textNodes.map(function (t) {
    const fs = t.fontSize !== figma.mixed ? t.fontSize : 14;
    fontSizes.push(fs);
    const chars = t.characters || '';
    const len = chars.length;
    textLengths.push(len);
    if (PLACEHOLDER_REGEX.test(chars)) {
      hasPlaceholderText = true;
    }

    const navMatches = findMatchingKeywords(chars, NAV_WORDS);
    const ctaMatches = findMatchingKeywords(chars, CTA_WORDS);
    navKeywordsDetected = navKeywordsDetected.concat(navMatches);
    ctaKeywordsDetected = ctaKeywordsDetected.concat(ctaMatches);

    if (len >= 2 && len <= 24) {
      shortTextLabelCount++;
      if (!LOREM_IPSUM_REGEX.test(chars)) {
        meaningfulShortTextCount++;
      }
    }

    return {
      characters: chars,
      fontSize: fs,
      length: len,
    };
  });

  const navKeywordsList = navKeywordsDetected.filter(function (item, pos, self) {
    return self.indexOf(item) === pos;
  });
  const ctaKeywordsList = ctaKeywordsDetected.filter(function (item, pos, self) {
    return self.indexOf(item) === pos;
  });

  fontSizes.sort(function (a, b) {
    return b - a;
  });

  const maxFont = fontSizes.length > 0 ? fontSizes[0] : 0;
  const minFont =
    fontSizes.length > 0 ? fontSizes[fontSizes.length - 1] : 0;
  const maxTextLen =
    textLengths.length > 0
      ? Math.max.apply(null, textLengths)
      : 0;

  let relativeWidth = 1;
  let relativeY = 0;
  if (parentBounds && parentBounds.width > 0) {
    relativeWidth = node.width / parentBounds.width;
  }
  if (parentBounds && parentBounds.height > 0 && 'y' in node) {
    relativeY = node.y / parentBounds.height;
  }

  const avgTextLength = textNodes.length > 0 ? Math.round((textLengths.reduce(function (a, b) { return a + b; }, 0) / textNodes.length) * 10) / 10 : 0;

  const placeholderAnalysis = detectPlaceholders(node);
  const pTypes = placeholderAnalysis.placeholders.filter(function (item, pos, self) {
    return self.indexOf(item) === pos;
  });

  let contentScore = 0;
  if (textNodes.length > 0) {
    contentScore += 0.3;
    if (avgTextLength >= 5) contentScore += 0.1;
    if (meaningfulShortTextCount >= 1) contentScore += 0.1;
  }
  if (hasImageInSubtree(node, 3)) {
    contentScore += 0.2;
  }
  if (hasCtaButtonChild(node) || ctaKeywordsList.length > 0) {
    contentScore += 0.3;
  }
  contentScore = Math.min(1, contentScore);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    width: node.width,
    height: node.height,
    y: 'y' in node ? node.y : 0,
    aspectRatio: aspectRatio(node),
    relativeWidth: relativeWidth,
    relativeY: relativeY,
    childCount: children.length,
    textCount: textNodes.length,
    texts: texts,
    maxFontSize: maxFont,
    minFontSize: minFont,
    maxTextLength: maxTextLen,
    hasHeading: maxFont >= 16 && textNodes.length >= 1,
    hasDescription: textNodes.length >= 2 && maxFont > minFont + 2,
    hasImage: hasImageInSubtree(node, 3),
    hasImagePlaceholder: hasImagePlaceholder(node, 2),
    hasLargeImageArea: hasLargeImageArea(node),
    hasCtaButton: hasCtaButtonChild(node) || childButtons.length > 0,
    candidateDepth: candidateDepth,
    isNestedGroup: node.type === 'GROUP' && candidateDepth > 1,
    hasPlaceholderText: hasPlaceholderText,
    shapeCount: countShapes(node, 2),
    hasRectangle: countShapes(node, 2) >= 1,
    layout: layout,
    isAutoLayout: layout !== null,
    isHorizontal: layout && layout.mode === 'HORIZONTAL',
    isVertical: layout && layout.mode === 'VERTICAL',
    isCenterAligned: isTextLikelyCentered(node),
    cornerRadius: 'cornerRadius' in node ? node.cornerRadius : 0,
    hasEffects:
      'effects' in node &&
      node.effects &&
      node.effects.length > 0,
    isNearTop: relativeY < 0.22,
    isShortLabel: maxTextLen > 0 && maxTextLen <= 24,
    shortTextLabelCount: shortTextLabelCount,
    meaningfulShortTextCount: meaningfulShortTextCount,
    hasAdjacentAvatarOrIcon: detectAdjacentAvatarOrIcon(node),
    placeholderCount: placeholderAnalysis.placeholders.length,
    meaningfulCount: placeholderAnalysis.meaningful.length,
    placeholderTypes: pTypes,
    contentScore: contentScore,
    childButtonsCount: childButtons.length,
    childInputsCount: childInputs.length,
    childCardsCount: childCards.length,
    childImagesCount: childImages.length,
    childTextsCount: childTexts.length,
    childPlaceholdersCount: childPlaceholders.length,
    childLinksCount: childLinks.length,
    childAvatarsCount: childAvatars.length,
    childMenusCount: childMenus.length,
    childNavigationsCount: childNavigations.length,
    childCourseCardsCount: childCourseCards.length,
    childContentCardsCount: childContentCards.length,
    childCategorySelectorsCount: childCategorySelectors.length,
    childFilterGroupsCount: childFilterGroups.length,
    childHeroCarouselsCount: childHeroCarousels.length,
    textSemantics: {
      textNodesCount: textNodes.length,
      avgTextLength: avgTextLength,
      navKeywordsDetected: navKeywordsList,
      ctaKeywordsDetected: ctaKeywordsList,
      navKeywordCount: navKeywordsList.length,
      ctaKeywordCount: ctaKeywordsList.length,
    },
  };
}
