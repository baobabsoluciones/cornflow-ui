import { describe, test, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CoreAlert from '@cornflow-ui/core/components/core/CoreAlert.vue'
import CoreBadge from '@cornflow-ui/core/components/core/CoreBadge.vue'
import CoreButton from '@cornflow-ui/core/components/core/CoreButton.vue'
import CoreCheckbox from '@cornflow-ui/core/components/core/CoreCheckbox.vue'
import CoreDescriptionList from '@cornflow-ui/core/components/core/CoreDescriptionList.vue'
import CoreDialog from '@cornflow-ui/core/components/core/CoreDialog.vue'
import CoreEmptyState from '@cornflow-ui/core/components/core/CoreEmptyState.vue'
import CoreIcon from '@cornflow-ui/core/components/core/CoreIcon.vue'
import CoreMenu from '@cornflow-ui/core/components/core/CoreMenu.vue'
import CoreMultiSelect, {
  pickedSummary,
} from '@cornflow-ui/core/components/core/CoreMultiSelect.vue'
import CoreProgressBar from '@cornflow-ui/core/components/core/CoreProgressBar.vue'
import CoreSegmentedControl from '@cornflow-ui/core/components/core/CoreSegmentedControl.vue'
import CoreSelect from '@cornflow-ui/core/components/core/CoreSelect.vue'
import CoreSwitch from '@cornflow-ui/core/components/core/CoreSwitch.vue'
import CoreTextField from '@cornflow-ui/core/components/core/CoreTextField.vue'
import CoreTimeline from '@cornflow-ui/core/components/core/CoreTimeline.vue'
import CoreConfirmDialog from '@cornflow-ui/core/components/core/table/CoreConfirmDialog.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { common: { close: 'Close' } } },
})

describe('CoreIcon', () => {
  test('is decorative unless it has a label', () => {
    const decorative = mount(CoreIcon, { props: { name: 'mdi-history' } })
    expect(decorative.classes()).toEqual(
      expect.arrayContaining(['mdi', 'mdi-history']),
    )
    expect(decorative.attributes('aria-hidden')).toBe('true')

    const labelled = mount(CoreIcon, {
      props: { name: 'mdi-alert', label: 'Error', size: 22 },
    })
    expect(labelled.attributes('role')).toBe('img')
    expect(labelled.attributes('aria-label')).toBe('Error')
    expect(labelled.attributes('style')).toContain('font-size: 22px')
  })
})

describe('CoreButton', () => {
  test('is a plain button with its text and icon, and emits clicks', async () => {
    const wrapper = mount(CoreButton, {
      props: { text: 'Load', icon: 'mdi-open-in-app' },
    })

    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.text()).toBe('Load')
    expect(wrapper.find('.mdi-open-in-app').exists()).toBe(true)

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  test('takes the variant, size and tone', () => {
    const wrapper = mount(CoreButton, {
      props: { text: 'Delete', variant: 'text', color: 'error', size: 'small' },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        'core-button--text',
        'core-button--small',
        'core-button--tone-danger',
      ]),
    )
  })

  test('while loading shows a spinner and its loading text, and takes no clicks', async () => {
    const wrapper = mount(CoreButton, {
      props: {
        text: 'Delete',
        icon: 'mdi-delete',
        loading: true,
        loadingText: 'Deleting…',
      },
    })

    expect(wrapper.find('.core-spinner').exists()).toBe(true)
    expect(wrapper.find('.mdi-delete').exists()).toBe(false)
    expect(wrapper.text()).toBe('Deleting…')
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
  })

  test('an icon button shows no text', () => {
    const wrapper = mount(CoreButton, {
      props: { variant: 'icon', icon: 'mdi-pencil', text: 'Edit' },
      attrs: { 'aria-label': 'Edit' },
    })
    expect(wrapper.find('.core-button__text').exists()).toBe(false)
    expect(wrapper.attributes('aria-label')).toBe('Edit')
  })

  test('a custom colour overrides the variant', () => {
    const wrapper = mount(CoreButton, {
      props: { text: 'Go', backgroundColor: 'var(--accent)' },
    })
    expect(wrapper.attributes('style')).toContain('--button-bg: var(--accent)')
  })
})

describe('CoreBadge', () => {
  test('a soft badge shows its icon and label in its tone', () => {
    const wrapper = mount(CoreBadge, {
      props: { label: 'Success', tone: 'success', icon: 'mdi-check-circle' },
    })
    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(['core-badge--soft', 'core-badge--success']),
    )
    expect(wrapper.find('.mdi-check-circle').exists()).toBe(true)
    expect(wrapper.text()).toBe('Success')
  })

  test('a dot badge shows a dot instead of the icon', () => {
    const wrapper = mount(CoreBadge, {
      props: {
        label: 'Infeasible',
        tone: 'danger',
        variant: 'dot',
        icon: 'mdi-close',
      },
    })
    expect(wrapper.find('.core-badge__dot').exists()).toBe(true)
    expect(wrapper.find('.mdi-close').exists()).toBe(false)
  })
})

describe('CoreAlert', () => {
  test('an error is announced at once, with its title and message', () => {
    const wrapper = mount(CoreAlert, {
      props: {
        tone: 'error',
        title: 'Server message',
        message: 'Column not found',
      },
    })
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.find('.core-alert__title').text()).toBe('Server message')
    expect(wrapper.find('.core-alert__message').text()).toBe('Column not found')
    expect(wrapper.find('.mdi-alert-circle').exists()).toBe(true)
  })

  test('other tones are polite, and the action emits', async () => {
    const wrapper = mount(CoreAlert, {
      props: {
        tone: 'info',
        message: 'Only the latest',
        actionLabel: 'Last 7 days',
      },
    })
    expect(wrapper.attributes('role')).toBe('status')

    await wrapper.find('.core-alert__action').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})

describe('CoreEmptyState', () => {
  test('shows its title and text, and the action only when given', async () => {
    const plain = mount(CoreEmptyState, {
      props: { title: 'Nothing yet', text: 'Create one' },
    })
    expect(plain.text()).toContain('Nothing yet')
    expect(plain.text()).toContain('Create one')
    expect(plain.find('button').exists()).toBe(false)

    const withAction = mount(CoreEmptyState, {
      props: { title: 'No results', actionLabel: 'Clear filters' },
    })
    await withAction.find('button').trigger('click')
    expect(withAction.emitted('action')).toHaveLength(1)
  })
})

describe('CoreDescriptionList', () => {
  test('lists the pairs with a value and leaves out the empty ones', () => {
    const wrapper = mount(CoreDescriptionList, {
      props: {
        title: 'Execution data',
        items: [
          { label: 'User', value: 'Ana' },
          { label: 'Finished', value: '—', muted: true },
          { label: 'Mode', value: null },
          { label: 'Plant', value: '' },
          { label: 'Horizon', value: 0 },
        ],
      },
    })

    expect(wrapper.find('h3').text()).toBe('Execution data')
    expect(wrapper.findAll('dt').map((term) => term.text())).toEqual([
      'User',
      'Finished',
      'Horizon',
    ])
    expect(wrapper.findAll('dd')[1].classes()).toContain('is-muted')
  })
})

describe('CoreProgressBar', () => {
  test('keeps its value between 0 and 100', () => {
    const over = mount(CoreProgressBar, {
      props: { value: 140, label: 'Time used' },
    })
    expect(over.attributes('aria-valuenow')).toBe('100')
    expect(over.attributes('aria-label')).toBe('Time used')

    const under = mount(CoreProgressBar, { props: { value: -3 } })
    expect(under.attributes('aria-valuenow')).toBe('0')
  })
})

describe('CoreTimeline', () => {
  const steps = [
    { key: 'queued', label: 'Queued', time: '10:30', status: 'done' as const },
    {
      key: 'run',
      label: 'Running',
      description: '12 min',
      status: 'current' as const,
      icon: 'mdi-loading',
      spin: true,
      progress: 40,
    },
    { key: 'end', label: 'Finished', status: 'pending' as const },
  ]

  test('marks the current step and shows its own icon and progress', () => {
    const wrapper = mount(CoreTimeline, { props: { title: 'Progress', steps } })
    const items = wrapper.findAll('li')

    expect(items).toHaveLength(3)
    expect(items[1].attributes('aria-current')).toBe('step')
    expect(items[1].find('.core-spinner').exists()).toBe(true)
    expect(
      items[1].find('[role="progressbar"]').attributes('aria-valuenow'),
    ).toBe('40')
    expect(items[0].find('.mdi-check-circle').exists()).toBe(true)
    expect(items[2].find('.mdi-circle-outline').exists()).toBe(true)
  })

  test('the line to a step is solid once reached and dashed while pending', () => {
    const wrapper = mount(CoreTimeline, { props: { steps } })
    const lines = wrapper.findAll('.core-timeline__line')

    expect(lines).toHaveLength(2)
    expect(lines[0].classes()).toContain('is-reached')
    expect(lines[1].classes()).not.toContain('is-reached')
  })
})

describe('CoreMenu', () => {
  const items = [
    { key: 'group', label: 'Execution', header: true },
    { key: 'all', label: 'All', selected: true },
    { key: 'north', label: 'North', count: 3 },
    { key: 'south', label: 'South', disabled: true },
  ]

  test('a single choice marks the picked row, and a pick emits it', async () => {
    const wrapper = mount(CoreMenu, {
      props: { title: 'Plant', items, selectable: true },
    })
    const rows = wrapper.findAll('.core-menu__item')

    expect(wrapper.find('.core-menu__group').text()).toBe('Execution')
    expect(rows.map((row) => row.attributes('role'))).toEqual([
      'menuitemradio',
      'menuitemradio',
      'menuitemradio',
    ])
    expect(rows[0].attributes('aria-checked')).toBe('true')
    expect(rows[1].find('.core-menu__item-count').text()).toBe('3')

    await rows[1].trigger('click')
    expect(wrapper.emitted('select')?.[0][0]).toMatchObject({ key: 'north' })
  })

  test('a choice of several marks every picked row as checked', () => {
    const wrapper = mount(CoreMenu, {
      props: {
        items: [
          { key: 'north', label: 'North', selected: true },
          { key: 'south', label: 'South', selected: true },
          { key: 'east', label: 'East' },
        ],
        multiple: true,
      },
    })
    const rows = wrapper.findAll('.core-menu__item')
    expect(rows.map((row) => row.attributes('role'))).toEqual([
      'menuitemcheckbox',
      'menuitemcheckbox',
      'menuitemcheckbox',
    ])
    expect(rows.map((row) => row.attributes('aria-checked'))).toEqual(['true', 'true', 'false'])
  })

  test('the arrows move between the rows that can be picked, from the search box down', async () => {
    const wrapper = mount(CoreMenu, {
      props: { items, searchable: true, searchPlaceholder: 'Search…' },
      attachTo: document.body,
    })
    const search = wrapper.find('input').element as HTMLInputElement
    const rows = wrapper.findAll('.core-menu__item').map((row) => row.element)

    search.focus()
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[0])

    await wrapper.find('.core-menu').trigger('keydown', { key: 'End' })
    expect(document.activeElement).toBe(rows[1])

    await wrapper.find('.core-menu').trigger('keydown', { key: 'ArrowUp' })
    await wrapper.find('.core-menu').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(search)
  })

  test('the search box is a v-model, and an empty list says so', async () => {
    const wrapper = mount(CoreMenu, {
      props: {
        items: [],
        searchable: true,
        emptyText: 'No field matches',
        query: '',
      },
    })
    expect(wrapper.find('.core-menu__empty').text()).toBe('No field matches')

    await wrapper.find('input').setValue('sol')
    expect(wrapper.emitted('update:query')).toEqual([['sol']])
  })

  test('the back arrow emits back', async () => {
    const wrapper = mount(CoreMenu, { props: { items, backLabel: 'Back' } })
    await wrapper.find('.core-menu__back').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})

describe('CoreDialog', () => {
  test('shows its title, content and actions while open', async () => {
    mount(CoreDialog, {
      props: {
        modelValue: true,
        title: 'Delete this execution?',
        icon: 'mdi-delete',
        tone: 'danger',
      },
      slots: {
        default: 'It will be removed.',
        actions: '<button class="action">Delete</button>',
      },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()

    const dialog = document.body.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Delete this execution?')
    expect(dialog.textContent).toContain('It will be removed.')
    expect(dialog.querySelector('.action')).not.toBeNull()
    expect(dialog.querySelector('.core-dialog__icon')?.classList).toContain(
      'is-danger',
    )
  })

  test('Escape closes it, unless it is persistent', async () => {
    const closable = mount(CoreDialog, {
      props: { modelValue: true, title: 'Title' },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    document.body
      .querySelector('[role="dialog"]')!
      .dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      )
    await flushPromises()
    expect(closable.emitted('update:modelValue')).toEqual([[false]])
    closable.unmount()

    const persistent = mount(CoreDialog, {
      props: { modelValue: true, title: 'Title', persistent: true },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    document.body
      .querySelector('[role="dialog"]')!
      .dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      )
    await flushPromises()
    expect(persistent.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('CoreConfirmDialog', () => {
  const mountConfirm = async (props = {}) => {
    const wrapper = mount(CoreConfirmDialog, {
      props: {
        modelValue: true,
        title: 'Confirm delete',
        message: 'Are you sure?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        ...props,
      },
      global: { plugins: [i18n] },
      attachTo: document.body,
    })
    await flushPromises()
    const buttons = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>(
        '.core-dialog__actions button',
      ),
    )
    return { wrapper, cancel: buttons[0], confirm: buttons[1] }
  }

  test('confirming emits confirm; cancelling emits cancel and closes', async () => {
    const { wrapper, cancel, confirm } = await mountConfirm()

    confirm.click()
    expect(wrapper.emitted('confirm')).toHaveLength(1)

    cancel.click()
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  test('a danger colour makes the confirm button destructive', async () => {
    const { confirm } = await mountConfirm({ confirmColor: 'var(--danger)' })
    expect(confirm.classList).toContain('core-button--tone-danger')
  })

  test('while loading the confirm button spins and the message says to wait', async () => {
    const { confirm } = await mountConfirm({
      loading: true,
      loadingMessage: 'Deleting…',
    })

    expect(confirm.querySelector('.core-spinner')).not.toBeNull()
    expect(
      document.body.querySelector('.core-confirm-dialog__loading-message')
        ?.textContent,
    ).toContain('Deleting…')
  })
})

describe('CoreTextField', () => {
  test('gives the text as it is typed, and the attributes go to the input', async () => {
    const wrapper = mount(CoreTextField, {
      props: { modelValue: 'Plan', placeholder: 'Name' },
      attrs: { id: 'name', class: 'wide', 'data-testid': 'name-field' },
    })
    const input = wrapper.find('input')

    expect(input.element.value).toBe('Plan')
    expect(input.attributes()).toMatchObject({ id: 'name', placeholder: 'Name', 'data-testid': 'name-field' })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['core-text-field', 'wide']))

    await input.setValue('Plan B')
    expect(wrapper.emitted('update:modelValue')).toEqual([['Plan B']])
  })

  test('a number field gives numbers, whole ones with integer, and null when emptied', async () => {
    const decimal = mount(CoreTextField, { props: { type: 'number' } })
    await decimal.find('input').setValue('2.5')
    await decimal.find('input').setValue('')
    expect(decimal.emitted('update:modelValue')).toEqual([[2.5], [null]])

    const whole = mount(CoreTextField, { props: { type: 'number', integer: true } })
    expect(whole.find('input').attributes('step')).toBe('1')
    await whole.find('input').setValue('7')
    expect(whole.emitted('update:modelValue')).toEqual([[7]])
  })

  test('with lazy it gives the value when the field changes, not on every keystroke', async () => {
    const wrapper = mount(CoreTextField, { props: { lazy: true } })
    const input = wrapper.find('input')

    input.element.value = 'abc'
    await input.trigger('input')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input.trigger('change')
    expect(wrapper.emitted('update:modelValue')).toEqual([['abc']])
  })

  test('shows its suffix and the append slot, marks itself invalid and can be several lines', () => {
    const field = mount(CoreTextField, {
      props: { suffix: 'sec', invalid: true, size: 'large' },
      slots: { append: '<button class="eye">Show</button>' },
    })
    expect(field.find('.core-text-field__suffix').text()).toBe('sec')
    expect(field.find('.eye').exists()).toBe(true)
    expect(field.classes()).toEqual(expect.arrayContaining(['is-invalid', 'core-text-field--large']))
    expect(field.find('input').attributes('aria-invalid')).toBe('true')

    const multiline = mount(CoreTextField, { props: { multiline: true, rows: 3, modelValue: 'Notes' } })
    expect(multiline.find('textarea').element.value).toBe('Notes')
    expect(multiline.find('textarea').attributes('rows')).toBe('3')
  })
})

describe('CoreMultiSelect', () => {
  const options = Array.from({ length: 8 }, (_, i) => ({ value: i + 1, label: `Item ${i + 1}` }))

  /** Mounts it in the page and opens its list. */
  async function open(props: Record<string, unknown>) {
    const wrapper = mount(CoreMultiSelect, { props: { options, ...props }, attachTo: document.body })
    await wrapper.find('button').trigger('click')
    await flushPromises()
    return wrapper
  }

  function rows() {
    return Array.from(document.body.querySelectorAll<HTMLButtonElement>('.core-menu__item'))
  }

  test('the box shows the picked options, or the placeholder while there are none', () => {
    const empty = mount(CoreMultiSelect, { props: { options, placeholder: 'All' } })
    expect(empty.find('button').text()).toBe('All')
    expect(empty.find('button').classes()).toContain('is-empty')

    const picked = mount(CoreMultiSelect, { props: { options, modelValue: [5, 1, 3] } })
    expect(picked.find('button').text()).toBe('Item 1, Item 3 +1')
  })

  test('picking adds or removes an option, in the order of the options, and keeps the list open', async () => {
    const wrapper = await open({ modelValue: [3] })
    expect(rows().filter((row) => row.getAttribute('aria-checked') === 'true')).toHaveLength(1)

    rows()[0].click()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[1, 3]])
    rows()[2].click()
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([[]])
    expect(rows()).toHaveLength(8)
    wrapper.unmount()
  })

  test('the search box narrows the list, and the clear button unpicks everything', async () => {
    const wrapper = await open({
      modelValue: [2],
      searchPlaceholder: 'Search',
      noMatchesText: 'No match',
      clearText: 'Clear',
    })
    const search = document.body.querySelector<HTMLInputElement>('.core-menu__search-input')!
    search.value = 'item 8'
    search.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(rows().map((row) => row.textContent?.trim())).toEqual(['Item 8'])

    const clear = Array.from(document.body.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Clear',
    )!
    clear.click()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([[]])
    wrapper.unmount()
  })

  test('a short list has no search box', async () => {
    const wrapper = await open({ options: options.slice(0, 3) })
    expect(document.body.querySelector('.core-menu__search')).toBeNull()
    wrapper.unmount()
  })

  test('pickedSummary names the first picks and counts the rest', () => {
    expect(pickedSummary([])).toBe('')
    expect(pickedSummary(['A', 'B'])).toBe('A, B')
    expect(pickedSummary(['A', 'B', 'C', 'D'])).toBe('A, B +2')
  })
})

describe('CoreSelect', () => {
  const options = [
    { value: 1, label: 'One' },
    { value: true, label: 'Yes' },
    { value: 'mip', label: 'MIP' },
  ]

  test('shows the picked option and gives the value of the one picked, of any type', async () => {
    const wrapper = mount(CoreSelect, { props: { modelValue: true, options } })
    const select = wrapper.find('select')

    expect(select.element.value).toBe('1')
    expect(wrapper.classes()).not.toContain('is-empty')

    await select.setValue('0')
    await select.setValue('2')
    expect(wrapper.emitted('update:modelValue')).toEqual([[1], ['mip']])
  })

  test('shows the placeholder while nothing is picked; clearable lets it be picked back', async () => {
    const fixed = mount(CoreSelect, { props: { options, placeholder: 'Choose…' } })
    expect(fixed.classes()).toContain('is-empty')
    expect(fixed.find('option').text()).toBe('Choose…')
    expect(fixed.find('option').attributes('disabled')).toBeDefined()

    const clearable = mount(CoreSelect, {
      props: { options, modelValue: 1, placeholder: 'Not set', clearable: true },
    })
    expect(clearable.find('option').attributes('disabled')).toBeUndefined()
    await clearable.find('select').setValue('')
    expect(clearable.emitted('update:modelValue')).toEqual([[null]])
  })
})

describe('CoreSwitch', () => {
  test('is a switch that toggles its value, with its label', async () => {
    const wrapper = mount(CoreSwitch, { props: { modelValue: false, label: 'From the database' } })
    expect(wrapper.attributes('role')).toBe('switch')
    expect(wrapper.attributes('aria-checked')).toBe('false')
    expect(wrapper.text()).toBe('From the database')
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  test('a disabled switch does not toggle', async () => {
    const wrapper = mount(CoreSwitch, { props: { modelValue: true, disabled: true } })
    expect(wrapper.classes()).toContain('is-on')
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('CoreCheckbox', () => {
  test('is a checkbox that ticks and unticks', async () => {
    const wrapper = mount(CoreCheckbox, { props: { modelValue: true, label: 'Ticked' } })
    expect(wrapper.attributes('role')).toBe('checkbox')
    expect(wrapper.attributes('aria-checked')).toBe('true')
    expect(wrapper.find('.mdi-check-bold').exists()).toBe(true)
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  test('indeterminate reads as mixed and shows a dash; clicking it ticks it', async () => {
    const wrapper = mount(CoreCheckbox, { props: { modelValue: false, indeterminate: true } })
    expect(wrapper.attributes('aria-checked')).toBe('mixed')
    expect(wrapper.find('.mdi-minus').exists()).toBe(true)
    await wrapper.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
  })
})

describe('CoreSegmentedControl', () => {
  const options = [
    { value: 'summary', label: 'Summary' },
    { value: 'changes', label: 'Changes', count: 6 },
    { value: 'side', label: 'Side by side', disabled: true },
  ]

  test('marks the picked option and emits the one clicked', async () => {
    const wrapper = mount(CoreSegmentedControl, { props: { modelValue: 'summary', options } })
    const buttons = wrapper.findAll('[role="radio"]')
    expect(buttons.map((b) => b.attributes('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(buttons[1].text()).toContain('6')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['changes']])
    expect(buttons[2].attributes('disabled')).toBeDefined()
  })

  test('takes the soft look of a group switch', () => {
    const wrapper = mount(CoreSegmentedControl, { props: { modelValue: 'summary', options, variant: 'soft' } })
    expect(wrapper.classes()).toContain('core-segmented--soft')
  })
})
