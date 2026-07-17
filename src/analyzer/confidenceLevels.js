/**
 * Confidence tiers for wireframe pattern classification.
 */

/** Minimum top-match score to show in results (30%). */
export const DISPLAY_MIN_CONFIDENCE = 0.3;

/** High-confidence threshold for nesting / parent claims. */
export const HIGH_CONFIDENCE = 0.7;

/**
 * Returns tier metadata for a confidence score (0–1).
 */
export function getConfidenceLevel(score) {
  if (score >= 0.7) {
    return {
      id: 'high',
      label: 'High',
      cssClass: 'confidence-high',
    };
  }
  if (score >= 0.5) {
    return {
      id: 'medium',
      label: 'Medium',
      cssClass: 'confidence-medium',
    };
  }
  if (score >= 0.3) {
    return {
      id: 'low',
      label: 'Low',
      cssClass: 'confidence-low',
    };
  }
  return {
    id: 'very-low',
    label: 'Very Low',
    cssClass: 'confidence-very-low',
  };
}

/**
 * Whether a top match should appear in pattern results.
 */
export function shouldDisplayPattern(confidence) {
  return confidence >= DISPLAY_MIN_CONFIDENCE;
}

/**
 * Aggregates detected patterns into summary buckets for the UI.
 */
export function buildPatternSummary(patterns) {
  const summary = {
    buttons: 0,
    cards: 0,
    inputs: 0,
    navigation: 0,
    lists: 0,
    other: 0,
  };

  if (!patterns) {
    return summary;
  }

  for (let i = 0; i < patterns.length; i++) {
    const type = patterns[i].detectedType;
    if (type === 'Button' || type === 'CTA Group') {
      summary.buttons += 1;
    } else if (
      type === 'Card' ||
      type === 'Avatar' ||
      type === 'Image Block' ||
      type === 'Carousel' ||
      type === 'Carousel Section' ||
      type === 'Course Card' ||
      type === 'Content Card' ||
      type === 'Hero Carousel'
    ) {
      summary.cards += 1;
    } else if (
      type === 'Input Field' ||
      type === 'Textarea' ||
      type === 'Dropdown' ||
      type === 'Checkbox' ||
      type === 'Radio Group' ||
      type === 'Search Bar' ||
      type === 'Form Group'
    ) {
      summary.inputs += 1;
    } else if (
      type === 'Navigation' ||
      type === 'Tabs' ||
      type === 'Sidebar' ||
      type === 'Modal' ||
      type === 'Breadcrumb' ||
      type === 'Pagination' ||
      type === 'Category Selector'
    ) {
      summary.navigation += 1;
    } else if (
      type === 'Table' ||
      type === 'Card Grid' ||
      type === 'Form' ||
      type === 'Form Section' ||
      type === 'Course Listing Section' ||
      type === 'Card Grid Section' ||
      type === 'Filter Group' ||
      type === 'Feature List Section' ||
      type === 'Body Container'
    ) {
      summary.lists += 1;
    } else if (type) {
      summary.other += 1;
    }
  }

  return summary;
}
