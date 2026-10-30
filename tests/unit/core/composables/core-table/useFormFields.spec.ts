import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import {
  useFormFields,
  type FieldConfig,
} from '@cornflow-ui/core/composables/core-table/useFormFields'

const fields: FieldConfig[] = [
  { key: 'name', type: 'string' },
  { key: 'units', type: 'integer' },
  { key: 'cost', type: 'number' },
  { key: 'active', type: 'boolean' },
  { key: 'plant_id', type: 'integer', isForeignKey: true },
  { key: 'plant_name', type: 'string', isDependentField: true, isMainSelector: true },
]

describe('useFormFields', () => {
  test('types the values by their field and leaves the rest as they are', () => {
    const { prepareFormDataForSubmit } = useFormFields({ fields })

    expect(
      prepareFormDataForSubmit({
        name: 'L1',
        units: '12.7',
        cost: '3.5',
        active: 'true',
        note: 'free text',
      }),
    ).toEqual({ name: 'L1', units: 12, cost: 3.5, active: true, note: 'free text' })
  })

  test('invalid numbers become 0; empty values are kept as they are', () => {
    const { prepareFormDataForSubmit } = useFormFields({ fields })

    expect(prepareFormDataForSubmit({ units: 'x', cost: null, active: undefined })).toEqual({
      units: 0,
      cost: null,
      active: undefined,
    })
  })

  test('drops the id and the dependent columns of the references', () => {
    const { prepareFormDataForSubmit } = useFormFields({ fields })

    expect(prepareFormDataForSubmit({ id: 7, plant_id: 2, plant_name: 'North' })).toEqual({
      plant_id: 2,
    })
  })

  test('keeps the dependent columns of a row that stays pending', () => {
    const { prepareFormDataForSubmit } = useFormFields({ fields })

    expect(
      prepareFormDataForSubmit({ plant_name: 'North' }, { keepDependentFields: true }),
    ).toEqual({ plant_name: 'North' })
  })

  test('keeps the temporary id a pending row is referenced by', () => {
    const { prepareFormDataForSubmit } = useFormFields({ fields })

    expect(prepareFormDataForSubmit({ plant_id: 'create-plants-0-1' })).toEqual({
      plant_id: 'create-plants-0-1',
    })
  })

  test('reads the fields from a ref or an object keyed by field', () => {
    const fromRef = useFormFields({ fields: ref(fields) })
    expect(fromRef.prepareFormDataForSubmit({ units: '4' })).toEqual({ units: 4 })

    const fromObject = useFormFields({ fields: { units: { type: 'integer' } } })
    expect(fromObject.prepareFormDataForSubmit({ units: '4' })).toEqual({ units: 4 })
  })
})
