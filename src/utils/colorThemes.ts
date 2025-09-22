export interface ColorPalette {
  // Background gradient colors
  backgroundGradient1: string;  // Start color of gradient
  backgroundGradient2: string;  // End color of gradient
  
  // Main colors
  primary: string;
  primaryHover: string;
  secondary: string;
  
  // Text and borders
  text: string;
  border: string;
  
  // Button text (usually white, but black for yellow)
  buttonText: string;
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

// All 20 theme-accent combinations
const colorCombinations: Record<string, ColorPalette> = {
  // LIGHT COMBINATIONS (10)
  'blue-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#f1f5f9',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    secondary: '#1e40af',
    text: '#1e293b',
    border: '#e2e8f0',
    buttonText: '#ffffff'
  },
  'red-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#fef2f2',
    primary: '#ef4444',
    primaryHover: '#dc2626',
    secondary: '#b91c1c',
    text: '#1e293b',
    border: '#fecaca',
    buttonText: '#ffffff'
  },
  'green-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#f0fdf4',
    primary: '#10b981',
    primaryHover: '#059669',
    secondary: '#047857',
    text: '#1e293b',
    border: '#bbf7d0',
    buttonText: '#ffffff'
  },
  'yellow-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#fefce8',
    primary: '#f59e0b',
    primaryHover: '#d97706',
    secondary: '#b45309',
    text: '#1e293b',
    border: '#fef3c7',
    buttonText: '#ffffff'
  },
  'purple-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#faf5ff',
    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    secondary: '#6d28d9',
    text: '#1e293b',
    border: '#e9d5ff',
    buttonText: '#ffffff'
  },
  'pink-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#fdf2f8',
    primary: '#ec4899',
    primaryHover: '#db2777',
    secondary: '#be185d',
    text: '#1e293b',
    border: '#fce7f3',
    buttonText: '#ffffff'
  },
  'orange-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#fff7ed',
    primary: '#f97316',
    primaryHover: '#ea580c',
    secondary: '#c2410c',
    text: '#1e293b',
    border: '#fed7aa',
    buttonText: '#ffffff'
  },
  'neutral-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#f8fafc',
    primary: '#64748b',
    primaryHover: '#475569',
    secondary: '#334155',
    text: '#1e293b',
    border: '#e2e8f0',
    buttonText: '#ffffff'
  },
  'gray-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#f9fafb',
    primary: '#6b7280',
    primaryHover: '#4b5563',
    secondary: '#374151',
    text: '#111827',
    border: '#d1d5db',
    buttonText: '#ffffff'
  },
  'tan-light': {
    backgroundGradient1: '#ffffff',
    backgroundGradient2: '#fefdfb',
    primary: '#92400e',
    primaryHover: '#78350f',
    secondary: '#451a03',
    text: '#1c1917',
    border: '#e7e5e4',
    buttonText: '#ffffff'
  },

  // DARK COMBINATIONS (10)
  'blue-dark': {
    backgroundGradient1: '#0c1426',
    backgroundGradient2: '#1e293b',
    primary: '#60a5fa',
    primaryHover: '#3b82f6',
    secondary: '#93c5fd',
    text: '#f1f5f9',
    border: '#334155',
    buttonText: '#ffffff'
  },
  'red-dark': {
    backgroundGradient1: '#1a0e0e',
    backgroundGradient2: '#2d1b1b',
    primary: '#f87171',
    primaryHover: '#ef4444',
    secondary: '#fca5a5',
    text: '#fef2f2',
    border: '#7f1d1d',
    buttonText: '#ffffff'
  },
  'green-dark': {
    backgroundGradient1: '#0a1f0a',
    backgroundGradient2: '#1b2f1b',
    primary: '#34d399',
    primaryHover: '#10b981',
    secondary: '#6ee7b7',
    text: '#f0fdf4',
    border: '#22543d',
    buttonText: '#ffffff'
  },
  'yellow-dark': {
    backgroundGradient1: '#1a1611',
    backgroundGradient2: '#2d2619',
    primary: '#fbbf24',
    primaryHover: '#f59e0b',
    secondary: '#fcd34d',
    text: '#fefce8',
    border: '#78350f',
    buttonText: '#000000'
  },
  'purple-dark': {
    backgroundGradient1: '#1a0f2e',
    backgroundGradient2: '#2d1b4e',
    primary: '#a78bfa',
    primaryHover: '#8b5cf6',
    secondary: '#c4b5fd',
    text: '#faf5ff',
    border: '#6d28d9',
    buttonText: '#ffffff'
  },
  'pink-dark': {
    backgroundGradient1: '#1f0a1a',
    backgroundGradient2: '#2f1b2a',
    primary: '#f472b6',
    primaryHover: '#ec4899',
    secondary: '#f9a8d4',
    text: '#fdf2f8',
    border: '#be185d',
    buttonText: '#ffffff'
  },
  'orange-dark': {
    backgroundGradient1: '#1a0f08',
    backgroundGradient2: '#2d1f15',
    primary: '#fb923c',
    primaryHover: '#f97316',
    secondary: '#fdba74',
    text: '#fff7ed',
    border: '#c2410c',
    buttonText: '#ffffff'
  },
  'neutral-dark': {
    backgroundGradient1: '#0f172a',
    backgroundGradient2: '#1e293b',
    primary: '#94a3b8',
    primaryHover: '#64748b',
    secondary: '#cbd5e1',
    text: '#f1f5f9',
    border: '#475569',
    buttonText: '#ffffff'
  },
  'gray-dark': {
    backgroundGradient1: '#111827',
    backgroundGradient2: '#1f2937',
    primary: '#9ca3af',
    primaryHover: '#6b7280',
    secondary: '#d1d5db',
    text: '#f9fafb',
    border: '#4b5563',
    buttonText: '#ffffff'
  },
  'tan-dark': {
    backgroundGradient1: '#1c1611',
    backgroundGradient2: '#2c251a',
    primary: '#d97706',
    primaryHover: '#b45309',
    secondary: '#fbbf24',
    text: '#fef7ed',
    border: '#92400e',
    buttonText: '#ffffff'
  }
};

// Function to get the appropriate theme based on theme mode and accent
export function getColorTheme(themeMode: 'light' | 'dark' | 'auto', accent: string = 'blue'): ColorPalette {
  // Handle auto theme by detecting system preference
  let resolvedTheme = themeMode;
  if (themeMode === 'auto') {
    resolvedTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Create the combination key
  const combinationKey = `${accent}-${resolvedTheme}`;
  
  // Return the specific combination or fallback to blue-light
  return colorCombinations[combinationKey] || colorCombinations['blue-light'];
}

// Function to get font styles
export function getFontStyles(fontType: string = 'san-serif'): FontPalette {
  return fonts[fontType] || fonts['san-serif'];
}

// Helper functions for derived colors
export function getBackgroundGradient(colors: ColorPalette): string {
  return `linear-gradient(135deg, ${colors.backgroundGradient1} 0%, ${colors.backgroundGradient2} 100%)`;
}

export function getSolidBackground(colors: ColorPalette): string {
  return colors.backgroundGradient1; // Use the lighter gradient color as solid background
}

export function getTextMuted(colors: ColorPalette): string {
  return colors.text + '80'; // Add 50% opacity (80 in hex = 128/255 ≈ 50%)
}

export function getTextSecondary(colors: ColorPalette): string {
  return colors.text + 'CC'; // Add 80% opacity (CC in hex = 204/255 ≈ 80%)
}

export function getBorderLight(colors: ColorPalette): string {
  return colors.border + '40'; // Add 25% opacity (40 in hex = 64/255 ≈ 25%)
}

export function getShadow(colors: ColorPalette): string {
  // Extract RGB from primary color and create shadow
  const rgb = hexToRgb(colors.primary);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)` : 'rgba(0, 0, 0, 0.1)';
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string): {r: number, g: number, b: number} | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
} 