import { SimulaTheme } from '../types';

// Helper functions for width validation
const isAutoWidth = (width: any): boolean => width === 'auto';
const isPercentageWidth = (width: any): boolean => typeof width === 'string' && /^\d+(?:\.\d+)?%$/.test(width);
const isPixelWidth = (width: any): boolean => typeof width === 'string' && /^\d+(?:\.\d+)?px$/.test(width);

/**
 * Validates SimulaProvider props
 * Throws descriptive errors for invalid props
 */
export const validateSimulaProviderProps = (props: any): void => {
  const validProps = ['apiKey', 'children', 'devMode', 'primaryUserID'];
  const receivedProps = Object.keys(props);

  // Check for unknown props
  const unknownProps = receivedProps.filter(prop => !validProps.includes(prop));
  if (unknownProps.length > 0) {
    throw new Error(
      `Invalid prop${unknownProps.length > 1 ? 's' : ''} passed to SimulaProvider: ${unknownProps.map(p => `"${p}"`).join(', ')}. ` +
      `Valid props are: ${validProps.join(', ')}`
    );
  }

  // Validate required props
  if (!props.apiKey || typeof props.apiKey !== 'string') {
    throw new Error('SimulaProvider requires a valid "apiKey" prop (string)');
  }

  if (!props.children) {
    throw new Error('SimulaProvider requires a "children" prop');
  }

  // Validate optional props
  if (props.devMode !== undefined && typeof props.devMode !== 'boolean') {
    throw new Error(`Invalid "devMode" prop type: "${typeof props.devMode}". Must be a boolean`);
  }

  if (props.primaryUserID !== undefined && typeof props.primaryUserID !== 'string') {
    throw new Error(`Invalid "primaryUserID" prop type: "${typeof props.primaryUserID}". Must be a string`);
  }
};

/**
 * Validates AdSlot props
 * Throws descriptive errors for invalid props
 */
export const validateAdSlotProps = (props: any): void => {
  const validProps = ['messages', 'trigger', 'formats', 'theme', 'debounceMs', 'onImpression', 'onClick', 'onError'];
  const receivedProps = Object.keys(props);

  // Check for unknown props
  const unknownProps = receivedProps.filter(prop => !validProps.includes(prop));
  if (unknownProps.length > 0) {
    throw new Error(
      `Invalid prop${unknownProps.length > 1 ? 's' : ''} passed to AdSlot: ${unknownProps.map(p => `"${p}"`).join(', ')}. ` +
      `Valid props are: ${validProps.join(', ')}`
    );
  }

  // Validate messages (required)
  if (!props.messages || !Array.isArray(props.messages)) {
    throw new Error('AdSlot requires a valid "messages" prop (array of Message objects)');
  }

  if (props.messages.length === 0) {
    throw new Error('AdSlot "messages" prop cannot be an empty array');
  }

  props.messages.forEach((msg: any, i: number) => {
    if (!msg || typeof msg !== 'object') {
      throw new Error(`Invalid message at index ${i}: must be an object with "role" and "content" properties`);
    }
    if (!msg.role || typeof msg.role !== 'string') {
      throw new Error(`Invalid message at index ${i}: "role" must be a non-empty string`);
    }
    if (msg.content === undefined || typeof msg.content !== 'string') {
      throw new Error(`Invalid message at index ${i}: "content" must be a string`);
    }
  });

  // Validate formats (optional)
  if (props.formats !== undefined) {
    validateFormats(props.formats);
  }

  // Validate theme (optional)
  if (props.theme !== undefined) {
    validateTheme(props.theme);
  }

  // Validate debounceMs (optional)
  if (props.debounceMs !== undefined) {
    if (typeof props.debounceMs !== 'number') {
      throw new Error(`Invalid "debounceMs" prop type: "${typeof props.debounceMs}". Must be a number`);
    }
    if (props.debounceMs < 0) {
      throw new Error(`Invalid "debounceMs" prop value: "${props.debounceMs}". Must be a non-negative number`);
    }
  }

  // Validate callbacks (optional)
  if (props.onImpression !== undefined && typeof props.onImpression !== 'function') {
    throw new Error(`Invalid "onImpression" prop type: "${typeof props.onImpression}". Must be a function`);
  }

  if (props.onClick !== undefined && typeof props.onClick !== 'function') {
    throw new Error(`Invalid "onClick" prop type: "${typeof props.onClick}". Must be a function`);
  }

  if (props.onError !== undefined && typeof props.onError !== 'function') {
    throw new Error(`Invalid "onError" prop type: "${typeof props.onError}". Must be a function`);
  }

  // Note: trigger validation (Promise check) is skipped because checking instanceof Promise
  // is unreliable across different Promise implementations and contexts
};

/**
 * Validates formats - accepts string or string[]
 * Throws descriptive errors for invalid formats
 */
export const validateFormats = (formats?: string | string[]): void => {
  if (!formats) return;

  const validFormatOptions = ['all', 'tips', 'interactive', 'suggestions', 'text', 'highlight', 'visual_banner', 'image_feature'];

  // Normalize to array for validation
  const formatsArray = Array.isArray(formats) ? formats : [formats];

  formatsArray.forEach((format, i) => {
    if (typeof format !== 'string') {
      throw new Error(`Invalid format type at index ${i}: "${typeof format}". Must be a string. Valid values: ${validFormatOptions.join(', ')}`);
    }
    if (!validFormatOptions.includes(format)) {
      throw new Error(`Invalid format value${Array.isArray(formats) ? ` at index ${i}` : ''}: "${format}". Valid values: ${validFormatOptions.join(', ')}`);
    }
  });
};

/**
 * Validates theme object
 * Throws descriptive errors for invalid theme properties
 */
export const validateTheme = (theme?: SimulaTheme): void => {
  if (!theme || typeof theme !== 'object') {
    throw new Error('Invalid "theme": must be an object');
  }

  const validThemeOptions = ['light', 'dark', 'auto'];
  const validAccentOptions = ['blue', 'red', 'green', 'yellow', 'purple', 'pink', 'orange', 'neutral', 'gray', 'tan', 'transparent', 'image'];
  const validFontOptions = ['san-serif', 'serif', 'monospace'];
  const validKeys = ['theme', 'accent', 'font', 'width', 'cornerRadius'];

  // Check for invalid top-level keys
  Object.keys(theme).forEach(key => {
    if (!validKeys.includes(key)) {
      throw new Error(`Invalid theme parameter "${key}". Valid parameters: ${validKeys.join(', ')}`);
    }
  });

  // Validate theme value
  if (theme.theme !== undefined) {
    if (typeof theme.theme !== 'string') {
      throw new Error(`Invalid theme type "${typeof theme.theme}". Must be a string. Valid values: ${validThemeOptions.join(', ')}`);
    }
    if (!validThemeOptions.includes(theme.theme)) {
      throw new Error(`Invalid theme value "${theme.theme}". Valid values: ${validThemeOptions.join(', ')}`);
    }
  }

  // Validate accent value(s)
  if (theme.accent !== undefined) {
    const accents = Array.isArray(theme.accent) ? theme.accent : [theme.accent];
    accents.forEach((accent, i) => {
      if (typeof accent !== 'string') {
        throw new Error(`Invalid accent type at index ${i}: "${typeof accent}". Must be a string. Valid values: ${validAccentOptions.join(', ')}`);
      }
      if (!validAccentOptions.includes(accent)) {
        throw new Error(`Invalid accent value${Array.isArray(theme.accent) ? ` at index ${i}` : ''}: "${accent}". Valid values: ${validAccentOptions.join(', ')}`);
      }
    });
  }

  // Validate font value(s)
  if (theme.font !== undefined) {
    const fonts = Array.isArray(theme.font) ? theme.font : [theme.font];
    fonts.forEach((font, i) => {
      if (typeof font !== 'string') {
        throw new Error(`Invalid font type at index ${i}: "${typeof font}". Must be a string. Valid values: ${validFontOptions.join(', ')}`);
      }
      if (!validFontOptions.includes(font)) {
        throw new Error(`Invalid font value${Array.isArray(theme.font) ? ` at index ${i}` : ''}: "${font}". Valid values: ${validFontOptions.join(', ')}`);
      }
    });
  }

  // Validate width
  if (theme.width !== undefined) {
    if (typeof theme.width !== 'number' && typeof theme.width !== 'string') {
      throw new Error(`Invalid width type "${typeof theme.width}". Must be number, "auto", "%", or "px"`);
    }
    if (typeof theme.width === 'string' && !isAutoWidth(theme.width) && !isPercentageWidth(theme.width) && !isPixelWidth(theme.width)) {
      throw new Error(`Invalid width "${theme.width}". Must be an integer, "auto", or a string like "100%", "500px"`);
    }
  }

  // Validate cornerRadius
  if (theme.cornerRadius !== undefined && typeof theme.cornerRadius !== 'number') {
    throw new Error(`Invalid cornerRadius type "${typeof theme.cornerRadius}". Must be a number`);
  }
};
