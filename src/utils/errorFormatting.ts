/**
 * Utility functions for formatting errors with HTML markup
 */

/**
 * Interface for validation errors with instancePath and message
 */
export interface ValidationError {
  instancePath: string
  message: string
}

/**
 * Translation function type
 */
type TranslateFunction = (key: string, params?: Record<string, any>) => string

/**
 * Get translated keyword name
 */
function getTranslatedKeyword(keyword: string, t?: TranslateFunction): string {
  if (!t) return keyword
  
  const keywordKey = `validation.keywords.${keyword}`
  const translated = t(keywordKey)
  // If translation exists (not the same as key), return it, otherwise return original keyword
  return translated !== keywordKey ? translated : keyword
}

/**
 * Get translated parameter name
 */
function getTranslatedParam(paramKey: string, t?: TranslateFunction): string {
  if (!t) return paramKey
  
  const paramKeyTranslation = `validation.params.${paramKey}`
  const translated = t(paramKeyTranslation)
  return translated !== paramKeyTranslation ? translated : paramKey
}

/**
 * Keywords that require the 'limit' parameter
 */
const LIMIT_KEYWORDS = ['maximum', 'minimum', 'maxLength', 'minLength']

/**
 * Get translation params for a specific keyword
 */
function getKeywordParams(keyword: string, params: Record<string, any>): Record<string, any> {
  if (LIMIT_KEYWORDS.includes(keyword) && params.limit !== undefined) {
    return { limit: params.limit }
  }
  if (keyword === 'type') {
    return { type: params.type || 'unknown' }
  }
  return {}
}

/**
 * Translate Ajv error message based on keyword and params
 */
function translateErrorMessage(
  message: string,
  keyword: string,
  params: Record<string, any>,
  t?: TranslateFunction,
): string {
  if (!t) return message

  const messageKey = `validation.messages.${keyword}`
  let translatedTemplate = t(messageKey)

  // If translation key not found, try with params for specific keywords
  if (translatedTemplate === messageKey) {
    const keywordParams = getKeywordParams(keyword, params)
    const hasValidParams = LIMIT_KEYWORDS.includes(keyword) 
      ? params.limit !== undefined 
      : ['required', 'type', 'pattern'].includes(keyword)

    if (hasValidParams) {
      translatedTemplate = t(messageKey, keywordParams)
    } else {
      return message
    }
  } else {
    // Replace params in template
    Object.entries(params).forEach(([key, value]) => {
      translatedTemplate = translatedTemplate.replace(`{${key}}`, String(value))
    })
  }

  return translatedTemplate !== messageKey ? translatedTemplate : message
}

/**
 * Format an array of validation errors into HTML list items
 * @param errors Array of validation errors (can be ValidationError or Ajv ErrorObject)
 * @param t Optional translation function
 * @returns HTML string with formatted error list items
 */
export function formatValidationErrors(
  errors: ValidationError[] | any[],
  t?: TranslateFunction,
): string {
  if (!errors || errors.length === 0) {
    return ''
  }
  return errors
    .map((error) => {
      // Handle Ajv ErrorObject format (has instancePath, message, keyword, params, schemaPath)
      const instancePath = error.instancePath || ''
      const originalMessage = error.message || ''
      const keyword = error.keyword || ''
      const params = error.params || {}
      const schemaPath = error.schemaPath || ''

      // Translate the error message
      const message = translateErrorMessage(originalMessage, keyword, params, t)

      // Build path prefix
      const pathPrefix = instancePath && instancePath.trim() !== ''
        ? `<strong>${instancePath}</strong> - `
        : ''

      // Build additional details with translations
      let details = ''
      if (keyword) {
        const translatedKeyword = getTranslatedKeyword(keyword, t)
        details += ` <em>(${translatedKeyword})</em>`
      }
      if (Object.keys(params).length > 0) {
        const paramsStr = Object.entries(params)
          .map(([key, value]) => {
            const translatedKey = getTranslatedParam(key, t)
            return `${translatedKey}: ${value}`
          })
          .join(', ')
        details += ` <span style="font-size: 0.9em; color: #666;">[${paramsStr}]</span>`
      }

      return `<li>${pathPrefix}${message}${details}</li>`
    })
    .join('')
}

/**
 * Format validation errors with a title
 * @param title Title to display (will be wrapped in <strong> tags inside a <p>)
 * @param errors Array of validation errors
 * @param t Optional translation function
 * @returns Complete HTML string with title and formatted error list
 */
export function formatValidationErrorsWithTitle(
  title: string,
  errors: ValidationError[],
  t?: TranslateFunction,
): string {
  const titleHtml = `<p><strong>${title}:</strong></p>`
  const errorsHtml = formatValidationErrors(errors, t)
  return titleHtml + errorsHtml
}

/**
 * Format a single error message with a title
 * @param title Title to display (will be wrapped in <strong> tags inside a <p>)
 * @param message Error message
 * @returns HTML string with title and error message in list format
 */
export function formatSingleErrorWithTitle(
  title: string,
  message: string,
): string {
  return `<p><strong>${title}:</strong></p><li>${message}</li>`
}

/**
 * Format error details from backend (can be array of ValidationError or plain strings)
 * @param title Title to display
 * @param errorDetails Error details from backend
 * @param fallbackMessage Fallback message if errorDetails is empty/invalid
 * @param t Optional translation function
 * @returns Formatted HTML string
 */
export function formatErrorDetails(
  title: string,
  errorDetails: ValidationError[] | string[] | any,
  fallbackMessage: string,
  t?: TranslateFunction,
): string {
  if (
    !errorDetails ||
    (Array.isArray(errorDetails) && errorDetails.length === 0)
  ) {
    return formatSingleErrorWithTitle(title, fallbackMessage)
  }

  if (Array.isArray(errorDetails)) {
    // Check if it's an array of ValidationError objects
    if (
      errorDetails.length > 0 &&
      typeof errorDetails[0] === 'object' &&
      'instancePath' in errorDetails[0] &&
      'message' in errorDetails[0]
    ) {
      return formatValidationErrorsWithTitle(
        title,
        errorDetails as ValidationError[],
        t,
      )
    }

    // If it's an array of strings or other objects, convert to list items
    const errorList = errorDetails
      .map((error) => {
        if (typeof error === 'string') {
          return `<li>${error}</li>`
        } else if (typeof error === 'object' && error.message) {
          return `<li>${error.message}</li>`
        }
        return `<li>${String(error)}</li>`
      })
      .join('')

    return `<p><strong>${title}:</strong></p>` + errorList
  }

  // If it's not an array, treat it as a single message
  return formatSingleErrorWithTitle(title, String(errorDetails))
}
