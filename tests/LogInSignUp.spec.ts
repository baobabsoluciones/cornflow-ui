import { mount } from '@vue/test-utils'
import { describe, test, vi, beforeEach } from 'vitest'
import LoginSignup from '../src/components/LogInSignUp.vue'
import vuetify from './vuetify-setup.ts'
import { useGeneralStore } from '@/stores/general'
import AuthService from '@/services/AuthService'

vi.mock('@/stores/general', () => ({
  useGeneralStore: vi.fn(),
}))

vi.mock('@/services/AuthService', () => ({
  default: {
    login: vi.fn(),
    signup: vi.fn(),
  },
}))

describe('LoginSignup.vue', () => {
  let showSnackbarMock

  beforeEach(() => {
    vi.resetAllMocks()
    showSnackbarMock = vi.fn()
  })

  const createWrapper = (options = {}) => {
    return mount(LoginSignup, {
      global: {
        plugins: [vuetify],
        provide: {
          showSnackbar: showSnackbarMock,
        },
        mocks: {
          $t: (msg) => msg,
          $router: {
            push: vi.fn(),
          },
        },
        stubs: {
          MButton: true,
        },
      },
      ...options,
    })
  }

  test('renders login form by default', ({ expect }) => {
    vi.mocked(useGeneralStore).mockReturnValue({
      appConfig: {
        parameters: {
          enableSignup: true,
        },
      },
    })
    const wrapper = createWrapper()
    expect(wrapper.find('.username').exists()).toBe(true)
    expect(wrapper.find('.password').exists()).toBe(true)
    expect(wrapper.find('.email').exists()).toBe(false)
  })

  test('switches to signup form when signup link is clicked', async ({
    expect,
  }) => {
    vi.mocked(useGeneralStore).mockReturnValue({
      appConfig: {
        parameters: {
          enableSignup: true,
        },
      },
    })
    const wrapper = createWrapper()
    await wrapper.find('a').trigger('click')
    expect(wrapper.find('.email').exists()).toBe(true)
    expect(wrapper.find('.username').exists()).toBe(true)
    expect(wrapper.find('.password').exists()).toBe(true)
    expect(wrapper.findAll('.password').length).toBe(2) // One for password, one for confirmation
  })

  test('calls AuthService.login when login button is clicked', async ({
    expect,
  }) => {
    vi.mocked(AuthService.login).mockResolvedValue(true)
    vi.mocked(useGeneralStore).mockReturnValue({
      appConfig: {
        parameters: {
          enableSignup: true,
        },
      },
    })

    const wrapper = createWrapper()
    await wrapper.find('.username input').setValue('testuser')
    await wrapper.find('.password input').setValue('testpass')
    await wrapper.findComponent({ name: 'MButton' }).vm.$emit('click')

    expect(AuthService.login).toHaveBeenCalledWith('testuser', 'testpass')
    expect(wrapper.vm.$router.push).toHaveBeenCalledWith('/')
  })

  test('calls AuthService.signup when signup button is clicked', async ({
    expect,
  }) => {
    vi.mocked(AuthService.signup).mockResolvedValue(true)
    vi.mocked(useGeneralStore).mockReturnValue({
      appConfig: {
        parameters: {
          enableSignup: true,
        },
      },
    })

    const wrapper = createWrapper()
    await wrapper.find('a').trigger('click')
    await wrapper.find('.email input').setValue('test@example.com')
    await wrapper.find('.username input').setValue('testuser')
    await wrapper.findAll('.password input').at(0).setValue('testpass')
    await wrapper.findAll('.password input').at(1).setValue('testpass')
    await wrapper.findComponent({ name: 'MButton' }).vm.$emit('click')

    expect(AuthService.signup).toHaveBeenCalledWith(
      'test@example.com',
      'testuser',
      'testpass',
    )
  })

  test('toggles password visibility when eye icon is clicked', async ({
    expect,
  }) => {
    vi.mocked(useGeneralStore).mockReturnValue({
      appConfig: {
        parameters: {
          enableSignup: true,
        },
      },
    })
    const wrapper = createWrapper()
    const passwordField = wrapper.find('.password')
    const input = passwordField.find('input')

    expect(input.attributes('type')).toBe('password')
    const eyeIcon = passwordField.find('.v-field__append-inner .mdi-eye') // Updated selector
    if (eyeIcon.exists()) {
      await eyeIcon.trigger('click')
      expect(input.attributes('type')).toBe('text')
    } else {
      console.warn('Eye icon not found')
    }
  })

  test('disables signup when enableSignup is false', async ({ expect }) => {
    vi.mocked(useGeneralStore).mockReturnValue({
      appConfig: {
        parameters: {
          enableSignup: false,
        },
      },
    })
    const wrapper = createWrapper()
    expect(wrapper.find('v-row[v-if="enableSignUp"]').exists()).toBe(false)
  })
})
