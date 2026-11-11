import { describe, test, expect } from 'vitest'
import { InstanceCore } from '@cornflow-ui/core/models/Instance'
import { SolutionCore } from '@cornflow-ui/core/models/Solution'

// A schema whose tables and columns carry their titles and descriptions per language.
const schema = {
  $schema: 'http://json-schema.org/schema#',
  type: 'object',
  properties: {
    plants: {
      type: 'array',
      title: { en: 'Plants', es: 'Plantas' },
      description: { en: 'Where the products are made.', es: 'Dónde se fabrican los productos.' },
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', title: { en: 'Code', es: 'Código' } },
          capacity: { type: 'integer', minimum: 0, title: { en: 'Capacity', es: 'Capacidad' } },
        },
        required: ['code', 'capacity'],
      },
    },
  },
  required: ['plants'],
}

describe('schemas with titles per language', () => {
  test('an instance that holds what the schema asks passes', async () => {
    const instance = new InstanceCore('id', { plants: [{ code: 'PL-1', capacity: 900 }] }, schema, {}, 'app')
    expect(await instance.checkSchema()).toBeUndefined()
  })

  test('an instance that breaks the schema gets its errors', async () => {
    const instance = new InstanceCore('id', { plants: [{ code: 'PL-1', capacity: -5 }] }, schema, {}, 'app')
    const errors = await instance.checkSchema()
    expect(errors).toEqual([
      expect.objectContaining({ instancePath: '/plants/0/capacity', keyword: 'minimum' }),
    ])
  })

  test('a solution is checked against the same kind of schema', async () => {
    const valid = new SolutionCore('id', { plants: [{ code: 'PL-1', capacity: 900 }] }, schema, {}, 'app')
    const invalid = new SolutionCore('id', { plants: [{ code: 'PL-1' }] }, schema, {}, 'app')
    expect(await valid.checkSchema()).toBeUndefined()
    expect(await invalid.checkSchema()).toEqual([
      expect.objectContaining({ instancePath: '/plants/0', keyword: 'required' }),
    ])
  })
})
