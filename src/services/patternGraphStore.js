import { logScan } from '../utils/logger.js';

/** @type {object | null} Page-level pattern graph. */
let patternGraph = null;

/**
 * Stores the detected pattern graph.
 * @param {object} graph 
 */
export function setGraph(graph) {
  patternGraph = graph;
  logScan('patternGraphStore.setGraph()', {
    rootName: graph ? graph.name : null,
    childCount: graph && graph.children ? graph.children.length : 0,
  });
}

/**
 * Returns the current pattern graph.
 * @returns {object|null}
 */
export function getGraph() {
  return patternGraph;
}

/**
 * Whether a pattern graph has been computed and stored.
 * @returns {boolean}
 */
export function hasGraph() {
  return patternGraph !== null;
}

/**
 * Resets the stored pattern graph.
 */
export function clearGraph() {
  patternGraph = null;
}
