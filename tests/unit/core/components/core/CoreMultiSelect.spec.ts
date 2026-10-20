import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { createI18n } from 'vue-i18n'
import { defineComponent, nextTick, ref } from 'vue'
import CoreMultiSelect, {
  type CoreMultiSelectOption,
} from '@cornflow-ui/core/components/core/CoreMultiSelect.vue'
import { useClickOutside } from '@cornflow-ui/core/composables/useClickOutside'
import en from '@cornflow-ui/core/plugins/locales/en'
import es from '@cornflow-ui/core/plugins/locales/es'

const ITEMS: CoreMultiSelectOption[] = [
  { title: 'Lisbon', value: 'lis' },
  { title: 'Porto', value: 'opo' },
  { title: 'Faro', value: 'fao' },
]

// More than the default search threshold (8)
const LONG_ITEMS: CoreMultiSelectOption[] = Array.from(
  { length: 10 },
  (_, i) => ({
    title: `Station ${i + 1}`,
    value: `s${i + 1}`,
  }),
)

describe('CoreMultiSelect', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify({ components, directives })
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    document.body.innerHTML = ''
  })

  const createI18nPlugin = () =>
    createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          table: {
            searchPlaceholder: 'Search...',
            selectedItems: '{count} selected',
            clearSelection: 'Clear selection',
          },
          multiSelect: {
            all: 'All',
            noResults: 'No results',
          },
        },
      },
    })

  const createWrapper = (props: Record<string, any> = {}) => {
    const w = mount(CoreMultiSelect, {
      props: {
        modelValue: [],
        items: ITEMS,
        // Keeps the prop in sync, as a parent's v-model would
        'onUpdate:modelValue': (value: string[]) =>
          w.setProps({ modelValue: value }),
        ...props,
      },
      attachTo: document.body,
      global: { plugins: [vuetify, createI18nPlugin()] },
    })
    return w
  }

  const trigger = () => wrapper.find('.core-multi-select__trigger')
  const panel = () => wrapper.find('.core-multi-select__panel')
  const list = () => wrapper.find('[role="listbox"]')
  const search = () => wrapper.find('.core-multi-select__search-input')
  const options = () => wrapper.findAll('[role="option"]')
  const activeOption = () => wrapper.find('.core-multi-select__option--active')
  const lastEmitted = () => wrapper.emitted('update:modelValue')?.at(-1)?.[0]

  const openPanel = async () => {
    await trigger().trigger('click')
    await nextTick()
  }

  const pointerdown = (el: Element) =>
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))

  // Whether a mousedown on `el` would move focus (its default action wasn't prevented)
  const mousedownMovesFocus = (el: Element) =>
    el.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    )

  describe('summary', () => {
    test('reads the translated "all" with nothing selected', () => {
      wrapper = createWrapper()
      expect(trigger().text()).toBe('All')
      expect(trigger().attributes('title')).toBeUndefined()
    })

    test('reads allLabel when given', () => {
      wrapper = createWrapper({ allLabel: 'All stations' })
      expect(trigger().text()).toBe('All stations')
    })

    test('reads the title of a single selected item', () => {
      wrapper = createWrapper({ modelValue: ['opo'] })
      expect(trigger().text()).toBe('Porto')
      expect(trigger().attributes('title')).toBeUndefined()
      expect(trigger().classes()).toContain(
        'core-multi-select__trigger--has-value',
      )
    })

    test('reads "first +n" in item order, with every title in the tooltip', () => {
      wrapper = createWrapper({ modelValue: ['fao', 'lis'] })
      expect(trigger().text()).toBe('Lisbon +1')
      expect(trigger().attributes('title')).toBe('Lisbon, Faro')
    })
  })

  describe('selection', () => {
    test('toggles values and keeps the model in item order', async () => {
      wrapper = createWrapper()
      await openPanel()

      await options()[2].trigger('mousedown')
      expect(lastEmitted()).toEqual(['fao'])

      await options()[0].trigger('mousedown')
      expect(lastEmitted()).toEqual(['lis', 'fao'])

      await options()[2].trigger('mousedown')
      expect(lastEmitted()).toEqual(['lis'])
    })

    test('replaces the model instead of mutating it', async () => {
      const model = ['opo']
      wrapper = createWrapper({ modelValue: model })
      await openPanel()

      await options()[0].trigger('mousedown')

      expect(model).toEqual(['opo'])
      expect(lastEmitted()).not.toBe(model)
      expect(lastEmitted()).toEqual(['lis', 'opo'])
    })

    test('marks the selected options', async () => {
      wrapper = createWrapper({ modelValue: ['opo'] })
      await openPanel()

      expect(options()[1].classes()).toContain(
        'core-multi-select__option--selected',
      )
      expect(options()[0].classes()).not.toContain(
        'core-multi-select__option--selected',
      )
    })

    test('keeps the panel open while picking', async () => {
      wrapper = createWrapper()
      await openPanel()

      await options()[0].trigger('mousedown')
      await options()[1].trigger('mousedown')

      expect(panel().exists()).toBe(true)
    })

    test('ignores a right click on an option', async () => {
      wrapper = createWrapper()
      await openPanel()

      await options()[0].trigger('mousedown', { button: 2 })

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })
  })

  describe('focus', () => {
    test('clicks on an option, the clear button or the panel keep focus where it is', async () => {
      wrapper = createWrapper({ modelValue: ['lis'] })
      await openPanel()

      expect(mousedownMovesFocus(options()[1].element)).toBe(false)
      expect(
        mousedownMovesFocus(wrapper.find('.core-multi-select__clear').element),
      ).toBe(false)
      expect(mousedownMovesFocus(panel().element)).toBe(false)
    })

    test('the search box and the list scrollbar still take their clicks', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()

      expect(mousedownMovesFocus(search().element)).toBe(true)
      expect(mousedownMovesFocus(list().element)).toBe(true)
    })
  })

  describe('clear', () => {
    test('shows the selected count and clears the selection', async () => {
      wrapper = createWrapper({ modelValue: ['lis', 'fao'] })
      await openPanel()

      const bar = wrapper.find('.core-multi-select__bar')
      expect(bar.text()).toContain('2 selected')

      await wrapper.find('.core-multi-select__clear').trigger('click')

      expect(lastEmitted()).toEqual([])
      expect(wrapper.find('.core-multi-select__bar').exists()).toBe(false)
    })

    test('hides the bar with nothing selected', async () => {
      wrapper = createWrapper()
      await openPanel()
      expect(wrapper.find('.core-multi-select__bar').exists()).toBe(false)
    })
  })

  describe('search', () => {
    test('has no search box up to the threshold', async () => {
      wrapper = createWrapper()
      await openPanel()
      expect(search().exists()).toBe(false)
    })

    test('has a search box past the threshold', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()
      expect(search().exists()).toBe(true)
    })

    test('takes the threshold as a prop', async () => {
      wrapper = createWrapper({ searchThreshold: 0 })
      await openPanel()
      expect(search().exists()).toBe(true)
    })

    test('filters the options by title, case-insensitively', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()

      await search().setValue('  STATION 1')

      expect(options().map((o: any) => o.text())).toEqual([
        'Station 1',
        'Station 10',
      ])
      expect(activeOption().text()).toBe('Station 1')
    })

    test('says so when nothing matches', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()

      await search().setValue('nowhere')

      expect(options()).toHaveLength(0)
      expect(wrapper.find('.core-multi-select__empty').text()).toBe(
        'No results',
      )
    })

    test('starts empty again after closing', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()
      await search().setValue('Station 1')

      await trigger().trigger('click')
      await openPanel()

      expect((search().element as HTMLInputElement).value).toBe('')
      expect(options()).toHaveLength(10)
    })
  })

  describe('keyboard', () => {
    test('ArrowDown on the button opens the panel and focuses the list', async () => {
      wrapper = createWrapper()

      await trigger().trigger('keydown', { key: 'ArrowDown' })
      await nextTick()

      expect(panel().exists()).toBe(true)
      expect(document.activeElement).toBe(list().element)
      expect(activeOption().text()).toBe('Lisbon')
    })

    test('opening a long list focuses the search box', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })

      await openPanel()
      await nextTick()

      expect(document.activeElement).toBe(search().element)
    })

    test('ArrowDown / ArrowUp move the highlight, wrapping around', async () => {
      wrapper = createWrapper()
      await openPanel()

      await list().trigger('keydown', { key: 'ArrowDown' })
      expect(activeOption().text()).toBe('Porto')

      await list().trigger('keydown', { key: 'ArrowUp' })
      await list().trigger('keydown', { key: 'ArrowUp' })
      expect(activeOption().text()).toBe('Faro')

      await list().trigger('keydown', { key: 'ArrowDown' })
      expect(activeOption().text()).toBe('Lisbon')
    })

    test('Enter and Space toggle the highlighted option', async () => {
      wrapper = createWrapper()
      await openPanel()

      await list().trigger('keydown', { key: 'Enter' })
      expect(lastEmitted()).toEqual(['lis'])

      await list().trigger('keydown', { key: 'ArrowDown' })
      await list().trigger('keydown', { key: ' ' })
      expect(lastEmitted()).toEqual(['lis', 'opo'])
    })

    test('Space in the search box is part of the query, Enter still toggles', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()

      await search().trigger('keydown', { key: ' ' })
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()

      await search().trigger('keydown', { key: 'Enter' })
      expect(lastEmitted()).toEqual(['s1'])
    })

    test('ignores keys during an IME composition', async () => {
      wrapper = createWrapper()
      await openPanel()

      await list().trigger('keydown', { key: 'Enter', isComposing: true })

      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    })

    test('Escape closes, returns focus to the button and is not propagated', async () => {
      wrapper = createWrapper()
      const onDocumentKeydown = vi.fn()
      document.addEventListener('keydown', onDocumentKeydown)
      try {
        await openPanel()

        await list().trigger('keydown', { key: 'Escape' })

        expect(panel().exists()).toBe(false)
        expect(document.activeElement).toBe(trigger().element)
        expect(onDocumentKeydown).not.toHaveBeenCalled()
      } finally {
        document.removeEventListener('keydown', onDocumentKeydown)
      }
    })

    test('Tab closes the panel', async () => {
      wrapper = createWrapper()
      await openPanel()

      await list().trigger('keydown', { key: 'Tab' })

      expect(panel().exists()).toBe(false)
    })
  })

  describe('click outside', () => {
    test('a click outside closes the panel', async () => {
      wrapper = createWrapper()
      await openPanel()

      pointerdown(document.body)
      await nextTick()

      expect(panel().exists()).toBe(false)
    })

    test('a click inside keeps it open', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()

      pointerdown(options()[0].element)
      pointerdown(search().element)
      await nextTick()

      expect(panel().exists()).toBe(true)
    })

    test('inside a popover with its own click-outside, picking closes neither', async () => {
      // A filters popover, as in an app: it closes on a click outside it
      const FiltersPopover = defineComponent({
        components: { CoreMultiSelect },
        setup() {
          const isPopoverOpen = ref(true)
          const stations = ref<string[]>([])
          const root = ref<HTMLElement | null>(null)
          useClickOutside(
            root,
            () => isPopoverOpen.value,
            () => (isPopoverOpen.value = false),
          )
          return { isPopoverOpen, stations, root, items: ITEMS }
        },
        template: `<div>
          <div v-if="isPopoverOpen" ref="root" class="popover">
            <CoreMultiSelect v-model="stations" :items="items" />
          </div>
          <span class="outside" />
        </div>`,
      })
      wrapper = mount(FiltersPopover, {
        attachTo: document.body,
        global: { plugins: [vuetify, createI18nPlugin()] },
      })
      await openPanel()

      // A real click on an option: pointerdown, then mousedown
      for (const index of [2, 0]) {
        pointerdown(options()[index].element)
        await options()[index].trigger('mousedown')
      }

      expect(wrapper.vm.stations).toEqual(['lis', 'fao'])
      expect(wrapper.find('.popover').exists()).toBe(true)
      expect(panel().exists()).toBe(true)

      pointerdown(wrapper.find('.outside').element)
      await nextTick()

      expect(wrapper.find('.popover').exists()).toBe(false)
    })
  })

  describe('disabled', () => {
    test('is disabled and cannot open without items', async () => {
      wrapper = createWrapper({ items: [] })

      expect(trigger().attributes('disabled')).toBeDefined()
      expect(trigger().text()).toBe('All')

      await trigger().trigger('keydown', { key: 'ArrowDown' })
      expect(panel().exists()).toBe(false)
    })

    test('is disabled by the prop', () => {
      wrapper = createWrapper({ disabled: true })
      expect(trigger().attributes('disabled')).toBeDefined()
    })

    test('closes when the items go away while open', async () => {
      wrapper = createWrapper()
      await openPanel()

      await wrapper.setProps({ items: [] })

      expect(panel().exists()).toBe(false)
    })
  })

  describe('ARIA', () => {
    test('links the button to the listbox', async () => {
      wrapper = createWrapper({ id: 'station-filter' })

      expect(trigger().attributes('id')).toBe('station-filter')
      expect(trigger().attributes('aria-haspopup')).toBe('listbox')
      expect(trigger().attributes('aria-expanded')).toBe('false')
      expect(trigger().attributes('aria-controls')).toBeUndefined()

      await openPanel()

      expect(trigger().attributes('aria-expanded')).toBe('true')
      expect(trigger().attributes('aria-controls')).toBe(
        list().attributes('id'),
      )
      expect(list().attributes('aria-multiselectable')).toBe('true')
    })

    test('marks options as selected and points the list at the highlighted one', async () => {
      wrapper = createWrapper({ modelValue: ['opo'] })
      await openPanel()

      expect(options().map((o: any) => o.attributes('aria-selected'))).toEqual([
        'false',
        'true',
        'false',
      ])
      expect(list().attributes('aria-activedescendant')).toBe(
        options()[0].attributes('id'),
      )

      await list().trigger('keydown', { key: 'ArrowDown' })
      expect(list().attributes('aria-activedescendant')).toBe(
        options()[1].attributes('id'),
      )
    })

    test('with a search box, the box carries aria-activedescendant instead of the list', async () => {
      wrapper = createWrapper({ items: LONG_ITEMS })
      await openPanel()

      expect(search().attributes('aria-label')).toBe('Search...')
      expect(search().attributes('aria-controls')).toBe(list().attributes('id'))
      expect(search().attributes('aria-activedescendant')).toBe(
        options()[0].attributes('id'),
      )
      expect(list().attributes('aria-activedescendant')).toBeUndefined()
    })

    test('two instances in one app get different ids', async () => {
      const Host = defineComponent({
        components: { CoreMultiSelect },
        setup: () => ({ items: ITEMS }),
        template: `<div>
          <CoreMultiSelect :model-value="[]" :items="items" />
          <CoreMultiSelect :model-value="[]" :items="items" />
        </div>`,
      })
      wrapper = mount(Host, {
        attachTo: document.body,
        global: { plugins: [vuetify, createI18nPlugin()] },
      })
      for (const button of wrapper.findAll('.core-multi-select__trigger')) {
        await button.trigger('click')
      }

      const ids = wrapper
        .findAll('[role="listbox"]')
        .map((l: any) => l.attributes('id'))
      expect(ids).toHaveLength(2)
      expect(ids[0]).not.toBe(ids[1])
    })
  })

  describe('core translations', () => {
    const mountWithLocale = (locale: 'en' | 'es') =>
      mount(CoreMultiSelect, {
        props: {
          modelValue: ['s1', 's2'],
          items: LONG_ITEMS,
        },
        attachTo: document.body,
        global: {
          plugins: [
            vuetify,
            createI18n({ legacy: false, locale, messages: { en, es } }),
          ],
        },
      })

    test.each([
      ['en', 'All', 'Search...', '2 selected', 'Clear selection', 'No results'],
      [
        'es',
        'Todos',
        'Buscar...',
        '2 seleccionados',
        'Limpiar selección',
        'Sin resultados',
      ],
    ] as const)(
      'reads its texts from the core %s locale',
      async (locale, all, searchText, selected, clearText, noResults) => {
        wrapper = mountWithLocale(locale)
        await openPanel()

        expect(search().attributes('placeholder')).toBe(searchText)
        expect(wrapper.find('.core-multi-select__bar').text()).toContain(
          selected,
        )
        expect(wrapper.find('.core-multi-select__clear').text()).toBe(clearText)

        await search().setValue('nowhere')
        expect(wrapper.find('.core-multi-select__empty').text()).toBe(noResults)

        await wrapper.setProps({ modelValue: [] })
        expect(trigger().text()).toBe(all)
      },
    )
  })
})
