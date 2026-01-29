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
 * Extract field name from instancePath
 * @param instancePath Path like "/eCierresP/0/ID_PROFESOR" or "/eCierresP"
 * @returns Field name like "ID_PROFESOR" or "eCierresP"
 */
function extractFieldName(instancePath: string): string {
  if (!instancePath) return ''
  
  // Remove leading slash and split by '/'
  const parts = instancePath.replace(/^\//, '').split('/')
  
  // If path is empty, return empty
  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return ''
  }
  
  // Return the last non-empty part (the field name)
  return parts[parts.length - 1] || ''
}

/**
 * Format path for display (e.g., "/eCierresP/0/ID_PROFESOR" -> "eCierresP[0].ID_PROFESOR")
 */
function formatPathForDisplay(instancePath: string): string {
  if (!instancePath) return ''
  
  const parts = instancePath.replace(/^\//, '').split('/').filter(Boolean)
  if (parts.length === 0) return ''
  
  let formatted = parts[0]
  for (let i = 1; i < parts.length; i++) {
    // Check if it's a numeric index (array position)
    if (/^\d+$/.test(parts[i])) {
      formatted += `[${parts[i]}]`
    } else {
      formatted += `.${parts[i]}`
    }
  }
  
  return formatted
}

/**
 * Get translated type name
 */
function getTranslatedType(type: string, t?: TranslateFunction): string {
  if (!t) return type
  
  const typeKey = `validation.types.${type}`
  const translated = t(typeKey)
  return translated !== typeKey ? translated : type
}

/**
 * Format type error specifically
 */
function formatTypeError(
  error: any,
  fieldName: string,
  formattedPath: string,
  t?: TranslateFunction,
): string {
  const expectedType = error.params?.type || 'unknown'
  const translatedType = getTranslatedType(expectedType, t)
  const translatedKeyword = getTranslatedKeyword('type', t)
  
  if (fieldName && t) {
    const errorFormat = t('validation.errorFormats.typeError', { type: translatedType })
    // Replace {type} placeholder with HTML-wrapped type after translation
    const formattedError = errorFormat.replace(translatedType, `<code>${translatedType}</code>`)
    return `<strong>${formattedPath}</strong>: ${translatedKeyword} ${formattedError}`
  } else if (fieldName) {
    // Fallback if no translation function
    return `<strong>${formattedPath}</strong>: ${translatedKeyword} error - expected <code>${expectedType}</code>, but received a different type`
  }
  
  if (t) {
    const errorFormat = t('validation.errorFormats.typeErrorNoField', { type: translatedType })
    // Replace {type} placeholder with HTML-wrapped type after translation
    const formattedError = errorFormat.replace(translatedType, `<code>${translatedType}</code>`)
    return `${translatedKeyword} ${formattedError}`
  }
  
  return `${translatedKeyword} error - expected <code>${expectedType}</code>`
}

/**
 * Format required error specifically
 */
function formatRequiredError(
  error: any,
  formattedPath: string,
  t?: TranslateFunction,
): string {
  const missingProperty = error.params?.missingProperty || ''
  const translatedKeyword = getTranslatedKeyword('required', t)
  
  if (missingProperty && t) {
    if (formattedPath) {
      const errorFormat = t('validation.errorFormats.requiredError', { property: missingProperty })
      // Replace property placeholder with HTML-wrapped property after translation
      const formattedError = errorFormat.replace(missingProperty, `<code>${missingProperty}</code>`)
      return `<strong>${formattedPath}</strong>: ${translatedKeyword} ${formattedError}`
    }
    const errorFormat = t('validation.errorFormats.requiredErrorNoPath', { property: missingProperty })
    // Replace property placeholder with HTML-wrapped property after translation
    const formattedError = errorFormat.replace(missingProperty, `<code>${missingProperty}</code>`)
    return `${translatedKeyword} ${formattedError}`
  } else if (missingProperty) {
    // Fallback if no translation function
    if (formattedPath) {
      return `<strong>${formattedPath}</strong>: ${translatedKeyword} - missing property <code>${missingProperty}</code>`
    }
    return `${translatedKeyword} - missing required property <code>${missingProperty}</code>`
  }
  
  if (t) {
    const errorFormat = t('validation.errorFormats.requiredErrorGeneric')
    return `${translatedKeyword} ${errorFormat}`
  }
  
  return `${translatedKeyword} - missing required property`
}

/**
 * Group similar errors together
 * Only groups errors that have the exact same path (including array indices)
 */
function groupSimilarErrors(errors: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>()
  
  for (const error of errors) {
    const keyword = error.keyword || 'unknown'
    const instancePath = error.instancePath || ''
    const params = error.params || {}
    
    // Create a key that includes the full path to preserve array indices
    // This ensures errors at different array positions are shown separately
    let groupKey = `${keyword}:${instancePath}`
    
    // For type errors, include the expected type
    if (keyword === 'type' && params.type) {
      groupKey += `:${params.type}`
    }
    // For required errors, include the missing property
    else if (keyword === 'required' && params.missingProperty) {
      groupKey += `:${params.missingProperty}`
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(error)
  }
  
  return groups
}

/**
 * Format grouped errors
 * Shows each error individually to preserve array indices and specific paths
 */
function formatGroupedErrors(
  groupKey: string,
  errors: any[],
  t?: TranslateFunction,
): string {
  if (errors.length === 0) return ''
  
  // Format each error individually to show specific paths/indices
  return errors
    .map((error) => {
      const keyword = error.keyword || ''
      const fieldName = extractFieldName(error.instancePath || '')
      const formattedPath = formatPathForDisplay(error.instancePath || '')
      
      let errorText = ''
      
      // Format based on error type
      if (keyword === 'type') {
        errorText = formatTypeError(error, fieldName, formattedPath, t)
      } else if (keyword === 'required') {
        errorText = formatRequiredError(error, formattedPath, t)
      } else {
        // Generic error formatting
        const translatedKeyword = getTranslatedKeyword(keyword, t)
        const params = error.params || {}
        const message = error.message || ''
        
        errorText = formattedPath 
          ? `<strong>${formattedPath}</strong>: ${translatedKeyword}`
          : translatedKeyword
        
        if (Object.keys(params).length > 0) {
          const paramsStr = Object.entries(params)
            .map(([key, value]) => {
              const translatedKey = getTranslatedParam(key, t)
              return `${translatedKey}: <code>${value}</code>`
            })
            .join(', ')
          errorText += ` (${paramsStr})`
        }
        
        if (message && !message.includes(keyword)) {
          errorText += ` - ${message}`
        }
      }
      
      return `<li>${errorText}</li>`
    })
    .join('')
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
  
  // Group similar errors together
  const groupedErrors = groupSimilarErrors(errors)
  
  // Format each group
  const formattedErrors: string[] = []
  for (const [groupKey, groupErrors] of groupedErrors.entries()) {
    formattedErrors.push(formatGroupedErrors(groupKey, groupErrors, t))
  }
  
  return formattedErrors.join('')
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
  // Wrap errors in <ul> if there are errors
  const wrappedErrors = errorsHtml ? `<ul>${errorsHtml}</ul>` : ''
  return titleHtml + wrappedErrors
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
