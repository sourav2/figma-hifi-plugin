import { logScan } from '../utils/logger.js';
import { buildPatternSummary } from '../analyzer/confidenceLevels.js';

/** @type {object | null} Latest wireframe analysis result. */
let analysis = null;

function mapPatternForUi(p) {
  return {
    nodeId: p.nodeId,
    nodeName: p.nodeName,
    detectedType: p.detectedType,
    confidence: p.confidence,
    confidenceLevel: p.confidenceLevel || null,
    confidenceLevelId: p.confidenceLevelId || null,
    suggestedCategory: p.suggestedCategory,
    candidateComponents: p.candidateComponents || [],
    componentMatch: p.componentMatch || { bestMatch: null, confidence: 0, alternatives: [] },
    composition: p.composition || null,
    topMatch: p.topMatch || null,
    secondMatch: p.secondMatch || null,
    confidenceGap: p.confidenceGap != null ? p.confidenceGap : 0,
    explanation: p.explanation || [],
    requiredSignals: p.requiredSignals || [],
    rejectedCategories: p.rejectedCategories || [],
    textSemantics: p.textSemantics || null,
    placeholderCount: p.placeholderCount || 0,
    meaningfulCount: p.meaningfulCount || 0,
    placeholderTypes: p.placeholderTypes || [],
  };
}

function mapAttemptForUi(a) {
  return {
    nodeName: a.nodeName,
    nodeType: a.nodeType,
    composition: a.composition,
    displayed: a.displayed || false,
    accepted: a.accepted || false,
    skipped: a.skipped || false,
    detectedType: a.detectedType || null,
    confidence: a.confidence || 0,
    confidenceLevel: a.confidenceLevel || null,
    confidenceLevelId: a.confidenceLevelId || null,
    topMatch: a.topMatch || null,
    secondMatch: a.secondMatch || null,
    confidenceGap: a.confidenceGap != null ? a.confidenceGap : 0,
    explanation: a.explanation || [],
    requiredSignals: a.requiredSignals || [],
    rejectedCategories: a.rejectedCategories || [],
    allScores: a.allScores || [],
    rejectionReason: a.rejectionReason || a.skipReason || null,
    textSemantics: a.textSemantics || null,
    placeholderCount: a.placeholderCount || 0,
    meaningfulCount: a.meaningfulCount || 0,
    placeholderTypes: a.placeholderTypes || [],
  };
}

/**
 * Persists wireframe pattern detection results.
 */
export function setAnalysis(data) {
  analysis = data;
  logScan('patternStore.setAnalysis()', {
    frameName: data.frameName,
    patternCount: data.patterns ? data.patterns.length : 0,
    totalNodesScanned: data.debug ? data.debug.totalNodesScanned : 0,
  });
}

/**
 * Returns the full analysis or null.
 */
export function getAnalysis() {
  return analysis;
}

export function hasAnalysis() {
  return analysis !== null;
}

/**
 * Summary counts for UI.
 */
export function getSummary() {
  if (!analysis) {
    return {
      frameName: null,
      patternCount: 0,
      analyzedAt: null,
      totalNodesScanned: 0,
      candidatesEvaluated: 0,
      designSystemWarning: null,
      patternSummary: buildPatternSummary([]),
    };
  }

  return {
    frameName: analysis.frameName,
    patternCount: analysis.patterns.length,
    analyzedAt: analysis.analyzedAt,
    totalNodesScanned: analysis.debug ? analysis.debug.totalNodesScanned : 0,
    candidatesEvaluated: analysis.debug
      ? analysis.debug.candidatesEvaluated
      : 0,
    designSystemWarning: analysis.debug
      ? analysis.debug.designSystemWarning
      : null,
    patternSummary:
      analysis.patternSummary || buildPatternSummary(analysis.patterns),
  };
}

/**
 * Debug payload for the UI debug section.
 */
function getDebugPayload() {
  if (!analysis || !analysis.debug) {
    return null;
  }

  const d = analysis.debug;

  return {
    totalNodesScanned: d.totalNodesScanned,
    candidatesEvaluated: d.candidatesEvaluated,
    nodeTypesSummary: d.nodeTypesSummary,
    displayMinConfidence: d.displayMinConfidence,
    confidenceTiers: d.confidenceTiers,
    evaluatorNote: d.evaluatorNote,
    designSystemWarning: d.designSystemWarning,
    detectionAttempts: d.detectionAttempts.map(mapAttemptForUi),
  };
}

/**
 * Payload for the Wireframe Analysis Results UI section.
 */
export function getResultsPayload() {
  if (!analysis) {
    return {
      summary: getSummary(),
      patterns: [],
      geometryTree: null,
      patternGraph: null,
      debug: null,
    };
  }

  const payload = {
    summary: getSummary(),
    patterns: analysis.patterns.map(mapPatternForUi),
    geometryTree: analysis.geometryTree || null,
    patternGraph: analysis.patternGraph || null,
    debug: getDebugPayload(),
  };

  logScan('patternStore.getResultsPayload()', {
    patternCount: payload.patterns.length,
    patternSummary: payload.summary.patternSummary,
  });

  return payload;
}
