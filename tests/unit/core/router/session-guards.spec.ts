import { describe, test, expect, vi, beforeEach } from 'vitest'

const mockAuthService = vi.hoisted(() => ({
  isAuthenticated: vi.fn(() => true),
}))
vi.mock('@cornflow-ui/core/services/AuthServiceFactory', () => ({
  default: vi.fn().mockResolvedValue(mockAuthService),
}))

vi.mock('@/app/config', () => ({
  default: {
    getDashboardRoutes: () => [],
    getInstanceDashboardRoutes: () => [],
    getAppSectionRoutes: () => [],
    getCore: () => ({ parameters: { defaultView: 'history-execution' } }),
  },
}))

vi.mock('@cornflow-ui/core/config', () => ({
  default: {
    useHashMode: false,
    initConfig: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@cornflow-ui/core/stores/general', () => ({
  useGeneralStore: () => ({
    getUser: { roles: [{ name: 'planner' }] },
    getSchemaName: 'planning_dag',
    initialDataLoading: false,
    getConfigurations: {},
  }),
}))

for (const view of [
  'IndexView',
  'LoginView',
  'ResetPasswordView',
  'CreateExecutionView',
  'HistoryExecutionView',
  'DashboardView',
  'UserSettingsView',
  'SectionView',
  'ConfigurationSectionSubsectionView',
  'RolesManagementView',
  'NotFoundView',
]) {
  vi.doMock(`@cornflow-ui/core/views/${view}.vue`, () => ({
    default: { name: view, template: '<div><router-view /></div>' },
  }))
}

async function navigate(path: string) {
  const { createAppRouter } = await import('@cornflow-ui/core/router/index')
  const router = createAppRouter()
  await router.push(path)
  return router.currentRoute.value
}

describe('session guards', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockAuthService.isAuthenticated.mockReturnValue(true)
  })

  test('the password reset page opens without a session', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)

    const route = await navigate('/reset-password?token=abc')

    expect(route.path).toBe('/reset-password')
  })

  test('the password reset page opens with a session too', async () => {
    const route = await navigate('/reset-password?token=abc')

    expect(route.path).toBe('/reset-password')
  })

  test('without a session the app leads to the sign-in page', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false)

    expect((await navigate('/history-execution')).path).toBe('/sign-in')
  })

  test('a password that must be changed keeps the user on the settings page', async () => {
    sessionStorage.setItem('pwdChangeRequired', 'true')

    const route = await navigate('/history-execution')

    expect(route.path).toBe('/user-settings')
    expect(route.query.changePassword).toBe('true')
  })

  test('once the password is changed the app opens again', async () => {
    const route = await navigate('/history-execution')

    expect(route.path).toBe('/history-execution')
  })
})
