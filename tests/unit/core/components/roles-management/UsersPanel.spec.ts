import { describe, test, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import UsersPanel from '@cornflow-ui/core/components/roles-management/UsersPanel.vue'

const user = (overrides: any = {}) => ({
  id: 1,
  username: 'jdoe',
  full_name: 'John Doe',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@example.com',
  role_names: ['admin'],
  _role_ids: [1],
  ...overrides,
})

describe('UsersPanel', () => {
  let wrapper: any

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    missingWarn: false,
    fallbackWarn: false,
    messages: { en: {} },
  })

  const createWrapper = (props = {}) =>
    mount(UsersPanel, {
      props: {
        users: [user()],
        selectedRole: null,
        search: '',
        loading: false,
        ...props,
      },
      global: { plugins: [i18n] },
    })

  const rows = () => wrapper.findAll('.users-table__row')
  const usernames = () => wrapper.findAll('.user-handle').map((h: any) => h.text())

  describe('rendering and counts', () => {
    test('renders a row per user', () => {
      wrapper = createWrapper({ users: [user(), user({ id: 2, username: 'b' })] })
      expect(rows()).toHaveLength(2)
    })

    test('counts every user when no role is selected', () => {
      wrapper = createWrapper({ users: [user(), user({ id: 2 })] })
      expect(wrapper.find('.users-count').text()).toBe('2')
    })

    test('counts the filtered users out of all of them when a role is selected', () => {
      wrapper = createWrapper({
        users: [user(), user({ id: 2, role_names: [] })],
        selectedRole: { id: 1, name: 'admin' },
      })
      expect(wrapper.find('.users-count').text()).toBe('1 / 2')
    })

    test('shows the role filter when a role is selected', () => {
      wrapper = createWrapper({ selectedRole: { id: 1, name: 'admin' } })
      const filter = wrapper.find('.role-filter')
      expect(filter.text()).toContain('rolesManagement.filteringByRole')
      expect(filter.text()).toContain('admin')
    })

    test('shows no role filter without a selected role', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.role-filter').exists()).toBe(false)
    })

    test('has the user, e-mail, roles and actions columns', () => {
      wrapper = createWrapper()
      expect(wrapper.vm.columns.map((c: any) => c.key)).toEqual([
        'username',
        'email',
        'role_names',
        'actions',
      ])
      expect(wrapper.findAll('th')).toHaveLength(4)
    })
  })

  describe('rows', () => {
    test('renders the user name, handle, e-mail and initials', () => {
      wrapper = createWrapper()
      expect(wrapper.find('.user-name').text()).toBe('John Doe')
      expect(wrapper.find('.user-handle').text()).toBe('@jdoe')
      expect(wrapper.find('.user-avatar').text()).toBe('JD')
      expect(wrapper.find('.users-table__email').text()).toBe('john@example.com')
    })

    test('gives the avatar a tone of the core', () => {
      wrapper = createWrapper()
      const tone = wrapper
        .find('.user-avatar')
        .classes()
        .find((c: string) => c.startsWith('is-'))
      expect(['is-primary', 'is-success', 'is-warning', 'is-info', 'is-neutral']).toContain(tone)
    })

    test('renders a badge per role in the tone of its preset', () => {
      wrapper = createWrapper({ users: [user({ role_names: ['admin', 'viewer'] })] })
      const chips = wrapper.findAll('.role-chip')
      expect(chips.map((c: any) => c.text())).toEqual(['admin', 'viewer'])
      expect(chips[0].classes()).toContain('core-badge--primary')
      expect(chips[1].classes()).toContain('core-badge--success')
    })

    test('renders the no-roles placeholder when the user has no roles', () => {
      wrapper = createWrapper({ users: [user({ role_names: [] })] })
      expect(wrapper.find('.roles-cell__none').text()).toBe('rolesManagement.noRoles2')
    })

    test('emits edit when the row edit button is clicked', async () => {
      wrapper = createWrapper()
      const edit = wrapper.find('.users-table__edit')
      expect(edit.attributes('aria-label')).toBe('rolesManagement.editUser')
      await edit.trigger('click')
      expect(wrapper.emitted('edit')![0][0]).toMatchObject({ username: 'jdoe' })
    })
  })

  describe('empty / loading states', () => {
    test('renders the empty state when there are no users', () => {
      wrapper = createWrapper({ users: [] })
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('rolesManagement.errorLoadUsers')
    })

    test('says no user matches when the search leaves none', () => {
      wrapper = createWrapper({ users: [user()], search: 'nobody-like-this' })
      expect(wrapper.find('[data-testid="users-empty"]').text()).toContain(
        'rolesManagement.noUsersMatch',
      )
    })

    test('shows placeholder rows while loading with no users yet', () => {
      wrapper = createWrapper({ users: [], loading: true })
      expect(wrapper.findAll('.users-table__skeleton')).toHaveLength(5)
      expect(wrapper.find('.empty-state').exists()).toBe(false)
      expect(wrapper.find('.users-table').attributes('aria-busy')).toBe('true')
    })

    test('keeps the users on screen while they reload', () => {
      wrapper = createWrapper({ loading: true })
      expect(rows()).toHaveLength(1)
      expect(wrapper.find('.users-table__skeleton').exists()).toBe(false)
    })
  })

  describe('search and filter emits', () => {
    test('emits update:search when the search input changes', async () => {
      wrapper = createWrapper()
      await wrapper.find('.core-search-input__field').setValue('abc')
      expect(wrapper.emitted('update:search')![0]).toEqual(['abc'])
    })

    test('emits clear-filter when the role filter is cleared', async () => {
      wrapper = createWrapper({ selectedRole: { id: 1, name: 'admin' } })
      await wrapper.find('.role-filter__clear').trigger('click')
      expect(wrapper.emitted('clear-filter')).toBeTruthy()
    })
  })

  describe('filteredUsers', () => {
    test('filters by the selected role name', () => {
      wrapper = createWrapper({
        users: [user(), user({ id: 2, username: 'other', role_names: ['viewer'] })],
        selectedRole: { id: 1, name: 'admin' },
      })
      expect(wrapper.vm.filteredUsers).toHaveLength(1)
      expect(usernames()).toEqual(['@jdoe'])
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

    test('returns all users when search is blank', () => {
      wrapper = createWrapper({ users: [user(), user({ id: 2 })], search: '   ' })
      expect(wrapper.vm.filteredUsers).toHaveLength(2)
    })
  })

  describe('sorting', () => {
    const users = [
      user({ id: 1, username: 'carla', email: 'b@example.com' }),
      user({ id: 2, username: 'Agarcia', email: 'c@example.com' }),
      user({ id: 3, username: 'bruno', email: 'a@example.com' }),
    ]

    const sortButton = (index: number) => wrapper.findAll('.users-table__sort')[index]

    test('only the user and e-mail columns sort', () => {
      wrapper = createWrapper({ users })
      expect(wrapper.findAll('.users-table__sort')).toHaveLength(2)
    })

    test('keeps the order it is given until a header is clicked', () => {
      wrapper = createWrapper({ users })
      expect(usernames()).toEqual(['@carla', '@Agarcia', '@bruno'])
      expect(wrapper.findAll('th')[0].attributes('aria-sort')).toBeUndefined()
    })

    test('a header click sorts ascending, then descending, then back to the given order', async () => {
      wrapper = createWrapper({ users })
      const th = () => wrapper.findAll('th')[0]

      await sortButton(0).trigger('click')
      expect(usernames()).toEqual(['@Agarcia', '@bruno', '@carla'])
      expect(th().attributes('aria-sort')).toBe('ascending')

      await sortButton(0).trigger('click')
      expect(usernames()).toEqual(['@carla', '@bruno', '@Agarcia'])
      expect(th().attributes('aria-sort')).toBe('descending')

      await sortButton(0).trigger('click')
      expect(usernames()).toEqual(['@carla', '@Agarcia', '@bruno'])
      expect(th().attributes('aria-sort')).toBeUndefined()
    })

    test('sorting by another column starts it ascending', async () => {
      wrapper = createWrapper({ users })
      await sortButton(0).trigger('click')
      await sortButton(1).trigger('click')
      expect(usernames()).toEqual(['@bruno', '@carla', '@Agarcia'])
      expect(wrapper.findAll('th')[1].attributes('aria-sort')).toBe('ascending')
      expect(wrapper.findAll('th')[0].attributes('aria-sort')).toBeUndefined()
    })
  })
})
