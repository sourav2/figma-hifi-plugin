import { scanDesignSystem } from './scanner/designSystemScanner.js';
import * as designSystemStore from './services/designSystemStore.js';
import * as patternStore from './services/patternStore.js';
import * as patternGraphStore from './services/patternGraphStore.js';
import {
  getSelectedFrameRoot,
  analyzeWireframeFrame,
} from './analyzer/wireframeAnalyzer.js';
import { logScan, logScanError, errorMessage } from './utils/logger.js';
import {
  handlePreviewReplacement,
  handleApplyReplacement,
  handleUndoReplacement,
  clearCurrentPreview,
} from './services/replacementService.js';

figma.showUI(__html__, { width: 380, height: 640 });
logScan('Plugin main thread initialized');

/**
 * Handles messages from the plugin UI (dashboard).
 */
figma.ui.onmessage = async (msg) => {
  logScan('figma.ui.onmessage received', msg);

  if (!msg || !msg.type) {
    logScan('onmessage ignored — missing msg or msg.type');
    return;
  }

  switch (msg.type) {
    case 'scan-design-system':
      logScan('Matched message type: scan-design-system');
      figma.notify('Button Click Received');
      logScan('Routing to handleScanDesignSystem()');
      await handleScanDesignSystem();
      break;

    case 'view-results':
      logScan('Routing to handleViewResults()');
      handleViewResults();
      break;

    case 'analyze-selected-frame':
      logScan('Routing to handleAnalyzeSelectedFrame()');
      await handleAnalyzeSelectedFrame();
      break;

    case 'select-node':
      logScan('Routing to handleSelectNode()', msg.nodeId);
      await handleSelectNode(msg.nodeId);
      break;

    case 'preview-replacement':
      logScan('Routing to handlePreviewReplacement()');
      const previewRes = await handlePreviewReplacement(msg.nodeId, msg.componentName);
      figma.ui.postMessage({
        type: 'replacement-status',
        nodeId: msg.nodeId,
        action: 'preview',
        success: previewRes.success,
        error: previewRes.error,
        componentName: msg.componentName,
      });
      if (previewRes.success) {
        figma.notify('Replacement preview created');
      } else {
        figma.notify('Preview failed: ' + previewRes.error, { error: true });
      }
      break;

    case 'cancel-preview':
      logScan('Routing to clearCurrentPreview()');
      await clearCurrentPreview();
      figma.ui.postMessage({
        type: 'replacement-status',
        nodeId: msg.nodeId,
        action: 'cancel-preview',
        success: true,
        componentName: msg.componentName,
      });
      figma.notify('Replacement preview cancelled');
      break;

    case 'apply-replacement':
      logScan('Routing to handleApplyReplacement()');
      const applyRes = await handleApplyReplacement(msg.nodeId, msg.componentName);
      figma.ui.postMessage({
        type: 'replacement-status',
        nodeId: msg.nodeId,
        action: 'apply',
        success: applyRes.success,
        error: applyRes.error,
        componentName: msg.componentName,
      });
      if (applyRes.success) {
        figma.notify('Replacement applied successfully');
      } else {
        figma.notify('Apply failed: ' + applyRes.error, { error: true });
      }
      break;

    case 'undo-replacement':
      logScan('Routing to handleUndoReplacement()');
      const undoRes = await handleUndoReplacement(msg.nodeId);
      figma.ui.postMessage({
        type: 'replacement-status',
        nodeId: msg.nodeId,
        action: 'undo',
        success: undoRes.success,
        error: undoRes.error,
      });
      if (undoRes.success) {
        figma.notify('Replacement reverted');
      } else {
        figma.notify('Undo failed: ' + undoRes.error, { error: true });
      }
      break;

    default:
      logScan('onmessage — unhandled type: ' + msg.type);
      break;
  }
};

/**
 * Focuses selection on the specified canvas node and scrolls it into view.
 */
async function handleSelectNode(nodeId) {
  if (!nodeId) return;
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    } else {
      figma.notify('Node not found on the canvas');
    }
  } catch (error) {
    logScanError('handleSelectNode() — figma.getNodeByIdAsync failed for ' + nodeId, error);
    figma.notify('Failed to select node: ' + error.message, { error: true });
  }
}

/**
 * Runs the design system scanner and sends results to the UI.
 */
async function handleScanDesignSystem() {
  figma.notify('Scanner Started');
  logScan('handleScanDesignSystem() — START (Scanner Started notify shown)');
  figma.notify('Scan Started');

  figma.ui.postMessage({ type: 'scan-started' });
  logScan('Posted scan-started to UI');

  try {
    logScan('Calling scanDesignSystem() — BEFORE');
    const database = await scanDesignSystem();
    logScan('Calling scanDesignSystem() — AFTER', {
      components: database.components.length,
      componentSets: database.variants.length,
      colorStyles: database.colors.length,
      textStyles: database.typography.length,
    });

    designSystemStore.setDatabase(database);
    logScan('designSystemStore.setDatabase() — DONE');

    const payload = designSystemStore.getResultsPayload();
    logScan('Final payload for UI', payload);

    const uiMessage = Object.assign({ type: 'scan-complete' }, payload);
    logScan('Posting scan-complete to UI', {
      type: uiMessage.type,
      summary: uiMessage.summary,
      sampleKeys: uiMessage.samples
        ? Object.keys(uiMessage.samples)
        : null,
    });

    figma.ui.postMessage(uiMessage);

    const summary = payload.summary;
    figma.notify(
      'Design system scanned: ' +
        summary.components +
        ' components, ' +
        summary.variants +
        ' variant sets, ' +
        summary.colors +
        ' colors, ' +
        summary.typography +
        ' text styles',
    );

    figma.notify('Scan Finished');
    logScan('handleScanDesignSystem() — FINISH (success)');
  } catch (error) {
    logScanError('handleScanDesignSystem()', error);
    const message = errorMessage(error);
    figma.ui.postMessage({ type: 'scan-error', message });
    figma.notify('Scan failed: ' + message, { error: true });
  }
}

/**
 * Sends the last scan results to the UI without re-scanning.
 */
function handleViewResults() {
  logScan('handleViewResults() — START');

  if (!designSystemStore.hasDatabase()) {
    logScan('handleViewResults() — no database in store');
    figma.ui.postMessage({
      type: 'no-results',
      message: 'No scan data yet. Run "Scan Design System" first.',
    });
    return;
  }

  const payload = designSystemStore.getResultsPayload();
  logScan('handleViewResults() — posting results', payload);
  figma.ui.postMessage(
    Object.assign({ type: 'results' }, payload),
  );
  logScan('handleViewResults() — FINISH');
}

/**
 * Analyzes the selected wireframe frame and sends pattern detections to the UI.
 */
async function handleAnalyzeSelectedFrame() {
  logScan('handleAnalyzeSelectedFrame() — START');
  await clearCurrentPreview();
  figma.notify('Analyzing wireframe…');

  try {
    const resolved = getSelectedFrameRoot();
    if (resolved.error) {
      figma.ui.postMessage({
        type: 'analyze-error',
        message: resolved.error,
      });
      figma.notify(resolved.error, { error: true });
      return;
    }

    const analysis = await analyzeWireframeFrame(resolved.node, {
      designSystemWarning: resolved.designSystemWarning,
    });
    patternStore.setAnalysis(analysis);
    if (analysis.patternGraph) {
      patternGraphStore.setGraph(analysis.patternGraph);
    }

    const payload = patternStore.getResultsPayload();
    figma.ui.postMessage(
      Object.assign({ type: 'analyze-complete' }, payload),
    );

    figma.notify(
      'Found ' +
        analysis.patterns.length +
        ' UI pattern(s) (shown when top match ≥30%)',
    );
    logScan('handleAnalyzeSelectedFrame() — FINISH');
  } catch (error) {
    logScanError('handleAnalyzeSelectedFrame()', error);
    const message = errorMessage(error);
    figma.ui.postMessage({ type: 'analyze-error', message: message });
    figma.notify('Analysis failed: ' + message, { error: true });
  }
}
