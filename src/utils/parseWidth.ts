type WidthInput = number | string | null | undefined;

export const parseWidth = (width: WidthInput): { type: 'fill' | 'percentage' | 'pixels'; value?: number } => {
  // Handle null, undefined, "auto"
  if (width == null || width === 'auto' || width === '') {
    return { type: 'fill' };
  }

  // Handle string percentages (e.g., "10%")
  if (typeof width === 'string' && width.endsWith('%')) {
    const percentValue = parseFloat(width);
    if (!isNaN(percentValue) && percentValue > 0 && percentValue <= 100) {
      return { type: 'percentage', value: percentValue / 100 };
    }
  }

  // Handle string pixels (e.g., "500")
  if (typeof width === 'string') {
    const pixelValue = parseFloat(width);
    if (!isNaN(pixelValue) && pixelValue > 0) {
      return { type: 'pixels', value: pixelValue };
    }
  }

  // Handle number < 1 as percentage (e.g., 0.8 = 80%)
  if (typeof width === 'number' && width > 0 && width < 1) {
    return { type: 'percentage', value: width };
  }

  // Handle number >= 1 as pixels (e.g., 500 = 500px)
  if (typeof width === 'number' && width >= 1) {
    return { type: 'pixels', value: width };
  }

  // Default to fill
  return { type: 'fill' };
};

export const needsWidthMeasurement = (width: WidthInput): boolean => {
  const parsed = parseWidth(width);
  return parsed.type === 'fill' || parsed.type === 'percentage';
};

export const toWidthCSS = (width: WidthInput): string => {
  const parsed = parseWidth(width);
  if (parsed.type === 'percentage' && parsed.value !== undefined) {
    return `${parsed.value * 100}%`;
  }
  if (parsed.type === 'pixels' && parsed.value !== undefined) {
    return `${Math.round(parsed.value)}px`;
  }
  return '100%';
};

/**
 * Converts an offset value (top, right, bottom, left) to a CSS string.
 * Same format as width: number < 1 = percentage, number >= 1 = pixels,
 * string with % = percentage, string with number = pixels.
 */
export const toOffsetCSS = (value: number | string | undefined): string | undefined => {
  if (value === undefined) return undefined;

  // String with %
  if (typeof value === 'string' && value.endsWith('%')) {
    const v = parseFloat(value);
    if (!isNaN(v)) return `${v}%`;
  }

  // String with number (pixels)
  if (typeof value === 'string') {
    const v = parseFloat(value);
    if (!isNaN(v)) return `${v}px`;
  }

  // Number < 1 = percentage
  if (typeof value === 'number' && value >= 0 && value < 1) {
    return `${value * 100}%`;
  }

  // Number >= 1 = pixels
  if (typeof value === 'number' && value >= 1) {
    return `${Math.round(value)}px`;
  }

  // 0 is valid
  if (value === 0) return '0px';

  return undefined;
};
