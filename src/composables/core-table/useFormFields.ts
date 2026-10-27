/**
 * useFormFields — turns a row of a table into the payload its backend expects: values converted
 * to the type of their field (integers, numbers, booleans), the dependent columns of the
 * references dropped (the backend resolves them from the foreign key) and no `id`.
 *
 *   const { prepareFormDataForSubmit } = useFormFields({ fields: formFields })
 *   await repository.createItem(prepareFormDataForSubmit(row))
 */

import type { Ref, ComputedRef } from 'vue'

export interface FieldConfig {
  key?: string
  type: string
  title?: string
  required?: boolean
  frontendReadOnly?: boolean
  isForeignKey?: boolean
  isDependentField?: boolean
  isMainSelector?: boolean
  columnsToJoin?: string[]
  joinFrom?: string
  foreignKeyField?: string
  hidden?: boolean
  choices?: any[]
  valueNone?: { title: string | Record<string, string> }
}

export interface UseFormFieldsProps {
  fields?:
    | ComputedRef<Record<string, FieldConfig> | FieldConfig[]>
    | Ref<Record<string, FieldConfig> | FieldConfig[]>
    | Record<string, FieldConfig>
    | FieldConfig[]
}

function unwrapFields(
  value: UseFormFieldsProps['fields'],
): Record<string, FieldConfig> | FieldConfig[] {
  if (!value) return []
  if (typeof value === 'object' && 'value' in value) {
    return (value as Ref<Record<string, FieldConfig> | FieldConfig[]>).value ?? []
  }
  return value as Record<string, FieldConfig> | FieldConfig[]
}

/** A row created in the browser keeps its temporary id (`create-…`) until it is saved. */
const isTempId = (value: any): boolean =>
  typeof value === 'string' && value.startsWith('create-')

const toInteger = (value: any): number => {
  const result =
    typeof value === 'number' ? Math.floor(value) : Number.parseInt(String(value), 10)
  return Number.isNaN(result) ? 0 : result
}

const toNumber = (value: any): number => {
  const result = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isNaN(result) ? 0 : result
}

const toBoolean = (value: any): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1'
  return Boolean(value)
}

const convertValueByType = (value: any, fieldType: string): any => {
  if (isTempId(value)) return value
  switch (fieldType) {
    case 'integer':
      return toInteger(value)
    case 'number':
      return toNumber(value)
    case 'boolean':
      return toBoolean(value)
    default:
      return value
  }
}

export function useFormFields(props: UseFormFieldsProps) {
  const fieldsByKey = (): Record<string, FieldConfig> => {
    const fields = unwrapFields(props.fields)
    return Array.isArray(fields)
      ? Object.fromEntries(fields.map((field) => [field.key || '', field]))
      : fields
  }

  /**
   * The payload of a row: its values typed by their field, without the dependent columns of the
   * references (unless `keepDependentFields`: a pending row keeps them to show them) and without
   * its `id`.
   */
  const prepareFormDataForSubmit = (
    formData: Record<string, any>,
    options?: { keepDependentFields?: boolean },
  ): Record<string, any> => {
    const fields = fieldsByKey()
    const data: Record<string, any> = {}
    for (const [key, value] of Object.entries(formData)) {
      if (key === 'id') continue
      if (!options?.keepDependentFields && fields[key]?.isDependentField) continue
      const fieldType = fields[key]?.type
      data[key] =
        value === null || value === undefined || !fieldType
          ? value
          : convertValueByType(value, fieldType)
    }
    return data
  }

  return { prepareFormDataForSubmit }
}
