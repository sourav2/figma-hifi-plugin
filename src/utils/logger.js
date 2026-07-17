const PREFIX = '[Hi-Fi Scanner]';

/**
 * Logs a scan-flow message to the Figma plugin console.
 */
export function logScan(message, data) {
  if (data !== undefined) {
    console.log(PREFIX + ' ' + message, data);
  } else {
    console.log(PREFIX + ' ' + message);
  }
}

/**
 * Logs an error with full stack trace when available.
 */
export function logScanError(context, error) {
  console.error(PREFIX + ' ERROR in ' + context + ':', error);
  if (error && error instanceof Error && error.stack) {
    console.error(PREFIX + ' Stack trace:', error.stack);
  }
}

/**
 * Formats unknown errors for UI display.
 */
export function errorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
