import { describe, expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ParametersTable from '@cornflow-ui/core/components/core/data-table/ParametersTable.vue'
import type { ParameterRow } from '@cornflow-ui/core/components/core/data-table/ParametersTable.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      table: { yes: 'Yes', no: 'No' },
      dataTable: {
        errors: { required: 'Required', number: 'Enter a valid number' },
        parameters: {
          parameter: 'Parameter',
          value: 'Value',
          source: 'From database',
          fromDatabase: 'From database',
          revert: 'Revert',
          notAvailable: 'Not available',
          default: 'Default',
          database: 'From DB',
          fixed: 'Fixed',
          none: 'No parameters',
        },
      },
    },
  },
})

const horizon: ParameterRow = {
  id: 'horizon',
  label: 'Planning horizon',
  unit: 'weeks',
  column: { key: 'value', title: 'Value', type: 'number', required: true },
  value: 12,
}
const objective: ParameterRow = {
  id: 'objective',
  label: 'Objective',
  column: {
    key: 'value',
    title: 'Value',
    type: 'list',
    options: [
      { value: 'cost', label: 'Minimise cost' },
      { value: 'service', label: 'Maximise service' },
    ],
  },
  value: 'cost',
}

const mountTable = (props: Record<string, unknown>) =>
  mount(ParametersTable, { props: props as any, global: { plugins: [i18n] } })

const field = (wrapper: ReturnType<typeof mountTable>, id: string) =>
  wrapper.find(`[data-testid="parameter-${id}"]`)

describe('ParametersTable', () => {
  test('lists each parameter with its unit, and its value as text when read-only', () => {
    const wrapper = mountTable({
      rows: [{ ...horizon, value: 1200 }, objective],
      readOnly: true,
    })

    expect(field(wrapper, 'horizon').text()).toContain('Planning horizon')
    expect(field(wrapper, 'horizon').text()).toContain('(weeks)')
    expect(field(wrapper, 'horizon').text()).toContain('1,200')
    expect(field(wrapper, 'objective').text()).toContain('Minimise cost')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('From database')
  })

  test('a number is committed when the field changes, and an invalid one says why', async () => {
    const wrapper = mountTable({ rows: [horizon] })
    const input = wrapper.find('[data-testid="parameter-horizon-value"]')

    await input.setValue('12.5')
    expect(wrapper.emitted('update:value')).toEqual([['horizon', 12.5]])

    await input.setValue('twelve')
    expect(wrapper.emitted('update:value')).toHaveLength(1)
    expect(field(wrapper, 'horizon').text()).toContain('Enter a valid number')
    expect((input.element as HTMLInputElement).value).toBe('twelve')

    await input.setValue('')
    expect(field(wrapper, 'horizon').text()).toContain('Required')
  })

  test('a list value is picked from its options', async () => {
    const wrapper = mountTable({ rows: [objective] })

    await wrapper.find('[data-testid="parameter-objective-value"]').setValue('1')

    expect(wrapper.emitted('update:value')).toEqual([['objective', 'service']])
  })

  test('the source switch says whether the value comes from the database', async () => {
    const wrapper = mountTable({
      rows: [
        { ...horizon, source: { mode: 'switch', fromDatabase: true } },
        { ...objective, source: { mode: 'switch', fromDatabase: false, disabled: true } },
      ],
    })

    const horizonSwitch = wrapper.find('[data-testid="parameter-horizon-source"]')
    expect(horizonSwitch.attributes('aria-checked')).toBe('true')
    expect(horizonSwitch.text()).toBe('Yes')
    await horizonSwitch.trigger('click')
    expect(wrapper.emitted('update:source')).toEqual([['horizon', false]])

    const objectiveSwitch = wrapper.find('[data-testid="parameter-objective-source"]')
    expect(objectiveSwitch.attributes('disabled')).toBeDefined()
    expect(objectiveSwitch.text()).toBe('Not available')
  })

  test('a re-uploaded parameter picks Default, From DB or Fixed', async () => {
    const wrapper = mountTable({
      rows: [{ ...horizon, source: { mode: 'choice', value: 'database', databaseDisabled: false } }],
      sourceTitle: 'Value source',
    })

    expect(wrapper.text()).toContain('Value source')
    const options = wrapper.findAll('[data-testid="parameter-horizon-source"] [role="radio"]')
    expect(options.map((o) => o.text())).toEqual(['Default', 'From DB', 'Fixed'])
    expect(options[1].attributes('aria-checked')).toBe('true')

    await options[2].trigger('click')
    expect(wrapper.emitted('update:source')).toEqual([['horizon', 'fixed']])
  })

  test('From DB is disabled when the parameter cannot come from the database', () => {
    const wrapper = mountTable({
      rows: [{ ...horizon, source: { mode: 'choice', value: 'default', databaseDisabled: true } }],
    })

    const options = wrapper.findAll('[data-testid="parameter-horizon-source"] [role="radio"]')
    expect(options[1].attributes('disabled')).toBeDefined()
    expect(options[2].attributes('disabled')).toBeUndefined()
  })

  test('a modified value is marked and can be reverted', async () => {
    const wrapper = mountTable({ rows: [{ ...horizon, modified: true }, objective] })

    expect(field(wrapper, 'horizon').find('.is-modified').exists()).toBe(true)
    expect(wrapper.find('[data-testid="parameter-objective-revert"]').exists()).toBe(false)

    await wrapper.find('[data-testid="parameter-horizon-revert"]').trigger('click')
    expect(wrapper.emitted('revert')).toEqual([['horizon']])
  })
})
