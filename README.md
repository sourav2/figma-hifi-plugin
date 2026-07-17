# AI Lo-Fi → Hi-Fi Converter (Figma Plugin)

A Figma plugin that will convert low-fidelity wireframes into high-fidelity designs using the design system in the current file. **Phase 1** implements a **Design System Scanner** only — no AI or automatic conversion yet.

## Phase 1: Design System Scanner

When you run **Scan Design System**, the plugin:

1. Loads all pages in the file (`figma.loadAllPagesAsync()`).
2. Walks every page and collects **components** and **component sets** (variants).
3. Reads **local styles** from the file: paint (color), text, effect, and grid styles.
4. Builds an in-memory **Design System Database** used for the rest of the plugin session.

### Database shape

```json
{
  "components": [],
  "variants": [],
  "colors": [],
  "typography": [],
  "effects": [],
  "grids": [],
  "scannedAt": "ISO-8601 timestamp",
  "fileName": "Figma file name"
}
```

### What gets collected

| Category | Source | Fields (high level) |
|----------|--------|---------------------|
| **Components** | `COMPONENT` nodes on all pages | name, id, description, width, height, variantProperties, parent component set, page name |
| **Variants** | `COMPONENT_SET` nodes | name, id, description, dimensions, variant property names, child count, page name |
| **Colors** | `figma.getLocalPaintStylesAsync()` | name, id, RGB, HEX (from first solid paint) |
| **Typography** | `figma.getLocalTextStylesAsync()` | name, font family, size, weight (font style), line height, letter spacing |
| **Effects** | `figma.getLocalEffectStylesAsync()` | name, id, effect count and types |
| **Grids** | `figma.getLocalGridStylesAsync()` | name, id, grid count and patterns |

The plugin uses `documentAccess: "dynamic-page"` in `manifest.json`, so all style APIs and `figma.loadAllPagesAsync()` are called asynchronously before scanning.

Use **View Results** to reopen the last scan summary and sample JSON without re-scanning.

## Phase 2: Wireframe Analyzer

1. Run **Scan Design System** first (recommended — improves category suggestions).
2. Select a single **Frame**, **Section**, or **Group** in the canvas.
3. Click **Analyze Selected Frame**.

The plugin traverses child nodes and classifies UI patterns using **weighted heuristics** (auto-layout, text, shapes, images, hierarchy, position). A classification is **accepted only at ≥70% confidence**. Results are stored in `patternStore` and shown under **Wireframe Analysis Results**:

- **Top Match** / **Second Match** / **Confidence Gap** per layer
- **Detected as X because:** checklist of passed indicators (✓)
- **Rejected categories** with failed indicator reasons
- **Debug Mode** — full scores, all indicators (✓/✗), and diagnostics

| Column | Description |
|--------|-------------|
| Layer | Node name in the wireframe |
| Detected Element Type | Button, Card, Input Field, etc. |
| Confidence | Heuristic score (0–100%) |
| Suggested Design System Category | Matched component name from `designSystemStore`, or a default category |

**Detected patterns:** Button, Card, Input Field, Search Bar, Navigation Bar, Hero Section, Avatar, List Item, Table Row, Modal, Sidebar.

No AI, no layer replacement, and no component instances are created in this phase.

## Project structure

```
src/
  main.js                 # Plugin entry, UI message handling
  scanner/
    designSystemScanner.js  # Orchestrates full scan
    componentScanner.js     # Pages → components & variant sets
    styleScanner.js         # Local paint, text, effect, grid styles
  services/
    designSystemStore.js    # In-memory DB + summary/samples for UI
    patternStore.js         # Wireframe analysis results
    categoryMatcher.js      # Maps patterns → design system components
  analyzer/
    wireframeAnalyzer.js    # Selection + traversal
    patternDetector.js      # Heuristic scoring per pattern type
    patterns.js             # Pattern types & keywords
  utils/
    colorUtils.js           # RGB → HEX helpers
    nodeHelpers.js          # Node inspection for analysis

ui/
  dashboard.css           # Results panel & layout
  dashboard.js            # Scan / View Results UI logic

ui.html                   # Plugin UI shell
code.js                   # Bundled output (do not edit by hand)
manifest.json
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/)
- Figma desktop app

### Install & build

```bash
npm install
npm run build
```

`npm run build` bundles `src/main.js` → `code.js` and **inlines** `ui/dashboard.js` + `ui/dashboard.css` into `ui.html`. Figma only loads `ui.html` from the manifest and **ignores** external `<script src>` / `<link href>` — edit UI in `ui/dashboard.js`, then run `npm run build` (or `npm run build:ui`) before testing.

```bash
npm run watch   # Rebuild on file changes
```

### Run in Figma

1. **Plugins → Development → Import plugin from manifest…**
2. Select `manifest.json` in this folder.
3. Open a file that contains components and local styles.
4. Run the plugin → **Scan Design System** → **View Results**.

## Future phases (not implemented)

| Phase | Goal |
|-------|------|
| 2 | ✅ Analyze low-fidelity frames and detect UI patterns |
| 3 | Send patterns + design system inventory to Gemini/OpenAI |
| 4 | Generate high-fidelity screens using design system components |

## License

ISC
