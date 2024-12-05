import { mount } from '@vue/test-utils'
import { describe, test, vi, beforeEach } from 'vitest'
import LoginSignup from '../src/components/LogInSignUp.vue'
import vuetify from './vuetify-setup.ts'
import { useGeneralStore } from '@/stores/general'
import AuthService from '@/services/AuthService'

// Create hoisted mock config
const mockConfig = vi.hoisted(() => ({
  auth: {
    type: 'cornflow'
  }
}))

// Mock store
vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(() => ({
    appConfig: {
      parameters: {
        enableSignup: true
      }
    }
  }))
}))

// Mock auth service
vi.mock('@/services/AuthService', () => ({
  default: {
    login: vi.fn(),
    signup: vi.fn()
  }
}))

// Mock config
vi.mock('@/config', () => ({
  default: mockConfig
}))

describe('LoginSignup.vue', () => {
  const createWrapper = (options = {}) => {
    return mount(LoginSignup, {
      global: {
        plugins: [vuetify],
        provide: {
          showSnackbar: vi.fn(),
        },
        mocks: {
          $t: (key: string) => key,
          $router: {
            push: vi.fn(),
          },
        },
        stubs: {
          'v-text-field': {
            template: `
              <div class="v-text-field">
                <label v-if="label">{{ label }}</label>
                <input 
                  :type="type"
                  :value="modelValue"
                  @input="$emit('update:modelValue', $event.target.value)"
                />
              </div>
            `,
            props: ['modelValue', 'type', 'label', 'rules'],
            emits: ['update:modelValue'],
          },
          'MButton': {
            template: '<button class="v-btn" :data-test="label" @click="$emit(\'click\')">{{ label }}</button>',
            props: ['label', 'color'],
            emits: ['click'],
          },
          'v-card': {
            template: '<div class="v-card"><slot></slot></div>'
          },
          'v-card-title': {
            template: '<div class="v-card-title"><slot></slot></div>'
          },
          'v-card-subtitle': {
            template: '<div class="v-card-subtitle" :class="{ \'text-center\': $parent.isCornflowAuth === false }"><slot></slot></div>'
          },
          'v-card-text': {
            template: '<div class="v-card-text"><slot></slot></div>'
          },
          'v-card-actions': {
            template: '<div class="v-card-actions"><slot></slot></div>'
          },
          'v-row': {
            template: '<div class="v-row"><slot></slot></div>'
          },
          'v-col': {
            template: '<div class="v-col"><slot></slot></div>'
          },
          'v-form': {
            template: '<form @submit.prevent><slot></slot></form>'
          },
          'divider': {
            template: '<hr />'
          },
          'v-img': true
        },
      },
      ...options,
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.auth.type = 'cornflow'
  })

  test('renders login form by default', async ({ expect }) => {
    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()

    const usernameInput = wrapper.find('input[type="text"]')
    const passwordInput = wrapper.find('input[type="password"]')
    
    expect(usernameInput.exists()).toBe(true)
    expect(passwordInput.exists()).toBe(true)
  })

  test('switches to signup form when signup link is clicked', async ({ expect }) => {
    const wrapper = createWrapper()
    await wrapper.find('a[data-test="signup-link"]').trigger('click')
    await wrapper.vm.$nextTick()

    const passwordInputs = wrapper.findAll('input[type="password"]')
    expect(passwordInputs).toHaveLength(2)
  })

  test('renders Azure login button when auth type is azure', async ({ expect }) => {
    mockConfig.auth.type = 'azure'
    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()

    const button = wrapper.find('button.v-btn')
    expect(button.attributes('data-test')).toBe('logIn.azure_button')
  })

  test('renders AWS login button when auth type is cognito', async ({ expect }) => {
    mockConfig.auth.type = 'cognito'
    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()

    const button = wrapper.find('button.v-btn')
    expect(button.attributes('data-test')).toBe('logIn.cognito_button')
  })

  test('centers subtitle for non-cornflow auth types', async ({ expect }) => {
    mockConfig.auth.type = 'azure'
    const wrapper = createWrapper()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.v-card-subtitle.text-center').exists()).toBe(true)
  })
})
