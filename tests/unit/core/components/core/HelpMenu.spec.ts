import { describe, test, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import appConfig from '@/app/config'

vi.mock('@cornflow-ui/core/../package.json', () => ({ version: '1.2.3' }))

const store = {
  getLicences: [
    { library: 'Vue', version: '3.0.0', license: 'MIT', author: 'Evan You', description: 'Progressive framework' },
    { library: 'Reka UI', version: '2.0.0', license: 'MIT', author: 'Unovue', description: 'Headless components' },
  ],
  cornflowVersion: '2.4.1',
}
vi.mock('@cornflow-ui/core/stores/general', () => ({ useGeneralStore: () => store }))

import HelpMenu from '@cornflow-ui/core/components/core/HelpMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  messages: {
    en: {
      helpMenu: { help: 'Help', licences: 'Licences', close: 'Close', download: 'Download the manual' },
    },
  },
})

/** The popover and the dialogs rendered inline, so their content can be read. */
const stubs = {
  CorePopover: { name: 'CorePopover', template: '<div><slot name="trigger" /><slot /></div>' },
  CoreDialog: {
    name: 'CoreDialog',
    props: ['modelValue', 'title'],
    template: '<div v-if="modelValue" class="dialog" :data-title="title"><slot /><slot name="actions" /></div>',
  },
}

const mountMenu = () => mount(HelpMenu, { global: { plugins: [i18n], stubs } })

describe('HelpMenu', () => {
  test('a "?" button opens the help centre and the licences, and shows the versions', () => {
    const wrapper = mountMenu()
    expect(wrapper.find('[data-testid="help-menu-trigger"]').attributes('aria-label')).toBe('Help')
    expect(wrapper.findAll('.core-menu__item').map((item) => item.text())).toEqual(['Help', 'Licences'])
    expect(wrapper.find('.help-menu__versions').text()).toContain('Cornflow app version: 1.2.3')
    expect(wrapper.find('.help-menu__versions').text()).toContain('Cornflow version: 2.4.1')
  })

  test('the help centre offers each file of the app config in the current language', async () => {
    const wrapper = mountMenu()
    await wrapper.find('[data-testid="help-menu-help"]').trigger('click')
    const dialog = wrapper.find('.dialog[data-title="Help"]')
    expect(dialog.exists()).toBe(true)
    const files = appConfig.getHelpMenuFiles()
    const links = dialog.findAll('a.help-menu__file')
    expect(links).toHaveLength(files.length)
    files.forEach((file, index) => {
      expect(links[index].attributes('href')).toBe(
        `${import.meta.env.BASE_URL}${file.publicPath.replace('{lang}', 'en')}`,
      )
      expect(links[index].attributes('download')).toBe(
        file.downloadName || file.publicPath.split('/').pop(),
      )
    })
  })

  test('the licences list each library with its version, licence and author', async () => {
    const wrapper = mountMenu()
    await wrapper.find('[data-testid="help-menu-licences"]').trigger('click')
    const items = wrapper.findAll('.dialog[data-title="Licences"] li')
    expect(items.map((item) => item.text())).toEqual([
      'Vue v.3.0.0 (MIT): Evan You · Progressive framework',
      'Reka UI v.2.0.0 (MIT): Unovue · Headless components',
    ])
  })

  test('"Close" closes the dialog', async () => {
    const wrapper = mountMenu()
    await wrapper.find('[data-testid="help-menu-licences"]').trigger('click')
    await wrapper.find('.dialog[data-title="Licences"] button').trigger('click')
    expect(wrapper.find('.dialog[data-title="Licences"]').exists()).toBe(false)
  })
})
