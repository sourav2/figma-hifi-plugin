/**
 * Inlines ui/dashboard.css and ui/dashboard.js into ui.html.
 * Figma only loads ui.html from the manifest — external script/link src are ignored.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'ui', 'dashboard.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'ui', 'dashboard.js'), 'utf8');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
${css}
  </style>
</head>
<body>
  <div class="app-header">
    <h1>AI Lo-Fi → Hi-Fi Converter</h1>
    <p class="subtitle">Phase 1–2: Design System Scanner &amp; Wireframe Analyzer</p>
  </div>

  <div class="tabs-header">
    <div class="tab-link active" data-tab="scanner-tab">Scanner</div>
    <div class="tab-link" data-tab="analyzer-tab">Analyzer</div>
    <div class="tab-link" data-tab="diagnostics-tab">Diagnostics</div>
  </div>

  <div class="tab-container">
    <!-- SCANNER TAB -->
    <div id="scanner-tab" class="tab-content active">
      <div class="actions">
        <button id="scanBtn" type="button" onclick="window.__hiFiScanClick && window.__hiFiScanClick(event)">Scan Design System</button>
        <button id="viewBtn" type="button" class="secondary">View Results</button>
      </div>

      <div id="results-panel">
        <div class="stats">
          <div class="stat-card">
            <div class="stat-label">Components Found</div>
            <div class="stat-value" id="stat-components">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Variants Found</div>
            <div class="stat-value" id="stat-variants">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Color Styles Found</div>
            <div class="stat-value" id="stat-colors">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Text Styles Found</div>
            <div class="stat-value" id="stat-typography">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Effect Styles Found</div>
            <div class="stat-value" id="stat-effects">0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Grid Styles Found</div>
            <div class="stat-value" id="stat-grids">0</div>
          </div>
        </div>

        <p class="meta" id="meta"></p>
        <p class="samples-heading">Sample data (first 5 per category)</p>
        <div id="samples-container">Run a scan to see sample data.</div>
      </div>
    </div>

    <!-- ANALYZER TAB -->
    <div id="analyzer-tab" class="tab-content">
      <div class="actions">
        <button id="analyzeBtn" type="button">Analyze Selected Frame</button>
      </div>

      <div id="analysis-panel">
        <div id="analysis-warning" class="warning-banner" style="display:none"></div>
        <p class="analysis-meta" id="analysis-meta">Select a frame and click Analyze.</p>
        
        <h3 class="samples-heading">Pattern Summary</h3>
        <div class="pattern-summary-grid" id="pattern-summary-grid">
          <div class="summary-pill"><span class="summary-label">Buttons</span><strong id="summary-buttons">0</strong></div>
          <div class="summary-pill"><span class="summary-label">Cards</span><strong id="summary-cards">0</strong></div>
          <div class="summary-pill"><span class="summary-label">Inputs</span><strong id="summary-inputs">0</strong></div>
          <div class="summary-pill"><span class="summary-label">Navigation</span><strong id="summary-navigation">0</strong></div>
          <div class="summary-pill"><span class="summary-label">Lists</span><strong id="summary-lists">0</strong></div>
        </div>

        <h3 class="samples-heading">Pattern Graph</h3>
        <div id="pattern-graph-tree" class="tree-view-container">Run analysis to see the Pattern Graph.</div>

        <!-- Selected Pattern Details Panel -->
        <h3 class="samples-heading" id="details-heading" style="display:none">Selected Pattern Details</h3>
        <div id="selected-node-details" class="details-panel" style="display:none"></div>

        <h3 class="samples-heading">Geometry Tree</h3>
        <div id="geometry-tree" class="tree-view-container">Run analysis to see the Geometry Tree.</div>

        <p class="samples-heading">Detected patterns (top match ≥30%, sorted by confidence)</p>
        <div id="analysis-results-list"></div>
      </div>
    </div>

    <!-- DIAGNOSTICS TAB -->
    <div id="diagnostics-tab" class="tab-content">
      <div id="debug-panel">
        <div class="debug-toggle-row">
          <input type="checkbox" id="debugToggle" checked />
          <label for="debugToggle">Debug Mode — show diagnostics</label>
        </div>
        <div class="debug-body">
          <h3 class="samples-heading">Debug Stats</h3>
          <div class="debug-stat-grid">
            <div class="debug-stat">
              Total nodes scanned
              <strong id="debug-total-nodes">0</strong>
            </div>
            <div class="debug-stat">
              Container candidates evaluated
              <strong id="debug-candidates">0</strong>
            </div>
          </div>
          <p class="samples-heading">Node types found</p>
          <div class="node-types-list" id="debug-node-types">—</div>
          <p class="debug-note" id="debug-note"></p>
          <p class="samples-heading">Detection attempts (all confidence scores)</p>
          <div id="debug-attempts-wrap">
            <div id="debug-attempts"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <p class="status" id="status"></p>

  <script>
${js}
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'ui.html'), html, 'utf8');
console.log('[inline-ui] Wrote ui.html with inlined CSS and JS');
