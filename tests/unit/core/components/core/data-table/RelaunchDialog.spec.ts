import { describe, test, expect, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import RelaunchDialog from '@cornflow-ui/core/components/core/data-table/RelaunchDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: { dataTable: { relaunch: { note: '«{name}» does not change.' } } } },
})

let wrapper: VueWrapper | undefined

async function mountDialog(props: Record<string, unknown> = {}) {
  wrapper = mount(RelaunchDialog, {
    props: {
      open: true,
      name: 'Plan week 43 · v2',
      sourceName: 'Plan week 43',
      summary: '3 changes in Lines, Demand',
      ...props,
    },
    global: { plugins: [i18n] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const nameInput = () =>
  document.body.querySelector('[data-testid="relaunch-name"]') as HTMLInputElement
const launchButton = () =>
  document.body.querySelector('[data-testid="relaunch-launch"]') as HTMLButtonElement

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

describe('RelaunchDialog', () => {
  test('proposes the name, sums up the changes and says the source stays as it is', async () => {
    await mountDialog()

    expect(nameInput().value).toBe('Plan week 43 · v2')
    expect(document.body.textContent).toContain('3 changes in Lines, Demand')
    expect(document.body.textContent).toContain('«Plan week 43» does not change.')
  })

  test('launches with the name the user wrote', async () => {
    const dialog = await mountDialog()

    nameInput().value = '  Week 43 with more demand '
    nameInput().dispatchEvent(new Event('input'))
    await flushPromises()
    launchButton().click()

    expect(dialog.emitted('launch')).toEqual([['Week 43 with more demand']])
  })

  test('an empty name does not launch', async () => {
    const dialog = await mountDialog({ name: '' })

    launchButton().click()
    await flushPromises()

    expect(dialog.emitted('launch')).toBeUndefined()
    expect(document.body.textContent).toContain('dataTable.relaunch.nameRequired')
  })

  test('while launching the button spins and the name cannot change', async () => {
    await mountDialog({ busy: true })

    expect(launchButton().disabled).toBe(true)
    expect(nameInput().disabled).toBe(true)
  })
})
