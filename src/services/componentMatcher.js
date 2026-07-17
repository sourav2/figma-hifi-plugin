import { PATTERN_DS_KEYWORDS, PATTERN_DEFAULT_CATEGORY } from '../analyzer/patterns.js';

/**
 * Calculates and returns the best matching Design System component for a detected wireframe pattern.
 * Uses a weighted multi-signal scoring algorithm (keywords, dimensions, names, descriptions).
 * 
 * @param {object} pattern 
 * @param {object} database 
 * @returns {{ bestMatch: string, confidence: number, alternatives: string[] }}
 */
export function matchPatternToComponent(pattern, database) {
  if (!database || !database.components || database.components.length === 0) {
    return {
      bestMatch: null,
      confidence: 0,
      alternatives: [],
    };
  }

  const results = [];
  const detectedType = pattern.detectedType;
  const bounds = pattern.bounds;
  const nodeNameLower = (pattern.nodeName || '').toLowerCase();
  const keywords = PATTERN_DS_KEYWORDS[detectedType] || [];

  for (const comp of database.components) {
    const compNameLower = (comp.name || '').toLowerCase();
    const compSetLower = comp.parentComponentSet ? comp.parentComponentSet.name.toLowerCase() : '';
    const compDescLower = (comp.description || '').toLowerCase();

    // 1. Keyword overlap (Pattern Type matching) - 45% weight
    let keywordMatch = 0;
    for (const kw of keywords) {
      if (compNameLower.indexOf(kw.toLowerCase()) !== -1 || compSetLower.indexOf(kw.toLowerCase()) !== -1) {
        keywordMatch += 1;
        if (compNameLower === kw.toLowerCase() || compSetLower === kw.toLowerCase()) {
          keywordMatch += 2; // Extra weight for exact matches
        }
      }
    }
    
    // Fallback category matching if no explicit keywords are found
    if (keywordMatch === 0) {
      const defaultCategoryLower = (PATTERN_DEFAULT_CATEGORY[detectedType] || '').toLowerCase();
      const parts = defaultCategoryLower.split(/[^a-z0-9]+/i);
      for (const part of parts) {
        if (part.length > 2 && (compNameLower.indexOf(part) !== -1 || compSetLower.indexOf(part) !== -1)) {
          keywordMatch = 0.5;
        }
      }
    }

    const keywordScore = Math.min(1, keywordMatch / 3);

    // 2. Dimension and Aspect Ratio Similarity - 35% weight
    let dimensionScore = 0;
    if (bounds && bounds.width > 0 && bounds.height > 0 && comp.width > 0 && comp.height > 0) {
      const widthRatio = Math.min(comp.width, bounds.width) / Math.max(comp.width, bounds.width);
      const heightRatio = Math.min(comp.height, bounds.height) / Math.max(comp.height, bounds.height);
      const sizeScore = (widthRatio + heightRatio) / 2;

      const compAspect = comp.width / comp.height;
      const wireAspect = bounds.width / bounds.height;
      const aspectRatioMatch = Math.min(compAspect, wireAspect) / Math.max(compAspect, wireAspect);

      dimensionScore = (sizeScore * 0.6) + (aspectRatioMatch * 0.4);
    }

    // 3. Name overlaps (semantic similarity) - 15% weight
    let nameOverlapScore = 0;
    const wireframeWords = nodeNameLower.split(/[^a-z0-9]+/i).filter(w => w.length > 2);
    if (wireframeWords.length > 0) {
      let wordMatches = 0;
      for (const word of wireframeWords) {
        if (compNameLower.indexOf(word) !== -1 || compSetLower.indexOf(word) !== -1) {
          wordMatches += 1;
        }
      }
      nameOverlapScore = wordMatches / wireframeWords.length;
    }

    // 4. Description match - 5% weight
    let descriptionScore = 0;
    if (compDescLower && keywords.length > 0) {
      let descKeywords = 0;
      for (const kw of keywords) {
        if (compDescLower.indexOf(kw.toLowerCase()) !== -1) {
          descKeywords += 1;
        }
      }
      descriptionScore = Math.min(1, descKeywords / keywords.length);
    }

    // Weighted combination
    let totalScore = 0;
    if (keywordScore === 0) {
      // If there is absolutely no keyword match, penalize heavily to prevent mismatching types (e.g. Button matching Input Field)
      totalScore = (dimensionScore * 0.05) + (nameOverlapScore * 0.05);
    } else {
      totalScore = (keywordScore * 0.45) + (dimensionScore * 0.35) + (nameOverlapScore * 0.15) + (descriptionScore * 0.05);
    }

    // Variant property boost (up to 5% extra)
    if (comp.variantProperties) {
      let variantMatchCount = 0;
      const keys = Object.keys(comp.variantProperties);
      for (const key of keys) {
        const val = String(comp.variantProperties[key]).toLowerCase();
        if (nodeNameLower.indexOf(val) !== -1 && val !== 'default') {
          variantMatchCount += 1;
        }
      }
      if (keys.length > 0) {
        totalScore += (variantMatchCount / keys.length) * 0.05;
      }
    }

    results.push({
      name: comp.name,
      score: Math.min(1, Math.max(0, totalScore)),
    });
  }

  // Sort candidates by score descending
  results.sort((a, b) => b.score - a.score);

  const top = results[0];
  // Filter out extremely low-confidence matches as "no match found"
  const confidence = top ? Math.round(top.score * 100) : 0;
  const bestMatch = top && top.score > 0.15 ? top.name : 'No suitable match found';
  
  // Extract top alternatives
  const alternatives = results
    .slice(1, 4)
    .filter(r => r.score > 0.1)
    .map(r => r.name);

  return {
    bestMatch: bestMatch,
    confidence: bestMatch === 'No suitable match found' ? 0 : confidence,
    alternatives: alternatives,
  };
}
