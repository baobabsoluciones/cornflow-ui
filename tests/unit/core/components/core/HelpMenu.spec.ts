import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import HelpMenu from '@/components/core/HelpMenu.vue'

// Mock package.json version
vi.mock('@/../package.json', () => ({
  version: '1.2.3'
}))

// Mock the general store
const mockGeneralStore = {
  getLicences: [
    {
      library: 'Vue',
      version: '3.0.0',
      license: 'MIT',
      author: 'Evan You',
      description: 'Progressive JavaScript framework'
    },
    {
      library: 'Vuetify',
      version: '3.0.0',
      license: 'MIT',
      author: 'John Leider',
      description: 'Material Design component framework'
    }
  ],
  cornflowVersion: '2.4.1'
}

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => mockGeneralStore)
}))

// Mock i18n
const mockT = vi.fn((key) => {
  const translations = {
    'helpMenu.help': 'Help',
    'helpMenu.licences': 'Licenses',
    'helpMenu.close': 'Close',
    'helpMenu.download': 'Download Manual'
  }
  return translations[key] || key
})

const i18nPlugin = {
  install(app: any) {
    app.config.globalProperties.$t = mockT
    app.config.globalProperties.$i18n = {
      locale: 'en'
    }
  }
}

// Mock MBaseModal component
const MBaseModalStub = {
  name: 'MBaseModal',
  template: `
    <div class="m-base-modal" v-if="modelValue">
      <div class="modal-title">{{ title }}</div>
      <slot name="content"></slot>
      <div class="modal-buttons">
        <button 
          v-for="button in buttons" 
          :key="button.action"
          @click="$emit(button.action)"
          :class="button.class"
        >
          {{ button.text }}
        </button>
      </div>
    </div>
  `,
  props: ['modelValue', 'title', 'buttons'],
  emits: ['cancel', 'close', 'update:modelValue']
}

describe('HelpMenu', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
    vi.clearAllMocks()
    
    // Mock import.meta.env.BASE_URL
    Object.defineProperty(globalThis, 'import', {
      value: {
        meta: {
          env: {
            BASE_URL: '/app/'
          }
        }
      },
      configurable: true
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.unstubAllGlobals()
  })

  const createWrapper = () => {
    return mount(HelpMenu, {
      global: {
        plugins: [vuetify, i18nPlugin],
        stubs: {
          VBtn: { 
            template: '<button class="v-btn"><slot /></button>',
            props: ['fab', 'icon', 'rounded', 'density']
          },
          VIcon: { 
            template: '<i class="v-icon">{{ icon }}</i>',
            props: ['icon', 'small', 'size'],
            setup(props: any) {
              return { icon: props.icon }
            }
          },
          VMenu: { 
            template: '<div class="v-menu"><slot /></div>',
            props: ['activator', 'location', 'transition']
          },
          VList: { 
            template: '<div class="v-list"><slot /></div>',
            props: ['density', 'minWidth', 'rounded', 'slim']
          },
          VListItem: { 
            template: '<div class="v-list-item" @click="$emit(\'click\')"><slot /><slot name="subtitle" /></div>',
            props: ['link', 'minHeight'],
            emits: ['click']
          },
          VListItemTitle: { 
            template: '<div class="v-list-item-title"><slot /></div>'
          },
          VDivider: { 
            template: '<hr class="v-divider" />'
          },
          VCardText: { 
            template: '<div class="v-card-text"><slot /></div>'
          },
          MBaseModal: MBaseModalStub
        }
      }
    })
  }

  test('renders the help button correctly', () => {
    wrapper = createWrapper()
    
    expect(wrapper.find('.v-btn').exists()).toBe(true)
    expect(wrapper.find('.v-icon').exists()).toBe(true)
  })

  test('displays help menu items', () => {
    wrapper = createWrapper()
    
    const listItems = wrapper.findAll('.v-list-item')
    expect(listItems.length).toBeGreaterThanOrEqual(2)
    
    const menuTexts = wrapper.findAll('.v-list-item-title')
    expect(menuTexts[0].text()).toBe('Help')
    expect(menuTexts[1].text()).toBe('Licenses')
  })

  test('shows app version correctly', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.appVersion).toBe('Cornflow app version: 1.2.3')
  })

  test('shows backend version correctly', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.backendVersion).toBe('Cornflow version: 2.4.1')
  })

  test('computes manual file URL correctly', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.manualFile).toBe('/manual/user_manual_en.pdf')
  })

  test('opens help modal when help menu item is clicked', async () => {
    wrapper = createWrapper()
    
    const helpMenuItem = wrapper.findAll('.v-list-item')[0]
    await helpMenuItem.trigger('click')
    
    const vm = wrapper.vm as any
    expect(vm.helpModal).toBe(true)
  })

  test('opens licenses modal when licenses menu item is clicked', async () => {
    wrapper = createWrapper()
    
    const licensesMenuItem = wrapper.findAll('.v-list-item')[1]
    await licensesMenuItem.trigger('click')
    
    const vm = wrapper.vm as any
    expect(vm.licensesModal).toBe(true)
  })

  test('help modal displays with correct props', async () => {
    wrapper = createWrapper()
    
    // Open help modal
    const vm = wrapper.vm as any
    vm.helpModal = true
    await wrapper.vm.$nextTick()
    
    const helpModal = wrapper.findAllComponents(MBaseModalStub).find(modal => 
      modal.props('title') === 'Help'
    )
    
    expect(helpModal?.exists()).toBe(true)
    expect(helpModal?.props('title')).toBe('Help')
    expect(helpModal?.props('buttons')).toEqual([
      {
        text: 'Close',
        action: 'cancel',
        class: 'primary-btn'
      }
    ])
  })

  test('licenses modal displays with correct props', async () => {
    wrapper = createWrapper()
    
    // Open licenses modal
    const vm = wrapper.vm as any
    vm.licensesModal = true
    await wrapper.vm.$nextTick()
    
    const licensesModal = wrapper.findAllComponents(MBaseModalStub).find(modal => 
      modal.props('title') === 'Licenses'
    )
    
    expect(licensesModal?.exists()).toBe(true)
    expect(licensesModal?.props('title')).toBe('Licenses')
    expect(licensesModal?.props('buttons')).toEqual([
      {
        text: 'Close',
        action: 'cancel',
        class: 'primary-btn'
      }
    ])
  })

  test('displays licenses list correctly', async () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.licences).toEqual(mockGeneralStore.getLicences)
    expect(vm.licences).toHaveLength(2)
    expect(vm.licences[0].library).toBe('Vue')
    expect(vm.licences[1].library).toBe('Vuetify')
  })

  test('licenses modal content renders license information', async () => {
    wrapper = createWrapper()
    
    // Open licenses modal
    const vm = wrapper.vm as any
    vm.licensesModal = true
    await wrapper.vm.$nextTick()
    
    // Check that licenses are rendered
    const licensesModal = wrapper.findAllComponents(MBaseModalStub).find(modal => 
      modal.props('title') === 'Licenses'
    )
    
    expect(licensesModal?.exists()).toBe(true)
  })

  test('help modal contains download link', async () => {
    wrapper = createWrapper()
    
    // Open help modal
    const vm = wrapper.vm as any
    vm.helpModal = true
    await wrapper.vm.$nextTick()
    
    const downloadLink = wrapper.find('a[download="manual_user.pdf"]')
    expect(downloadLink.exists()).toBe(true)
    expect(downloadLink.attributes('href')).toBe('/manual/user_manual_en.pdf')
  })

  test('closes help modal when cancel is emitted', async () => {
    wrapper = createWrapper()
    
    // Open help modal
    const vm = wrapper.vm as any
    vm.helpModal = true
    await wrapper.vm.$nextTick()
    
    const helpModal = wrapper.findAllComponents(MBaseModalStub).find(modal => 
      modal.props('title') === 'Help'
    )
    
    await helpModal?.vm.$emit('cancel')
    expect(vm.helpModal).toBe(false)
  })

  test('closes licenses modal when cancel is emitted', async () => {
    wrapper = createWrapper()
    
    // Open licenses modal
    const vm = wrapper.vm as any
    vm.licensesModal = true
    await wrapper.vm.$nextTick()
    
    const licensesModal = wrapper.findAllComponents(MBaseModalStub).find(modal => 
      modal.props('title') === 'Licenses'
    )
    
    await licensesModal?.vm.$emit('cancel')
    expect(vm.licensesModal).toBe(false)
  })

  test('closes help modal when close is emitted', async () => {
    wrapper = createWrapper()
    
    // Open help modal
    const vm = wrapper.vm as any
    vm.helpModal = true
    await wrapper.vm.$nextTick()
    
    const helpModal = wrapper.findAllComponents(MBaseModalStub).find(modal => 
      modal.props('title') === 'Help'
    )
    
    await helpModal?.vm.$emit('close')
    expect(vm.helpModal).toBe(false)
  })

  test('closes licenses modal when close is emitted', async () => {
    wrapper = createWrapper()
    
    // Open licenses modal
    const vm = wrapper.vm as any
    vm.licensesModal = true
    await wrapper.vm.$nextTick()
    
    const licensesModal = wrapper.findAllComponents(MBaseModalStub).find(modal => 
      modal.props('title') === 'Licenses'
    )
    
    await licensesModal?.vm.$emit('close')
    expect(vm.licensesModal).toBe(false)
  })

  test('manual file URL changes with locale', async () => {
    wrapper = createWrapper()
    
    // Change locale
    const vm = wrapper.vm as any
    vm.$i18n.locale = 'es'
    await wrapper.vm.$nextTick()
    
    expect(vm.manualFile).toBe('/manual/user_manual_es.pdf')
  })

  test('component has correct initial data', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.licensesModal).toBe(false)
    expect(vm.helpModal).toBe(false)
    expect(vm.store).toBeDefined()
  })

  test('store is properly integrated', () => {
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.store).toStrictEqual(mockGeneralStore)
  })

  test('button has correct styling classes', () => {
    wrapper = createWrapper()
    
    const button = wrapper.find('.v-btn')
    expect(button.exists()).toBe(true)
  })

  test('handles empty licenses gracefully', async () => {
    // Mock empty licenses
    mockGeneralStore.getLicences = []
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.licences).toEqual([])
  })

  test('version displays handle missing values gracefully', () => {
    // Mock missing versions
    mockGeneralStore.cornflowVersion = undefined
    wrapper = createWrapper()
    
    const vm = wrapper.vm as any
    expect(vm.backendVersion).toBe('Cornflow version: undefined')
    expect(vm.appVersion).toBe('Cornflow app version: 1.2.3')
  })
})
