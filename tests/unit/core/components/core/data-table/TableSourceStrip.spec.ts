import { describe, expect, test } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TableSourceStrip from '@cornflow-ui/core/components/core/data-table/TableSourceStrip.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      common: { cancel: 'Cancel', close: 'Close' },
      dataTable: {
        source: {
          variants: {
            database: { label: 'From database', text: 'This table was obtained from the database.' },
          },
          perParameter: 'The origin is chosen per parameter.',
          choice: {
            static: { label: 'Static mode', title: 'Stays' },
            live: { label: 'Update with DB', title: 'Reads again' },
            file: { label: 'Excel', title: 'Excel data' },
            database: { label: 'Database', title: 'Database data' },
          },
          master: {
            matches: 'Master {name}',
            identical: 'Identical',
            pills: { added: '{count} row only in the loaded data | {count} rows only in the loaded data' },
            useMaster: { label: 'Use master data', title: 'Use master data', confirm: 'Use it' },
            saveMaster: { label: 'Save to master', title: 'Save to master', confirm: 'Save it' },
          },
        },
      },
    },
  },
})

const ready = {
  state: 'ready' as const,
  name: 'Products',
  added: 2,
  removed: 1,
  modified: 0,
  canUseMaster: true,
  canSaveMaster: false,
}

const mountStrip = (props: Record<string, unknown>) =>
  mount(TableSourceStrip, { props, global: { plugins: [i18n] }, attachTo: document.body })

describe('TableSourceStrip', () => {
  test('shows nothing without an origin or a master', () => {
    expect(mountStrip({}).find('[data-testid="table-source"]').exists()).toBe(false)
  })

  test('says where the table comes from, and per parameter on parameter tables', () => {
    const wrapper = mountStrip({ origin: { variant: 'database', perParameter: true } })
    const origin = wrapper.find('[data-testid="table-source-origin"]')
    expect(origin.classes()).toContain('is-database')
    expect(origin.text()).toContain('From database')
    expect(origin.text()).toContain('The origin is chosen per parameter.')
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(false)
  })

  test('the source choice offers static or live for a database table, file or database otherwise', async () => {
    const database = mountStrip({
      origin: { variant: 'database' },
      showSourceChoice: true,
      sourceChoice: 'static',
    })
    const labels = database.findAll('[role="radio"]').map((r) => r.text())
    expect(labels).toEqual(['Static mode', 'Update with DB'])
    await database.findAll('[role="radio"]')[1].trigger('click')
    expect(database.emitted('update:sourceChoice')).toEqual([['live']])

    const file = mountStrip({ origin: { variant: 'file' }, showSourceChoice: true })
    expect(file.findAll('[role="radio"]').map((r) => r.text())).toEqual(['Excel', 'Database'])
  })

  test('shows the differences with the master and opens the comparison', async () => {
    const wrapper = mountStrip({ master: ready })
    const master = wrapper.find('[data-testid="table-source-master"]')
    expect(master.text()).toContain('Master Products')
    expect(wrapper.find('[data-testid="table-source-pill-added"]').text()).toBe('+2')
    expect(wrapper.find('[data-testid="table-source-pill-added"]').attributes('title')).toBe(
      '2 rows only in the loaded data',
    )
    expect(wrapper.find('[data-testid="table-source-pill-removed"]').text()).toBe('−1')
    expect(wrapper.find('[data-testid="table-source-pill-modified"]').exists()).toBe(false)

    await wrapper.find('[data-testid="table-source-compare"]').trigger('click')
    expect(wrapper.emitted('compare')).toHaveLength(1)
  })

  test('a table with no differences reads Identical', () => {
    const wrapper = mountStrip({ master: { ...ready, added: 0, removed: 0 } })
    expect(wrapper.find('[data-testid="table-source-pill-identical"]').text()).toBe('Identical')
  })

  test('using the master data asks first', async () => {
    const wrapper = mountStrip({ master: ready })
    await wrapper.find('[data-testid="table-source-menu"]').trigger('click')
    await flushPromises()
    ;(document.body.querySelector('[data-testid="table-source-use-master"]') as HTMLElement).click()
    await flushPromises()

    const confirm = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('.core-dialog__actions button'),
    ).find((button) => button.textContent?.includes('Use it'))
    expect(wrapper.emitted('use-master')).toBeUndefined()
    confirm?.click()
    expect(wrapper.emitted('use-master')).toHaveLength(1)
  })

  test('the menu only offers what is allowed', async () => {
    const none = mountStrip({ master: { ...ready, canUseMaster: false } })
    expect(none.find('[data-testid="table-source-menu"]').exists()).toBe(false)

    const wrapper = mountStrip({ master: { ...ready, canSaveMaster: true } })
    await wrapper.find('[data-testid="table-source-menu"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="table-source-use-master"]')).not.toBeNull()
    expect(document.body.querySelector('[data-testid="table-source-save-master"]')).not.toBeNull()
  })
})
