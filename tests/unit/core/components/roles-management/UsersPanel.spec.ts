import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { createI18n } from 'vue-i18n'
import { h } from 'vue'
import UsersPanel from '@cornflow-ui/core/components/roles-management/UsersPanel.vue'

// CoreSearchInput pulls extra deps; stub it as a simple input wrapper.
vi.mock('@cornflow-ui/core/components/core/table/CoreSearchInput.vue', () => ({
  default: {
    name: 'CoreSearchInput',
    template:
      '<input class="core-search-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup.enter="$emit(\'search\', $event.target.value)" />',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'search'],
  },
}))

// Stub the virtual data table so item/no-data slots render deterministically in jsdom.
const VDataTableVirtualStub = {
  name: 'VDataTableVirtual',
  props: ['headers', 'items', 'loading', 'height', 'itemHeight'],
  setup(props: any, { slots }: any) {
    return () => {
      if (props.loading && slots.loading) {
        return h('div', { class: 'dt-loading' }, slots.loading())
      }
      if (!props.items || props.items.length === 0) {
        return h(
          'div',
          { class: 'dt-empty' },
          slots['no-data'] ? slots['no-data']() : [],
        )
      }
      return h(
        'div',
        { class: 'dt-body' },
        props.items.map((item: any) =>
          h('div', { class: 'dt-row', key: item.id }, [
            slots['item.username'] ? slots['item.username']({ item }) : null,
            slots['item.role_names'] ? slots['item.role_names']({ item }) : null,
            slots['item.actions'] ? slots['item.actions']({ item }) : null,
          ]),
        ),
      )
    }
  },
}

const user = (overrides: any = {}) => ({
  id: 1,
  username: 'jdoe',
  full_name: 'John Doe',
  email: 'john@example.com',
  role_names: ['admin'],
  _role_ids: [1],
  ...overrides,
})

describe('UsersPanel', () => {
  let vuetify: any
  let wrapper: any

  beforeEach(() => {
    vuetify = createVuetify()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

  const createWrapper = (props = {}) =>
    mount(UsersPanel, {
      props: {
        users: [user()],
        selectedRole: null,
        search: '',
        loading: false,
        ...props,
      },
      global: {
        plugins: [vuetify, i18n],
        stubs: {
          'v-data-table-virtual': VDataTableVirtualStub,
          'v-card': { template: '<div><slot /></div>' },
          'v-icon': { template: '<i><slot /></i>' },
          'v-chip': {
            template: '<span class="v-chip" @click:close="$emit(\'click:close\')"><slot /></span>',
            emits: ['click:close'],
          },
          'v-btn': {
            template: '<button class="v-btn" @click="$emit(\'click\')"><slot /></button>',
            emits: ['click'],
          },
          'v-skeleton-loader': { template: '<div class="skeleton" />' },
        },
      },
    })

  describe('rendering and counts', () => {
    test('renders the panel and a row per user', () => {
      wrapper = createWrapper({ users: [user(), user({ id: 2, username: 'b' })] })
      expect(wrapper.findAll('.dt-row')).toHaveLength(2)
    })

    test('shows total count chip when no role selected', () => {
      wrapper = createWrapper({ users: [user(), user({ id: 2 })] })
      // chip text contains the total (2)
      expect(wrapper.text()).toContain('2')
    })

    test('shows filtered/total chip when a role is selected', () => {
      wrapper = createWrapper({
        users: [user(), user({ id: 2, role_names: [] })],
        selectedRole: { id: 1, name: 'admin' },
      })
      // filteredUsers (1 has admin) / total (2)
      expect(wrapper.text()).toContain('1 / 2')
    })

    test('renders the role filter chip when a role is selected', () => {
      wrapper = createWrapper({ selectedRole: { id: 1, name: 'admin' } })
      expect(wrapper.text()).toContain('rolesManagement.filteringByRole')
      expect(wrapper.text()).toContain('admin')
    })
  })

  describe('item slots', () => {
    test('renders user name, handle and initials/avatar', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.user-name').text()).toBe('John Doe')
      expect(wrapper.find('.user-handle').text()).toBe('@jdoe')
      expect(wrapper.find('.user-avatar').text()).toBe('JD')
    })

    test('renders role chips when user has roles', () => {
      wrapper = createWrapper({ users: [user({ role_names: ['admin', 'viewer'] })] })
      const chips = wrapper.findAll('.role-chip')
      expect(chips.length).toBe(2)
    })

    test('renders noRoles placeholder when user has no roles', () => {
      wrapper = createWrapper({ users: [user({ role_names: [] })] })
      expect(wrapper.text()).toContain('rolesManagement.noRoles2')
    })

    test('emits edit when the row edit button is clicked', async () => {
      wrapper = createWrapper()
      await wrapper.find('.dt-row .v-btn').trigger('click')
      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')![0][0]).toMatchObject({ username: 'jdoe' })
    })
  })

  describe('empty / loading states', () => {
    test('renders no-data slot when there are no users', () => {
      wrapper = createWrapper({ users: [] })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('rolesManagement.errorLoadUsers')
    })

    test('renders loading slot when loading', () => {
      wrapper = createWrapper({ users: [], loading: true })
      expect(wrapper.find('.skeleton').exists()).toBe(true)
    })
  })

  describe('search and filter emits', () => {
    test('emits update:search when the search input changes', async () => {
      wrapper = createWrapper()
      const input = wrapper.find('.core-search-input')
      await input.setValue('abc')
      expect(wrapper.emitted('update:search')).toBeTruthy()
      expect(wrapper.emitted('update:search')![0]).toEqual(['abc'])
    })

    test('emits clear-filter when the filter chip close is triggered', async () => {
      wrapper = createWrapper({ selectedRole: { id: 1, name: 'admin' } })
      const chip = wrapper.findAll('.v-chip').find((c) => c.text().includes('admin'))
      await chip!.trigger('click:close')
      expect(wrapper.emitted('clear-filter')).toBeTruthy()
    })
  })

  describe('filteredUsers computed', () => {
    test('filters by selected role name', () => {
      wrapper = createWrapper({
        users: [user(), user({ id: 2, role_names: ['viewer'] })],
        selectedRole: { id: 1, name: 'admin' },
      })
      expect(wrapper.vm.filteredUsers).toHaveLength(1)
      expect(wrapper.vm.filteredUsers[0].username).toBe('jdoe')
    })

    test('filters by search query across username, full_name, email and roles', () => {
      const users = [
        user({ id: 1, username: 'alice', full_name: 'Alice A', email: 'a@x.com', role_names: ['admin'] }),
        user({ id: 2, username: 'bob', full_name: 'Bob B', email: 'b@x.com', role_names: ['viewer'] }),
      ]
      wrapper = createWrapper({ users, search: 'viewer' })
      expect(wrapper.vm.filteredUsers.map((u: any) => u.username)).toEqual(['bob'])

      wrapper = createWrapper({ users, search: 'alice' })
      expect(wrapper.vm.filteredUsers.map((u: any) => u.username)).toEqual(['alice'])

      wrapper = createWrapper({ users, search: 'b@x' })
      expect(wrapper.vm.filteredUsers.map((u: any) => u.username)).toEqual(['bob'])
    })

    test('returns all users when search is empty', () => {
      wrapper = createWrapper({ users: [user(), user({ id: 2 })], search: '   ' })
      expect(wrapper.vm.filteredUsers).toHaveLength(2)
    })
  })

  describe('headers computed', () => {
    test('exposes the expected column keys', () => {
      wrapper = createWrapper()
      const keys = wrapper.vm.headers.map((h: any) => h.key)
      expect(keys).toEqual(['username', 'email', 'role_names', 'actions'])
    })
  })

  describe('virtual height', () => {
    test('updateVirtualHeight clamps within bounds', () => {
      wrapper = createWrapper()
      // jsdom window.innerHeight default; value should stay within [280, 760]
      expect(wrapper.vm.virtualHeight).toBeGreaterThanOrEqual(280)
      expect(wrapper.vm.virtualHeight).toBeLessThanOrEqual(760)
    })
  })
})
