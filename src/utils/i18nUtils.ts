import { getCurrentInstance } from 'vue'
import { currentLocale } from '@/plugins/i18n'

/**
 * Resolves a title that can be either a string or a multilingual object
 * @param title - The title to resolve (string or object with language keys)
 * @param fallback - Fallback text if title is not found
 * @returns The resolved title string
 */
export function resolveTitle(
  title: string | Record<string, string>,
  fallback: string = '',
): string {
  // If title is already a string, return it
  if (typeof title === 'string') {
    return title
  }

  // If title is an object with language keys
  if (title && typeof title === 'object') {
    // Get current locale from Vue i18n
    const instance = getCurrentInstance()
    const currentLocale =
      instance?.appContext.config.globalProperties.$i18n?.locale || 'en'

    // Try to get title for current locale
    if (title[currentLocale]) {
      return title[currentLocale]
    }

    // Fallback to English if current locale not found
    if (title.en) {
      return title.en
    }

    // Fallback to first available language
    const firstKey = Object.keys(title)[0]
    if (firstKey && title[firstKey]) {
      return title[firstKey]
    }
  }

  // Return fallback if nothing found
  return fallback
}

/**
 * Alternative version that accepts locale as parameter (for use outside Vue components)
 * @param title - The title to resolve
 * @param locale - The target locale
 * @param fallback - Fallback text if title is not found
 * @returns The resolved title string
 */
export function resolveTitleWithLocale(
  title: string | Record<string, string>,
  locale: string = 'en',
  fallback: string = '',
): string {
  // If title is already a string, return it
  if (typeof title === 'string') {
    return title
  }

  // If title is an object with language keys
  if (title && typeof title === 'object') {
    // Try to get title for specified locale
    if (title[locale]) {
      return title[locale]
    }

    // Fallback to English if specified locale not found
    if (title.en) {
      return title.en
    }

    // Fallback to first available language
    const firstKey = Object.keys(title)[0]
    if (firstKey && title[firstKey]) {
      return title[firstKey]
    }
  }

  // Return fallback if nothing found
  return fallback
}

/**
 * Gets a localized message from an API response
 * Uses the current locale from the i18n plugin automatically
 * @param message - The message to localize (string or object with language keys)
 * @param fallback - Fallback text if message is not found
 * @returns The localized message string
 */
export function getLocalizedMessage(
  message: string | Record<string, string>,
  fallback: string = 'An error occurred',
): string {
  // If message is a simple string, return it directly
  if (typeof message === 'string') {
    return message
  }

  // If message is an object with language keys, get the appropriate one
  if (message && typeof message === 'object') {
    const locale = currentLocale.value

    // Try user's selected language first
    if (message[locale]) {
      return message[locale]
    }

    // Fallback to English
    if (message['en']) {
      return message['en']
    }

    // Return first available message if neither locale nor 'en' exist
    const keys = Object.keys(message)
    if (keys.length > 0) {
      return message[keys[0]]
    }
  }

  return fallback
}

const LOCALE_KEYS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja']

/**
 * Returns true when the value looks like a translation object (e.g. { en: "...", es: "..." }).
 */
function isTranslationObject(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return LOCALE_KEYS.some((key) => typeof obj[key] === 'string')
}

/**
 * Resolves a single message item to a string (string as-is, or { en, es, fr... } via current locale).
 */
function resolveMessageItem(
  item: unknown,
  fallback: string,
): string {
  if (item == null) return fallback
  if (typeof item === 'string') return item
  if (isTranslationObject(item)) return getLocalizedMessage(item, fallback)
  return fallback
}

/**
 * Resolves the display message from API error response content.
 * Handles three shapes:
 * (1) content.message or content is a string → use as-is.
 * (2) content.message or content is { en, es, fr... } → pick phrase for current i18n locale.
 * (3) content.message is an array of strings or { en, es, fr... } → resolve each and join with newlines.
 *
 * @param content - Response body (e.g. response.content)
 * @param fallback - Fallback when no message can be resolved
 * @returns Localized message string for the current i18n locale
 */
export function getMessageFromResponseContent(
  content: unknown,
  fallback: string = 'An error occurred',
): string {
  if (content == null) return fallback
  const raw = (content as Record<string, unknown>)?.message ?? content
  if (raw == null) return fallback
  if (typeof raw === 'string') return raw
  if (isTranslationObject(raw)) return getLocalizedMessage(raw, fallback)
  if (Array.isArray(raw) && raw.length > 0) {
    const parts = raw.map((item) => resolveMessageItem(item, ''))
    return parts.filter(Boolean).join('\n') || fallback
  }
  return fallback
}

/**
 * Same as getMessageFromResponseContent but returns null when content has no message or translation object.
 * Use when the API returns message: string | null and you want to preserve null.
 */
/**
 * Builds a user-facing message from API error bodies that use `error`, `message`,
 * and/or `jsonschema_errors` (common for validation failures).
 */
export function getApiErrorMessageFromContent(
  content: unknown,
  fallback: string = 'An error occurred',
): string {
  if (content == null) return fallback
  if (typeof content === 'string') return content
  if (typeof content !== 'object') return fallback
  const c = content as Record<string, unknown>

  if (Array.isArray(c.jsonschema_errors) && c.jsonschema_errors.length > 0) {
    const joined = c.jsonschema_errors.map(String).join('\n')
    const err = typeof c.error === 'string' ? c.error : ''
    const msg = typeof c.message === 'string' ? c.message : ''
    const head = err || msg
    return head ? `${head}\n${joined}` : joined
  }

  if (typeof c.error === 'string' && c.error.trim()) {
    return c.error
  }

  return getMessageFromResponseContent(content, fallback)
}

export function getMessageFromResponseContentOrNull(
  content: unknown,
): string | null {
  if (content == null) return null
  const raw = (content as Record<string, unknown>)?.message ?? content
  if (raw == null) return null
  if (typeof raw === 'string') return raw
  if (isTranslationObject(raw)) return getLocalizedMessage(raw, '')
  if (Array.isArray(raw) && raw.length > 0) {
    const parts = raw.map((item) => resolveMessageItem(item, ''))
    return parts.filter(Boolean).join('\n') || null
  }
  return null
}

/**
 * Type guard to check if a title is multilingual
 * @param title - The title to check
 * @returns True if title is a multilingual object
 */
export function isMultilingualTitle(
  title: any,
): title is Record<string, string> {
  return title && typeof title === 'object' && !Array.isArray(title)
}
