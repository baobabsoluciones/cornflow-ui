import { getCurrentInstance } from 'vue'

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
 * Type guard to check if a title is multilingual
 * @param title - The title to check
 * @returns True if title is a multilingual object
 */
export function isMultilingualTitle(
  title: any,
): title is Record<string, string> {
  return title && typeof title === 'object' && !Array.isArray(title)
}
