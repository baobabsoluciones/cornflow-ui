import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  registerPremiumModules,
  getExtensionContext,
  getPremiumGlobalComponents,
  runPremiumActiveSchemaChangedHooks,
  runPremiumGlobalContextChangedHooks,
} from '@cornflow-ui/core/plugins/extensions'
import { useGeneralStore } from '@cornflow-ui/core/stores/general'
import type { PremiumModule } from '@cornflow-ui/core/types/extension'

describe('extension context', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    registerPremiumModules([])
    setActivePinia(undefined as any)
  })

  describe('getRoleNames', () => {
    test('reads the roles of the logged-in user from the store', () => {
      setActivePinia(createPinia())
      sessionStorage.setItem('userRoles', JSON.stringify(['viewer']))
      useGeneralStore().user = { roles: [{ id: 3, name: 'admin' }] }

      expect(getExtensionContext().getRoleNames()).toEqual(['admin'])
    })

    test('falls back to sessionStorage before the user is loaded', () => {
      setActivePinia(createPinia())
      sessionStorage.setItem('userRoles', JSON.stringify(['planner']))

      expect(getExtensionContext().getRoleNames()).toEqual(['planner'])
    })

    test('falls back to sessionStorage before Pinia is installed', () => {
      setActivePinia(undefined as any)
      sessionStorage.setItem('userRoles', JSON.stringify(['planner']))

      expect(getExtensionContext().getRoleNames()).toEqual(['planner'])
    })

    test('a global component gated by role shows once the login loads the user', () => {
      setActivePinia(createPinia())
      registerPremiumModules([
        {
          id: 'admin-banner',
          globalComponents: [
            {
              component: {} as any,
              slot: 'app-banners',
              isVisible: (ctx) => ctx.getRoleNames().includes('admin'),
            },
          ],
        },
      ])
      expect(getPremiumGlobalComponents('app-banners')).toHaveLength(0)

      useGeneralStore().user = { roles: [{ id: 3, name: 'admin' }] }

      expect(getPremiumGlobalComponents('app-banners')).toHaveLength(1)
    })
  })

  test('exposes the active schema and the picked global-context values', () => {
    setActivePinia(createPinia())
    const store = useGeneralStore()
    store.schema = 'stock_dag'
    store.globalContext = { plant_id: '102', program_id: null }

    const ctx = getExtensionContext()

    expect(ctx.getActiveSchema?.()).toBe('stock_dag')
    expect(ctx.getGlobalContext?.()).toEqual({ plant_id: '102' })
  })

  test('global components can be mounted in the context bar', () => {
    const component = {} as any
    registerPremiumModules([
      { id: 'top', globalComponents: [{ component, slot: 'app-top-bar' }] },
    ])

    expect(getPremiumGlobalComponents('app-top-bar')).toEqual([
      { component, slot: 'app-top-bar' },
    ])
    expect(getPremiumGlobalComponents('app-banners')).toEqual([])
  })

  describe('change hooks', () => {
    test('run the hooks of the enabled modules only', async () => {
      const onActiveSchemaChanged = vi.fn()
      const onGlobalContextChanged = vi.fn()
      const disabled = vi.fn()
      const modules: PremiumModule[] = [
        { id: 'a', onActiveSchemaChanged, onGlobalContextChanged },
        {
          id: 'b',
          isEnabled: () => false,
          onActiveSchemaChanged: disabled,
          onGlobalContextChanged: disabled,
        },
        { id: 'c' },
      ]
      registerPremiumModules(modules)

      await runPremiumActiveSchemaChangedHooks('stock_dag')
      await runPremiumGlobalContextChangedHooks({ plant_id: '102' })

      expect(onActiveSchemaChanged).toHaveBeenCalledWith(
        'stock_dag',
        expect.objectContaining({ getRoleNames: expect.any(Function) }),
      )
      expect(onGlobalContextChanged).toHaveBeenCalledWith(
        { plant_id: '102' },
        expect.objectContaining({ getRoleNames: expect.any(Function) }),
      )
      expect(disabled).not.toHaveBeenCalled()
    })
  })
})
