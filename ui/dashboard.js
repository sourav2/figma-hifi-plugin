/**
 * Plugin UI dashboard — communicates with the main thread via postMessage.
 * Source file: inlined into ui.html by scripts/inline-ui.js (Figma ignores external script src).
 */

var UI_PREFIX = '[Hi-Fi UI]';

function uiLog(message, data) {
  if (data !== undefined) {
    console.log(UI_PREFIX + ' ' + message, data);
  } else {
    console.log(UI_PREFIX + ' ' + message);
  }
}

var scanBtn = null;
var viewBtn = null;
var analyzeBtn = null;
var resultsPanel = null;
var samplesContainer = null;
var statusEl = null;
var metaEl = null;
var analysisPanel = null;
var analysisMetaEl = null;
var analysisResultsList = null;
var analysisWarningEl = null;
var summaryButtonsEl = null;
var summaryCardsEl = null;
var summaryInputsEl = null;
var summaryNavigationEl = null;
var summaryListsEl = null;
var debugPanel = null;
var debugToggle = null;
var debugTotalNodesEl = null;
var debugCandidatesEl = null;
var debugNodeTypesEl = null;
var debugNoteEl = null;
var debugAttemptsEl = null;

// New tree view containers
var patternGraphTreeEl = null;
var geometryTreeEl = null;

var statIds = {
  components: 'stat-components',
  variants: 'stat-variants',
  colors: 'stat-colors',
  typography: 'stat-typography',
  effects: 'stat-effects',
  grids: 'stat-grids',
};

function setStatus(text, className) {
  if (!statusEl) {
    return;
  }
  if (className === undefined) {
    className = '';
  }
  statusEl.textContent = text;
  statusEl.className = 'status' + (className ? ' ' + className : '');
}

function setButtonsDisabled(disabled) {
  if (scanBtn) {
    scanBtn.disabled = disabled;
  }
  if (viewBtn) {
    viewBtn.disabled = disabled;
  }
}

/**
 * Updates count cards and sample JSON in the results panel.
 */
function renderResults(summary, samples) {
  uiLog('renderResults() called', { summary: summary, hasSamples: !!samples });

  Object.keys(statIds).forEach(function (key) {
    var el = document.getElementById(statIds[key]);
    if (el && summary[key] !== undefined) {
      el.textContent = String(summary[key]);
    }
  });

  if (summary.scannedAt && metaEl) {
    metaEl.textContent =
      'File: ' +
      (summary.fileName || '—') +
      ' · Scanned: ' +
      new Date(summary.scannedAt).toLocaleString();
  } else if (metaEl) {
    metaEl.textContent = '';
  }

  if (samplesContainer) {
    if (samples) {
      samplesContainer.textContent = JSON.stringify(samples, null, 2);
    } else {
      samplesContainer.textContent = 'No sample data.';
    }
  }

  if (resultsPanel) {
    resultsPanel.classList.add('visible');
  }
  uiLog('Results panel visible, stats updated');
}

function pct(score) {
  return Math.round((score || 0) * 100);
}

function formatMatchLine(label, match) {
  if (!match) {
    return label + ': —';
  }
  return label + ': ' + match.type + ' (' + pct(match.confidence) + '%)';
}

function buildExplanationEl(title, items, showFailed) {
  var block = document.createElement('div');
  block.className = 'explanation-block';

  var heading = document.createElement('div');
  heading.className = 'explanation-title';
  heading.textContent = title;
  block.appendChild(heading);

  if (!items || items.length === 0) {
    var none = document.createElement('div');
    none.textContent = '—';
    block.appendChild(none);
    return block;
  }

  items.forEach(function (item) {
    if (!showFailed && !item.passed) {
      return;
    }
    var line = document.createElement('div');
    line.className =
      'explanation-item ' + (item.passed ? 'pass' : 'fail');
    line.textContent =
      (item.passed ? '✓ ' : '✗ ') + item.label;
    block.appendChild(line);
  });

  return block;
}

function buildRejectedEl(rejectedCategories) {
  var block = document.createElement('div');
  block.className = 'rejected-block';

  var heading = document.createElement('div');
  heading.className = 'explanation-title';
  heading.textContent = 'Rejected categories';
  block.appendChild(heading);

  if (!rejectedCategories || rejectedCategories.length === 0) {
    var none = document.createElement('div');
    none.textContent = '—';
    block.appendChild(none);
    return block;
  }

  rejectedCategories.forEach(function (cat) {
    var line = document.createElement('div');
    line.className = 'rejected-cat';
    line.textContent =
      cat.type +
      ' (' +
      pct(cat.confidence) +
      '%)';
    block.appendChild(line);

    if (cat.reasons && cat.reasons.length > 0) {
      var reasons = document.createElement('div');
      reasons.className = 'rejected-cat-reasons';
      reasons.textContent = cat.reasons.join(' · ');
      block.appendChild(reasons);
    }
  });

  return block;
}

function buildTextSemanticsEl(semantics) {
  var block = document.createElement('div');
  block.className = 'explanation-block';
  block.style.borderTop = '1px solid #e2e8f0';
  block.style.marginTop = '6px';
  block.style.paddingTop = '6px';

  var heading = document.createElement('div');
  heading.className = 'explanation-title';
  heading.textContent = 'Text Semantics:';
  block.appendChild(heading);

  var nodesFound = document.createElement('div');
  nodesFound.className = 'explanation-item';
  nodesFound.style.color = '#475569';
  nodesFound.textContent = '• Text nodes found: ' + (semantics.textNodesCount || 0);
  block.appendChild(nodesFound);

  var avgLen = document.createElement('div');
  avgLen.className = 'explanation-item';
  avgLen.style.color = '#475569';
  avgLen.textContent = '• Average text length: ' + (semantics.avgTextLength || 0) + ' chars';
  block.appendChild(avgLen);

  var navKws = document.createElement('div');
  navKws.className = 'explanation-item';
  navKws.style.color = '#475569';
  navKws.textContent = '• Navigation keywords: ' + 
    (semantics.navKeywordsDetected && semantics.navKeywordsDetected.length > 0 
      ? semantics.navKeywordsDetected.join(', ') 
      : 'None');
  block.appendChild(navKws);

  var ctaKws = document.createElement('div');
  ctaKws.className = 'explanation-item';
  ctaKws.style.color = '#475569';
  ctaKws.textContent = '• CTA keywords: ' + 
    (semantics.ctaKeywordsDetected && semantics.ctaKeywordsDetected.length > 0 
      ? semantics.ctaKeywordsDetected.join(', ') 
      : 'None');
  block.appendChild(ctaKws);

  return block;
}

function buildPlaceholderAnalysisEl(item) {
  var block = document.createElement('div');
  block.className = 'explanation-block';
  block.style.borderTop = '1px solid #e2e8f0';
  block.style.marginTop = '6px';
  block.style.paddingTop = '6px';

  var heading = document.createElement('div');
  heading.className = 'explanation-title';
  heading.textContent = 'Placeholder Analysis:';
  block.appendChild(heading);

  var total = document.createElement('div');
  total.className = 'explanation-item';
  total.style.color = '#475569';
  total.textContent = '• Placeholder Elements Detected: ' + (item.placeholderCount || 0);
  block.appendChild(total);

  var types = document.createElement('div');
  types.className = 'explanation-item';
  types.style.color = '#475569';
  types.textContent = '• Placeholder Types: ' + 
    (item.placeholderTypes && item.placeholderTypes.length > 0 
      ? item.placeholderTypes.join(', ') 
      : 'None');
  block.appendChild(types);

  var meaningful = document.createElement('div');
  meaningful.className = 'explanation-item';
  meaningful.style.color = '#475569';
  meaningful.textContent = '• Meaningful Content Count: ' + (item.meaningfulCount || 0);
  block.appendChild(meaningful);

  var placeholderCount = document.createElement('div');
  placeholderCount.className = 'explanation-item';
  placeholderCount.style.color = '#475569';
  placeholderCount.textContent = '• Placeholder Content Count: ' + (item.placeholderCount || 0);
  block.appendChild(placeholderCount);

  return block;
}

function levelCssClass(levelId) {
  if (!levelId) {
    return 'confidence-very-low';
  }
  return 'confidence-' + levelId;
}

function updateUIForState(panel, nodeId, action, success, error, componentName) {
  var pBtn = panel.querySelector('.replacement-btn-preview');
  var aBtn = panel.querySelector('.replacement-btn-apply');
  var cBtn = panel.querySelector('.replacement-btn-cancel');
  var uBtn = panel.querySelector('.replacement-btn-undo');
  var diag = panel.querySelector('.replacement-diagnostics');
  
  if (pBtn) pBtn.disabled = false;
  if (aBtn) aBtn.disabled = false;
  if (cBtn) cBtn.disabled = false;
  if (uBtn) uBtn.disabled = false;

  var titleEl = panel.querySelector('.pattern-card-title') || panel.querySelector('.details-panel-title');
  var name = titleEl ? titleEl.textContent : nodeId;
  var matchComp = componentName || 'None';
  var isToken = componentName && componentName.startsWith('Token:');
  var tokenName = isToken ? componentName.replace('Token:', '').trim() : '';

  var statusHtml = '<strong>Original Node:</strong> ' + name + '<br>';
  if (isToken) {
    statusHtml += '<strong>Token Found:</strong> ' + tokenName + '<br>';
  } else {
    statusHtml += '<strong>Matched Component:</strong> ' + matchComp + '<br>';
  }

  if (success) {
    if (action === 'preview') {
      if (isToken) {
        statusHtml += '<strong>Token Applied:</strong> <span style="color:#f59e0b; font-weight:600;">Preview Active</span>';
      } else {
        statusHtml += '<strong>Status:</strong> <span style="color:#f59e0b; font-weight:600;">Preview Active</span>';
      }
      if (pBtn) pBtn.style.display = 'none';
      if (cBtn) cBtn.style.display = 'inline-block';
      if (aBtn) aBtn.style.display = 'inline-block';
      if (uBtn) uBtn.style.display = 'none';
    } else if (action === 'cancel-preview') {
      if (isToken) {
        statusHtml += '<strong>Token Applied:</strong> <span style="color:#64748b; font-weight:600;">Preview Cancelled</span>';
      } else {
        statusHtml += '<strong>Status:</strong> <span style="color:#64748b; font-weight:600;">Preview Cancelled</span>';
      }
      if (pBtn) pBtn.style.display = 'inline-block';
      if (cBtn) cBtn.style.display = 'none';
      if (aBtn) aBtn.style.display = 'inline-block';
      if (uBtn) uBtn.style.display = 'none';
    } else if (action === 'apply') {
      if (isToken) {
        statusHtml += '<strong>Token Applied:</strong> <span style="color:#10b981; font-weight:600;">Successfully</span>';
      } else {
        statusHtml += '<strong>Status:</strong> <span style="color:#10b981; font-weight:600;">Replacement Applied</span>';
      }
      if (pBtn) pBtn.style.display = 'none';
      if (cBtn) cBtn.style.display = 'none';
      if (aBtn) aBtn.style.display = 'none';
      if (uBtn) uBtn.style.display = 'inline-block';
    } else if (action === 'undo') {
      if (isToken) {
        statusHtml += '<strong>Token Applied:</strong> <span style="color:#64748b; font-weight:600;">Undone (Original Restored)</span>';
      } else {
        statusHtml += '<strong>Status:</strong> <span style="color:#64748b; font-weight:600;">Undone (Original Restored)</span>';
      }
      if (pBtn) pBtn.style.display = 'inline-block';
      if (cBtn) cBtn.style.display = 'none';
      if (aBtn) aBtn.style.display = 'inline-block';
      if (uBtn) uBtn.style.display = 'none';
    }
  } else {
    if (isToken) {
      statusHtml += '<strong>Application Failed</strong><br>' +
                    '<strong>Reason:</strong> <span style="color:#ef4444; font-weight:600;">' + error + '</span>';
    } else {
      statusHtml += '<strong>Status:</strong> <span style="color:#ef4444; font-weight:600;">Failed: ' + error + '</span>';
    }
  }
  if (diag) {
    diag.innerHTML = statusHtml;
  }
}

function buildPatternCard(item) {
  var levelId = item.confidenceLevelId || 'very-low';
  var card = document.createElement('div');
  card.className = 'pattern-card level-' + levelId;
  card.setAttribute('data-node-id', item.nodeId);

  var title = document.createElement('div');
  title.className = 'pattern-card-title';
  title.textContent = item.nodeName || '—';
  card.appendChild(title);

  var topLine = document.createElement('div');
  topLine.className = 'match-row ' + levelCssClass(levelId);
  topLine.innerHTML =
    '<strong>' + formatMatchLine('Top Match', item.topMatch) + '</strong>';
  card.appendChild(topLine);

  var secondLine = document.createElement('div');
  secondLine.className = 'match-row';
  secondLine.textContent = formatMatchLine('Second Match', item.secondMatch);
  card.appendChild(secondLine);

  var gapLine = document.createElement('div');
  gapLine.className = 'gap-row';
  gapLine.textContent = 'Gap: ' + pct(item.confidenceGap) + '%';
  card.appendChild(gapLine);

  var levelBadge = document.createElement('div');
  levelBadge.className =
    'confidence-level-badge ' + levelCssClass(levelId);
  levelBadge.textContent =
    'Confidence Level: ' + (item.confidenceLevel || 'Very Low');
  card.appendChild(levelBadge);

  // 1. Matched Component Details
  var matchBlock = document.createElement('div');
  matchBlock.className = 'candidate-components-block';
  matchBlock.style.borderTop = '1px solid #e2e8f0';
  matchBlock.style.marginTop = '8px';
  matchBlock.style.paddingTop = '8px';

  var matchTitle = document.createElement('div');
  matchTitle.className = 'explanation-title';
  matchTitle.textContent = 'Component Match Results:';
  matchBlock.appendChild(matchTitle);

  if (item.componentMatch && item.componentMatch.bestMatch && item.componentMatch.bestMatch !== 'No suitable match found') {
    var matchInfo = item.componentMatch;
    
    var bestRow = document.createElement('div');
    bestRow.className = 'match-row';
    bestRow.style.display = 'flex';
    bestRow.style.alignItems = 'center';
    bestRow.style.justifyContent = 'space-between';
    bestRow.style.background = '#f8fafc';
    bestRow.style.padding = '6px 8px';
    bestRow.style.borderRadius = '4px';
    bestRow.style.border = '1px solid #e2e8f0';
    bestRow.style.marginBottom = '6px';
    
    var nameSpan = document.createElement('span');
    nameSpan.className = 'candidate-item-name';
    nameSpan.style.fontWeight = '600';
    nameSpan.textContent = matchInfo.bestMatch;

    var confClass = 'confidence-very-low';
    if (matchInfo.confidence >= 70) confClass = 'confidence-high';
    else if (matchInfo.confidence >= 50) confClass = 'confidence-medium';
    else if (matchInfo.confidence >= 30) confClass = 'confidence-low';

    var scoreBadge = document.createElement('span');
    scoreBadge.className = 'confidence-level-badge ' + confClass;
    scoreBadge.style.marginTop = '0';
    scoreBadge.textContent = matchInfo.confidence + '% match';

    bestRow.appendChild(nameSpan);
    bestRow.appendChild(scoreBadge);
    matchBlock.appendChild(bestRow);

    if (matchInfo.alternatives && matchInfo.alternatives.length > 0) {
      var altTitle = document.createElement('div');
      altTitle.style.fontSize = '9px';
      altTitle.style.fontWeight = '600';
      altTitle.style.color = '#64748b';
      altTitle.style.marginBottom = '2px';
      altTitle.textContent = 'Alternative Matches:';
      matchBlock.appendChild(altTitle);

      var altList = document.createElement('div');
      altList.style.display = 'flex';
      altList.style.flexDirection = 'column';
      altList.style.gap = '4px';

      matchInfo.alternatives.forEach(function (alt) {
        var altItem = document.createElement('div');
        altItem.className = 'candidate-item';
        altItem.style.fontSize = '9px';
        altItem.style.padding = '3px 6px';
        altItem.textContent = alt;
        altList.appendChild(altItem);
      });

      matchBlock.appendChild(altList);
    }
    card.appendChild(matchBlock);
  } else {
    var noMatch = document.createElement('div');
    noMatch.className = 'gap-row';
    noMatch.style.color = '#94a3b8';
    noMatch.style.fontStyle = 'italic';
    noMatch.style.fontSize = '10px';
    noMatch.style.marginTop = '4px';
    noMatch.textContent = 'No matching component found in Design System database. Run scan first.';
    matchBlock.appendChild(noMatch);
    card.appendChild(matchBlock);
  }

  // 2. Replacement Actions Block
  var replacementBlock = document.createElement('div');
  replacementBlock.className = 'replacement-actions-block';

  var repTitle = document.createElement('div');
  repTitle.className = 'explanation-title';
  repTitle.textContent = 'Replacement Controls:';
  replacementBlock.appendChild(repTitle);

  var buttonsRow = document.createElement('div');
  buttonsRow.className = 'replacement-buttons-row';

  var previewBtn = document.createElement('button');
  previewBtn.textContent = 'Preview';
  previewBtn.className = 'replacement-btn replacement-btn-preview';
  buttonsRow.appendChild(previewBtn);

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel Preview';
  cancelBtn.className = 'replacement-btn replacement-btn-cancel';
  cancelBtn.style.display = 'none';
  buttonsRow.appendChild(cancelBtn);

  var applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply';
  applyBtn.className = 'replacement-btn replacement-btn-apply';
  buttonsRow.appendChild(applyBtn);

  var undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.className = 'replacement-btn replacement-btn-undo';
  undoBtn.style.display = 'none';
  buttonsRow.appendChild(undoBtn);

  replacementBlock.appendChild(buttonsRow);

  var diagnosticsLine = document.createElement('div');
  diagnosticsLine.className = 'replacement-diagnostics';
  
  var bestMatchComp = item.componentMatch && item.componentMatch.bestMatch ? item.componentMatch.bestMatch : 'None';
  diagnosticsLine.innerHTML = '<strong>Original Node:</strong> ' + item.nodeName + '<br>' +
                               '<strong>Matched Component:</strong> ' + bestMatchComp + '<br>' +
                               '<strong>Status:</strong> Not applied';
  replacementBlock.appendChild(diagnosticsLine);
  card.appendChild(replacementBlock);

  // 3. Diagnostics Panel
  var diagnosticsBlock = document.createElement('div');
  diagnosticsBlock.className = 'diagnostics-panel-block';

  if (item.detectedType) {
    diagnosticsBlock.appendChild(
      buildExplanationEl(
        'Detected as ' + item.detectedType + ' because:',
        item.explanation,
        false
      )
    );

    if (item.requiredSignals && item.requiredSignals.length > 0) {
      var reqBlock = document.createElement('div');
      reqBlock.className = 'explanation-block';
      reqBlock.style.borderTop = '1px solid #e2e8f0';
      reqBlock.style.marginTop = '6px';
      reqBlock.style.paddingTop = '6px';

      var reqTitle = document.createElement('div');
      reqTitle.className = 'explanation-title';
      reqTitle.textContent = 'Required Signals:';
      reqBlock.appendChild(reqTitle);

      item.requiredSignals.forEach(function (sig) {
        var reqLine = document.createElement('div');
        reqLine.className = 'explanation-item ' + (sig.passed ? 'pass' : 'fail');
        reqLine.textContent = (sig.passed ? '✓ ' : '✗ ') + sig.label;
        reqBlock.appendChild(reqLine);
      });
      diagnosticsBlock.appendChild(reqBlock);
    }
  }

  if (item.placeholderCount !== undefined || item.meaningfulCount !== undefined) {
    var metricsBlock = document.createElement('div');
    metricsBlock.className = 'explanation-block';
    metricsBlock.style.borderTop = '1px solid #e2e8f0';
    metricsBlock.style.marginTop = '6px';
    metricsBlock.style.paddingTop = '6px';

    var metricsTitle = document.createElement('div');
    metricsTitle.className = 'explanation-title';
    metricsTitle.textContent = 'Content Metrics:';
    metricsBlock.appendChild(metricsTitle);

    var metricsInfo = document.createElement('div');
    metricsInfo.className = 'explanation-item';
    metricsInfo.style.color = '#475569';
    metricsInfo.textContent = '• Meaningful Content: ' + (item.meaningfulCount || 0) + ' · Placeholder Content: ' + (item.placeholderCount || 0);
    metricsBlock.appendChild(metricsInfo);

    diagnosticsBlock.appendChild(metricsBlock);
  }

  diagnosticsBlock.appendChild(buildRejectedEl(item.rejectedCategories));
  card.appendChild(diagnosticsBlock);

  // Click listeners
  previewBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!item.componentMatch || !item.componentMatch.bestMatch || item.componentMatch.bestMatch === 'No suitable match found') {
      diagnosticsLine.innerHTML = '<strong>Original Node:</strong> ' + item.nodeName + '<br>' +
                                   '<strong>Matched Component:</strong> None<br>' +
                                   '<strong>Status:</strong> <span style="color:#ef4444">Failed: No suitable match</span>';
      return;
    }
    previewBtn.disabled = true;
    applyBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'preview-replacement',
        nodeId: item.nodeId,
        componentName: item.componentMatch.bestMatch
      }
    }, '*');
  });

  cancelBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    cancelBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'cancel-preview',
        nodeId: item.nodeId,
        componentName: item.componentMatch ? item.componentMatch.bestMatch : ''
      }
    }, '*');
  });

  applyBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!item.componentMatch || !item.componentMatch.bestMatch || item.componentMatch.bestMatch === 'No suitable match found') {
      diagnosticsLine.innerHTML = '<strong>Original Node:</strong> ' + item.nodeName + '<br>' +
                                   '<strong>Matched Component:</strong> None<br>' +
                                   '<strong>Status:</strong> <span style="color:#ef4444">Failed: No suitable match</span>';
      return;
    }
    previewBtn.disabled = true;
    applyBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'apply-replacement',
        nodeId: item.nodeId,
        componentName: item.componentMatch.bestMatch
      }
    }, '*');
  });

  undoBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    undoBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'undo-replacement',
        nodeId: item.nodeId
      }
    }, '*');
  });

  var interactiveHint = document.createElement('div');
  interactiveHint.className = 'interactive-hint';
  interactiveHint.style.fontSize = '10px';
  interactiveHint.style.color = '#18a0fb';
  interactiveHint.style.marginTop = '6px';
  interactiveHint.style.fontWeight = '600';
  interactiveHint.style.cursor = 'pointer';
  interactiveHint.textContent = '▼ Click to expand replacement controls';
  card.appendChild(interactiveHint);

  card.addEventListener('click', function (e) {
    if (e.target.closest('.candidate-item') || e.target.closest('button')) return;
    
    var allCards = document.querySelectorAll('.pattern-card');
    allCards.forEach(function (c) {
      if (c !== card) {
        c.classList.remove('expanded-replacement');
        var hint = c.querySelector('.interactive-hint');
        if (hint) hint.textContent = '▼ Click to expand replacement controls';
      }
    });

    var isExpanded = card.classList.toggle('expanded-replacement');
    interactiveHint.textContent = isExpanded ? '▲ Click to collapse replacement controls' : '▼ Click to expand replacement controls';

    parent.postMessage({ pluginMessage: { type: 'select-node', nodeId: item.nodeId } }, '*');
    card.style.background = '#f8fafc';
    setTimeout(function() {
      card.style.background = '';
    }, 400);
  });
  card.style.cursor = 'pointer';

  return card;
}

function renderPatternSummary(patternSummary) {
  if (!patternSummary) {
    return;
  }
  if (summaryButtonsEl) {
    summaryButtonsEl.textContent = String(patternSummary.buttons || 0);
  }
  if (summaryCardsEl) {
    summaryCardsEl.textContent = String(patternSummary.cards || 0);
  }
  if (summaryInputsEl) {
    summaryInputsEl.textContent = String(patternSummary.inputs || 0);
  }
  if (summaryNavigationEl) {
    summaryNavigationEl.textContent = String(patternSummary.navigation || 0);
  }
  if (summaryListsEl) {
    summaryListsEl.textContent = String(patternSummary.lists || 0);
  }
}

function showSelectedNodeDetails(node) {
  var panel = document.getElementById('selected-node-details');
  var heading = document.getElementById('details-heading');
  if (!panel || !heading) return;

  panel.setAttribute('data-node-id', node.id);
  panel.style.display = 'flex';
  heading.style.display = 'block';

  panel.innerHTML = '';

  var title = document.createElement('div');
  title.className = 'details-panel-title';
  title.textContent = node.name || 'Unnamed Pattern';
  panel.appendChild(title);

  // Pattern type
  var typeRow = document.createElement('div');
  typeRow.className = 'match-row';
  typeRow.style.fontSize = '11px';
  typeRow.style.color = '#334155';
  typeRow.innerHTML = '<strong>Pattern Type:</strong> ' + node.type;
  panel.appendChild(typeRow);

  // Match details
  var matchInfo = node.componentMatch;
  var bestMatch = matchInfo && matchInfo.bestMatch ? matchInfo.bestMatch : 'None';
  var confidence = matchInfo ? matchInfo.confidence : 0;

  var bestRow = document.createElement('div');
  bestRow.className = 'match-row';
  bestRow.style.display = 'flex';
  bestRow.style.alignItems = 'center';
  bestRow.style.justifyContent = 'space-between';
  bestRow.style.background = '#f8fafc';
  bestRow.style.padding = '6px 8px';
  bestRow.style.borderRadius = '4px';
  bestRow.style.border = '1px solid #e2e8f0';
  bestRow.style.marginTop = '4px';

  var nameSpan = document.createElement('span');
  nameSpan.className = 'candidate-item-name';
  nameSpan.style.fontWeight = '600';
  nameSpan.textContent = bestMatch;

  var confClass = 'confidence-very-low';
  if (confidence >= 70) confClass = 'confidence-high';
  else if (confidence >= 50) confClass = 'confidence-medium';
  else if (confidence >= 30) confClass = 'confidence-low';

  var scoreBadge = document.createElement('span');
  scoreBadge.className = 'confidence-level-badge ' + confClass;
  scoreBadge.style.marginTop = '0';
  scoreBadge.textContent = confidence + '% match';

  bestRow.appendChild(nameSpan);
  bestRow.appendChild(scoreBadge);
  panel.appendChild(bestRow);

  // Action buttons
  var replacementBlock = document.createElement('div');
  replacementBlock.className = 'replacement-actions-block';
  replacementBlock.style.marginTop = '4px';
  replacementBlock.style.borderTop = 'none';
  replacementBlock.style.display = 'flex';

  var buttonsRow = document.createElement('div');
  buttonsRow.className = 'replacement-buttons-row';

  var previewBtn = document.createElement('button');
  previewBtn.textContent = 'Preview';
  previewBtn.className = 'replacement-btn replacement-btn-preview';
  buttonsRow.appendChild(previewBtn);

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel Preview';
  cancelBtn.className = 'replacement-btn replacement-btn-cancel';
  cancelBtn.style.display = 'none';
  buttonsRow.appendChild(cancelBtn);

  var applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply';
  applyBtn.className = 'replacement-btn replacement-btn-apply';
  buttonsRow.appendChild(applyBtn);

  var undoBtn = document.createElement('button');
  undoBtn.textContent = 'Undo';
  undoBtn.className = 'replacement-btn replacement-btn-undo';
  undoBtn.style.display = 'none';
  buttonsRow.appendChild(undoBtn);

  replacementBlock.appendChild(buttonsRow);

  var diagnosticsLine = document.createElement('div');
  diagnosticsLine.className = 'replacement-diagnostics';
  diagnosticsLine.innerHTML = '<strong>Original Node:</strong> ' + node.name + '<br>' +
                               '<strong>Matched Component:</strong> ' + bestMatch + '<br>' +
                               '<strong>Status:</strong> Not applied';
  replacementBlock.appendChild(diagnosticsLine);
  panel.appendChild(replacementBlock);

  // Click listeners
  previewBtn.addEventListener('click', function (e) {
    if (bestMatch === 'No suitable match found' || bestMatch === 'None') return;
    previewBtn.disabled = true;
    applyBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'preview-replacement',
        nodeId: node.id,
        componentName: bestMatch
      }
    }, '*');
  });

  cancelBtn.addEventListener('click', function (e) {
    cancelBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'cancel-preview',
        nodeId: node.id,
        componentName: bestMatch
      }
    }, '*');
  });

  applyBtn.addEventListener('click', function (e) {
    if (bestMatch === 'No suitable match found' || bestMatch === 'None') return;
    previewBtn.disabled = true;
    applyBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'apply-replacement',
        nodeId: node.id,
        componentName: bestMatch
      }
    }, '*');
  });

  undoBtn.addEventListener('click', function (e) {
    undoBtn.disabled = true;
    parent.postMessage({
      pluginMessage: {
        type: 'undo-replacement',
        nodeId: node.id
      }
    }, '*');
  });
}

function hideSelectedNodeDetails() {
  var panel = document.getElementById('selected-node-details');
  var heading = document.getElementById('details-heading');
  if (panel) {
    panel.style.display = 'none';
    panel.removeAttribute('data-node-id');
  }
  if (heading) {
    heading.style.display = 'none';
  }
}

/**
 * Builds DOM tree element recursively for geometry tree and pattern graph.
 */
function buildTreeDom(node, isPatternGraph) {
  var wrapper = document.createElement('div');
  wrapper.className = 'tree-node-wrapper';

  var row = document.createElement('div');
  row.className = 'tree-node';
  row.setAttribute('data-id', node.id);

  var hasChildren = node.children && node.children.length > 0;
  
  var toggle = document.createElement('span');
  toggle.className = 'tree-node-toggle';
  toggle.textContent = hasChildren ? '▼' : ' ';
  row.appendChild(toggle);

  var icon = document.createElement('span');
  icon.className = 'tree-node-icon';
  if (isPatternGraph) {
    icon.textContent = node.type === 'Screen' ? '📱' : '🎯';
  } else {
    if (node.isImage) icon.textContent = '🖼️';
    else if (node.type === 'TEXT') icon.textContent = '📝';
    else if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') icon.textContent = '🔹';
    else icon.textContent = '📁';
  }
  row.appendChild(icon);

  var name = document.createElement('span');
  name.className = 'tree-node-name';
  name.textContent = node.name || 'Unnamed';
  row.appendChild(name);

  if (isPatternGraph) {
    if (node.type !== 'Screen') {
      var typeBadge = document.createElement('span');
      typeBadge.className = 'tree-node-pattern-type';
      typeBadge.textContent = node.type + ' (' + pct(node.confidence) + '%)';
      row.appendChild(typeBadge);
    } else {
      var rootBadge = document.createElement('span');
      rootBadge.className = 'tree-node-type';
      rootBadge.textContent = 'ROOT SCREEN';
      row.appendChild(rootBadge);
    }
  } else {
    var typeBadge = document.createElement('span');
    typeBadge.className = 'tree-node-type';
    typeBadge.textContent = node.type + (node.isAutoLayout ? ' (Auto-' + node.layoutMode[0] + ')' : '');
    row.appendChild(typeBadge);
  }

  wrapper.appendChild(row);

  if (hasChildren) {
    var childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-node-children';
    
    node.children.forEach(function (child) {
      childrenContainer.appendChild(buildTreeDom(child, isPatternGraph));
    });
    
    wrapper.appendChild(childrenContainer);

    // Collapsible logic
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      childrenContainer.classList.toggle('collapsed');
      toggle.textContent = childrenContainer.classList.contains('collapsed') ? '▶' : '▼';
    });
  }

  // Selection logic on tree row click
  row.addEventListener('click', function (e) {
    if (e.target.classList.contains('tree-node-toggle')) return;
    
    parent.postMessage({ pluginMessage: { type: 'select-node', nodeId: node.id } }, '*');
    
    if (isPatternGraph && node.type !== 'Screen') {
      showSelectedNodeDetails(node);
    } else {
      hideSelectedNodeDetails();
    }
    
    row.style.background = '#e0f2fe';
    setTimeout(function () {
      row.style.background = '';
    }, 400);
  });

  return wrapper;
}

function renderTree(treeData, container, isPatternGraph) {
  if (!container) return;
  container.innerHTML = '';
  
  if (!treeData) {
    container.textContent = 'No tree data available.';
    return;
  }
  
  container.appendChild(buildTreeDom(treeData, isPatternGraph));
}

/**
 * Renders wireframe pattern detections with match breakdown.
 */
function renderAnalysisResults(summary, patterns, geometryTree, patternGraph, debug) {
  uiLog('renderAnalysisResults()', {
    summary: summary,
    count: patterns ? patterns.length : 0,
    hasGeometry: !!geometryTree,
    hasGraph: !!patternGraph,
    debug: debug,
  });

  if (!analysisPanel) {
    return;
  }

  if (analysisWarningEl) {
    if (summary && summary.designSystemWarning) {
      analysisWarningEl.textContent = summary.designSystemWarning;
      analysisWarningEl.style.display = 'block';
    } else if (debug && debug.designSystemWarning) {
      analysisWarningEl.textContent = debug.designSystemWarning;
      analysisWarningEl.style.display = 'block';
    } else {
      analysisWarningEl.style.display = 'none';
      analysisWarningEl.textContent = '';
    }
  }

  if (analysisMetaEl && summary) {
    var meta =
      (summary.frameName ? 'Frame: ' + summary.frameName : '') +
      (summary.analyzedAt
        ? ' · ' + new Date(summary.analyzedAt).toLocaleString()
        : '') +
      ' · ' +
      (summary.patternCount || 0) +
      ' pattern(s)' +
      (summary.totalNodesScanned !== undefined
        ? ' · ' + summary.totalNodesScanned + ' nodes scanned'
        : '');
    analysisMetaEl.textContent = meta;
  }

  if (summary && summary.patternSummary) {
    renderPatternSummary(summary.patternSummary);
  }

  // Render Trees
  renderTree(patternGraph, patternGraphTreeEl, true);
  renderTree(geometryTree, geometryTreeEl, false);

  if (analysisResultsList) {
    analysisResultsList.innerHTML = '';

    var sorted = (patterns || []).slice().sort(function (a, b) {
      return (b.confidence || 0) - (a.confidence || 0);
    });

    if (sorted.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'analysis-empty';
      empty.textContent =
        'No patterns with top match ≥30%. Check Debug Mode for very low scores or group layers into Frames.';
      analysisResultsList.appendChild(empty);
    } else {
      sorted.forEach(function (p) {
        analysisResultsList.appendChild(buildPatternCard(p));
      });
    }
  }

  analysisPanel.classList.add('visible');
  renderDebugPanel(debug);
}

function formatScoresList(allScores) {
  if (!allScores || allScores.length === 0) {
    return '—';
  }
  return allScores
    .map(function (s) {
      return s.type + ': ' + Math.round(s.confidence * 100) + '%';
    })
    .join(' · ');
}

/**
 * Renders the Debug Mode section with node stats and rejection reasons.
 */
function renderDebugPanel(debug) {
  if (!debugPanel) {
    return;
  }

  if (!debug) {
    debugPanel.classList.remove('visible');
    return;
  }

  debugPanel.classList.add('visible');

  if (debugTotalNodesEl) {
    debugTotalNodesEl.textContent = String(debug.totalNodesScanned || 0);
  }

  if (debugCandidatesEl) {
    debugCandidatesEl.textContent = String(debug.candidatesEvaluated || 0);
  }

  if (debugNodeTypesEl && debug.nodeTypesSummary) {
    if (debug.nodeTypesSummary.length === 0) {
      debugNodeTypesEl.textContent = 'No nodes found.';
    } else {
      debugNodeTypesEl.textContent = debug.nodeTypesSummary
        .map(function (item) {
          return item.type + ': ' + item.count;
        })
        .join('\n');
    }
  }

  if (debugNoteEl) {
    debugNoteEl.textContent = debug.evaluatorNote || '';
  }

  if (debugAttemptsEl) {
    debugAttemptsEl.innerHTML = '';

    var attempts = debug.detectionAttempts || [];

    if (attempts.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'debug-attempt';
      empty.textContent =
        'No container candidates evaluated. Group Rectangle + Text layers into Frames for detection.';
      debugAttemptsEl.appendChild(empty);
    } else {
      attempts.forEach(function (attempt) {
        var block = document.createElement('div');
        block.className = 'debug-attempt';

        var nameLine = document.createElement('div');
        nameLine.className = 'debug-attempt-name';
        nameLine.textContent =
          (attempt.nodeName || '—') +
          ' (' +
          (attempt.nodeType || '?') +
          ')';

        var compLine = document.createElement('div');
        compLine.textContent = attempt.composition || '—';

        var matchLine = document.createElement('div');
        matchLine.className = 'debug-attempt-scores';
        matchLine.textContent =
          formatMatchLine('Top', attempt.topMatch) +
          ' · ' +
          formatMatchLine('2nd', attempt.secondMatch) +
          ' · Gap ' +
          pct(attempt.confidenceGap) +
          '%';

        var scoresLine = document.createElement('div');
        scoresLine.className = 'debug-attempt-scores';
        scoresLine.textContent = formatScoresList(attempt.allScores);

        var statusLine = document.createElement('div');

        if (attempt.skipped) {
          statusLine.className = 'debug-attempt-skipped';
          statusLine.textContent = attempt.rejectionReason || 'Skipped';
        } else if (attempt.displayed) {
          statusLine.className = 'debug-attempt-accepted';
          statusLine.textContent =
            'Shown as ' +
            attempt.detectedType +
            ' (' +
            pct(attempt.confidence) +
            '% · ' +
            (attempt.confidenceLevel || '—') +
            ')';
        } else {
          statusLine.className = 'debug-attempt-rejected';
          statusLine.textContent =
            attempt.rejectionReason ||
            'Hidden: top match below 30% (Very Low)';
        }

        block.appendChild(nameLine);
        block.appendChild(compLine);
        if (!attempt.skipped) {
          block.appendChild(matchLine);
          if (attempt.allScores && attempt.allScores.length) {
            block.appendChild(scoresLine);
          }
          if (attempt.explanation && attempt.explanation.length) {
            block.appendChild(
              buildExplanationEl('Indicators', attempt.explanation, true),
            );
          }
          if (attempt.requiredSignals && attempt.requiredSignals.length > 0) {
            var attemptReq = attempt.requiredSignals.map(function(s) {
              return { label: s.label, passed: s.passed };
            });
            block.appendChild(
              buildExplanationEl('Required Signals', attemptReq, true)
            );
          }
          if (
            attempt.rejectedCategories &&
            attempt.rejectedCategories.length
          ) {
            block.appendChild(
              buildRejectedEl(attempt.rejectedCategories),
            );
          }
          if (attempt.textSemantics) {
            block.appendChild(buildTextSemanticsEl(attempt.textSemantics));
          }
          if (attempt.placeholderCount !== undefined) {
            block.appendChild(buildPlaceholderAnalysisEl(attempt));
          }
        }
        block.appendChild(statusLine);
        debugAttemptsEl.appendChild(block);
      });
    }
  }

  if (debugToggle && debugToggle.checked) {
    debugPanel.classList.add('expanded');
  } else {
    debugPanel.classList.remove('expanded');
  }
}

function onDebugToggleChange() {
  if (!debugPanel || !debugToggle) {
    return;
  }
  if (debugToggle.checked) {
    debugPanel.classList.add('expanded');
  } else {
    debugPanel.classList.remove('expanded');
  }
}

function onScanButtonClick() {
  console.log('BUTTON CLICKED');
  uiLog('onScanButtonClick() — BUTTON CLICKED');

  setStatus('Scanning design system…');
  setButtonsDisabled(true);

  var pluginMessage = { type: 'scan-design-system' };
  uiLog('Sending postMessage to plugin controller', pluginMessage);
  parent.postMessage({ pluginMessage: pluginMessage }, '*');
  uiLog('postMessage dispatched with type: scan-design-system');
}

function onViewResultsClick() {
  uiLog('View Results button clicked');
  parent.postMessage({ pluginMessage: { type: 'view-results' } }, '*');
}

function onAnalyzeButtonClick() {
  console.log('ANALYZE BUTTON CLICKED');
  uiLog('Analyze Selected Frame button clicked');

  setStatus('Analyzing selected frame…');
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
  }

  parent.postMessage(
    { pluginMessage: { type: 'analyze-selected-frame' } },
    '*',
  );
}

/**
 * Tab switching setup.
 */
function initTabs() {
  var tabLinks = document.querySelectorAll('.tab-link');
  var tabContents = document.querySelectorAll('.tab-content');
  
  tabLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      var targetTab = link.getAttribute('data-tab');
      
      tabLinks.forEach(function (l) { l.classList.remove('active'); });
      tabContents.forEach(function (c) { c.classList.remove('active'); });
      
      link.classList.add('active');
      var targetEl = document.getElementById(targetTab);
      if (targetEl) {
        targetEl.classList.add('active');
      }
      
      uiLog('Tab activated: ' + targetTab);
    });
  });
}

function initDashboard() {
  uiLog('initDashboard() — START');

  scanBtn = document.getElementById('scanBtn');
  viewBtn = document.getElementById('viewBtn');
  analyzeBtn = document.getElementById('analyzeBtn');
  resultsPanel = document.getElementById('results-panel');
  samplesContainer = document.getElementById('samples-container');
  statusEl = document.getElementById('status');
  metaEl = document.getElementById('meta');
  analysisPanel = document.getElementById('analysis-panel');
  analysisMetaEl = document.getElementById('analysis-meta');
  analysisResultsList = document.getElementById('analysis-results-list');
  summaryButtonsEl = document.getElementById('summary-buttons');
  summaryCardsEl = document.getElementById('summary-cards');
  summaryInputsEl = document.getElementById('summary-inputs');
  summaryNavigationEl = document.getElementById('summary-navigation');
  summaryListsEl = document.getElementById('summary-lists');
  analysisWarningEl = document.getElementById('analysis-warning');
  debugPanel = document.getElementById('debug-panel');
  debugToggle = document.getElementById('debugToggle');
  debugTotalNodesEl = document.getElementById('debug-total-nodes');
  debugCandidatesEl = document.getElementById('debug-candidates');
  debugNodeTypesEl = document.getElementById('debug-node-types');
  debugNoteEl = document.getElementById('debug-note');
  debugAttemptsEl = document.getElementById('debug-attempts');

  // Interactive Tree view binders
  patternGraphTreeEl = document.getElementById('pattern-graph-tree');
  geometryTreeEl = document.getElementById('geometry-tree');

  if (!scanBtn) {
    console.error(UI_PREFIX + ' ERROR: #scanBtn not found — cannot attach listener');
    setStatus('UI error: Scan button not found.', 'error');
    return;
  }

  window.__hiFiScanClick = onScanButtonClick;

  scanBtn.addEventListener('click', onScanButtonClick);
  uiLog('Event listener attached to #scanBtn');

  if (viewBtn) {
    viewBtn.addEventListener('click', onViewResultsClick);
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', onAnalyzeButtonClick);
    uiLog('Event listener attached to #analyzeBtn');
  }

  if (debugToggle) {
    debugToggle.addEventListener('change', onDebugToggleChange);
    debugToggle.checked = true;
    onDebugToggleChange();
  }

  initTabs();

  uiLog('initDashboard() — FINISH');
}

window.onmessage = function (event) {
  uiLog('window.onmessage fired', event.data);

  var msg = event.data.pluginMessage;
  if (!msg) {
    uiLog('No pluginMessage in event — ignoring');
    return;
  }

  uiLog('Received pluginMessage from controller', msg);

  switch (msg.type) {
    case 'scan-started':
      uiLog('Handler: scan-started');
      setStatus('Loading pages and scanning…');
      setButtonsDisabled(true);
      break;

    case 'scan-complete':
      uiLog('Handler: scan-complete', {
        summary: msg.summary,
        hasSamples: !!msg.samples,
      });
      setButtonsDisabled(false);
      setStatus('Scan complete.', 'success');
      if (msg.summary) {
        renderResults(msg.summary, msg.samples);
      } else {
        setStatus('Scan complete but no summary in payload.', 'error');
      }
      break;

    case 'results':
      uiLog('Handler: results', { summary: msg.summary });
      setStatus('Showing last scan results.', 'success');
      renderResults(msg.summary, msg.samples);
      break;

    case 'analyze-complete':
      uiLog('Handler: analyze-complete', {
        summary: msg.summary,
        patterns: msg.patterns,
        geometryTree: msg.geometryTree,
        patternGraph: msg.patternGraph,
        debug: msg.debug,
      });
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
      }
      setStatus('Wireframe analysis complete.', 'success');
      hideSelectedNodeDetails();
      renderAnalysisResults(msg.summary, msg.patterns, msg.geometryTree, msg.patternGraph, msg.debug);
      break;

    case 'analyze-error':
      uiLog('Handler: analyze-error', msg.message);
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
      }
      setStatus('Analysis error: ' + msg.message, 'error');
      break;

    case 'no-results':
      uiLog('Handler: no-results', msg.message);
      setStatus(msg.message || 'No results available.', 'error');
      break;

    case 'replacement-status':
      uiLog('Handler: replacement-status', msg);
      
      // Update Selected Node Details panel if active
      var detailsPanel = document.getElementById('selected-node-details');
      if (detailsPanel && detailsPanel.getAttribute('data-node-id') === msg.nodeId) {
        updateUIForState(detailsPanel, msg.nodeId, msg.action, msg.success, msg.error, msg.componentName);
      }

      var targetCard = document.querySelector('[data-node-id="' + msg.nodeId + '"]');
      if (targetCard) {
        updateUIForState(targetCard, msg.nodeId, msg.action, msg.success, msg.error, msg.componentName);
      }
      break;

    case 'scan-error':
      uiLog('Handler: scan-error', msg.message);
      setButtonsDisabled(false);
      setStatus('Error: ' + msg.message, 'error');
      break;

    default:
      uiLog('Handler: unhandled message type — ' + msg.type);
      break;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
