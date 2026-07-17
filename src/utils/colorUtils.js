/**
 * Converts Figma's 0–1 RGB channels to 0–255 integers.
 */
function rgbTo255(channel) {
  return Math.round(Math.max(0, Math.min(1, channel)) * 255);
}

/**
 * Converts RGB (0–255) to a hex color string (e.g. "#1A2B3C").
 */
export function rgbToHex(r, g, b) {
  const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extracts solid color values from a Figma Paint (SOLID type only).
 * @returns {{ r: number, g: number, b: number, hex: string } | null}
 */
export function solidPaintToColor(paint) {
  if (!paint || paint.type !== 'SOLID') {
    return null;
  }
  if (paint.visible === false) {
    return null;
  }

  const { r, g, b } = paint.color;
  const R = rgbTo255(r);
  const G = rgbTo255(g);
  const B = rgbTo255(b);

  return {
    r: R,
    g: G,
    b: B,
    hex: rgbToHex(R, G, B),
  };
}
