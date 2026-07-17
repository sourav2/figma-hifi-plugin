import * as designSystemStore from './designSystemStore.js';
import {
  PATTERN_DS_KEYWORDS,
  PATTERN_DEFAULT_CATEGORY,
} from '../analyzer/patterns.js';

/**
 * Finds the best matching design system component name for a detected pattern.
 */
function findMatchingComponent(detectedType) {
  const database = designSystemStore.getDatabase();
  if (!database || !database.components) {
    return null;
  }

  const keywords = PATTERN_DS_KEYWORDS[detectedType] || [];
  let best = null;
  let bestScore = 0;

  for (let i = 0; i < database.components.length; i++) {
    const comp = database.components[i];
    const name = (comp.name || '').toLowerCase();
    let score = 0;

    for (let k = 0; k < keywords.length; k++) {
      if (name.indexOf(keywords[k]) !== -1) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = comp.name;
    }
  }

  return bestScore > 0 ? best : null;
}

/**
 * Suggests a design system category using designSystemStore inventory.
 */
export function suggestDesignSystemCategory(detectedType) {
  const matchedComponent = findMatchingComponent(detectedType);

  if (matchedComponent) {
    return 'Component: ' + matchedComponent;
  }

  if (!designSystemStore.hasDatabase()) {
    return (
      (PATTERN_DEFAULT_CATEGORY[detectedType] || detectedType) +
      ' (scan design system for matches)'
    );
  }

  return PATTERN_DEFAULT_CATEGORY[detectedType] || detectedType;
}
