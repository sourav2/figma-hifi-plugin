import { collectTextNodes } from '../utils/nodeHelpers.js';
import * as designSystemStore from './designSystemStore.js';
import { logScan, logScanError } from '../utils/logger.js';

let currentPreview = null;
const undoStack = [];

export async function clearCurrentPreview() {
  if (!currentPreview) return;
  try {
    const instance = await figma.getNodeByIdAsync(currentPreview.instanceId);
    if (instance) {
      instance.remove();
    }
    const original = await figma.getNodeByIdAsync(currentPreview.originalNodeId);
    if (original) {
      original.visible = true;
    }
  } catch (err) {
    logScanError('clearCurrentPreview() failed', err);
  }
  currentPreview = null;
}

export function findComponentInDb(name) {
  const db = designSystemStore.getDatabase();
  if (!db || !db.components) return null;
  // Try exact ID
  let found = db.components.find(c => c.id === name);
  if (found) return found;
  // Try name match
  found = db.components.find(c => c.name === name);
  if (found) return found;
  // Try set/name match
  found = db.components.find(c => {
    const fullName = c.parentComponentSet ? `${c.parentComponentSet.name}/${c.name}` : c.name;
    return fullName === name;
  });
  return found;
}

async function applyTokenStyles(clone, componentName) {
  const db = designSystemStore.getDatabase();
  if (!db) return;

  const styleName = componentName.replace(/^Token:\s*/, '');

  if (clone.type === 'TEXT') {
    const textStyle = db.typography.find(t => t.name === styleName || `Typography/${t.name}` === styleName);
    if (textStyle) {
      try {
        if (clone.fontName !== figma.mixed) {
          await figma.loadFontAsync(clone.fontName);
        } else {
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        }
        
        if (textStyle.fontFamily && textStyle.fontWeight) {
          await figma.loadFontAsync({ family: textStyle.fontFamily, style: textStyle.fontWeight });
        }
        await clone.setTextStyleIdAsync(textStyle.id);
      } catch (err) {
        logScanError('Failed to apply textStyleId', err);
        throw new Error('Failed to apply textStyleId: ' + err.message);
      }
    }

    const colorStyle = db.colors.find(c => c.name.toLowerCase().indexOf('text') !== -1 || c.name.toLowerCase().indexOf('foreground') !== -1);
    if (colorStyle) {
      try {
        await clone.setFillStyleIdAsync(colorStyle.id);
      } catch (err) {
        logScanError('Failed to apply fillStyleId', err);
        throw new Error('Failed to apply fillStyleId: ' + err.message);
      }
    }
  } else {
    // Container radius styling
    if ('cornerRadius' in clone) {
      if (styleName.indexOf('Small') !== -1) clone.cornerRadius = 4;
      else if (styleName.indexOf('Large') !== -1) clone.cornerRadius = 16;
      else clone.cornerRadius = 8;
    }

    // Effect styling (Elevation)
    if (db.effects && db.effects.length > 0) {
      const effectStyle = db.effects.find(e => e.name === styleName || e.name.toLowerCase().indexOf('shadow') !== -1 || e.name.toLowerCase().indexOf('elevation') !== -1);
      if (effectStyle) {
        try {
          await clone.setEffectStyleIdAsync(effectStyle.id);
        } catch (err) {
          logScanError('Failed to apply effectStyleId', err);
          throw new Error('Failed to apply effectStyleId: ' + err.message);
        }
      }
    }

    // Background color style
    if (db.colors && db.colors.length > 0) {
      const colorStyle = db.colors.find(c => c.name === styleName || c.name.toLowerCase().indexOf('bg') !== -1 || c.name.toLowerCase().indexOf('background') !== -1 || c.name.toLowerCase().indexOf('surface') !== -1);
      if (colorStyle) {
        try {
          await clone.setFillStyleIdAsync(colorStyle.id);
        } catch (err) {
          logScanError('Failed to apply fillStyleId', err);
          throw new Error('Failed to apply fillStyleId: ' + err.message);
        }
      }
    }

    // Image placeholder styling if it's an image surface or placeholder
    if (componentName.toLowerCase().indexOf('image') !== -1 || styleName.toLowerCase().indexOf('image') !== -1 || styleName.toLowerCase().indexOf('surface') !== -1) {
      clone.fills = [{
        type: 'SOLID',
        color: { r: 0.9, g: 0.9, b: 0.9 },
        opacity: 1
      }];
      clone.strokes = [{
        type: 'SOLID',
        color: { r: 0.7, g: 0.7, b: 0.7 }
      }];
      clone.strokeWeight = 1;
    }
  }
}

export async function handlePreviewReplacement(originalNodeId, componentName) {
  await clearCurrentPreview();
  
  try {
    const originalNode = await figma.getNodeByIdAsync(originalNodeId);
    if (!originalNode) {
      return { success: false, error: 'Original wireframe node not found.' };
    }

    if (componentName && componentName.startsWith('Token:')) {
      const clone = originalNode.clone();
      
      // Position it
      clone.x = originalNode.x;
      clone.y = originalNode.y;
      
      // Insert into parent
      if (originalNode.parent) {
        const index = originalNode.parent.children.indexOf(originalNode);
        originalNode.parent.insertChild(index, clone);
      }
      
      // Apply token styling
      await applyTokenStyles(clone, componentName);
      
      // Hide original node
      originalNode.visible = false;
      
      // Store preview state
      currentPreview = {
        originalNodeId,
        instanceId: clone.id,
        componentName,
      };
      
      // Select the new clone
      figma.currentPage.selection = [clone];
      
      return { success: true, instanceId: clone.id };
    }
    
    const compRecord = findComponentInDb(componentName);
    if (!compRecord) {
      return { success: false, error: 'Component not found in scanned Design System database.' };
    }
    
    const componentNode = await figma.getNodeByIdAsync(compRecord.id);
    if (!componentNode || componentNode.type !== 'COMPONENT') {
      return { success: false, error: 'Design System Component node could not be loaded from canvas.' };
    }
    
    // Create instance
    const instance = componentNode.createInstance();
    
    // Position it
    instance.x = originalNode.x;
    instance.y = originalNode.y;
    
    // Insert into parent
    if (originalNode.parent) {
      const index = originalNode.parent.children.indexOf(originalNode);
      originalNode.parent.insertChild(index, instance);
    }
    
    // Resize
    instance.resize(originalNode.width, originalNode.height);
    
    // Preserve text content
    await preserveTextContent(originalNode, instance);
    
    // Hide original node
    originalNode.visible = false;
    
    // Store preview state
    currentPreview = {
      originalNodeId,
      instanceId: instance.id,
      componentName,
    };
    
    // Select the new instance
    figma.currentPage.selection = [instance];
    
    return { success: true, instanceId: instance.id };
  } catch (err) {
    logScanError('handlePreviewReplacement() failed', err);
    return { success: false, error: err.message };
  }
}

export async function handleApplyReplacement(originalNodeId, componentName) {
  // If we are already previewing this node, make it permanent
  if (currentPreview && currentPreview.originalNodeId === originalNodeId && currentPreview.componentName === componentName) {
    undoStack.push({
      originalNodeId: currentPreview.originalNodeId,
      instanceId: currentPreview.instanceId,
    });
    const previewInstId = currentPreview.instanceId;
    currentPreview = null;
    return { success: true, instanceId: previewInstId };
  }
  
  // Otherwise, run preview flow and make it permanent
  const res = await handlePreviewReplacement(originalNodeId, componentName);
  if (res.success) {
    undoStack.push({
      originalNodeId,
      instanceId: res.instanceId,
    });
    currentPreview = null;
  }
  return res;
}

export async function handleUndoReplacement(originalNodeId) {
  const index = undoStack.findIndex(e => e.originalNodeId === originalNodeId);
  if (index === -1) {
    return { success: false, error: 'No replacement applied for this node.' };
  }
  const entry = undoStack[index];
  try {
    const instance = await figma.getNodeByIdAsync(entry.instanceId);
    if (instance) {
      instance.remove();
    }
    const original = await figma.getNodeByIdAsync(entry.originalNodeId);
    if (original) {
      original.visible = true;
      figma.currentPage.selection = [original];
    }
    undoStack.splice(index, 1);
    return { success: true };
  } catch (err) {
    logScanError('handleUndoReplacement() failed', err);
    return { success: false, error: err.message };
  }
}

async function preserveTextContent(originalNode, instance) {
  const origTexts = collectTextNodes(originalNode);
  const instTexts = collectTextNodes(instance);
  
  const count = Math.min(origTexts.length, instTexts.length);
  for (let i = 0; i < count; i++) {
    const origTextNode = origTexts[i];
    const instTextNode = instTexts[i];
    if (origTextNode && instTextNode) {
      try {
        if (instTextNode.fontName !== figma.mixed) {
          await figma.loadFontAsync(instTextNode.fontName);
        } else {
          const len = instTextNode.characters.length;
          for (let j = 0; j < len; j++) {
            const font = instTextNode.getRangeFontName(j, j + 1);
            if (font !== figma.mixed) {
              await figma.loadFontAsync(font);
            }
          }
        }
        instTextNode.characters = origTextNode.characters;
      } catch (err) {
        logScanError('Failed to preserve text characters', err);
      }
    }
  }
}
