import { InChatTheme, NativeContext } from '../types';
import { logger } from './logger';

/**
 * Prop validators. Crash-safety contract (native prime directive — the SDK
 * must never crash the host): in production these NEVER throw. They log via
 * console.error and return `false` so the caller renders a safe default
 * (null / blank). Pass `strict = true` (wired to `devMode`) to throw during
 * integration, matching the previous always-throw behavior.
 *
 * Validation is safe to run on EVERY render (components re-validate as props
 * change, so a surface mounted with temporarily-invalid props — e.g. an
 * empty `messages` array while chat history loads — recovers once props
 * become valid): each unique failure message is logged only once per page.
 */

const loggedMessages = new Set<string>();

const fail = (message: string, strict: boolean): false => {
  if (strict) throw new Error(message);
  if (!loggedMessages.has(message)) {
    loggedMessages.add(message);
    logger.error(message);
  }
  return false;
};

/** Test hook. Not public API. */
export const _resetValidationWarningsForTests = (): void => {
  loggedMessages.clear();
};

// Helper functions for width validation
const isAutoWidth = (width: any): boolean => width === 'auto';
const isPercentageWidth = (width: any): boolean => typeof width === 'string' && /^\d+(?:\.\d+)?%$/.test(width);
const isPixelWidth = (width: any): boolean => typeof width === 'string' && /^\d+(?:\.\d+)?px$/.test(width);

/**
 * Validates SimulaProvider props. Returns false (or throws when strict) on invalid props.
 */
export const validateSimulaProviderProps = (props: any, strict = false): boolean => {
  const validProps = ['apiKey', 'children', 'devMode', 'primaryUserID', 'hasPrivacyConsent', 'privacy', 'telemetryEnabled'];
  const receivedProps = Object.keys(props);

  // Check for unknown props
  const unknownProps = receivedProps.filter(prop => !validProps.includes(prop));
  if (unknownProps.length > 0) {
    return fail(
      `Invalid prop${unknownProps.length > 1 ? 's' : ''} passed to SimulaProvider: ${unknownProps.map(p => `"${p}"`).join(', ')}. ` +
      `Valid props are: ${validProps.join(', ')}`,
      strict
    );
  }

  // Validate required props
  if (!props.apiKey || typeof props.apiKey !== 'string') {
    return fail('SimulaProvider requires a valid "apiKey" prop (string)', strict);
  }

  if (!props.children) {
    return fail('SimulaProvider requires a "children" prop', strict);
  }

  // Validate optional props
  if (props.devMode !== undefined && typeof props.devMode !== 'boolean') {
    return fail(`Invalid "devMode" prop type: "${typeof props.devMode}". Must be a boolean`, strict);
  }

  if (props.primaryUserID !== undefined && typeof props.primaryUserID !== 'string') {
    return fail(`Invalid "primaryUserID" prop type: "${typeof props.primaryUserID}". Must be a string`, strict);
  }

  if (props.hasPrivacyConsent !== undefined && typeof props.hasPrivacyConsent !== 'boolean') {
    return fail(`Invalid "hasPrivacyConsent" prop type: "${typeof props.hasPrivacyConsent}". Must be a boolean`, strict);
  }

  if (props.privacy !== undefined && (typeof props.privacy !== 'object' || props.privacy === null)) {
    return fail(`Invalid "privacy" prop type: "${typeof props.privacy}". Must be a SimulaPrivacyConfig object`, strict);
  }

  if (props.telemetryEnabled !== undefined && typeof props.telemetryEnabled !== 'boolean') {
    return fail(`Invalid "telemetryEnabled" prop type: "${typeof props.telemetryEnabled}". Must be a boolean`, strict);
  }

  return true;
};

/**
 * Validates InChatAdSlot props. Returns false (or throws when strict) on invalid props.
 */
export const validateInChatAdSlotProps = (props: any, strict = false): boolean => {
  const validProps = ['messages', 'trigger', 'formats', 'theme', 'debounceMs', 'charDesc', 'onFill', 'onRender', 'onImpression', 'onClick', 'onError'];
  const receivedProps = Object.keys(props);

  // Check for unknown props
  const unknownProps = receivedProps.filter(prop => !validProps.includes(prop));
  if (unknownProps.length > 0) {
    return fail(
      `Invalid prop${unknownProps.length > 1 ? 's' : ''} passed to InChatAdSlot: ${unknownProps.map(p => `"${p}"`).join(', ')}. ` +
      `Valid props are: ${validProps.join(', ')}`,
      strict
    );
  }

  // Validate messages (required)
  if (!props.messages || !Array.isArray(props.messages)) {
    return fail('InChatAdSlot requires a valid "messages" prop (array of Message objects)', strict);
  }

  if (props.messages.length === 0) {
    return fail('InChatAdSlot "messages" prop cannot be an empty array', strict);
  }

  for (let i = 0; i < props.messages.length; i++) {
    const msg = props.messages[i];
    if (!msg || typeof msg !== 'object') {
      return fail(`Invalid message at index ${i}: must be an object with "role" and "content" properties`, strict);
    }
    if (!msg.role || typeof msg.role !== 'string') {
      return fail(`Invalid message at index ${i}: "role" must be a non-empty string`, strict);
    }
    if (msg.content === undefined || typeof msg.content !== 'string') {
      return fail(`Invalid message at index ${i}: "content" must be a string`, strict);
    }
  }

  // Validate theme (optional)
  if (props.theme !== undefined && !validateTheme(props.theme, strict)) {
    return false;
  }

  // Validate debounceMs (optional)
  if (props.debounceMs !== undefined) {
    if (typeof props.debounceMs !== 'number') {
      return fail(`Invalid "debounceMs" prop type: "${typeof props.debounceMs}". Must be a number`, strict);
    }
    if (props.debounceMs < 0) {
      return fail(`Invalid "debounceMs" prop value: "${props.debounceMs}". Must be a non-negative number`, strict);
    }
  }

  // Validate charDesc (optional)
  if (props.charDesc !== undefined && typeof props.charDesc !== 'string') {
    return fail(`Invalid "charDesc" prop type: "${typeof props.charDesc}". Must be a string`, strict);
  }

  // Validate callbacks (optional)
  if (props.onImpression !== undefined && typeof props.onImpression !== 'function') {
    return fail(`Invalid "onImpression" prop type: "${typeof props.onImpression}". Must be a function`, strict);
  }

  if (props.onClick !== undefined && typeof props.onClick !== 'function') {
    return fail(`Invalid "onClick" prop type: "${typeof props.onClick}". Must be a function`, strict);
  }

  if (props.onFill !== undefined && typeof props.onFill !== 'function') {
    return fail(`Invalid "onFill" prop type: "${typeof props.onFill}". Must be a function`, strict);
  }

  if (props.onRender !== undefined && typeof props.onRender !== 'function') {
    return fail(`Invalid "onRender" prop type: "${typeof props.onRender}". Must be a function`, strict);
  }

  if (props.onError !== undefined && typeof props.onError !== 'function') {
    return fail(`Invalid "onError" prop type: "${typeof props.onError}". Must be a function`, strict);
  }

  // Note: trigger validation (Promise check) is skipped because checking instanceof Promise
  // is unreliable across different Promise implementations and contexts
  return true;
};

/**
 * Validates theme object. Returns false (or throws when strict) on invalid theme properties.
 */
export const validateTheme = (theme?: InChatTheme, strict = false): boolean => {
  if (!theme || typeof theme !== 'object') {
    return fail('Invalid "theme": must be an object', strict);
  }

  const validModeOptions = ['light', 'dark', 'auto'];
  const validAccentOptions = ['blue', 'red', 'green', 'yellow', 'purple', 'pink', 'orange', 'neutral', 'gray', 'tan', 'transparent', 'image'];
  const validFontOptions = ['sans-serif', 'serif', 'monospace'];
  const validKeys = ['mode', 'theme', 'accent', 'font', 'width', 'cornerRadius']; // 'theme' kept for backward compatibility

  // Check for invalid top-level keys
  for (const key of Object.keys(theme)) {
    if (!validKeys.includes(key)) {
      return fail(`Invalid theme parameter "${key}". Valid parameters: ${validKeys.join(', ')}`, strict);
    }
  }

  // Validate mode value (prefer 'mode' over 'theme' for backward compatibility)
  const modeValue = theme.mode ?? (theme as any).theme;
  if (modeValue !== undefined) {
    if (typeof modeValue !== 'string') {
      return fail(`Invalid mode/theme type "${typeof modeValue}". Must be a string. Valid values: ${validModeOptions.join(', ')}`, strict);
    }
    if (!validModeOptions.includes(modeValue)) {
      return fail(`Invalid mode/theme value "${modeValue}". Valid values: ${validModeOptions.join(', ')}`, strict);
    }
  }

  // Validate accent value(s)
  if (theme.accent !== undefined) {
    const accents = Array.isArray(theme.accent) ? theme.accent : [theme.accent];
    for (let i = 0; i < accents.length; i++) {
      const accent = accents[i];
      if (typeof accent !== 'string') {
        return fail(`Invalid accent type at index ${i}: "${typeof accent}". Must be a string. Valid values: ${validAccentOptions.join(', ')}`, strict);
      }
      if (!validAccentOptions.includes(accent)) {
        return fail(`Invalid accent value${Array.isArray(theme.accent) ? ` at index ${i}` : ''}: "${accent}". Valid values: ${validAccentOptions.join(', ')}`, strict);
      }
    }
  }

  // Validate font value(s)
  if (theme.font !== undefined) {
    const fonts = Array.isArray(theme.font) ? theme.font : [theme.font];
    for (let i = 0; i < fonts.length; i++) {
      const font = fonts[i];
      if (typeof font !== 'string') {
        return fail(`Invalid font type at index ${i}: "${typeof font}". Must be a string. Valid values: ${validFontOptions.join(', ')}`, strict);
      }
      if (!validFontOptions.includes(font)) {
        return fail(`Invalid font value${Array.isArray(theme.font) ? ` at index ${i}` : ''}: "${font}". Valid values: ${validFontOptions.join(', ')}`, strict);
      }
    }
  }

  // Validate width
  if (theme.width !== undefined) {
    if (typeof theme.width !== 'number' && typeof theme.width !== 'string') {
      return fail(`Invalid width type "${typeof theme.width}". Must be number, "auto", "%", or "px"`, strict);
    }
    if (typeof theme.width === 'string' && !isAutoWidth(theme.width) && !isPercentageWidth(theme.width) && !isPixelWidth(theme.width)) {
      return fail(`Invalid width "${theme.width}". Must be an integer, "auto", or a string like "100%", "500px"`, strict);
    }
  }

  // Validate cornerRadius
  if (theme.cornerRadius !== undefined && typeof theme.cornerRadius !== 'number') {
    return fail(`Invalid cornerRadius type "${typeof theme.cornerRadius}". Must be a number`, strict);
  }

  return true;
};

/**
 * Validates NativeContext object. Returns false (or throws when strict) on invalid context properties.
 */
export const validateNativeContext = (context: any, strict = false): boolean => {
  if (!context || typeof context !== 'object') {
    return fail('Invalid "context": must be an object', strict);
  }

  const validKeys = ['searchTerm', 'tags', 'category', 'title', 'description', 'userProfile', 'userEmail', 'nsfw', 'customContext'];

  // Check for invalid top-level keys
  for (const key of Object.keys(context)) {
    if (!validKeys.includes(key)) {
      return fail(`Invalid context parameter "${key}". Valid parameters: ${validKeys.join(', ')}`, strict);
    }
  }

  // Validate searchTerm (optional string)
  if (context.searchTerm !== undefined && typeof context.searchTerm !== 'string') {
    return fail(`Invalid "searchTerm" type: "${typeof context.searchTerm}". Must be a string`, strict);
  }

  // Validate tags (optional array of strings, max 10)
  if (context.tags !== undefined) {
    if (!Array.isArray(context.tags)) {
      return fail(`Invalid "tags" type: "${typeof context.tags}". Must be an array of strings`, strict);
    }
    if (context.tags.length > 10) {
      return fail(`"tags" array exceeds maximum length of 10 (received ${context.tags.length})`, strict);
    }
    for (let i = 0; i < context.tags.length; i++) {
      const tag = context.tags[i];
      if (typeof tag !== 'string') {
        return fail(`Invalid tag at index ${i}: "${typeof tag}". Must be a string`, strict);
      }
      if (tag.startsWith('#')) {
        return fail(`Invalid tag at index ${i}: "${tag}". Tags should not include # prefix`, strict);
      }
    }
  }

  // Validate category (optional string)
  if (context.category !== undefined && typeof context.category !== 'string') {
    return fail(`Invalid "category" type: "${typeof context.category}". Must be a string`, strict);
  }

  // Validate title (optional string)
  if (context.title !== undefined && typeof context.title !== 'string') {
    return fail(`Invalid "title" type: "${typeof context.title}". Must be a string`, strict);
  }

  // Validate description (optional string)
  if (context.description !== undefined && typeof context.description !== 'string') {
    return fail(`Invalid "description" type: "${typeof context.description}". Must be a string`, strict);
  }

  // Validate userProfile (optional string)
  if (context.userProfile !== undefined && typeof context.userProfile !== 'string') {
    return fail(`Invalid "userProfile" type: "${typeof context.userProfile}". Must be a string`, strict);
  }

  // Validate userEmail (optional string)
  if (context.userEmail !== undefined && typeof context.userEmail !== 'string') {
    return fail(`Invalid "userEmail" type: "${typeof context.userEmail}". Must be a string`, strict);
  }

  // Validate nsfw (optional boolean)
  if (context.nsfw !== undefined && typeof context.nsfw !== 'boolean') {
    return fail(`Invalid "nsfw" type: "${typeof context.nsfw}". Must be a boolean`, strict);
  }

  // Validate customContext (optional object with max 10 keys)
  if (context.customContext !== undefined) {
    if (typeof context.customContext !== 'object' || context.customContext === null || Array.isArray(context.customContext)) {
      return fail(`Invalid "customContext" type: must be an object with string or string[] values`, strict);
    }
    const keys = Object.keys(context.customContext);
    if (keys.length > 10) {
      return fail(`"customContext" exceeds maximum of 10 keys (received ${keys.length})`, strict);
    }
    for (const key of keys) {
      const value = context.customContext[key];
      if (typeof value === 'string') {
        // Valid
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] !== 'string') {
            return fail(`Invalid customContext["${key}"][${i}]: "${typeof value[i]}". Must be a string`, strict);
          }
        }
      } else {
        return fail(`Invalid customContext["${key}"]: "${typeof value}". Must be a string or string[]`, strict);
      }
    }
  }

  return true;
};

/**
 * Validates NativeBanner props. Returns false (or throws when strict) on invalid props.
 */
export const validateNativeBannerProps = (props: any, strict = false): boolean => {
  const validProps = ['slot', 'width', 'position', 'context', 'theme', 'preloadedAdId', 'previewHtml', 'loadingComponent', 'onLoad', 'onImpression', 'onPaid', 'onClick', 'onError'];
  const receivedProps = Object.keys(props);

  // Check for unknown props
  const unknownProps = receivedProps.filter(prop => !validProps.includes(prop));
  if (unknownProps.length > 0) {
    return fail(
      `Invalid prop${unknownProps.length > 1 ? 's' : ''} passed to NativeBanner: ${unknownProps.map(p => `"${p}"`).join(', ')}. ` +
      `Valid props are: ${validProps.join(', ')}`,
      strict
    );
  }

  // Validate slot (required)
  if (props.slot === undefined) {
    return fail('NativeBanner requires a "slot" prop (placement identifier string, e.g., "feed", "explore")', strict);
  }
  if (typeof props.slot !== 'string') {
    return fail(`Invalid "slot" prop type: "${typeof props.slot}". Must be a string`, strict);
  }
  if (props.slot.trim() === '') {
    return fail('NativeBanner "slot" prop cannot be an empty string', strict);
  }

  // Validate width (optional)
  if (props.width !== undefined && props.width !== null) {
    const width = props.width;
    // Allow number, string, "auto", or null
    if (typeof width !== 'number' && typeof width !== 'string') {
      return fail(`Invalid "width" prop type: "${typeof width}". Must be a number, string (e.g., "10%", "500", "auto"), or null`, strict);
    }
    // Validate number width
    if (typeof width === 'number' && width < 0) {
      return fail(`Invalid "width" prop value: "${width}". Must be a non-negative number`, strict);
    }
    // Validate string width formats
    if (typeof width === 'string' && width !== 'auto' && width !== '') {
      // Check if it's a percentage string
      if (width.endsWith('%')) {
        const percentValue = parseFloat(width);
        if (isNaN(percentValue) || percentValue <= 0 || percentValue > 100) {
          return fail(`Invalid "width" prop value: "${width}". Percentage must be between 0 and 100`, strict);
        }
      } else {
        // Check if it's a pixel string
        const pixelValue = parseFloat(width);
        if (isNaN(pixelValue) || pixelValue <= 0) {
          return fail(`Invalid "width" prop value: "${width}". Must be a valid number, percentage (e.g., "10%"), or "auto"`, strict);
        }
      }
    }
  }

  // Validate position (required, non-negative number)
  if (props.position === undefined) {
    return fail('NativeBanner requires a "position" prop (non-negative number)', strict);
  }
  if (typeof props.position !== 'number') {
    return fail(`Invalid "position" prop type: "${typeof props.position}". Must be a number`, strict);
  }
  if (props.position < 0) {
    return fail(`Invalid "position" prop value: "${props.position}". Must be a non-negative number`, strict);
  }

  // Validate context (optional — merged over the global SimulaAds context when omitted)
  if (props.context !== undefined && !validateNativeContext(props.context, strict)) {
    return false;
  }

  // Validate theme (optional)
  if (props.theme !== undefined && props.theme !== 'dark' && props.theme !== 'light' && props.theme !== 'system') {
    return fail(`Invalid "theme" prop value: "${props.theme}". Must be "dark", "light", or "system"`, strict);
  }

  // Validate preloadedAdId / previewHtml (optional strings)
  if (props.preloadedAdId !== undefined && typeof props.preloadedAdId !== 'string') {
    return fail(`Invalid "preloadedAdId" prop type: "${typeof props.preloadedAdId}". Must be a string`, strict);
  }
  if (props.previewHtml !== undefined && typeof props.previewHtml !== 'string') {
    return fail(`Invalid "previewHtml" prop type: "${typeof props.previewHtml}". Must be a string`, strict);
  }

  // Validate callbacks (optional)
  if (props.onLoad !== undefined && typeof props.onLoad !== 'function') {
    return fail(`Invalid "onLoad" prop type: "${typeof props.onLoad}". Must be a function`, strict);
  }

  if (props.onImpression !== undefined && typeof props.onImpression !== 'function') {
    return fail(`Invalid "onImpression" prop type: "${typeof props.onImpression}". Must be a function`, strict);
  }

  if (props.onPaid !== undefined && typeof props.onPaid !== 'function') {
    return fail(`Invalid "onPaid" prop type: "${typeof props.onPaid}". Must be a function`, strict);
  }

  if (props.onClick !== undefined && typeof props.onClick !== 'function') {
    return fail(`Invalid "onClick" prop type: "${typeof props.onClick}". Must be a function`, strict);
  }

  if (props.onError !== undefined && typeof props.onError !== 'function') {
    return fail(`Invalid "onError" prop type: "${typeof props.onError}". Must be a function`, strict);
  }

  return true;
};
