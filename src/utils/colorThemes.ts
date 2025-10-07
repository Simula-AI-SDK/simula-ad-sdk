export interface ColorPalette {
  // Modal background
  background: string;

  // Modal text
  text: string;

  // Modal link colors
  primary: string;
  primaryHover: string;

  // Modal border
  border: string;
}

export interface FontPalette {
  primary: string;
  secondary: string;
}

// Font definitions
export const fonts: Record<string, FontPalette> = {
  'san-serif': {
    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    secondary: 'system-ui, -apple-system, sans-serif'
  },
  'serif': {
    primary: 'Georgia, "Times New Roman", Times, serif',
    secondary: '"Hoefler Text", "Baskerville Old Face", Garamond, serif'
  },
  'monospace': {
    primary: '"SF Mono", Monaco, "Inconsolata", "Roboto Mono", "Source Code Pro", Consolas, "Courier New", monospace',
    secondary: 'ui-monospace, Menlo, monospace'
  }
};

// Modal color themes - only two options based on theme mode
const colorCombinations: Record<string, ColorPalette> = {
  'light': {
    background: '#ffffff',
    text: '#1e293b',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    border: '#e2e8f0'
  },
  'dark': {
    background: '#0f172a',
    text: '#f1f5f9',
    primary: '#60a5fa',
    primaryHover: '#3b82f6',
    border: '#475569'
  }
};

// Function to get the appropriate theme based on theme mode
// Accent is ignored - modal always uses consistent colors based on light/dark theme
export function getColorTheme(themeMode: 'light' | 'dark' | 'auto', _accent?: string): ColorPalette {
  // Handle auto theme by detecting system preference
  let resolvedTheme = themeMode;
  if (themeMode === 'auto') {
    resolvedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Return the theme color, fallback to light
  return colorCombinations[resolvedTheme] || colorCombinations['light'];
}

// Helper functions for styling
export const getSolidBackground = (colors: ColorPalette): string => {
  return colors.background;
};

export const getBackgroundGradient = (colors: ColorPalette): string => {
  // No longer using gradients, just return solid background
  return colors.background;
};

export const getTextMuted = (colors: ColorPalette): string => {
  // Use a slightly muted version of the text color
  return colors.text + 'aa'; // Add alpha for slight transparency
};

export const getTextSecondary = (colors: ColorPalette): string => {
  // Not used anymore, but keeping for compatibility
  return colors.text;
};

export const getBorderLight = (colors: ColorPalette): string => {
  return colors.border;
};

export const getShadow = (colors: ColorPalette): string => {
  return 'rgba(0, 0, 0, 0.1)';
};

export const getFontStyles = (font: string = 'san-serif'): FontPalette => {
  return fonts[font] || fonts['san-serif'];
};