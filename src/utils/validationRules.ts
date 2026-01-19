/**
 * Validation rules utilities
 *
 * Provides reusable validation rules for form fields with i18n support.
 * All validation rules return a function that accepts a value and returns
 * either true (valid) or a translated error message string.
 *
 * Usage:
 * import { createValidationRules } from '@/utils/validationRules'
 *
 * const rules = createValidationRules(t) // t is the i18n translate function
 * const emailRules = [rules.required(), rules.email()]
 */

export interface ValidationRule {
  (value: any): boolean | string
}

export interface FieldConfig {
  type?: string
  required?: boolean
  min?: number | string
  max?: number | string
  minLength?: number
  maxLength?: number
  pattern?: string
  email?: boolean
}

/**
 * Create validation rules with i18n support
 * @param t - Translation function from vue-i18n
 */
export function createValidationRules(
  t: (key: string, params?: any) => string,
) {
  return {
    /**
     * Required field validation
     */
    required: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        // Check for null, undefined, empty string, or empty array
        if (v === null || v === undefined || v === '')
          return customMessage || t('validation.required')
        if (Array.isArray(v) && v.length === 0)
          return customMessage || t('validation.required')
        return true
      }
    },

    /**
     * Email format validation
     * Uses bounded quantifiers to prevent ReDoS attacks
     */
    email: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        const str = String(v)
        // Length check first to avoid ReDoS on very long strings
        if (str.length > 254) return customMessage || t('validation.email')
        // Bounded quantifiers for local part (max 64) and domain parts (max 63 each)
        const pattern = /^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@]{1,63}$/
        return pattern.test(str) || customMessage || t('validation.email')
      }
    },

    /**
     * Minimum value validation (for numbers)
     */
    min: (minValue: number, customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (v === null || v === undefined || v === '') return true // Optional field
        const numValue = Number(v)
        if (isNaN(numValue)) return t('validation.invalidNumber')
        return (
          numValue >= minValue ||
          customMessage ||
          t('validation.min', { min: minValue })
        )
      }
    },

    /**
     * Maximum value validation (for numbers)
     */
    max: (maxValue: number, customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (v === null || v === undefined || v === '') return true // Optional field
        const numValue = Number(v)
        if (isNaN(numValue)) return t('validation.invalidNumber')
        return (
          numValue <= maxValue ||
          customMessage ||
          t('validation.max', { max: maxValue })
        )
      }
    },

    /**
     * Minimum length validation (for strings)
     */
    minLength: (minLen: number, customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        const strValue = String(v)
        return (
          strValue.length >= minLen ||
          customMessage ||
          t('validation.minLength', { length: minLen })
        )
      }
    },

    /**
     * Maximum length validation (for strings)
     */
    maxLength: (maxLen: number, customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        const strValue = String(v)
        return (
          strValue.length <= maxLen ||
          customMessage ||
          t('validation.maxLength', { length: maxLen })
        )
      }
    },

    /**
     * Pattern/Regex validation
     */
    pattern: (
      pattern: string | RegExp,
      customMessage?: string,
    ): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        const regex =
          typeof pattern === 'string' ? new RegExp(pattern) : pattern
        return regex.test(String(v)) || customMessage || t('validation.pattern')
      }
    },

    /**
     * Number validation
     */
    number: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (v === null || v === undefined || v === '') return true // Optional field
        const numValue = Number(v)
        return (
          !isNaN(numValue) || customMessage || t('validation.invalidNumber')
        )
      }
    },

    /**
     * Integer validation
     */
    integer: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (v === null || v === undefined || v === '') return true // Optional field
        const numValue = Number(v)
        if (isNaN(numValue))
          return customMessage || t('validation.invalidNumber')
        return (
          Number.isInteger(numValue) || customMessage || t('validation.integer')
        )
      }
    },

    /**
     * URL validation
     */
    url: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        try {
          new URL(v)
          return true
        } catch {
          return customMessage || t('validation.url')
        }
      }
    },

    /**
     * Date validation
     */
    date: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        const date = new Date(v)
        return !isNaN(date.getTime()) || customMessage || t('validation.date')
      }
    },

    /**
     * Phone number validation (basic)
     */
    phone: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        // Basic phone pattern: allows +, -, spaces, and digits
        const pattern = /^[\d\s\-+()]+$/
        return pattern.test(String(v)) || customMessage || t('validation.phone')
      }
    },

    /**
     * Alphanumeric validation
     */
    alphanumeric: (customMessage?: string): ValidationRule => {
      return (v: any) => {
        if (!v) return true // Optional field
        const pattern = /^[a-zA-Z0-9]+$/
        return (
          pattern.test(String(v)) ||
          customMessage ||
          t('validation.alphanumeric')
        )
      }
    },

    /**
     * Custom validation function
     */
    custom: (
      validatorFn: (value: any) => boolean,
      errorMessage: string,
    ): ValidationRule => {
      return (v: any) => {
        return validatorFn(v) || errorMessage
      }
    },
  }
}

/**
 * Generate validation rules from field configuration
 * @param field - Field configuration object
 * @param t - Translation function
 */
export function getFieldValidationRules(
  field: FieldConfig,
  t: (key: string, params?: any) => string,
): ValidationRule[] {
  const rules = createValidationRules(t)
  const validationRules: ValidationRule[] = []

  // Required validation
  if (field.required) {
    validationRules.push(rules.required())
  }

  // Type-specific validations
  switch (field.type) {
    case 'email':
      validationRules.push(rules.email())
      break

    case 'number':
      validationRules.push(rules.number())
      if (field.min !== undefined) {
        validationRules.push(rules.min(Number(field.min)))
      }
      if (field.max !== undefined) {
        validationRules.push(rules.max(Number(field.max)))
      }
      break

    case 'integer':
      validationRules.push(rules.integer())
      if (field.min !== undefined) {
        validationRules.push(rules.min(Number(field.min)))
      }
      if (field.max !== undefined) {
        validationRules.push(rules.max(Number(field.max)))
      }
      break

    case 'date':
      validationRules.push(rules.date())
      break

    case 'string':
      if (field.minLength !== undefined) {
        validationRules.push(rules.minLength(field.minLength))
      }
      if (field.maxLength !== undefined) {
        validationRules.push(rules.maxLength(field.maxLength))
      }
      break
  }

  // Pattern validation (works for any type)
  if (field.pattern) {
    validationRules.push(rules.pattern(field.pattern))
  }

  return validationRules
}

/**
 * Validate a single field value
 * @param value - The value to validate
 * @param rules - Array of validation rules
 * @returns Array of error messages (empty if valid)
 */
export function validateField(value: any, rules: ValidationRule[]): string[] {
  const errors: string[] = []

  for (const rule of rules) {
    const result = rule(value)
    if (result !== true) {
      errors.push(result as string)
    }
  }

  return errors
}

/**
 * Validate an entire form
 * @param formData - Form data object
 * @param fieldConfigs - Field configurations
 * @param t - Translation function
 * @returns Object with field errors
 */
export function validateForm(
  formData: Record<string, any>,
  fieldConfigs: Record<string, FieldConfig>,
  t: (key: string, params?: any) => string,
): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  Object.entries(fieldConfigs).forEach(([fieldName, fieldConfig]) => {
    const value = formData[fieldName]
    const rules = getFieldValidationRules(fieldConfig, t)
    const fieldErrors = validateField(value, rules)

    if (fieldErrors.length > 0) {
      errors[fieldName] = fieldErrors
    }
  })

  return errors
}

/**
 * Check if form has any errors
 * @param errors - Errors object from validateForm
 * @returns true if form is valid (no errors)
 */
export function isFormValid(errors: Record<string, string[]>): boolean {
  return Object.keys(errors).length === 0
}
