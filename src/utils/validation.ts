import { InChatTheme, NativeContext } from '../types';

// Helper functions for width validation
const isAutoWidth = (width: any): boolean => width === 'auto';
const isPercentageWidth = (width: any): boolean => typeof width === 'string' && /^\d+(?:\.\d+)?%$/.test(width);
const isPixelWidth = (width: any): boolean => typeof width === 'string' && /^\d+(?:\.\d+)?px$/.test(width);

/**
 * Validates SimulaProvider props
 * Throws descriptive errors for invalid props
 */
export const validateSimulaProviderProps = (props: any): void => {
  const validProps = ['apiKey', 'children', 'devMode', 'primaryUserID', 'hasPrivacyConsent'];
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

  if (props.hasPrivacyConsent !== undefined && typeof props.hasPrivacyConsent !== 'boolean') {
    throw new Error(`Invalid "hasPrivacyConsent" prop type: "${typeof props.hasPrivacyConsent}". Must be a boolean`);
  }
};

/**
 * Validates InChatAdSlot props
 * Throws descriptive errors for invalid props
 */
export const validateInChatAdSlotProps = (props: any): void => {
  const validProps = ['messages', 'trigger', 'formats', 'theme', 'debounceMs', 'charDesc', 'onImpression', 'onClick', 'onError'];
  const receivedProps = Object.keys(props);

  // Check for unknown props
  const unknownProps = receivedProps.filter(prop => !validProps.includes(prop));
  if (unknownProps.length > 0) {
    throw new Error(
      `Invalid prop${unknownProps.length > 1 ? 's' : ''} passed to InChatAdSlot: ${unknownProps.map(p => `"${p}"`).join(', ')}. ` +
      `Valid props are: ${validProps.join(', ')}`
    );
  }

  // Validate messages (required)
  if (!props.messages || !Array.isArray(props.messages)) {
    throw new Error('InChatAdSlot requires a valid "messages" prop (array of Message objects)');
  }

  if (props.messages.length === 0) {
    throw new Error('InChatAdSlot "messages" prop cannot be an empty array');
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

  // Validate charDesc (optional)
  if (props.charDesc !== undefined && typeof props.charDesc !== 'string') {
    throw new Error(`Invalid "charDesc" prop type: "${typeof props.charDesc}". Must be a string`);
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
 * Validates theme object
 * Throws descriptive errors for invalid theme properties
 */
export const validateTheme = (theme?: InChatTheme): void => {
  if (!theme || typeof theme !== 'object') {
    throw new Error('Invalid "theme": must be an object');
  }

  const validModeOptions = ['light', 'dark', 'auto'];
  const validAccentOptions = ['blue', 'red', 'green', 'yellow', 'purple', 'pink', 'orange', 'neutral', 'gray', 'tan', 'transparent', 'image'];
  const validFontOptions = ['san-serif', 'serif', 'monospace'];
  const validKeys = ['mode', 'theme', 'accent', 'font', 'width', 'cornerRadius']; // 'theme' kept for backward compatibility

  // Check for invalid top-level keys
  Object.keys(theme).forEach(key => {
    if (!validKeys.includes(key)) {
      throw new Error(`Invalid theme parameter "${key}". Valid parameters: ${validKeys.join(', ')}`);
    }
  });

  // Validate mode value (prefer 'mode' over 'theme' for backward compatibility)
  const modeValue = theme.mode ?? (theme as any).theme;
  if (modeValue !== undefined) {
    if (typeof modeValue !== 'string') {
      throw new Error(`Invalid mode/theme type "${typeof modeValue}". Must be a string. Valid values: ${validModeOptions.join(', ')}`);
    }
    if (!validModeOptions.includes(modeValue)) {
      throw new Error(`Invalid mode/theme value "${modeValue}". Valid values: ${validModeOptions.join(', ')}`);
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

/**
 * Validates NativeContext object
 * Throws descriptive errors for invalid context properties
 */
export const validateNativeContext = (context: any): void => {
  if (!context || typeof context !== 'object') {
    throw new Error('Invalid "context": must be an object');
  }

  const validKeys = ['searchTerm', 'tags', 'category', 'title', 'description', 'userProfile', 'userEmail', 'nsfw', 'customContext'];

  // Check for invalid top-level keys
  Object.keys(context).forEach(key => {
    if (!validKeys.includes(key)) {
      throw new Error(`Invalid context parameter "${key}". Valid parameters: ${validKeys.join(', ')}`);
    }
  });

  // Validate searchTerm (optional string)
  if (context.searchTerm !== undefined && typeof context.searchTerm !== 'string') {
    throw new Error(`Invalid "searchTerm" type: "${typeof context.searchTerm}". Must be a string`);
  }

  // Validate tags (optional array of strings, max 10)
  if (context.tags !== undefined) {
    if (!Array.isArray(context.tags)) {
      throw new Error(`Invalid "tags" type: "${typeof context.tags}". Must be an array of strings`);
    }
    if (context.tags.length > 10) {
      throw new Error(`"tags" array exceeds maximum length of 10 (received ${context.tags.length})`);
    }
    context.tags.forEach((tag: any, i: number) => {
      if (typeof tag !== 'string') {
        throw new Error(`Invalid tag at index ${i}: "${typeof tag}". Must be a string`);
      }
      if (tag.startsWith('#')) {
        throw new Error(`Invalid tag at index ${i}: "${tag}". Tags should not include # prefix`);
      }
    });
  }

  // Validate category (optional string)
  if (context.category !== undefined && typeof context.category !== 'string') {
    throw new Error(`Invalid "category" type: "${typeof context.category}". Must be a string`);
  }

  // Validate title (optional string)
  if (context.title !== undefined && typeof context.title !== 'string') {
    throw new Error(`Invalid "title" type: "${typeof context.title}". Must be a string`);
  }

  // Validate description (optional string)
  if (context.description !== undefined && typeof context.description !== 'string') {
    throw new Error(`Invalid "description" type: "${typeof context.description}". Must be a string`);
  }

  // Validate userProfile (optional string)
  if (context.userProfile !== undefined && typeof context.userProfile !== 'string') {
    throw new Error(`Invalid "userProfile" type: "${typeof context.userProfile}". Must be a string`);
  }

  // Validate userEmail (optional string)
  if (context.userEmail !== undefined && typeof context.userEmail !== 'string') {
    throw new Error(`Invalid "userEmail" type: "${typeof context.userEmail}". Must be a string`);
  }

  // Validate nsfw (optional boolean)
  if (context.nsfw !== undefined && typeof context.nsfw !== 'boolean') {
    throw new Error(`Invalid "nsfw" type: "${typeof context.nsfw}". Must be a boolean`);
  }

  // Validate customContext (optional object with max 10 keys)
  if (context.customContext !== undefined) {
    if (typeof context.customContext !== 'object' || context.customContext === null || Array.isArray(context.customContext)) {
      throw new Error(`Invalid "customContext" type: must be an object with string or string[] values`);
    }
    const keys = Object.keys(context.customContext);
    if (keys.length > 10) {
      throw new Error(`"customContext" exceeds maximum of 10 keys (received ${keys.length})`);
    }
    keys.forEach(key => {
      const value = context.customContext[key];
      if (typeof value === 'string') {
        // Valid
      } else if (Array.isArray(value)) {
        value.forEach((v: any, i: number) => {
          if (typeof v !== 'string') {
            throw new Error(`Invalid customContext["${key}"][${i}]: "${typeof v}". Must be a string`);
          }
        });
      } else {
        throw new Error(`Invalid customContext["${key}"]: "${typeof value}". Must be a string or string[]`);
      }
    });
  }
};

/**
 * Validates NativeBanner props
 * Throws descriptive errors for invalid props
 */
export const validateNativeBannerProps = (props: any): void => {
  const validProps = ['slot', 'width', 'position', 'context', 'loadingComponent', 'onLoad', 'onImpression', 'onError'];
  const receivedProps = Object.keys(props);

  // Check for unknown props
  const unknownProps = receivedProps.filter(prop => !validProps.includes(prop));
  if (unknownProps.length > 0) {
    throw new Error(
      `Invalid prop${unknownProps.length > 1 ? 's' : ''} passed to NativeBanner: ${unknownProps.map(p => `"${p}"`).join(', ')}. ` +
      `Valid props are: ${validProps.join(', ')}`
    );
  }

  // Validate slot (required)
  if (props.slot === undefined) {
    throw new Error('NativeBanner requires a "slot" prop (placement identifier string, e.g., "feed", "explore")');
  }
  if (typeof props.slot !== 'string') {
    throw new Error(`Invalid "slot" prop type: "${typeof props.slot}". Must be a string`);
  }
  if (props.slot.trim() === '') {
    throw new Error('NativeBanner "slot" prop cannot be an empty string');
  }

  // Validate width (optional)
  if (props.width !== undefined && props.width !== null) {
    const width = props.width;
    // Allow number, string, "auto", or null
    if (typeof width !== 'number' && typeof width !== 'string') {
      throw new Error(`Invalid "width" prop type: "${typeof width}". Must be a number, string (e.g., "10%", "500", "auto"), or null`);
    }
    // Validate number width
    if (typeof width === 'number' && width < 0) {
      throw new Error(`Invalid "width" prop value: "${width}". Must be a non-negative number`);
    }
    // Validate string width formats
    if (typeof width === 'string' && width !== 'auto' && width !== '') {
      // Check if it's a percentage string
      if (width.endsWith('%')) {
        const percentValue = parseFloat(width);
        if (isNaN(percentValue) || percentValue <= 0 || percentValue > 100) {
          throw new Error(`Invalid "width" prop value: "${width}". Percentage must be between 0 and 100`);
        }
      } else {
        // Check if it's a pixel string
        const pixelValue = parseFloat(width);
        if (isNaN(pixelValue) || pixelValue <= 0) {
          throw new Error(`Invalid "width" prop value: "${width}". Must be a valid number, percentage (e.g., "10%"), or "auto"`);
        }
      }
    }
  }

  // Validate position (required, non-negative number)
  if (props.position === undefined) {
    throw new Error('NativeBanner requires a "position" prop (non-negative number)');
  }
  if (typeof props.position !== 'number') {
    throw new Error(`Invalid "position" prop type: "${typeof props.position}". Must be a number`);
  }
  if (props.position < 0) {
    throw new Error(`Invalid "position" prop value: "${props.position}". Must be a non-negative number`);
  }

  // Validate context (required)
  if (props.context === undefined) {
    throw new Error('NativeBanner requires a "context" prop (NativeContext object)');
  }
  validateNativeContext(props.context);

  // Validate callbacks (optional)
  if (props.onLoad !== undefined && typeof props.onLoad !== 'function') {
    throw new Error(`Invalid "onLoad" prop type: "${typeof props.onLoad}". Must be a function`);
  }

  if (props.onImpression !== undefined && typeof props.onImpression !== 'function') {
    throw new Error(`Invalid "onImpression" prop type: "${typeof props.onImpression}". Must be a function`);
  }

  if (props.onError !== undefined && typeof props.onError !== 'function') {
    throw new Error(`Invalid "onError" prop type: "${typeof props.onError}". Must be a function`);
  }
};
