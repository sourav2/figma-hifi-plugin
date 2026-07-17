// src/utils/nodeHelpers.js
function nameHintScore(node, keywords) {
  const name = (node.name || "").toLowerCase();
  for (let i = 0; i < keywords.length; i++) {
    if (name.indexOf(keywords[i]) !== -1) {
      return 0.12;
    }
  }
  return 0;
}

// src/analyzer/patterns.js
var PATTERN_TYPES = [
  "Button",
  "Input Field",
  "Textarea",
  "Dropdown",
  "Checkbox",
  "Radio Group",
  "Search Bar",
  "Card",
  "Card Grid",
  "Navigation",
  "Tabs",
  "Table",
  "Modal",
  "Sidebar",
  "Avatar",
  "Image Block",
  "Text Block",
  "CTA Group",
  "Form",
  "Form Group",
  "Banner",
  "Carousel",
  "Pagination",
  "Breadcrumb",
  "Header",
  "Link Group",
  "Footer Links",
  "Navigation Links",
  "PlaceholderContent",
  "Hero Section",
  "Content Block",
  "CTA Section",
  "Form Section",
  "Card Grid Section",
  "Footer Section",
  "Image Grid Section",
  "Header Section",
  "Navigation Icon",
  "Heading",
  "Body Text",
  "Paragraph",
  "Description",
  "Label",
  "Carousel Section",
  "Feature List Section",
  "Course Card",
  "Content Card",
  "Course Listing Section",
  "Category Selector",
  "Filter Group",
  "Hero Carousel",
  "Body Container",
  "Bottom Navigation"
];

// src/utils/logger.js
var PREFIX = "[Hi-Fi Scanner]";
function logScan(message, data) {
  if (data !== void 0) {
    console.log(PREFIX + " " + message, data);
  } else {
    console.log(PREFIX + " " + message);
  }
}

// src/analyzer/confidenceLevels.js
var DISPLAY_MIN_CONFIDENCE = 0.3;
function getConfidenceLevel(score) {
  if (score >= 0.7) {
    return {
      id: "high",
      label: "High",
      cssClass: "confidence-high"
    };
  }
  if (score >= 0.5) {
    return {
      id: "medium",
      label: "Medium",
      cssClass: "confidence-medium"
    };
  }
  if (score >= 0.3) {
    return {
      id: "low",
      label: "Low",
      cssClass: "confidence-low"
    };
  }
  return {
    id: "very-low",
    label: "Very Low",
    cssClass: "confidence-very-low"
  };
}
function shouldDisplayPattern(confidence) {
  return confidence >= DISPLAY_MIN_CONFIDENCE;
}

// src/analyzer/patternDetector-current.mjs
var MIN_CONFIDENCE = DISPLAY_MIN_CONFIDENCE;
function roundConfidence(score) {
  const c = Math.max(0, Math.min(1, score));
  return Math.round(c * 100) / 100;
}
function describeComposition(features) {
  const parts = [];
  if (features.hasRectangle || features.shapeCount > 0) {
    parts.push("Rectangle");
  }
  if (features.textCount > 0) {
    parts.push(
      features.textCount === 1 ? "Text" : features.textCount + " Text"
    );
  }
  if (features.hasImage || features.hasImagePlaceholder) {
    parts.push("Image");
  }
  if (features.isAutoLayout) {
    parts.push("Auto-layout " + (features.isHorizontal ? "H" : "V"));
  }
  if (parts.length === 0) {
    return features.name || "Unknown layer";
  }
  return parts.join(" + ");
}
function evaluatePattern(patternType, features, indicators, requiredSignals = [], negativeSignals = []) {
  let earned = 0;
  let total = 0;
  const explanation = [];
  const failedReasons = [];
  for (let i = 0; i < indicators.length; i++) {
    const ind = indicators[i];
    total += ind.weight;
    const passed = ind.test(features);
    if (passed) {
      earned += ind.weight;
    } else {
      failedReasons.push(ind.label);
    }
    explanation.push({
      label: ind.label,
      passed,
      weight: ind.weight,
      type: "standard"
    });
  }
  let score = total > 0 ? earned / total : 0;
  for (let i = 0; i < negativeSignals.length; i++) {
    const neg = negativeSignals[i];
    const active = neg.test(features);
    if (active) {
      score -= neg.penalty;
      explanation.push({
        label: "Penalty: " + neg.label + " (-" + Math.round(neg.penalty * 100) + "%)",
        passed: false,
        // In UI, fail highlights that penalty occurred
        weight: neg.penalty,
        type: "penalty"
      });
      failedReasons.push("Penalty: " + neg.label);
    }
  }
  const requiredResults = [];
  let allRequiredMet = true;
  for (let i = 0; i < requiredSignals.length; i++) {
    const req = requiredSignals[i];
    const passed = req.test(features);
    if (!passed) {
      allRequiredMet = false;
      failedReasons.push("Missing required: " + req.label);
    }
    requiredResults.push({
      label: req.label,
      passed
    });
    explanation.push({
      label: "Required: " + req.label,
      passed,
      weight: 0,
      type: "required"
    });
  }
  score += nameHintScore({ name: features.name }, getNameKeywords(patternType));
  const nodeNameLower = (features.name || "").toLowerCase();
  if (/\b(button|btn|cta|submit|enquire)\b/i.test(nodeNameLower) || nodeNameLower.indexOf("button") !== -1 || nodeNameLower.indexOf("btn") !== -1 || nodeNameLower.indexOf("cta") !== -1 || nodeNameLower.indexOf("submit") !== -1 || nodeNameLower.indexOf("enquire") !== -1) {
    if (patternType === "Button") {
      score += 0.5;
      explanation.push({ label: "Name Hint Boost: contains button/btn/cta/submit/enquire (+50%)", passed: true, weight: 0.5, type: "boost" });
    }
    if (["Input Field", "Dropdown", "Checkbox", "Radio Group"].indexOf(patternType) !== -1) {
      score -= 0.5;
      explanation.push({ label: "Name Hint Penalty: contains button/btn/cta/submit/enquire (-50%)", passed: false, weight: 0.5, type: "penalty" });
      failedReasons.push("Name Hint: contains button/btn/cta/submit/enquire");
    }
  }
  if (/\b(input|field|textfield|form-field)\b/i.test(nodeNameLower) || nodeNameLower.indexOf("input") !== -1 || nodeNameLower.indexOf("textfield") !== -1 || nodeNameLower.indexOf("field") !== -1 || nodeNameLower.indexOf("form-field") !== -1) {
    if (patternType === "Input Field") {
      score += 0.5;
      explanation.push({ label: "Name Hint Boost: contains input/textfield/field/form-field (+50%)", passed: true, weight: 0.5, type: "boost" });
    }
    if (patternType === "Button") {
      score -= 0.5;
      explanation.push({ label: "Name Hint Penalty: contains input/textfield/field/form-field (-50%)", passed: false, weight: 0.5, type: "penalty" });
      failedReasons.push("Name Hint: contains input/textfield/field/form-field");
    }
  }
  if (/\b(header|navbar|navigation|menu|hamburger)\b/i.test(nodeNameLower) || nodeNameLower.indexOf("header") !== -1 || nodeNameLower.indexOf("navbar") !== -1 || nodeNameLower.indexOf("navigation") !== -1 || nodeNameLower.indexOf("menu") !== -1 || nodeNameLower.indexOf("hamburger") !== -1) {
    if (patternType === "Navigation" || patternType === "Header" || patternType === "Header Section" || patternType === "Navigation Icon") {
      score += 0.5;
      explanation.push({ label: "Name Hint Boost: contains header/navbar/navigation/menu/hamburger (+50%)", passed: true, weight: 0.5, type: "boost" });
    }
    if (["Dropdown", "Carousel", "Checkbox", "Radio Group", "Input Field"].indexOf(patternType) !== -1) {
      score -= 0.5;
      explanation.push({ label: "Name Hint Penalty: contains header/navbar/navigation/menu/hamburger (-50%)", passed: false, weight: 0.5, type: "penalty" });
      failedReasons.push("Name Hint: contains header/navbar/navigation/menu/hamburger");
    }
  }
  if (/\b(card|course|product|item|tile)\b/i.test(nodeNameLower) || nodeNameLower.indexOf("card") !== -1 || nodeNameLower.indexOf("course") !== -1 || nodeNameLower.indexOf("product") !== -1 || nodeNameLower.indexOf("item") !== -1 || nodeNameLower.indexOf("tile") !== -1) {
    if (patternType === "Card") {
      score += 0.4;
      explanation.push({ label: "Name Hint Boost: contains card/course/product/item/tile (+40%)", passed: true, weight: 0.4, type: "boost" });
    }
    if (patternType === "Modal") {
      score -= 0.4;
      explanation.push({ label: "Name Hint Penalty: contains card/course/product/item/tile (-40%)", passed: false, weight: 0.4, type: "penalty" });
      failedReasons.push("Name Hint: contains card/course/product/item/tile");
    }
  }
  if (!allRequiredMet) {
    score = Math.min(score, 0.29);
  }
  score = roundConfidence(score);
  return {
    type: patternType,
    confidence: score,
    explanation,
    failedReasons,
    requiredSignals: requiredResults,
    allRequiredMet
  };
}
function getNameKeywords(patternType) {
  const map = {
    Button: ["button", "btn", "cta", "action"],
    "Input Field": ["input", "field", "textfield", "text field"],
    Textarea: ["textarea", "text area", "multiline"],
    Dropdown: ["dropdown", "select", "menu-select", "combobox"],
    Checkbox: ["checkbox", "chk", "check"],
    "Radio Group": ["radio", "radio group", "radiobutton"],
    "Search Bar": ["search", "searchbar", "search-bar"],
    Card: ["card", "tile", "panel"],
    "Card Grid": ["grid", "cards-grid", "card-list"],
    Navigation: ["nav", "navbar", "header", "navigation", "appbar", "topbar"],
    Tabs: ["tabs", "tabbar", "tab-bar", "segmented-control"],
    Table: ["table", "datatable", "grid-data"],
    Modal: ["modal", "dialog", "popup", "overlay", "window"],
    Sidebar: ["sidebar", "side-nav", "drawer", "rail", "navigation-drawer"],
    Avatar: ["avatar", "profile", "userpic", "thumbnail", "badge-avatar"],
    "Image Block": ["image", "img", "photo", "picture", "artwork", "hero-image"],
    "Text Block": ["text-block", "typography", "paragraph", "heading-group", "copy"],
    "CTA Group": ["cta-group", "button-group", "actions", "action-bar"],
    Form: ["form", "signup-form", "login-form", "contact-form"],
    "Form Group": ["form-group", "input-group", "field-container"],
    Banner: ["banner", "alert-banner", "promo", "hero-banner"],
    Carousel: ["carousel", "slider", "slideshow"],
    Pagination: ["pagination", "pager", "page-control"],
    Breadcrumb: ["breadcrumb", "breadcrumbs", "path"],
    Header: ["header", "appbar", "topbar", "navbar"],
    "Link Group": ["links", "link-group", "list-links", "footer-column"],
    "Footer Links": ["footer", "footer-links", "footer-nav"],
    "Navigation Links": ["nav-links", "menu-links", "menu-items"],
    PlaceholderContent: ["placeholder", "skeleton", "shimmer", "loading"],
    "Hero Section": ["hero", "banner-hero", "jumbotron", "promo-hero"],
    "Content Block": ["content", "block", "section-content", "body", "text-button"],
    "CTA Section": ["cta", "call-to-action", "action-section", "button-section"],
    "Form Section": ["form", "input-form", "section-form"],
    "Card Grid Section": ["grid", "cards-grid", "card-list"],
    "Footer Section": ["footer", "footer-links", "footer-nav"],
    "Image Grid Section": ["grid", "gallery", "images", "photos", "placement"],
    "Header Section": ["header", "navbar", "nav", "topbar"],
    "Navigation Icon": ["hamburger", "menu-icon", "nav-icon", "menu-button"],
    Heading: ["heading", "title", "h1", "h2", "h3", "h4", "h5", "h6"],
    "Body Text": ["body", "paragraph", "text", "copy"],
    Paragraph: ["paragraph", "text", "copy", "para"],
    Description: ["description", "desc", "info", "summary"],
    Label: ["label", "tag", "caption", "badge"],
    "Carousel Section": ["carousel", "slider", "slideshow"],
    "Feature List Section": ["features", "list", "benefits", "points"],
    "Course Card": ["course-card", "course-tile", "class-card", "lecture-card"],
    "Content Card": ["content-card", "blog-card", "news-card", "article-card"],
    "Course Listing Section": ["courses-list", "courses-grid", "course-listing", "academy-section"],
    "Category Selector": ["category-selector", "categories", "pills-selector", "tag-selector"],
    "Filter Group": ["filter-group", "filters", "refine-panel"],
    "Hero Carousel": ["hero-carousel", "hero-slider", "promo-carousel"],
    "Body Container": ["body-container", "layout-body", "screen-body", "page-container"]
  };
  return map[patternType] || [];
}
function scoreButtonWeighted(f) {
  const indicators = [
    { label: "Rectangle/shape present", weight: 0.2, test: (x) => x.hasRectangle || x.shapeCount >= 1 },
    { label: "Text label present", weight: 0.2, test: (x) => x.textCount >= 1 },
    { label: "Dimensions (80-300x32-60px)", weight: 0.25, test: (x) => x.width >= 80 && x.width <= 300 && x.height >= 32 && x.height <= 60 },
    { label: "Few children (<=4)", weight: 0.15, test: (x) => x.childCount <= 4 },
    { label: "Short text label", weight: 0.1, test: (x) => x.isShortLabel || x.maxTextLength <= 30 },
    { label: "Center alignment", weight: 0.1, test: (x) => x.isCenterAligned }
  ];
  const required = [
    {
      label: "Rectangle/background, text label, and button dimensions",
      test: (x) => {
        const hasBg = x.hasRectangle || x.shapeCount >= 1 || x.cornerRadius > 0 || x.hasEffects;
        const hasText = x.textCount >= 1;
        const hasDim = x.width >= 40 && x.width <= 400 && x.height >= 24 && x.height <= 80;
        return hasBg && hasText && hasDim;
      }
    }
  ];
  const negative = [
    { label: "Large text blocks / paragraphs", penalty: 0.6, test: (x) => x.textCount >= 2 && x.maxTextLength > 50 },
    { label: "Large height / content section", penalty: 0.5, test: (x) => x.height > 100 },
    { label: "Excessive child count (>=5)", penalty: 0.4, test: (x) => x.childCount >= 5 }
  ];
  return evaluatePattern("Button", f, indicators, required, negative);
}
function scoreInputFieldWeighted(f) {
  const indicators = [
    { label: "Rectangle/field background", weight: 0.25, test: (x) => x.hasRectangle || x.shapeCount >= 1 },
    { label: "Placeholder/label text", weight: 0.25, test: (x) => x.hasPlaceholderText || x.textCount >= 1 },
    { label: "Input dimensions (32-56px tall)", weight: 0.25, test: (x) => x.width >= 100 && x.height >= 32 && x.height <= 56 },
    { label: "Label/input structure (<=4 children)", weight: 0.25, test: (x) => x.childCount <= 4 && x.textCount >= 1 }
  ];
  const required = [
    {
      label: "Placeholder text or label + field structure",
      test: (x) => x.hasPlaceholderText || x.textCount >= 1 && (x.hasRectangle || x.shapeCount >= 1)
    }
  ];
  const negative = [
    { label: "Description/article/paragraph text", penalty: 0.7, test: (x) => x.maxTextLength > 50 },
    { label: "Excessive child count (>=5)", penalty: 0.5, test: (x) => x.childCount >= 5 }
  ];
  return evaluatePattern("Input Field", f, indicators, required, negative);
}
function scoreTextareaWeighted(f) {
  const indicators = [
    { label: "Rectangle/field background", weight: 0.25, test: (x) => x.hasRectangle || x.shapeCount >= 1 },
    { label: "Text present", weight: 0.25, test: (x) => x.textCount >= 1 },
    { label: "Textarea height (60-180px)", weight: 0.3, test: (x) => x.width >= 120 && x.height >= 60 && x.height <= 180 },
    { label: "Placeholder/multiline structure", weight: 0.2, test: (x) => x.hasPlaceholderText || x.textCount >= 1 }
  ];
  const required = [
    {
      label: "Placeholder text or label + textarea structure",
      test: (x) => x.hasPlaceholderText || x.textCount >= 1 && (x.hasRectangle || x.shapeCount >= 1)
    }
  ];
  const negative = [
    { label: "Extremely short height (<50px)", penalty: 0.5, test: (x) => x.height < 50 }
  ];
  return evaluatePattern("Textarea", f, indicators, required, negative);
}
function scoreDropdownWeighted(f) {
  const indicators = [
    { label: "Rectangle/field background", weight: 0.25, test: (x) => x.hasRectangle || x.shapeCount >= 1 },
    { label: "Text label present", weight: 0.2, test: (x) => x.textCount >= 1 },
    { label: "Dropdown dimensions (32-56px tall)", weight: 0.25, test: (x) => x.width >= 100 && x.height >= 32 && x.height <= 56 },
    { label: "Contains chevron/arrow shape or name hint", weight: 0.3, test: (x) => x.shapeCount >= 2 || x.name && /dropdown|select|chevron|arrow/i.test(x.name) }
  ];
  const required = [
    {
      label: "Chevron/arrow vector OR dropdown keyword hint",
      test: (x) => x.shapeCount >= 2 || x.name && /dropdown|select|chevron|arrow/i.test(x.name)
    }
  ];
  const negative = [
    { label: "Large width (>400px)", penalty: 0.5, test: (x) => x.width > 400 },
    { label: "Contains links or avatars", penalty: 0.6, test: (x) => x.childLinksCount >= 1 || x.childAvatarsCount >= 1 || x.childTextsCount >= 3 },
    { label: "Contains buttons", penalty: 0.4, test: (x) => x.childButtonsCount >= 1 }
  ];
  return evaluatePattern("Dropdown", f, indicators, required, negative);
}
function scoreCheckboxWeighted(f) {
  const indicators = [
    { label: "Small square shape/container (12-28px)", weight: 0.4, test: (x) => x.width >= 12 && x.width <= 28 && x.height >= 12 && x.height <= 28 },
    { label: "Roughly square aspect ratio", weight: 0.25, test: (x) => x.aspectRatio >= 0.8 && x.aspectRatio <= 1.25 },
    { label: "Few children (<=3)", weight: 0.15, test: (x) => x.childCount <= 3 },
    { label: "Short text label next to/inside checkbox", weight: 0.2, test: (x) => x.textCount <= 2 && x.maxTextLength <= 40 }
  ];
  const required = [
    {
      label: "Small square bounds (12-32px)",
      test: (x) => x.width >= 10 && x.width <= 32 && x.height >= 10 && x.height <= 32
    }
  ];
  const negative = [
    { label: "Hamburger or menu keywords", penalty: 0.8, test: (x) => x.name && /menu|hamburger|nav|icon/i.test(x.name) }
  ];
  return evaluatePattern("Checkbox", f, indicators, required, negative);
}
function scoreRadioGroupWeighted(f) {
  const indicators = [
    { label: "Contains small circle(s) or name hint", weight: 0.4, test: (x) => x.width >= 12 && x.width <= 28 && x.height >= 12 && x.height <= 28 || x.name && /radio/i.test(x.name) },
    { label: "Round shape presence (ellipse/star)", weight: 0.3, test: (x) => x.type === "ELLIPSE" || x.shapeCount >= 1 },
    { label: "Few children or simple layout", weight: 0.3, test: (x) => x.childCount <= 3 && x.textCount <= 2 }
  ];
  const required = [
    {
      label: "Small bounds or radio keyword hint",
      test: (x) => x.width >= 10 && x.width <= 32 && x.height >= 10 && x.height <= 32 || x.name && /radio/i.test(x.name)
    }
  ];
  const negative = [
    { label: "Hamburger or menu keywords", penalty: 0.8, test: (x) => x.name && /menu|hamburger|nav|icon/i.test(x.name) }
  ];
  return evaluatePattern("Radio Group", f, indicators, required, negative);
}
function scoreSearchBarWeighted(f) {
  const indicators = [
    { label: "Wide horizontal bar (140-600px wide, 28-56px tall)", weight: 0.3, test: (x) => x.width >= 140 && x.width <= 600 && x.height >= 28 && x.height <= 56 },
    { label: "Horizontal or auto-layout", weight: 0.2, test: (x) => x.isHorizontal || x.childCount >= 1 },
    { label: "Icon/shape + text indicator", weight: 0.25, test: (x) => x.shapeCount >= 1 && x.textCount >= 1 },
    { label: "Search keyword/placeholder hint", weight: 0.25, test: (x) => x.hasPlaceholderText || x.name && /search/i.test(x.name) }
  ];
  const required = [
    {
      label: "Wide horizontal container and search indicator/placeholder",
      test: (x) => {
        const isSearchName = x.name && /search/i.test(x.name);
        const isSearchText = x.texts && x.texts.some((t) => /search/i.test(t.characters || ""));
        return x.width >= 100 && (x.hasPlaceholderText || isSearchName || isSearchText || x.shapeCount >= 1);
      }
    }
  ];
  return evaluatePattern("Search Bar", f, indicators, required);
}
function scoreCardWeighted(f) {
  const indicators = [
    { label: "Image presence or child image", weight: 0.25, test: (x) => x.hasImage || x.hasLargeImageArea || x.hasImagePlaceholder || x.childImagesCount >= 1 },
    { label: "Title or heading present", weight: 0.25, test: (x) => x.hasHeading || x.maxFontSize >= 16 },
    { label: "Description text present", weight: 0.2, test: (x) => x.hasDescription || x.textCount >= 2 },
    { label: "CTA button child present", weight: 0.15, test: (x) => x.hasCtaButton || x.childButtonsCount >= 1 },
    { label: "Contains meaningful content items", weight: 0.15, test: (x) => x.meaningfulCount >= 1 }
  ];
  const required = [
    {
      label: "Image/placeholder, title/description, and meaningful content present",
      test: (x) => (x.hasImage || x.hasLargeImageArea || x.hasImagePlaceholder || x.childImagesCount >= 1) && x.textCount >= 1 && x.meaningfulCount >= 1
    }
  ];
  const negative = [
    { label: "No meaningful text content", penalty: 0.8, test: (x) => x.meaningfulCount === 0 && x.textCount === 0 },
    { label: "Rectangle only container", penalty: 0.6, test: (x) => x.childCount === 0 && x.textCount === 0 }
  ];
  const res = evaluatePattern("Card", f, indicators, required, negative);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreCardGridWeighted(f) {
  const indicators = [
    { label: "Multiple child cards (2 to 12)", weight: 0.4, test: (x) => x.childCardsCount >= 2 && x.childCount <= 12 },
    { label: "Auto-layout or wrap distribution", weight: 0.3, test: (x) => x.isAutoLayout || x.isHorizontal || x.isVertical },
    { label: "Contains meaningful content elements", weight: 0.3, test: (x) => x.meaningfulCount >= 2 }
  ];
  const required = [
    {
      label: "Multiple child cards (cards >= 2)",
      test: (x) => x.childCardsCount >= 2
    }
  ];
  const negative = [
    { label: "Repeated placeholders without content", penalty: 0.8, test: (x) => x.childPlaceholdersCount >= 2 && x.meaningfulCount === 0 }
  ];
  const res = evaluatePattern("Card Grid", f, indicators, required, negative);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreNavigationWeighted(f) {
  const indicators = [
    { label: "Horizontal layout / arrangement", weight: 0.15, test: (x) => x.isHorizontal || x.width > x.height * 2.5 },
    { label: "Multiple meaningful short text labels (>=2)", weight: 0.1, test: (x) => x.meaningfulShortTextCount >= 2 },
    { label: "Located near top of screen (header position)", weight: 0.1, test: (x) => x.isNearTop || x.y < 120 },
    { label: "Adjacent avatar or menu icon", weight: 0.15, test: (x) => x.hasAdjacentAvatarOrIcon || x.childAvatarsCount >= 1 },
    { label: "Contains navigation text keywords (e.g. Home, About)", weight: 0.15, test: (x) => x.navKeywordCount >= 1 },
    { label: "Navigation dimensions (width >= 180, height 24-120px)", weight: 0.1, test: (x) => x.width >= 180 && x.height >= 24 && x.height <= 120 },
    { label: "Avatar + Links / Menu composite structure", weight: 0.25, test: (x) => x.childAvatarsCount >= 1 && (x.childLinksCount >= 1 || x.childTextsCount >= 2 || x.childMenusCount >= 1) }
  ];
  const required = [
    {
      label: "Significant width and horizontal or menu/avatar indicator",
      test: (x) => x.width >= 120 && (x.isHorizontal || x.width > x.height * 1.5 || x.childAvatarsCount >= 1)
    }
  ];
  const negative = [
    { label: "Navigation candidates are placeholders only", penalty: 0.2, test: (x) => x.placeholderCount >= 2 && x.meaningfulCount === 0 },
    { label: "Contains multiple cards or card grids", penalty: 0.8, test: (x) => x.childCardsCount >= 2 || x.childImagesCount >= 3 }
  ];
  const res = evaluatePattern("Navigation", f, indicators, required, negative);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreTabsWeighted(f) {
  const indicators = [
    { label: "Horizontal tabs list", weight: 0.4, test: (x) => x.isHorizontal || x.width > x.height * 2 },
    { label: "Multiple tab buttons/labels (>=2)", weight: 0.4, test: (x) => x.childCount >= 2 && x.textCount >= 2 },
    { label: "Tabs height (32-64px)", weight: 0.2, test: (x) => x.height >= 32 && x.height <= 64 }
  ];
  const required = [
    {
      label: "Multiple sibling horizontal tab buttons",
      test: (x) => x.childCount >= 2
    }
  ];
  const negative = [
    { label: "Paragraphs/heavy text content", penalty: 0.5, test: (x) => x.textCount >= 4 && x.maxTextLength > 30 }
  ];
  return evaluatePattern("Tabs", f, indicators, required, negative);
}
function scoreTableWeighted(f) {
  const indicators = [
    { label: "Vertical row layout/stack (childCount >= 2)", weight: 0.4, test: (x) => x.isVertical && x.childCount >= 2 },
    { label: "Contains row-like children / headers", weight: 0.4, test: (x) => x.childCount >= 2 && x.textCount >= 4 },
    { label: "Large grid layout (width >= 240, height >= 100)", weight: 0.2, test: (x) => x.width >= 240 && x.height >= 100 }
  ];
  const required = [
    {
      label: "Vertical stack containing multiple rows/items",
      test: (x) => x.childCount >= 2
    }
  ];
  const res = evaluatePattern("Table", f, indicators, required);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreModalWeighted(f) {
  const indicators = [
    { label: "Dialog surface size (width >= 200, height >= 150)", weight: 0.25, test: (x) => x.width >= 200 && x.height >= 150 },
    { label: "Title + content text layers", weight: 0.25, test: (x) => x.textCount >= 2 && x.childCount >= 2 },
    { label: "Rounded corners or elevation shadow", weight: 0.2, test: (x) => x.cornerRadius > 0 || x.hasEffects },
    { label: "Has close icon or cancel action", weight: 0.15, test: (x) => x.name && /close|cancel|x|cross/i.test(x.name) || x.texts && x.texts.some((t) => /close|cancel|dismiss|x/i.test(t.characters || "")) },
    { label: "Popup naming/keyword", weight: 0.15, test: (x) => x.name && /modal|dialog|popup|window|confirm/i.test(x.name) }
  ];
  const required = [
    {
      label: "Centered dialog surface, Overlay/backdrop, Close icon, Dialog actions, and Popup naming",
      test: (x) => {
        const meetsSize = x.width >= 150 && x.width <= 900 && x.height >= 100 && x.height <= 800;
        const isNotTooBig = x.relativeWidth <= 0.85;
        const isNotTopOrBottom = x.relativeY >= 0.05 && x.relativeY <= 0.85;
        const hasNaming = x.name && /modal|dialog|popup|window|confirm/i.test(x.name);
        const hasClose = x.name && /close|cancel|x|cross/i.test(x.name) || x.texts && x.texts.some((t) => /close|cancel|dismiss|x/i.test(t.characters || ""));
        const isCentered = x.isCenterAligned || x.name && /center/i.test(x.name);
        const hasActions = x.childButtonsCount >= 1 || x.hasCtaButton || x.texts && x.texts.some((t) => /ok|cancel|submit|confirm|yes|no/i.test(t.characters || ""));
        const hasOverlay = x.name && /overlay|backdrop/i.test(x.name) || x.hasEffects || x.relativeWidth > 0.8 && x.childCount >= 1;
        return meetsSize && isNotTooBig && isNotTopOrBottom && hasNaming && hasClose && hasActions && (isCentered || hasOverlay);
      }
    }
  ];
  const negative = [
    { label: "Repeated in list or grid", penalty: 0.9, test: (x) => x.candidateDepth > 1 || x.name && /card|item|grid|list|course/i.test(x.name) },
    { label: "Contains CTA card structure (image + heading + desc)", penalty: 0.9, test: (x) => (x.hasImage || x.childImagesCount >= 1) && x.hasHeading && x.hasDescription && x.hasCtaButton },
    { label: "Contained inside card grid parent", penalty: 0.9, test: (x) => x.isNestedGroup || x.name && /grid|tile|list/i.test(x.name) || x.childCardsCount > 0 }
  ];
  return evaluatePattern("Modal", f, indicators, required, negative);
}
function scoreSidebarWeighted(f) {
  const indicators = [
    { label: "Narrow vertical column (relativeWidth <= 0.38, height >= 180)", weight: 0.35, test: (x) => x.relativeWidth <= 0.38 && x.height >= 180 },
    { label: "Vertical navigation stack", weight: 0.35, test: (x) => x.isVertical && x.childCount >= 2 },
    { label: "Multiple text items (textCount >= 2)", weight: 0.3, test: (x) => x.textCount >= 2 }
  ];
  const required = [
    {
      label: "Tall vertical column layout",
      test: (x) => x.height > x.width * 1.5
    }
  ];
  const res = evaluatePattern("Sidebar", f, indicators, required);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreAvatarWeighted(f) {
  const indicators = [
    { label: "Square or round dimensions (16-96px)", weight: 0.35, test: (x) => x.width >= 16 && x.width <= 96 && x.height >= 16 && x.height <= 96 },
    { label: "Aspect ratio 1:1", weight: 0.3, test: (x) => x.aspectRatio >= 0.75 && x.aspectRatio <= 1.35 },
    { label: "Image fill or initials text", weight: 0.35, test: (x) => x.hasImage || x.textCount === 1 && x.maxTextLength <= 3 }
  ];
  const required = [
    {
      label: "Small square dimensions (<=120px)",
      test: (x) => x.width <= 120 && x.height <= 120 && x.aspectRatio >= 0.7 && x.aspectRatio <= 1.4
    }
  ];
  return evaluatePattern("Avatar", f, indicators, required);
}
function scoreImageBlockWeighted(f) {
  const indicators = [
    { label: "Image occupies majority of content", weight: 0.4, test: (x) => x.hasImage || x.hasLargeImageArea || x.type === "IMAGE" },
    { label: "Text count <= 1", weight: 0.3, test: (x) => x.textCount <= 1 },
    { label: "No inputs and no CTA buttons", weight: 0.3, test: (x) => x.childInputsCount === 0 && x.childButtonsCount === 0 && !x.hasCtaButton }
  ];
  const required = [
    {
      label: "Image occupies majority, text count <= 1, no inputs, no CTA buttons",
      test: (x) => {
        const hasImg = x.hasImage || x.hasImagePlaceholder || x.hasLargeImageArea || x.type === "IMAGE";
        const lowText = x.textCount <= 1;
        const noInputs = x.childInputsCount === 0;
        const noCta = x.childButtonsCount === 0 && !x.hasCtaButton;
        return hasImg && lowText && noInputs && noCta;
      }
    }
  ];
  const negative = [
    { label: "Inputs exist", penalty: 0.9, test: (x) => x.childInputsCount > 0 },
    { label: "Buttons exist", penalty: 0.9, test: (x) => x.childButtonsCount > 0 || x.hasCtaButton },
    { label: "Text count >= 2", penalty: 0.9, test: (x) => x.textCount >= 2 }
  ];
  return evaluatePattern("Image Block", f, indicators, required, negative);
}
function scoreTextBlockWeighted(f) {
  const indicators = [
    { label: "Pure typography layout (no shape bg)", weight: 0.4, test: (x) => !x.hasRectangle && x.shapeCount === 0 },
    { label: "Contains text layer(s)", weight: 0.3, test: (x) => x.textCount >= 1 },
    { label: "Simple layout (children only text)", weight: 0.3, test: (x) => x.childCount === 0 || x.childCount === x.textCount }
  ];
  const required = [
    {
      label: "Contains text layer and no background shape",
      test: (x) => x.textCount >= 1 && !x.hasRectangle
    }
  ];
  return evaluatePattern("Text Block", f, indicators, required);
}
function scoreCtaGroupWeighted(f) {
  const indicators = [
    { label: "Horizontal button arrangement", weight: 0.3, test: (x) => x.isHorizontal || x.width > x.height * 1.8 },
    { label: "Contains multiple buttons (childCount >= 2)", weight: 0.4, test: (x) => x.childCount >= 2 && x.textCount >= 2 },
    { label: "Group dimensions (height 32-80px, width 120-500px)", weight: 0.3, test: (x) => x.height >= 32 && x.height <= 80 && x.width >= 120 && x.width <= 500 }
  ];
  const required = [
    {
      label: "Multiple horizontal button/text indicators",
      test: (x) => x.childCount >= 2 && x.textCount >= 2
    }
  ];
  return evaluatePattern("CTA Group", f, indicators, required);
}
function scoreFormWeighted(f) {
  const indicators = [
    { label: "Contains child inputs (>=2)", weight: 0.4, test: (x) => x.childInputsCount >= 2 },
    { label: "Contains child button (>=1)", weight: 0.3, test: (x) => x.childButtonsCount >= 1 },
    { label: "Vertical or form stack layout", weight: 0.3, test: (x) => x.isVertical || x.height > x.width }
  ];
  const required = [
    {
      label: "2+ input fields and 1 button OR 3+ input fields",
      test: (x) => x.childInputsCount >= 2 && x.childButtonsCount >= 1 || x.childInputsCount >= 3
    }
  ];
  const res = evaluatePattern("Form", f, indicators, required);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreFormGroupWeighted(f) {
  const indicators = [
    { label: "Contains text label + input element", weight: 0.4, test: (x) => x.textCount >= 2 && x.childCount >= 2 },
    { label: "Vertical or stack layout", weight: 0.3, test: (x) => x.isVertical || x.height >= 48 },
    { label: "Dimensions (height 48-120px)", weight: 0.3, test: (x) => x.height >= 48 && x.height <= 120 }
  ];
  const required = [
    {
      label: "Contains label and field input elements",
      test: (x) => x.textCount >= 1 && (x.childInputsCount >= 1 || x.name && /form|group|input|field/i.test(x.name))
    }
  ];
  return evaluatePattern("Form Group", f, indicators, required);
}
function scoreBannerWeighted(f) {
  const indicators = [
    { label: "Wide aspect ratio banner shape", weight: 0.4, test: (x) => x.relativeWidth >= 0.65 && x.height >= 60 && x.height <= 260 },
    { label: "Contains text content (heading/desc)", weight: 0.3, test: (x) => x.textCount >= 1 },
    { label: "CTA or promo structure", weight: 0.3, test: (x) => x.hasCtaButton || x.hasRectangle || x.childCount >= 1 }
  ];
  const required = [
    {
      label: "At least 2 of: Large container, Promotional text/name, Wide layout, Background emphasis, Headline + supporting text",
      test: (x) => {
        const hasContainer = x.width >= 400 && x.height >= 80;
        const hasPromo = x.name && /promo|banner|ad|offer|sale|discount/i.test(x.name) || x.texts && x.texts.some((t) => /promo|banner|ad|offer|sale|discount|coupon/i.test(t.characters || ""));
        const hasWide = x.aspectRatio >= 2.5;
        const hasBg = x.cornerRadius > 0 || x.hasEffects || x.hasRectangle;
        const hasHeadlineText = x.textCount >= 2 || x.hasHeading && x.hasDescription;
        let count = 0;
        if (hasContainer) count++;
        if (hasPromo) count++;
        if (hasWide) count++;
        if (hasBg) count++;
        if (hasHeadlineText) count++;
        return count >= 2;
      }
    }
  ];
  const negative = [
    { label: "Aspect ratio < 2.0", penalty: 0.5, test: (x) => x.aspectRatio < 2 },
    { label: "High child density (>=4)", penalty: 0.4, test: (x) => x.childCount >= 4 },
    { label: "Only text + button exists", penalty: 0.4, test: (x) => x.textCount === 1 && (x.childButtonsCount === 1 || x.hasCtaButton) },
    {
      label: "No promotional structure & background treatment",
      penalty: 0.5,
      test: (x) => {
        const hasPromo = x.name && /promo|banner|ad|offer|sale/i.test(x.name) || x.texts && x.texts.some((t) => /promo|banner|ad|offer|sale/i.test(t.characters || ""));
        const hasBg = x.hasRectangle || x.cornerRadius > 0 || x.hasEffects;
        return !hasPromo && !hasBg;
      }
    }
  ];
  return evaluatePattern("Banner", f, indicators, required, negative);
}
function scoreCarouselWeighted(f) {
  const indicators = [
    { label: "Horizontal list structure", weight: 0.3, test: (x) => x.isHorizontal || x.width > x.height * 1.5 },
    { label: "Multiple slide child items (>=2)", weight: 0.4, test: (x) => x.childCount >= 2 },
    { label: "Contains navigation indicator or dots", weight: 0.3, test: (x) => x.shapeCount >= 3 || x.name && /carousel|slider|dots/i.test(x.name) }
  ];
  const required = [
    {
      label: "Must have at least 2 of: multiple slides/items, pagination indicators, navigation arrows, horizontal content sequence, or repeated child structure",
      test: (x) => {
        const signals = [
          x.childCount >= 2,
          x.name && /dot|indicator|pagination/i.test(x.name) || x.shapeCount >= 3,
          x.name && /arrow|prev|next|chevron/i.test(x.name),
          x.isHorizontal || x.aspectRatio >= 1.5,
          x.childCount >= 2 && x.shapeCount >= x.childCount
        ];
        return signals.filter(Boolean).length >= 2;
      }
    }
  ];
  const negative = [
    { label: "Too few child elements (<=1)", penalty: 0.5, test: (x) => x.childCount <= 1 },
    { label: "Repeated elements are placeholders only", penalty: 0.4, test: (x) => x.placeholderCount >= 2 && x.meaningfulCount === 0 },
    { label: "No meaningful content exists", penalty: 0.5, test: (x) => x.meaningfulCount === 0 }
  ];
  const res = evaluatePattern("Carousel", f, indicators, required, negative);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreCarouselSectionWeighted(f) {
  const indicators = [
    { label: "Horizontal slide arrangement", weight: 0.3, test: (x) => x.isHorizontal || x.width > x.height * 1.3 },
    { label: "Pattern A: Multiple visible slides + pagination", weight: 0.3, test: (x) => x.childCount >= 2 && (x.shapeCount >= 3 || x.name && /dot|pagination|indicator/i.test(x.name)) },
    { label: "Pattern B: Single visible slide + pagination dots", weight: 0.2, test: (x) => (x.childCardsCount === 1 || x.childImagesCount === 1) && (x.shapeCount >= 3 || x.name && /dot|pagination|indicator/i.test(x.name)) },
    { label: "Pattern C: Image + Arrows", weight: 0.2, test: (x) => (x.hasImage || x.childImagesCount >= 1) && (x.shapeCount >= 2 || x.name && /arrow|chevron|prev|next/i.test(x.name)) }
  ];
  const required = [
    {
      label: "Pattern A, B, or C carousel indicator signals",
      test: (x) => {
        const patA = x.childCount >= 2 && (x.shapeCount >= 3 || x.name && /dot|pagination|indicator/i.test(x.name));
        const patB = (x.childCardsCount <= 1 || x.childImagesCount <= 1) && (x.shapeCount >= 3 || x.name && /dot|pagination|indicator/i.test(x.name));
        const patC = (x.hasImage || x.childImagesCount >= 1) && (x.shapeCount >= 2 || x.name && /arrow|chevron|prev|next/i.test(x.name));
        return patA || patB || patC || x.name && /carousel|slider/i.test(x.name);
      }
    }
  ];
  const negative = [
    { label: "Too few elements and no indicator signals", penalty: 0.5, test: (x) => x.childCount <= 1 && !(x.name && /carousel|slider/i.test(x.name)) }
  ];
  const res = evaluatePattern("Carousel Section", f, indicators, required, negative);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreFeatureListSectionWeighted(f) {
  const indicators = [
    { label: "Multiple text nodes / child texts (>=2)", weight: 0.35, test: (x) => x.textCount >= 2 || x.childTextsCount >= 2 },
    { label: "Repeated icon/image/shape elements (>=2)", weight: 0.35, test: (x) => x.shapeCount >= 2 || x.childImagesCount >= 2 || x.childPlaceholdersCount >= 2 || x.name && /feature|list|benefits|points/i.test(x.name) },
    { label: "Vertical or horizontal arrangement", weight: 0.3, test: (x) => x.isVertical || x.isHorizontal || x.isAutoLayout }
  ];
  const required = [
    {
      label: "Multiple text blocks and icon/ellipse indicators",
      test: (x) => {
        const hasTexts = x.textCount >= 2 || x.childTextsCount >= 2;
        const hasIcons = x.shapeCount >= 2 || x.childImagesCount >= 2 || x.childPlaceholdersCount >= 2 || x.name && /feature|list|benefits|points/i.test(x.name);
        return hasTexts && hasIcons;
      }
    }
  ];
  const negative = [
    { label: "Contains input elements", penalty: 0.6, test: (x) => x.childInputsCount >= 1 }
  ];
  const res = evaluatePattern("Feature List Section", f, indicators, required, negative);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scorePaginationWeighted(f) {
  const indicators = [
    { label: "Horizontal buttons/numbers row", weight: 0.3, test: (x) => x.isHorizontal || x.width > x.height * 2 },
    { label: "Multiple pagination dots/cells (>=2)", weight: 0.4, test: (x) => x.childCount >= 2 && x.textCount >= 1 },
    { label: "Short row height (20-48px)", weight: 0.3, test: (x) => x.height >= 20 && x.height <= 48 }
  ];
  const required = [
    {
      label: "Repeated page indicators or Prev/Next controls",
      test: (x) => x.childCount >= 2 || x.name && /prev|next|arrow|chevron|page/i.test(x.name)
    }
  ];
  const negative = [
    { label: "Excessive height (>=80px)", penalty: 0.4, test: (x) => x.height >= 80 }
  ];
  return evaluatePattern("Pagination", f, indicators, required, negative);
}
function scoreBreadcrumbWeighted(f) {
  const indicators = [
    { label: "Horizontal sequence links", weight: 0.3, test: (x) => x.isHorizontal || x.width > x.height * 2.5 },
    { label: "Multiple short link texts (>=2)", weight: 0.4, test: (x) => x.textCount >= 2 && x.maxTextLength <= 30 },
    { label: "Short link height (16-36px)", weight: 0.3, test: (x) => x.height >= 16 && x.height <= 36 }
  ];
  const required = [
    {
      label: "Multiple text segments and separator characters/icons",
      test: (x) => {
        const hasSeparator = x.texts && x.texts.some((t) => /[\/>»|]/i.test(t.characters || ""));
        const hasBreadcrumbName = x.name && /breadcrumb|breadcrumbs|path/i.test(x.name);
        return x.textCount >= 2 && (hasSeparator || hasBreadcrumbName || x.shapeCount >= 1);
      }
    }
  ];
  const negative = [
    { label: "Excessive height (>=80px)", penalty: 0.4, test: (x) => x.height >= 80 },
    { label: "Fewer than 2 text links", penalty: 0.6, test: (x) => x.textCount < 2 }
  ];
  return evaluatePattern("Breadcrumb", f, indicators, required, negative);
}
function scoreCourseCardWeighted(f) {
  const indicators = [
    { label: "Title present", weight: 0.25, test: (x) => x.hasHeading || x.maxFontSize >= 16 },
    { label: "Duration text present", weight: 0.25, test: (x) => x.texts && x.texts.some((t) => /hr|hour|week|month|day|duration|mins|min/i.test(t.characters || "")) },
    { label: "Career/industry keywords present", weight: 0.25, test: (x) => x.texts && x.texts.some((t) => /aviation|hospitality|career|developer|designer|business|marketing|job|salary|course|learn/i.test(t.characters || "")) },
    { label: "CTA Button present", weight: 0.25, test: (x) => x.hasCtaButton || x.childButtonsCount >= 1 }
  ];
  const required = [
    {
      label: "Title, duration keyword, career keyword, and CTA button",
      test: (x) => {
        const hasTitle = x.hasHeading || x.maxFontSize >= 15 || x.textCount >= 1;
        const hasDuration = x.texts && x.texts.some((t) => /hr|hour|week|month|day|duration|mins|min/i.test(t.characters || ""));
        const hasCareer = x.texts && x.texts.some((t) => /aviation|hospitality|career|developer|designer|business|marketing|job|salary|course|learn/i.test(t.characters || ""));
        const hasCta = x.hasCtaButton || x.childButtonsCount >= 1 || x.texts && x.texts.some((t) => /enroll|apply|join|start|learn|enquire|view/i.test(t.characters || ""));
        return hasTitle && hasDuration && hasCareer && hasCta;
      }
    }
  ];
  const negative = [
    { label: "Repeated placeholders only", penalty: 0.8, test: (x) => x.meaningfulCount === 0 }
  ];
  return evaluatePattern("Course Card", f, indicators, required, negative);
}
function scoreContentCardWeighted(f) {
  const indicators = [
    { label: "Image fill or placeholder present", weight: 0.3, test: (x) => x.hasImage || x.hasImagePlaceholder || x.hasLargeImageArea || x.childImagesCount >= 1 },
    { label: "Title present", weight: 0.3, test: (x) => x.hasHeading || x.maxFontSize >= 16 },
    { label: "Description/text content present", weight: 0.4, test: (x) => x.textCount >= 2 }
  ];
  const required = [
    {
      label: "Container with image and description/text",
      test: (x) => (x.hasImage || x.hasImagePlaceholder || x.hasLargeImageArea || x.childImagesCount >= 1) && x.textCount >= 2
    }
  ];
  const negative = [
    { label: "Contains CTA button", penalty: 0.5, test: (x) => x.hasCtaButton || x.childButtonsCount >= 1 },
    { label: "Contains course metadata", penalty: 0.5, test: (x) => x.texts && x.texts.some((t) => /hr|hour|week|month|day/i.test(t.characters || "")) }
  ];
  return evaluatePattern("Content Card", f, indicators, required, negative);
}
function scoreCourseListingSectionWeighted(f) {
  const indicators = [
    { label: "Contains 2+ course cards", weight: 0.5, test: (x) => x.childCourseCardsCount >= 2 },
    { label: "Course listing keyword hint", weight: 0.3, test: (x) => x.name && /course|learning|class|academy|lecture/i.test(x.name) },
    { label: "Grid or list structure", weight: 0.2, test: (x) => x.isAutoLayout || x.isHorizontal || x.isVertical }
  ];
  const required = [
    {
      label: "At least 2 course cards OR 2+ generic cards inside course container",
      test: (x) => x.childCourseCardsCount >= 2 || x.childCardsCount >= 2 && x.name && /course|learning|class|academy/i.test(x.name)
    }
  ];
  return evaluatePattern("Course Listing Section", f, indicators, required);
}
function scoreCategorySelectorWeighted(f) {
  const indicators = [
    { label: "Repeated sibling buttons/pills (>=2)", weight: 0.4, test: (x) => x.childButtonsCount >= 2 || x.childCount >= 2 },
    { label: "Short text labels (<=20 chars)", weight: 0.3, test: (x) => x.maxTextLength <= 20 },
    { label: "Mutually exclusive options / horizontal row", weight: 0.3, test: (x) => x.isHorizontal || x.name && /filter|category|selector|tags|tabs/i.test(x.name) }
  ];
  const required = [
    {
      label: "Multiple horizontal sibling buttons/labels with short text",
      test: (x) => x.childCount >= 2 && x.maxTextLength <= 25 && (x.isHorizontal || x.childButtonsCount >= 2 || x.name && /category|selector|filter|tag/i.test(x.name))
    }
  ];
  return evaluatePattern("Category Selector", f, indicators, required);
}
function scoreFilterGroupWeighted(f) {
  const indicators = [
    { label: "Contains check/radio inputs or selector pills", weight: 0.4, test: (x) => x.childInputsCount >= 1 || x.childCategorySelectorsCount >= 1 },
    { label: "Filter keyword name hint", weight: 0.3, test: (x) => x.name && /filter|refine|sort/i.test(x.name) },
    { label: "Layout arrangement", weight: 0.3, test: (x) => x.isVertical || x.isHorizontal }
  ];
  const required = [
    {
      label: "Inputs/selectors present or filter keyword hint",
      test: (x) => (x.childInputsCount >= 1 || x.childCategorySelectorsCount >= 1 || x.name && /filter|refine|sort/i.test(x.name)) && x.childCount >= 1
    }
  ];
  return evaluatePattern("Filter Group", f, indicators, required);
}
function scoreHeroCarouselWeighted(f) {
  const indicators = [
    { label: "Large container size (width >= 360, height >= 200)", weight: 0.3, test: (x) => x.width >= 360 && x.height >= 200 },
    { label: "Hero heading/title and description", weight: 0.3, test: (x) => (x.hasHeading || x.maxFontSize >= 20) && x.textCount >= 2 },
    { label: "Carousel slides and pagination/navigation", weight: 0.4, test: (x) => (x.childCardsCount >= 2 || x.childImagesCount >= 2) && (x.shapeCount >= 3 || x.name && /carousel|slider|dots|pagination/i.test(x.name)) }
  ];
  const required = [
    {
      label: "Large slider with hero title/text and indicators",
      test: (x) => x.width >= 300 && (x.hasHeading || x.maxFontSize >= 16) && (x.childCardsCount >= 1 || x.childImagesCount >= 1 || x.name && /carousel|slider/i.test(x.name))
    }
  ];
  return evaluatePattern("Hero Carousel", f, indicators, required);
}
function scoreBodyContainerWeighted(f) {
  const indicators = [
    { label: "Large container dimensions (width >= 320, height >= 480)", weight: 0.35, test: (x) => x.width >= 320 && x.height >= 480 },
    { label: "Contains multiple children (>=2)", weight: 0.35, test: (x) => x.childCount >= 2 },
    { label: "Contains section-level children (headers, footers, grids, forms)", weight: 0.3, test: (x) => x.childNavigationsCount >= 1 || x.childCardsCount >= 1 || x.childLinksCount >= 1 || x.childInputsCount >= 1 }
  ];
  const required = [
    {
      label: "Large size and nested structural elements",
      test: (x) => x.width >= 280 && x.height >= 400
    }
  ];
  return evaluatePattern("Body Container", f, indicators, required);
}
var WEIGHTED_SCORERS = {
  Button: scoreButtonWeighted,
  "Input Field": scoreInputFieldWeighted,
  Textarea: scoreTextareaWeighted,
  Dropdown: scoreDropdownWeighted,
  Checkbox: scoreCheckboxWeighted,
  "Radio Group": scoreRadioGroupWeighted,
  "Search Bar": scoreSearchBarWeighted,
  Card: scoreCardWeighted,
  "Card Grid": scoreCardGridWeighted,
  Navigation: scoreNavigationWeighted,
  Tabs: scoreTabsWeighted,
  Table: scoreTableWeighted,
  Modal: scoreModalWeighted,
  Sidebar: scoreSidebarWeighted,
  Avatar: scoreAvatarWeighted,
  "Image Block": scoreImageBlockWeighted,
  "Text Block": scoreTextBlockWeighted,
  "CTA Group": scoreCtaGroupWeighted,
  Form: scoreFormWeighted,
  "Form Group": scoreFormGroupWeighted,
  Banner: scoreBannerWeighted,
  Carousel: scoreCarouselWeighted,
  Pagination: scorePaginationWeighted,
  Breadcrumb: scoreBreadcrumbWeighted,
  Header: scoreHeaderWeighted,
  "Link Group": scoreLinkGroupWeighted,
  "Footer Links": scoreFooterLinksWeighted,
  "Navigation Links": scoreNavigationLinksWeighted,
  PlaceholderContent: scorePlaceholderContentWeighted,
  "Hero Section": scoreHeroSectionWeighted,
  "Content Block": scoreContentBlockWeighted,
  "CTA Section": scoreCtaSectionWeighted,
  "Form Section": scoreFormSectionWeighted,
  "Card Grid Section": scoreCardGridSectionWeighted,
  "Footer Section": scoreFooterSectionWeighted,
  "Image Grid Section": scoreImageGridSectionWeighted,
  "Header Section": scoreHeaderSectionWeighted,
  "Navigation Icon": scoreNavigationIconWeighted,
  Heading: scoreHeadingWeighted,
  "Body Text": scoreBodyTextWeighted,
  Paragraph: scoreParagraphWeighted,
  Description: scoreDescriptionWeighted,
  Label: scoreLabelWeighted,
  "Carousel Section": scoreCarouselSectionWeighted,
  "Feature List Section": scoreFeatureListSectionWeighted,
  "Course Card": scoreCourseCardWeighted,
  "Content Card": scoreContentCardWeighted,
  "Course Listing Section": scoreCourseListingSectionWeighted,
  "Category Selector": scoreCategorySelectorWeighted,
  "Filter Group": scoreFilterGroupWeighted,
  "Hero Carousel": scoreHeroCarouselWeighted,
  "Body Container": scoreBodyContainerWeighted
};
function hasSemanticSectionSignals(features) {
  const nameLower = (features.name || "").toLowerCase();
  if (/\b(header|hero|carousel|course|listing|form|footer|feature|section|banner|cta|nav|navigation)\b/i.test(nameLower)) {
    return true;
  }
  if (features.childInputsCount >= 2 && features.childButtonsCount >= 1) {
    return true;
  }
  if ((features.childCardsCount >= 2 || features.childImagesCount >= 2) && (features.textCount >= 2 || features.childTextsCount >= 1)) {
    return true;
  }
  if (features.childLinksCount >= 1 && features.relativeY >= 0.6) {
    return true;
  }
  if ((features.childMenusCount >= 1 || features.childAvatarsCount >= 1 || features.childNavigationsCount >= 1) && (features.isNearTop || features.y < 120)) {
    return true;
  }
  if ((features.childButtonsCount >= 1 || features.hasCtaButton) && (features.textCount >= 2 || features.childTextsCount >= 1) && (features.childImagesCount >= 1 || features.childCardsCount >= 1)) {
    return true;
  }
  return false;
}
function hasComponentSignals(features) {
  const nameLower = (features.name || "").toLowerCase();
  const nameSignals = /\b(button|btn|cta|input|field|dropdown|search|tab|nav|navbar|card|course|modal|sidebar|table|form|banner|carousel|breadcrumb|pagination|avatar|image|checkbox|radio|label|menu|link)\b/i.test(nameLower);
  const structureSignals = features.childButtonsCount >= 1 || features.childInputsCount >= 1 || features.childCardsCount >= 1 || features.childImagesCount >= 1 || features.childLinksCount >= 1 || features.childNavigationsCount >= 1 || features.childMenusCount >= 1 || features.childAvatarsCount >= 1 || features.hasCtaButton || features.hasHeading || features.hasDescription || features.hasImage || features.hasImagePlaceholder;
  return nameSignals || structureSignals;
}
function getStructuralRole(features) {
  const nameLower = (features.name || "").toLowerCase();
  const semanticSectionSignals = hasSemanticSectionSignals(features);
  const componentSignals = hasComponentSignals(features);
  const looksLikePageContainer = (features.candidateDepth <= 1 || features.childCount >= 2) && (features.width >= 320 && features.height >= 480 || /\b(page|screen|main|home|app)\b/i.test(nameLower)) && !semanticSectionSignals && !componentSignals;
  if (looksLikePageContainer) {
    return "page-container";
  }
  const looksLikeLayoutContainer = !semanticSectionSignals && !componentSignals && (features.childCount >= 1 || features.isAutoLayout || features.isNestedGroup || /\b(wrapper|container|group|layout|frame|content|body)\b/i.test(nameLower));
  if (looksLikeLayoutContainer) {
    return "layout-container";
  }
  if (semanticSectionSignals) {
    return "section";
  }
  if (componentSignals) {
    return "component";
  }
  return "primitive";
}
function getEligibility(features, structuralRole) {
  if (structuralRole === "page-container") {
    return { eligible: false, reason: "Page container" };
  }
  if (structuralRole === "layout-container") {
    if (hasSemanticSectionSignals(features)) {
      return { eligible: true, reason: "Semantic section signals" };
    }
    return { eligible: false, reason: "Generic layout container" };
  }
  return { eligible: true, reason: "Eligible by role" };
}
function getDetectionLevel(features) {
  const nameLower = (features.name || "").toLowerCase();
  const hasSectionName = /header|hero|carousel|course|listing|form|footer|feature|section|banner/i.test(nameLower);
  const hasStructuralChildren = features.childInputsCount >= 1 || features.childCardsCount >= 1 || features.childButtonsCount >= 1 || features.childImagesCount >= 1 || features.childLinksCount >= 1 || features.childNavigationsCount >= 1 || features.childTextsCount >= 1;
  if (features.hasBodyContainerIntent || features.width >= 320 && features.height >= 480 && features.childCount >= 2 && !hasSectionName) {
    return "page-container";
  }
  if (features.hasHeaderIntent || features.hasFooterIntent || features.hasHeroCarouselIntent || hasSectionName || hasStructuralChildren && features.childCount >= 2 && (features.textCount >= 2 || features.childCount >= 3)) {
    return "section";
  }
  if (features.childCount >= 1 || features.childButtonsCount >= 1 || features.childInputsCount >= 1 || features.childCardsCount >= 1 || features.childImagesCount >= 1 || features.hasCtaButton || features.hasHeading || features.hasDescription || features.hasImage || features.hasImagePlaceholder) {
    return "component";
  }
  return "primitive";
}
function getAllowedPatternTypes(level) {
  switch (level) {
    case "page-container":
      return ["Body Container"];
    case "section":
      return [
        "Header Section",
        "Hero Section",
        "Hero Carousel",
        "Carousel Section",
        "Course Listing Section",
        "Form Section",
        "Footer Section",
        "Feature List Section",
        "Card Grid Section",
        "Image Grid Section"
      ];
    case "component":
      return [
        "Course Card",
        "Content Card",
        "Card",
        "Button",
        "Input Field",
        "Search Bar",
        "Dropdown",
        "Category Selector",
        "Tabs",
        "Navigation",
        "Footer Links",
        "Card Grid",
        "Form",
        "Form Group",
        "Modal",
        "Sidebar",
        "Table",
        "Banner",
        "Carousel",
        "Pagination",
        "Breadcrumb",
        "Link Group",
        "Navigation Links",
        "CTA Group"
      ];
    case "primitive":
      return [
        "Heading",
        "Body Text",
        "Paragraph",
        "Description",
        "Image Block",
        "Avatar",
        "Checkbox",
        "Radio Group",
        "Label",
        "Text Block",
        "PlaceholderContent",
        "Navigation Icon"
      ];
    default:
      return PATTERN_TYPES;
  }
}
function detectPatternWithDebug(features) {
  const composition = describeComposition(features);
  const structuralRole = getStructuralRole(features);
  const eligibility = getEligibility(features, structuralRole);
  if (!eligibility.eligible) {
    const confidenceLevel2 = getConfidenceLevel(0);
    return {
      composition,
      displayed: false,
      accepted: false,
      detectedType: null,
      confidence: 0,
      confidenceLevel: confidenceLevel2.label,
      confidenceLevelId: confidenceLevel2.id,
      displayMinConfidence: DISPLAY_MIN_CONFIDENCE,
      topMatch: null,
      secondMatch: null,
      confidenceGap: 0,
      explanation: [],
      requiredSignals: [],
      rejectedCategories: [],
      allScores: [],
      rejectionReason: "Skipped: " + eligibility.reason,
      textSemantics: features.textSemantics || null,
      placeholderCount: features.placeholderCount || 0,
      meaningfulCount: features.meaningfulCount || 0,
      placeholderTypes: features.placeholderTypes || []
    };
  }
  const isFormFamily = features.childInputsCount >= 2 && features.childButtonsCount >= 1 || features.childInputsCount >= 3;
  const isCardFamily = features.childCardsCount >= 1 || (features.hasRectangle || features.cornerRadius > 0 || features.hasEffects || features.childCount >= 2) && (features.hasHeading || features.maxFontSize >= 15 || features.name && /title|heading|card/i.test(features.name)) && (features.textCount >= 2 || features.texts && features.texts.some((t) => /hr|hour|week|month|day|duration/i.test(t.characters || ""))) && (features.hasCtaButton || features.childButtonsCount >= 1 || features.texts && features.texts.some((t) => /enroll|apply|join|start|learn|enquire|view/i.test(t.characters || "")));
  const isCarouselFamily = features.name && /carousel|slider|slideshow/i.test(features.name) || (features.shapeCount >= 3 || features.name && /dot|pagination|indicator/i.test(features.name)) || features.childCount >= 2 && (features.childCardsCount >= 2 || features.childImagesCount >= 2) || features.name && /arrow|prev|next|chevron/i.test(features.name);
  const isNavigationFamily = features.textSemantics && features.textSemantics.navKeywordCount >= 1 || (features.childMenusCount >= 1 || features.hasAdjacentAvatarOrIcon || features.name && /menu|hamburger|navbar|nav|header|icon/i.test(features.name)) || features.name && /breadcrumb/i.test(features.name) || features.childCount >= 2 && (features.name && /tab|segment/i.test(features.name));
  const hasHeaderIntent = (features.isNearTop || features.y < 120) && (features.childLinksCount >= 1 || features.childMenusCount >= 1 || features.childAvatarsCount >= 1 || features.name && /header|navbar|nav/i.test(features.name));
  const hasFooterIntent = (features.relativeY >= 0.6 || features.name && /footer/i.test(features.name)) && (features.childLinksCount >= 1 || features.textCount >= 2);
  const hasBodyContainerIntent = features.width >= 320 && features.height >= 480 && (features.childCount >= 2 || features.childNavigationsCount >= 1 || features.childCardsCount >= 1 || features.childLinksCount >= 1 || features.childInputsCount >= 1) && !hasHeaderIntent && !hasFooterIntent;
  const hasHeroCarouselIntent = (features.isCarouselFamily || features.name && /hero|carousel|slider/i.test(features.name)) && (features.childImagesCount >= 1 || features.childCardsCount >= 1) && (features.textCount >= 2 || features.name && /hero|banner/i.test(features.name));
  const hasCourseCardIntent = features.name && /course|learning|academy|class/i.test(features.name) || features.texts && features.texts.some((t) => /course|learning|academy|class|hr|hour|week|month|day/i.test(t.characters || ""));
  const hasFormSectionIntent = features.childInputsCount >= 2 && features.childButtonsCount >= 1;
  features.isFormFamily = isFormFamily;
  features.isCardFamily = isCardFamily;
  features.isCarouselFamily = isCarouselFamily;
  features.isNavigationFamily = isNavigationFamily;
  features.hasHeaderIntent = hasHeaderIntent;
  features.hasFooterIntent = hasFooterIntent;
  features.hasBodyContainerIntent = hasBodyContainerIntent;
  features.hasHeroCarouselIntent = hasHeroCarouselIntent;
  features.hasCourseCardIntent = hasCourseCardIntent;
  features.hasFormSectionIntent = hasFormSectionIntent;
  const categoryResults = [];
  const detectionLevel = getDetectionLevel(features);
  const allowedPatternTypes = getAllowedPatternTypes(detectionLevel);
  const candidatePatternTypes = allowedPatternTypes.filter((type) => WEIGHTED_SCORERS[type]);
  for (let i = 0; i < PATTERN_TYPES.length; i++) {
    const type = PATTERN_TYPES[i];
    const scorer = WEIGHTED_SCORERS[type];
    if (scorer && (candidatePatternTypes.length === 0 || candidatePatternTypes.includes(type))) {
      categoryResults.push(scorer(features));
    }
  }
  applyCompetitionAdjustments(categoryResults, features);
  categoryResults.sort(function(a, b) {
    return b.confidence - a.confidence;
  });
  const top = categoryResults[0];
  const second = categoryResults.length > 1 ? categoryResults[1] : null;
  const topConfidence = top ? top.confidence : 0;
  const secondConfidence = second ? second.confidence : 0;
  const confidenceGap = roundConfidence(topConfidence - secondConfidence);
  const displayed = top && shouldDisplayPattern(top.confidence);
  const confidenceLevel = getConfidenceLevel(topConfidence);
  const accepted = displayed;
  const allScores = categoryResults.map(function(r) {
    return { type: r.type, confidence: r.confidence };
  });
  const rejectedCategories = [];
  const winnerType = displayed && top ? top.type : null;
  for (let j = 0; j < categoryResults.length; j++) {
    const r = categoryResults[j];
    if (winnerType && r.type === winnerType) {
      continue;
    }
    const rejectReasons = r.failedReasons.length > 0 ? r.failedReasons : ["Score below winning category"];
    rejectedCategories.push({
      type: r.type,
      confidence: r.confidence,
      reasons: rejectReasons,
      requiredSignals: r.requiredSignals || []
    });
  }
  if (displayed && top) {
    const childSummaryParts = [];
    if (features.childButtonsCount > 0) childSummaryParts.push(features.childButtonsCount + " Button(s)");
    if (features.childInputsCount > 0) childSummaryParts.push(features.childInputsCount + " Input(s)");
    if (features.childCardsCount > 0) childSummaryParts.push(features.childCardsCount + " Card(s)");
    if (features.childImagesCount > 0) childSummaryParts.push(features.childImagesCount + " Image(s)");
    if (features.childTextsCount > 0) childSummaryParts.push(features.childTextsCount + " Text Block(s)");
    if (features.childPlaceholdersCount > 0) childSummaryParts.push(features.childPlaceholdersCount + " Placeholder(s)");
    if (features.childLinksCount > 0) childSummaryParts.push(features.childLinksCount + " Link(s)");
    if (features.childAvatarsCount > 0) childSummaryParts.push(features.childAvatarsCount + " Avatar(s)");
    if (features.childMenusCount > 0) childSummaryParts.push(features.childMenusCount + " Menu(s)");
    if (features.childNavigationsCount > 0) childSummaryParts.push(features.childNavigationsCount + " Nav/Header(s)");
    const childSummaryString = childSummaryParts.length > 0 ? childSummaryParts.join(" \xB7 ") : "None";
    top.explanation.push({
      label: "Structure: " + childSummaryString,
      passed: true,
      weight: 0,
      type: "info"
    });
    const SECTION_TYPES = /* @__PURE__ */ new Set([
      "Header",
      "Navigation",
      "Hero Section",
      "Form Section",
      "Form",
      "Card Grid",
      "Card Grid Section",
      "Footer Section",
      "Footer Links",
      "Sidebar",
      "Header Section",
      "Image Grid Section",
      "Carousel Section",
      "Feature List Section"
    ]);
    if (SECTION_TYPES.has(top.type)) {
      top.explanation.push({
        label: "Section Type: " + top.type,
        passed: true,
        weight: 0,
        type: "info"
      });
      let reasoningStr = "";
      if (top.type === "Form Section" || top.type === "Form") {
        reasoningStr = `Detected ${features.childInputsCount} Input(s) and ${features.childButtonsCount} Button(s)`;
      } else if (top.type === "Hero Section") {
        reasoningStr = `Detected Title/Heading, Description, and CTA Button`;
      } else if (top.type === "Card Grid Section" || top.type === "Card Grid") {
        reasoningStr = `Detected ${features.childCardsCount} Card(s) with meaningful content`;
      } else if (top.type === "Footer Section" || top.type === "Footer Links") {
        reasoningStr = `Detected ${features.childLinksCount} Footer Link(s) located near bottom`;
      } else if (top.type === "Header" || top.type === "Navigation" || top.type === "Header Section") {
        reasoningStr = `Detected Avatar, Menu, or Navigation links near top`;
      } else if (top.type === "Image Grid Section") {
        reasoningStr = `Detected ${features.childImagesCount} Image Block(s) inside parent`;
      } else if (top.type === "Carousel Section") {
        reasoningStr = `Detected horizontal repeated slide/card items with navigation indicators`;
      } else if (top.type === "Feature List Section") {
        reasoningStr = `Detected repeated icon/shape and text pairings`;
      } else {
        reasoningStr = `Composite layout structure matches ${top.type} indicators`;
      }
      top.explanation.push({
        label: "Reasoning: " + reasoningStr,
        passed: true,
        weight: 0,
        type: "info"
      });
      const childrenTypes = [];
      if (features.childButtonsCount > 0) childrenTypes.push("Button");
      if (features.childInputsCount > 0) childrenTypes.push("Input");
      if (features.childCardsCount > 0) childrenTypes.push("Card");
      if (features.childImagesCount > 0) childrenTypes.push("Image");
      if (features.childTextsCount > 0) childrenTypes.push("Text");
      if (features.childLinksCount > 0) childrenTypes.push("Links");
      if (features.childAvatarsCount > 0) childrenTypes.push("Avatar");
      if (features.childMenusCount > 0) childrenTypes.push("Menu Icon");
      const childrenStr = childrenTypes.length > 0 ? childrenTypes.join(", ") : "None";
      top.explanation.push({
        label: "Children: " + childrenStr,
        passed: true,
        weight: 0,
        type: "info"
      });
      const topRejects = rejectedCategories.slice(0, 2).map((cat) => cat.type).join(", ");
      top.explanation.push({
        label: "Rejected: " + (topRejects || "None"),
        passed: false,
        weight: 0,
        type: "info"
      });
    }
  }
  const result = {
    composition,
    displayed,
    accepted,
    detectedType: displayed && top ? top.type : null,
    confidence: topConfidence,
    confidenceLevel: confidenceLevel.label,
    confidenceLevelId: confidenceLevel.id,
    displayMinConfidence: DISPLAY_MIN_CONFIDENCE,
    topMatch: top ? { type: top.type, confidence: top.confidence } : null,
    secondMatch: second ? { type: second.type, confidence: second.confidence } : null,
    confidenceGap,
    explanation: displayed && top ? top.explanation : [],
    requiredSignals: displayed && top ? top.requiredSignals : [],
    rejectedCategories,
    allScores,
    rejectionReason: displayed ? null : buildRejectionSummary(composition, top, second, confidenceGap),
    textSemantics: features.textSemantics || null,
    placeholderCount: features.placeholderCount || 0,
    meaningfulCount: features.meaningfulCount || 0,
    placeholderTypes: features.placeholderTypes || []
  };
  logScan('Detection attempt: "' + features.name + '"', {
    composition,
    displayed,
    confidenceLevel: confidenceLevel.label,
    topMatch: result.topMatch,
    secondMatch: result.secondMatch,
    confidenceGap,
    allScores
  });
  return result;
}
function buildRejectionSummary(composition, top, second, gap) {
  if (!top) {
    return composition + " \u2192 No pattern scored.";
  }
  const topPct = Math.round(top.confidence * 100);
  const secondPct = second ? Math.round(second.confidence * 100) : 0;
  let msg = composition + " \u2192 Top: " + top.type + " (" + topPct + "%)";
  if (second) {
    msg += ", 2nd: " + second.type + " (" + secondPct + "%), gap " + Math.round(gap * 100) + "%";
  }
  msg += ". Not shown: top match below " + Math.round(DISPLAY_MIN_CONFIDENCE * 100) + "% display threshold.";
  if (top.failedReasons.length > 0) {
    msg += " Missing/Failed: " + top.failedReasons.join(", ") + ".";
  }
  return msg;
}
function detectPattern(features) {
  const debug = detectPatternWithDebug(features);
  if (!debug.displayed) {
    return null;
  }
  return {
    detectedType: debug.detectedType,
    confidence: debug.confidence,
    confidenceLevel: debug.confidenceLevel
  };
}
function scorePlaceholderContentWeighted(f) {
  const indicators = [
    { label: "Placeholder elements present", weight: 0.4, test: (x) => x.placeholderCount >= 1 },
    { label: "No meaningful content", weight: 0.4, test: (x) => x.meaningfulCount === 0 },
    { label: "No structure (no card/carousel patterns)", weight: 0.2, test: (x) => x.childCardsCount === 0 && x.childImagesCount === 0 }
  ];
  const required = [
    {
      label: "No meaningful content, no CTA, no structure, no pagination, no card patterns",
      test: (x) => {
        const noMeaningful = x.meaningfulCount === 0;
        const noCta = x.childButtonsCount === 0 && !x.hasCtaButton;
        const noStructure = x.childCardsCount === 0 && x.childInputsCount === 0 && x.childImagesCount === 0;
        const noPagination = !(x.name && /dot|indicator|pagination|pager/i.test(x.name));
        const noCardPatterns = x.childCardsCount === 0 && !(x.name && /card|tile/i.test(x.name));
        return x.placeholderCount >= 1 && noMeaningful && noCta && noStructure && noPagination && noCardPatterns;
      }
    }
  ];
  return evaluatePattern("PlaceholderContent", f, indicators, required);
}
function scoreLinkGroupWeighted(f) {
  const indicators = [
    { label: "3+ text labels", weight: 0.4, test: (x) => x.textCount >= 3 },
    { label: "Navigation-like wording/labels", weight: 0.3, test: (x) => x.textSemantics.navKeywordCount >= 1 || x.name && /link|menu|nav|footer/i.test(x.name) },
    { label: "Short labels", weight: 0.3, test: (x) => x.isShortLabel || x.maxTextLength <= 30 }
  ];
  const required = [
    {
      label: "3+ short labels, navigation wording, no CTAs, forms, card containers, or image blocks",
      test: (x) => {
        const hasMinLabels = x.textCount >= 3;
        const navWording = x.textSemantics.navKeywordCount >= 1 || x.name && /link|menu|nav|footer|site/i.test(x.name) || x.texts && x.texts.some((t) => /home|about|contact|service|blog|pricing|career/i.test(t.characters || ""));
        const noCta = x.childButtonsCount === 0 && !x.hasCtaButton;
        const noForms = x.childInputsCount === 0;
        const noCards = x.childCardsCount === 0;
        const noImages = !x.hasImage && !x.hasImagePlaceholder && !x.hasLargeImageArea && x.childImagesCount === 0;
        const isShort = x.maxTextLength <= 40;
        return hasMinLabels && navWording && noCta && noForms && noCards && noImages && isShort;
      }
    }
  ];
  const negative = [
    { label: "Inputs exist", penalty: 0.9, test: (x) => x.childInputsCount > 0 },
    { label: "Buttons exist", penalty: 0.9, test: (x) => x.childButtonsCount > 0 || x.hasCtaButton },
    { label: "Card containers exist", penalty: 0.9, test: (x) => x.childCardsCount > 0 },
    { label: "Pagination exists", penalty: 0.9, test: (x) => x.name && /pagination|pager|dots/i.test(x.name) },
    { label: "Large image blocks exist", penalty: 0.9, test: (x) => x.hasImage || x.childImagesCount > 0 }
  ];
  return evaluatePattern("Link Group", f, indicators, required, negative);
}
function scoreFooterLinksWeighted(f) {
  const indicators = [
    { label: "Contains link group features (>=3 texts)", weight: 0.3, test: (x) => x.textCount >= 3 },
    { label: "Located near bottom of screen or footer name hint", weight: 0.3, test: (x) => x.relativeY >= 0.6 || x.name && /footer/i.test(x.name) },
    { label: "Vertical or horizontal arrangement", weight: 0.2, test: (x) => x.isVertical || x.isHorizontal },
    { label: "Footer name keyword hint", weight: 0.2, test: (x) => x.name && /footer/i.test(x.name) }
  ];
  const required = [
    {
      label: "Multiple text segments near bottom of screen or footer name hint",
      test: (x) => x.textCount >= 2 && (x.relativeY >= 0.5 || x.name && /footer/i.test(x.name))
    }
  ];
  const negative = [
    { label: "No text links", penalty: 0.8, test: (x) => x.textCount === 0 },
    { label: "Not near bottom and no footer name hint", penalty: 0.5, test: (x) => x.relativeY < 0.5 && !(x.name && /footer/i.test(x.name)) },
    { label: "Contains input fields (form)", penalty: 0.9, test: (x) => x.childInputsCount >= 1 }
  ];
  return evaluatePattern("Footer Links", f, indicators, required, negative);
}
function scoreNavigationLinksWeighted(f) {
  const indicators = [
    { label: "Contains navigation keywords", weight: 0.4, test: (x) => x.textSemantics && x.textSemantics.navKeywordCount >= 1 },
    { label: "Located near top of screen or navigation name hint", weight: 0.3, test: (x) => x.isNearTop || x.name && /nav|header|menu/i.test(x.name) },
    { label: "Horizontal arrangement", weight: 0.3, test: (x) => x.isHorizontal || x.width > x.height * 2 }
  ];
  const required = [
    {
      label: "Multiple short text labels, and near top or navigation keywords/name hint",
      test: (x) => x.textCount >= 2 && (x.isNearTop || x.textSemantics && x.textSemantics.navKeywordCount >= 1 || x.name && /nav|menu/i.test(x.name))
    }
  ];
  const negative = [
    { label: "No navigation indicators", penalty: 0.6, test: (x) => x.textCount < 2 }
  ];
  return evaluatePattern("Navigation Links", f, indicators, required, negative);
}
function scoreHeaderWeighted(f) {
  const indicators = [
    { label: "Located near top of screen", weight: 0.25, test: (x) => x.isNearTop || x.y < 120 },
    { label: "Large horizontal container size", weight: 0.25, test: (x) => x.width >= 300 && x.height >= 40 && x.height <= 140 },
    { label: "Logo/text/avatar elements present", weight: 0.2, test: (x) => x.textCount >= 1 || x.hasAdjacentAvatarOrIcon || x.childAvatarsCount >= 1 },
    { label: "Header name keyword hint", weight: 0.1, test: (x) => x.name && /header|appbar|topbar|navbar/i.test(x.name) },
    { label: "Avatar + Menu + Links composite header", weight: 0.2, test: (x) => x.childAvatarsCount >= 1 && x.childMenusCount >= 1 && (x.childLinksCount >= 1 || x.childTextsCount >= 1) }
  ];
  const required = [
    {
      label: "At least 2 of: Navigation links, Logo, Avatar, Menu icon, Top-of-screen positioning",
      test: (x) => {
        const hasNavLinks = x.childLinksCount >= 1 || x.name && /links|nav-links|menu-links/i.test(x.name);
        const hasLogo = x.name && /logo/i.test(x.name) || x.texts && x.texts.some((t) => /logo/i.test(t.characters || ""));
        const hasAvatar = x.childAvatarsCount >= 1 || x.name && /avatar|profile/i.test(x.name);
        const hasMenuIcon = x.childMenusCount >= 1 || x.name && /menu|hamburger|nav-icon/i.test(x.name);
        const hasTopPos = x.isNearTop || x.y < 120;
        let count = 0;
        if (hasNavLinks) count++;
        if (hasLogo) count++;
        if (hasAvatar) count++;
        if (hasMenuIcon) count++;
        if (hasTopPos) count++;
        return count >= 2;
      }
    }
  ];
  const negative = [
    { label: "Not near top of screen", penalty: 0.5, test: (x) => !x.isNearTop && x.y >= 180 },
    { label: "Just text + button layout", penalty: 0.6, test: (x) => x.textCount === 1 && (x.childButtonsCount === 1 || x.hasCtaButton) && x.childLinksCount === 0 && x.childAvatarsCount === 0 && x.childMenusCount === 0 },
    { label: "Contains multiple cards or card grids", penalty: 0.8, test: (x) => x.childCardsCount >= 2 || x.childImagesCount >= 3 }
  ];
  return evaluatePattern("Header", f, indicators, required, negative);
}
function scoreHeroSectionWeighted(f) {
  const indicators = [
    { label: "Large size (width >= 360, height >= 180)", weight: 0.2, test: (x) => x.width >= 360 && x.height >= 180 },
    { label: "Heading/title (fontSize >= 20px)", weight: 0.25, test: (x) => x.hasHeading || x.maxFontSize >= 20 },
    { label: "Description text present", weight: 0.2, test: (x) => x.hasDescription || x.textCount >= 2 },
    { label: "Large image area or image child", weight: 0.2, test: (x) => x.hasImage || x.hasLargeImageArea || x.childImagesCount >= 1 },
    { label: "CTA Button present", weight: 0.15, test: (x) => x.hasCtaButton || x.childButtonsCount >= 1 }
  ];
  const required = [
    {
      label: "Contains title/heading, description, and large image",
      test: (x) => (x.hasHeading || x.maxFontSize >= 16) && x.textCount >= 2 && (x.hasImage || x.hasLargeImageArea || x.childImagesCount >= 1 || x.hasImagePlaceholder)
    }
  ];
  const res = evaluatePattern("Hero Section", f, indicators, required);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreContentBlockWeighted(f) {
  const indicators = [
    { label: "Contains text nodes", weight: 0.35, test: (x) => x.textCount >= 1 },
    { label: "Contains button/CTA element", weight: 0.35, test: (x) => x.childButtonsCount >= 1 || x.hasCtaButton },
    { label: "Content block dimensions", weight: 0.3, test: (x) => x.width >= 120 && x.height >= 40 }
  ];
  const required = [
    {
      label: "Contains text and a CTA button",
      test: (x) => x.textCount >= 1 && (x.childButtonsCount >= 1 || x.hasCtaButton)
    }
  ];
  const negative = [
    { label: "Contains input elements (should be Form)", penalty: 0.6, test: (x) => x.childInputsCount >= 1 },
    { label: "Contains cards or images (should be Card)", penalty: 0.4, test: (x) => x.childCardsCount >= 1 || x.childImagesCount >= 1 }
  ];
  return evaluatePattern("Content Block", f, indicators, required, negative);
}
function scoreCtaSectionWeighted(f) {
  const indicators = [
    { label: "Contains child buttons (>=1)", weight: 0.3, test: (x) => x.childButtonsCount >= 1 || x.hasCtaButton },
    { label: "Horizontal alignment or horizontal auto-layout", weight: 0.2, test: (x) => x.isHorizontal || x.width > x.height * 1.5 },
    { label: "CTA keywords present in text or name", weight: 0.2, test: (x) => x.textSemantics.ctaKeywordCount >= 1 || x.name && /cta|button|action/i.test(x.name) },
    { label: "Heading + Description + Button structure", weight: 0.3, test: (x) => x.textCount >= 2 && (x.childButtonsCount >= 1 || x.hasCtaButton) }
  ];
  const required = [
    {
      label: "Contains button / CTA element",
      test: (x) => x.childButtonsCount >= 1 || x.hasCtaButton
    }
  ];
  const negative = [
    { label: "Contains input fields", penalty: 0.7, test: (x) => x.childInputsCount >= 1 },
    { label: "Heavy text paragraphs (>3 text lines)", penalty: 0.4, test: (x) => x.textCount >= 4 }
  ];
  return evaluatePattern("CTA Section", f, indicators, required, negative);
}
function scoreFormSectionWeighted(f) {
  const indicators = [
    { label: "Contains child inputs (>=2)", weight: 0.4, test: (x) => x.childInputsCount >= 2 },
    { label: "Contains child button (>=1)", weight: 0.3, test: (x) => x.childButtonsCount >= 1 },
    { label: "Vertical or form stack layout", weight: 0.3, test: (x) => x.isVertical || x.height > x.width }
  ];
  const required = [
    {
      label: "2+ input fields and 1 button OR 3+ input fields",
      test: (x) => x.childInputsCount >= 2 && x.childButtonsCount >= 1 || x.childInputsCount >= 3
    }
  ];
  const negative = [
    { label: "Contains no input elements", penalty: 0.8, test: (x) => x.childInputsCount === 0 }
  ];
  return evaluatePattern("Form Section", f, indicators, required, negative);
}
function scoreCardGridSectionWeighted(f) {
  const indicators = [
    { label: "Multiple child cards (2 to 12)", weight: 0.4, test: (x) => x.childCardsCount >= 2 && x.childCount <= 12 },
    { label: "Auto-layout or wrap distribution", weight: 0.3, test: (x) => x.isAutoLayout || x.isHorizontal || x.isVertical },
    { label: "Contains meaningful content elements", weight: 0.3, test: (x) => x.meaningfulCount >= 2 }
  ];
  const required = [
    {
      label: "Multiple child cards (cards >= 2)",
      test: (x) => x.childCardsCount >= 2
    }
  ];
  const negative = [
    { label: "Repeated placeholders without content", penalty: 0.8, test: (x) => x.childPlaceholdersCount >= 2 && x.meaningfulCount === 0 }
  ];
  const res = evaluatePattern("Card Grid Section", f, indicators, required, negative);
  res.confidence = roundConfidence(res.confidence * (0.3 + 0.7 * f.contentScore));
  return res;
}
function scoreFooterSectionWeighted(f) {
  const indicators = [
    { label: "Contains link groups or multiple text segments", weight: 0.3, test: (x) => x.childLinksCount >= 1 || x.textCount >= 3 },
    { label: "Footer positioning near bottom of screen", weight: 0.3, test: (x) => x.relativeY >= 0.6 || x.name && /footer/i.test(x.name) },
    { label: "No images or media blocks", weight: 0.2, test: (x) => !x.hasImage && x.childImagesCount === 0 },
    { label: "Footer name keyword hint", weight: 0.2, test: (x) => x.name && /footer/i.test(x.name) }
  ];
  const required = [
    {
      label: "Located near bottom of screen or footer name hint",
      test: (x) => x.relativeY >= 0.5 || x.name && /footer/i.test(x.name)
    }
  ];
  const negative = [
    { label: "Contains images", penalty: 0.7, test: (x) => x.hasImage || x.childImagesCount > 0 },
    { label: "Contains input fields (form)", penalty: 0.9, test: (x) => x.childInputsCount >= 1 }
  ];
  return evaluatePattern("Footer Section", f, indicators, required, negative);
}
function applyCompetitionAdjustments(results, f) {
  const findResult = (type) => results.find((r) => r.type === type);
  const resPlaceholder = findResult("PlaceholderContent");
  const resCardGrid = findResult("Card Grid");
  const resCarousel = findResult("Carousel");
  const resCarouselSection = findResult("Carousel Section");
  const resFeatureListSection = findResult("Feature List Section");
  const resCard = findResult("Card");
  const resTable = findResult("Table");
  const resForm = findResult("Form");
  const resNav = findResult("Navigation");
  const resHeader = findResult("Header");
  const resBanner = findResult("Banner");
  const resSidebar = findResult("Sidebar");
  const resLinkGroup = findResult("Link Group");
  const resFooterLinks = findResult("Footer Links");
  const resNavLinks = findResult("Navigation Links");
  const resBreadcrumb = findResult("Breadcrumb");
  const resHero = findResult("Hero Section");
  const resTextarea = findResult("Textarea");
  const resTabs = findResult("Tabs");
  const resContentBlock = findResult("Content Block");
  const resCtaSection = findResult("CTA Section");
  const resFormSection = findResult("Form Section");
  const resCardGridSection = findResult("Card Grid Section");
  const resFooterSection = findResult("Footer Section");
  const resInputField = findResult("Input Field");
  const resDropdown = findResult("Dropdown");
  const resHeaderSection = findResult("Header Section");
  const resImageGridSection = findResult("Image Grid Section");
  const resNavigationIcon = findResult("Navigation Icon");
  const resCourseCard = findResult("Course Card");
  const resContentCard = findResult("Content Card");
  const resCourseListingSection = findResult("Course Listing Section");
  const resCategorySelector = findResult("Category Selector");
  const resFilterGroup = findResult("Filter Group");
  const resHeroCarousel = findResult("Hero Carousel");
  const resBodyContainer = findResult("Body Container");
  function applyPenalty(res, penalty, label) {
    if (!res) return;
    res.confidence = roundConfidence(res.confidence - penalty);
    res.explanation.push({
      label: `Competition Penalty: ${label} (-${Math.round(penalty * 100)}%)`,
      passed: false,
      weight: penalty,
      type: "penalty"
    });
    res.failedReasons.push(`Competition Penalty: ${label}`);
  }
  function applyBoost(res, boost, label) {
    if (!res) return;
    res.confidence = roundConfidence(res.confidence + boost);
    res.explanation.push({
      label: `Competition Boost: ${label} (+${Math.round(boost * 100)}%)`,
      passed: true,
      weight: boost,
      type: "boost"
    });
  }
  if (f.isFormFamily) {
    applyBoost(resForm, 0.45, "Form Family active");
    applyBoost(resFormSection, 0.45, "Form Family active");
    applyBoost(findResult("Form Group"), 0.25, "Form Family active");
    applyPenalty(resCardGrid, 0.6, "Form Family active conflict");
    applyPenalty(resCardGridSection, 0.6, "Form Family active conflict");
    applyPenalty(resCarousel, 0.6, "Form Family active conflict");
    applyPenalty(resCarouselSection, 0.6, "Form Family active conflict");
    applyPenalty(resImageGridSection, 0.6, "Form Family active conflict");
    applyPenalty(resPlaceholder, 0.6, "Form Family active conflict");
    applyPenalty(resLinkGroup, 0.6, "Form Family active conflict");
  }
  if (f.hasFormSectionIntent) {
    applyBoost(resFormSection, 0.2, "Form section intent");
    applyPenalty(resLinkGroup, 0.7, "Form section intent");
    applyPenalty(findResult("Input Field"), 0.6, "Form section intent");
  }
  if (f.isCardFamily) {
    applyBoost(resCard, 0.35, "Card Family active");
    applyBoost(resCourseCard, 0.45, "Card Family active (Course Card)");
    applyBoost(resContentCard, 0.35, "Card Family active (Content Card)");
    applyBoost(resCardGrid, 0.3, "Card Family active (Card Grid)");
    applyBoost(resCardGridSection, 0.3, "Card Family active (Card Grid Section)");
    applyBoost(resCourseListingSection, 0.35, "Card Family active (Course Listing Section)");
    applyPenalty(resPlaceholder, 0.5, "Card Family active conflict");
    applyPenalty(resLinkGroup, 0.5, "Card Family active conflict");
  }
  if (f.isCarouselFamily) {
    applyBoost(resCarousel, 0.45, "Carousel Family active");
    applyBoost(resCarouselSection, 0.45, "Carousel Family active");
    applyBoost(resHeroCarousel, 0.4, "Carousel Family active (Hero Carousel)");
    applyPenalty(resCardGrid, 0.4, "Carousel Family active conflict");
    applyPenalty(resCardGridSection, 0.4, "Carousel Family active conflict");
    applyPenalty(resPlaceholder, 0.5, "Carousel Family active conflict");
    applyPenalty(resLinkGroup, 0.5, "Carousel Family active conflict");
    applyPenalty(findResult("Image Block"), 0.25, "Carousel Family active conflict");
    applyPenalty(findResult("Description"), 0.45, "Carousel Family active conflict");
  }
  if (f.hasHeroCarouselIntent) {
    applyBoost(resHeroCarousel, 0.3, "Hero carousel intent");
    applyPenalty(resHeader, 0.35, "Hero carousel intent");
    applyPenalty(resHeaderSection, 0.25, "Hero carousel intent");
    applyPenalty(resNav, 0.2, "Hero carousel intent");
    applyPenalty(findResult("Description"), 0.4, "Hero carousel intent");
  }
  if (f.isNavigationFamily) {
    applyBoost(resNav, 0.4, "Navigation Family active");
    applyBoost(resHeader, 0.4, "Navigation Family active");
    applyBoost(resHeaderSection, 0.4, "Navigation Family active");
    applyBoost(resTabs, 0.35, "Navigation Family active");
    applyBoost(resNavLinks, 0.35, "Navigation Family active");
    applyBoost(resCategorySelector, 0.35, "Navigation Family active (Category Selector)");
    applyBoost(resFilterGroup, 0.3, "Navigation Family active (Filter Group)");
    applyBoost(resBreadcrumb, 0.3, "Navigation Family active");
    applyPenalty(resCardGrid, 0.5, "Navigation Family active conflict");
    applyPenalty(resCardGridSection, 0.5, "Navigation Family active conflict");
    applyPenalty(resPlaceholder, 0.6, "Navigation Family active conflict");
  }
  if (f.hasHeaderIntent) {
    applyBoost(resHeader, 0.2, "Header intent");
    applyBoost(resHeaderSection, 0.2, "Header intent");
    applyPenalty(resBodyContainer, 0.2, "Header intent");
  }
  if (f.hasFooterIntent) {
    applyBoost(resFooterSection, 0.25, "Footer intent");
    applyBoost(resFooterLinks, 0.2, "Footer intent");
    applyPenalty(resHeader, 0.35, "Footer intent");
    applyPenalty(resHeaderSection, 0.25, "Footer intent");
  }
  if (f.hasBodyContainerIntent) {
    applyBoost(resBodyContainer, 0.25, "Body container intent");
    applyPenalty(resHeader, 0.35, "Body container intent");
    applyPenalty(resHeaderSection, 0.25, "Body container intent");
    applyPenalty(resNav, 0.2, "Body container intent");
  }
  if (f.hasCourseCardIntent) {
    applyBoost(resCourseCard, 0.2, "Course card intent");
    applyPenalty(findResult("Modal"), 0.55, "Course card intent");
  }
  const hasMultipleChildren = f.childCount >= 2 || f.textCount >= 2;
  const hasStructuralChildren = f.childInputsCount > 0 || f.childCardsCount > 0 || f.childButtonsCount > 0 || f.childImagesCount > 0;
  if (hasMultipleChildren || hasStructuralChildren) {
    if (f.childInputsCount >= 1 || f.childButtonsCount >= 1) {
      applyPenalty(findResult("Image Block"), 0.9, "Parent contains input/button components");
      applyPenalty(findResult("Link Group"), 0.9, "Parent contains input/button components");
      applyPenalty(findResult("PlaceholderContent"), 0.9, "Parent contains input/button components");
      applyPenalty(findResult("Button"), 0.9, "Container layout takes priority over button");
      applyPenalty(findResult("Input Field"), 0.9, "Container layout takes priority over input");
    }
    if (f.childCardsCount >= 1 || f.childImagesCount >= 1) {
      applyPenalty(findResult("Image Block"), 0.8, "Parent contains card/image components");
      applyPenalty(findResult("Link Group"), 0.8, "Parent contains card/image components");
      applyPenalty(findResult("PlaceholderContent"), 0.8, "Parent contains card/image components");
    }
  }
  const hasStructuralLayout = resCarousel && resCarousel.confidence >= 0.3 || resCarouselSection && resCarouselSection.confidence >= 0.3 || resHeroCarousel && resHeroCarousel.confidence >= 0.3 || resCardGrid && resCardGrid.confidence >= 0.3 || resCardGridSection && resCardGridSection.confidence >= 0.3 || resCourseListingSection && resCourseListingSection.confidence >= 0.3 || resImageGridSection && resImageGridSection.confidence >= 0.3 || resFeatureListSection && resFeatureListSection.confidence >= 0.3;
  if (hasStructuralLayout) {
    applyPenalty(resPlaceholder, 0.8, "Structural layout active");
  } else if (resPlaceholder && resPlaceholder.confidence >= 0.5) {
    const penalty = 0.8;
    applyPenalty(resCardGrid, penalty, "Placeholder content detected");
    applyPenalty(resCardGridSection, penalty, "Placeholder content detected");
    applyPenalty(resCourseListingSection, penalty, "Placeholder content detected");
    applyPenalty(resCarousel, penalty, "Placeholder content detected");
    applyPenalty(resCarouselSection, penalty, "Placeholder content detected");
    applyPenalty(resHeroCarousel, penalty, "Placeholder content detected");
    applyPenalty(resCard, penalty, "Placeholder content detected");
    applyPenalty(resCourseCard, penalty, "Placeholder content detected");
    applyPenalty(resContentCard, penalty, "Placeholder content detected");
    applyPenalty(resTable, penalty, "Placeholder content detected");
    applyPenalty(resForm, penalty, "Placeholder content detected");
    applyPenalty(resNav, penalty, "Placeholder content detected");
    applyPenalty(resSidebar, penalty, "Placeholder content detected");
    applyPenalty(resTabs, penalty, "Placeholder content detected");
    applyPenalty(resContentBlock, penalty, "Placeholder content detected");
    applyPenalty(resCtaSection, penalty, "Placeholder content detected");
    applyPenalty(resFormSection, penalty, "Placeholder content detected");
    applyPenalty(resFooterSection, penalty, "Placeholder content detected");
    applyPenalty(resHeaderSection, penalty, "Placeholder content detected");
    applyPenalty(resImageGridSection, penalty, "Placeholder content detected");
    applyPenalty(resFeatureListSection, penalty, "Placeholder content detected");
  }
  if (f.isNearTop || f.y < 120) {
    applyBoost(resNav, 0.4, "Near top of screen");
    applyBoost(resHeader, 0.3, "Near top of screen");
    applyBoost(resHeaderSection, 0.3, "Near top of screen");
    applyBoost(resNavLinks, 0.25, "Near top of screen");
  }
  if (f.relativeY >= 0.6 || f.name && /footer/i.test(f.name)) {
    applyBoost(resFooterLinks, 0.4, "Near bottom/Footer context");
    applyBoost(resFooterSection, 0.4, "Near bottom/Footer context");
    applyBoost(resLinkGroup, 0.3, "Footer context");
    applyPenalty(resCarousel, 0.3, "Footer/bottom context");
    applyPenalty(resCarouselSection, 0.3, "Footer/bottom context");
    applyPenalty(resHeroCarousel, 0.3, "Footer/bottom context");
    applyPenalty(resCardGrid, 0.2, "Footer/bottom context");
    applyPenalty(resCardGridSection, 0.2, "Footer/bottom context");
    applyPenalty(resCourseListingSection, 0.2, "Footer/bottom context");
    applyPenalty(resImageGridSection, 0.2, "Footer/bottom context");
  }
  const linkGroupActive = resLinkGroup && resLinkGroup.confidence >= 0.5 || resFooterLinks && resFooterLinks.confidence >= 0.5 || resNavLinks && resNavLinks.confidence >= 0.5;
  if (linkGroupActive) {
    applyPenalty(resCardGrid, 0.4, "Link group active");
    applyPenalty(resCardGridSection, 0.4, "Link group active");
    applyPenalty(resCourseListingSection, 0.4, "Link group active");
    applyPenalty(resCarousel, 0.4, "Link group active");
    applyPenalty(resCarouselSection, 0.4, "Link group active");
    applyPenalty(resHeroCarousel, 0.4, "Link group active");
    applyPenalty(resCard, 0.3, "Link group active");
    applyPenalty(resCourseCard, 0.3, "Link group active");
    applyPenalty(resContentCard, 0.3, "Link group active");
    applyPenalty(resContentBlock, 0.2, "Link group active");
    applyPenalty(resImageGridSection, 0.4, "Link group active");
  }
  if (f.meaningfulCount === 0 && f.placeholderCount > 0) {
    applyPenalty(resCarousel, 0.5, "No meaningful content");
    applyPenalty(resCarouselSection, 0.5, "No meaningful content");
    applyPenalty(resHeroCarousel, 0.5, "No meaningful content");
    applyPenalty(resCardGrid, 0.5, "No meaningful content");
    applyPenalty(resCardGridSection, 0.5, "No meaningful content");
    applyPenalty(resCourseListingSection, 0.5, "No meaningful content");
    applyPenalty(resCard, 0.5, "No meaningful content");
    applyPenalty(resCourseCard, 0.5, "No meaningful content");
    applyPenalty(resContentCard, 0.5, "No meaningful content");
    applyPenalty(resContentBlock, 0.4, "No meaningful content");
    applyPenalty(resImageGridSection, 0.5, "No meaningful content");
  }
  if (f.textCount === 0) {
    applyPenalty(resNav, 0.8, "No text content");
    applyPenalty(resLinkGroup, 0.8, "No text content");
    applyPenalty(resFooterLinks, 0.8, "No text content");
    applyPenalty(resFooterSection, 0.8, "No text content");
    applyPenalty(resNavLinks, 0.8, "No text content");
    applyPenalty(resBreadcrumb, 0.8, "No text content");
    applyPenalty(resContentBlock, 0.8, "No text content");
    applyPenalty(resCardGridSection, 0.8, "No text content");
    applyPenalty(resCourseListingSection, 0.8, "No text content");
    applyPenalty(resHeaderSection, 0.8, "No text content");
    applyPenalty(resImageGridSection, 0.8, "No text content");
    applyPenalty(resCarouselSection, 0.8, "No text content");
    applyPenalty(resHeroCarousel, 0.8, "No text content");
    applyPenalty(resFeatureListSection, 0.8, "No text content");
  }
  const isNavActive = resNav && resNav.confidence >= 0.5 || resHeader && resHeader.confidence >= 0.5 || resHeaderSection && resHeaderSection.confidence >= 0.5;
  if (isNavActive) {
    applyPenalty(resDropdown, 0.8, "Navigation active");
    applyPenalty(resCarousel, 0.8, "Navigation active");
    applyPenalty(resCarouselSection, 0.8, "Navigation active");
    applyPenalty(resHeroCarousel, 0.8, "Navigation active");
    applyPenalty(resCardGrid, 0.8, "Navigation active");
    applyPenalty(resCardGridSection, 0.8, "Navigation active");
    applyPenalty(resCourseListingSection, 0.8, "Navigation active");
    applyPenalty(resImageGridSection, 0.8, "Navigation active");
  }
  if (resHero && resHero.confidence >= 0.5) {
    applyPenalty(resTextarea, 0.8, "Hero section active");
    applyPenalty(resInputField, 0.8, "Hero section active");
    applyPenalty(resDropdown, 0.8, "Hero section active");
    applyPenalty(resCardGrid, 0.8, "Hero section active");
    applyPenalty(resCardGridSection, 0.8, "Hero section active");
    applyPenalty(resCourseListingSection, 0.8, "Hero section active");
    applyPenalty(resCarousel, 0.8, "Hero section active");
    applyPenalty(resCarouselSection, 0.8, "Hero section active");
    applyPenalty(resHeroCarousel, 0.8, "Hero section active");
    applyPenalty(resCard, 0.8, "Hero section active");
    applyPenalty(resCourseCard, 0.8, "Hero section active");
    applyPenalty(resContentCard, 0.8, "Hero section active");
    applyPenalty(resContentBlock, 0.8, "Hero section active");
    applyPenalty(resCtaSection, 0.6, "Hero section active");
    applyPenalty(resImageGridSection, 0.8, "Hero section active");
    applyPenalty(findResult("Image Block"), 0.8, "Hero section active");
    applyPenalty(findResult("Link Group"), 0.8, "Hero section active");
    applyPenalty(findResult("PlaceholderContent"), 0.8, "Hero section active");
  }
  const isFormActive = resForm && resForm.confidence >= 0.5 || resFormSection && resFormSection.confidence >= 0.5;
  if (isFormActive) {
    applyPenalty(resInputField, 0.9, "Form active");
    applyPenalty(resLinkGroup, 0.9, "Form active");
    applyPenalty(findResult("Image Block"), 0.9, "Form active");
    applyPenalty(resTextarea, 0.8, "Form active");
    applyPenalty(resContentBlock, 0.8, "Form active");
    applyPenalty(resCtaSection, 0.5, "Form active");
    applyBoost(resForm, 0.15, "Strong form components");
    applyBoost(resFormSection, 0.15, "Strong form components");
  }
  const isCarouselSectionActive = resCarouselSection && resCarouselSection.confidence >= 0.5 || resHeroCarousel && resHeroCarousel.confidence >= 0.5;
  if (isCarouselSectionActive) {
    applyPenalty(findResult("Image Block"), 0.8, "Carousel section active");
    applyPenalty(findResult("PlaceholderContent"), 0.8, "Carousel section active");
    applyPenalty(findResult("Link Group"), 0.8, "Carousel section active");
    applyPenalty(resCardGrid, 0.5, "Carousel section active");
    applyPenalty(resCardGridSection, 0.5, "Carousel section active");
  }
  const isCourseListingActive = resCourseListingSection && resCourseListingSection.confidence >= 0.5;
  if (isCourseListingActive) {
    applyPenalty(resCardGrid, 0.5, "Course Listing Section active");
    applyPenalty(resCardGridSection, 0.5, "Course Listing Section active");
    applyPenalty(resLinkGroup, 0.8, "Course Listing Section active");
    applyPenalty(findResult("Image Block"), 0.8, "Course Listing Section active");
  }
  const isCourseCardActive = resCourseCard && resCourseCard.confidence >= 0.5;
  if (isCourseCardActive) {
    applyPenalty(resCard, 0.5, "Course Card active");
    applyPenalty(resContentCard, 0.5, "Course Card active");
    applyPenalty(resLinkGroup, 0.8, "Course Card active");
    applyPenalty(findResult("Image Block"), 0.8, "Course Card active");
  }
  const isCategorySelectorActive = resCategorySelector && resCategorySelector.confidence >= 0.5;
  if (isCategorySelectorActive) {
    applyPenalty(resLinkGroup, 0.8, "Category Selector active");
    applyPenalty(resCardGrid, 0.8, "Category Selector active");
    applyPenalty(findResult("Image Block"), 0.8, "Category Selector active");
    applyPenalty(findResult("PlaceholderContent"), 0.8, "Category Selector active");
  }
  if (resContentBlock && resContentBlock.confidence >= 0.5) {
    applyPenalty(resTextarea, 0.7, "Content block active");
    applyPenalty(resCard, 0.5, "Content block active");
    applyPenalty(resCourseCard, 0.5, "Content block active");
    applyPenalty(resContentCard, 0.5, "Content block active");
    applyPenalty(resBanner, 0.4, "Content block active");
    applyPenalty(resHeader, 0.4, "Content block active");
  }
  if (resCtaSection && resCtaSection.confidence >= 0.5) {
    applyPenalty(resTextarea, 0.7, "CTA section active");
    applyPenalty(resBanner, 0.4, "CTA section active");
    applyPenalty(resHeader, 0.4, "CTA section active");
  }
  if (resNavigationIcon && resNavigationIcon.confidence >= 0.5) {
    applyPenalty(findResult("Checkbox"), 0.8, "Navigation icon active");
    applyPenalty(findResult("Radio Group"), 0.8, "Navigation icon active");
    applyPenalty(findResult("Input Field"), 0.8, "Navigation icon active");
  }
  if (resImageGridSection && resImageGridSection.confidence >= 0.5) {
  }
  const hasCarouselDotsPattern = (f.hasImage || f.hasImagePlaceholder || f.childImagesCount >= 1) && (f.shapeCount >= 3 || f.name && /dot|pagination|indicator/i.test(f.name));
  if (hasCarouselDotsPattern) {
    applyBoost(resCarousel, 0.5, "Image placeholder + pagination dots pattern detected");
    applyBoost(resCarouselSection, 0.5, "Image placeholder + pagination dots pattern detected");
    applyBoost(resHeroCarousel, 0.5, "Image placeholder + pagination dots pattern detected");
    applyPenalty(findResult("Image Block"), 0.8, "Carousel pagination dots boost conflict");
    applyPenalty(findResult("PlaceholderContent"), 0.8, "Carousel pagination dots boost conflict");
  }
  const isBodyContainerActive = resBodyContainer && resBodyContainer.confidence >= 0.5;
  if (isBodyContainerActive) {
    applyPenalty(resNavLinks, 0.8, "Body Container active");
    applyPenalty(resLinkGroup, 0.8, "Body Container active");
  }
}
function scoreImageGridSectionWeighted(f) {
  const indicators = [
    { label: "Multiple child images/placeholders (>=3)", weight: 0.5, test: (x) => x.childImagesCount + x.childPlaceholdersCount >= 3 },
    { label: "Grid or horizontal layout distribution", weight: 0.3, test: (x) => x.isAutoLayout || x.isHorizontal || x.isVertical || x.aspectRatio >= 1.2 },
    { label: "Image-centric name hint", weight: 0.2, test: (x) => x.name && /grid|gallery|placement|images|photos/i.test(x.name) }
  ];
  const required = [
    { label: "At least 3 child images or placeholders", test: (x) => x.childImagesCount + x.childPlaceholdersCount >= 3 }
  ];
  return evaluatePattern("Image Grid Section", f, indicators, required);
}
function scoreHeaderSectionWeighted(f) {
  const indicators = [
    { label: "Contains navigation links or menus", weight: 0.4, test: (x) => x.childLinksCount >= 1 || x.childMenusCount >= 1 || x.hasAdjacentAvatarOrIcon },
    { label: "Near top of screen", weight: 0.4, test: (x) => x.isNearTop || x.y < 120 },
    { label: "Wide horizontal layout", weight: 0.2, test: (x) => x.relativeWidth >= 0.7 && x.width > x.height * 2.5 }
  ];
  const required = [
    { label: "Near top of screen or header name", test: (x) => x.isNearTop || x.y < 150 || x.name && /header|navbar|nav/i.test(x.name) }
  ];
  const negative = [
    { label: "Contains multiple cards or card grids", penalty: 0.8, test: (x) => x.childCardsCount >= 2 || x.childImagesCount >= 3 }
  ];
  return evaluatePattern("Header Section", f, indicators, required, negative);
}
function scoreNavigationIconWeighted(f) {
  const indicators = [
    { label: "Navigation icon name hint", weight: 0.5, test: (x) => x.name && /menu|hamburger|nav-icon|menu-icon|menu-btn/i.test(x.name) },
    { label: "Small icon dimensions", weight: 0.3, test: (x) => x.width >= 12 && x.width <= 64 && x.height >= 12 && x.height <= 64 },
    { label: "Few child elements", weight: 0.2, test: (x) => x.childCount <= 2 }
  ];
  const required = [
    { label: "Navigation icon name hint or small dimensions", test: (x) => x.name && /menu|hamburger|nav-icon/i.test(x.name) || x.width <= 64 && x.height <= 64 && (x.name && /icon|btn/i.test(x.name)) }
  ];
  return evaluatePattern("Navigation Icon", f, indicators, required);
}
function scoreHeadingWeighted(f) {
  const indicators = [
    { label: "Large text size (>=16px)", weight: 0.4, test: (x) => x.maxFontSize >= 16 },
    { label: "Heading name hint", weight: 0.4, test: (x) => x.name && /heading|title|h1|h2|h3|h4|h5|h6/i.test(x.name) },
    { label: "Short text content", weight: 0.2, test: (x) => x.maxTextLength <= 80 }
  ];
  const required = [
    { label: "Contains text content", test: (x) => x.textCount >= 1 || x.type === "TEXT" }
  ];
  const negative = [
    { label: "Is a container with children", penalty: 0.9, test: (x) => x.childCount >= 1 }
  ];
  return evaluatePattern("Heading", f, indicators, required, negative);
}
function scoreBodyTextWeighted(f) {
  const indicators = [
    { label: "Medium text size (12-15px)", weight: 0.3, test: (x) => x.maxFontSize >= 12 && x.maxFontSize <= 15 },
    { label: "Body name hint", weight: 0.4, test: (x) => x.name && /body|text/i.test(x.name) },
    { label: "Medium/Long text content", weight: 0.3, test: (x) => x.maxTextLength >= 20 }
  ];
  const required = [
    { label: "Contains text content", test: (x) => x.textCount >= 1 || x.type === "TEXT" }
  ];
  const negative = [
    { label: "Is a container with children", penalty: 0.9, test: (x) => x.childCount >= 1 }
  ];
  return evaluatePattern("Body Text", f, indicators, required, negative);
}
function scoreParagraphWeighted(f) {
  const indicators = [
    { label: "Longer text content", weight: 0.4, test: (x) => x.maxTextLength >= 40 },
    { label: "Paragraph name hint", weight: 0.4, test: (x) => x.name && /paragraph|para|desc|body/i.test(x.name) },
    { label: "Medium/small text size (<=15px)", weight: 0.2, test: (x) => x.maxFontSize <= 15 }
  ];
  const required = [
    { label: "Contains text content", test: (x) => x.textCount >= 1 || x.type === "TEXT" }
  ];
  const negative = [
    { label: "Is a container with children", penalty: 0.9, test: (x) => x.childCount >= 1 }
  ];
  return evaluatePattern("Paragraph", f, indicators, required, negative);
}
function scoreDescriptionWeighted(f) {
  const indicators = [
    { label: "Description name hint", weight: 0.5, test: (x) => x.name && /desc|description|info/i.test(x.name) },
    { label: "Small/medium text size (<=14px)", weight: 0.3, test: (x) => x.maxFontSize <= 14 },
    { label: "Text content exists", weight: 0.2, test: (x) => x.textCount >= 1 || x.type === "TEXT" }
  ];
  const required = [
    { label: "Contains text content", test: (x) => x.textCount >= 1 || x.type === "TEXT" }
  ];
  const negative = [
    { label: "Is a container with children", penalty: 0.9, test: (x) => x.childCount >= 1 }
  ];
  return evaluatePattern("Description", f, indicators, required, negative);
}
function scoreLabelWeighted(f) {
  const indicators = [
    { label: "Label name hint", weight: 0.4, test: (x) => x.name && /label|tag|caption|badge/i.test(x.name) },
    { label: "Small text size (9-13px)", weight: 0.3, test: (x) => x.maxFontSize <= 13 },
    { label: "Short text length", weight: 0.3, test: (x) => x.maxTextLength <= 30 }
  ];
  const required = [
    { label: "Contains text content", test: (x) => x.textCount >= 1 || x.type === "TEXT" }
  ];
  const negative = [
    { label: "Is a container with children", penalty: 0.9, test: (x) => x.childCount >= 1 }
  ];
  return evaluatePattern("Label", f, indicators, required, negative);
}
export {
  MIN_CONFIDENCE,
  describeComposition,
  detectPattern,
  detectPatternWithDebug
};
