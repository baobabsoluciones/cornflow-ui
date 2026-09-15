import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { vuetify, createTestI18n } from '../../helpers'
import UnsavedChangesWarningModal from '@cornflow-ui/core/components/core/UnsavedChangesWarningModal.vue'

describe('UnsavedChangesWarningModal', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
    }
  })

  const createWrapper = (props = {}) => {
    const i18n = createTestI18n({
      en: {
        pendingChanges: {
          unsavedChangesWarning: {
            title: 'Unsaved Changes',
            message: 'You have unsaved changes.',
            stay: 'Stay',
            leave: 'Leave',
          },
          changes: 'changes',
        },
      },
    })

    return shallowMount(UnsavedChangesWarningModal, {
      props: {
        modelValue: true,
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
      },
    })
  }

  test('renders without errors', () => {
    wrapper = createWrapper()
    expect(wrapper.exists()).toBe(true)
  })

  test('renders when closed', () => {
    wrapper = createWrapper({ modelValue: false })
    expect(wrapper.exists()).toBe(true)
  })
})
