import { describe, test, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent } from 'vue'
import en from '@cornflow-ui/core/plugins/locales/en'
import { useRoleMeta } from '@cornflow-ui/core/composables/roles-management/useRoleMeta'

function roleMeta() {
  let meta!: ReturnType<typeof useRoleMeta>
  mount(
    defineComponent({
      setup() {
        meta = useRoleMeta()
        return () => null
      },
    }),
    { global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] } },
  )
  return meta
}

describe('useRoleMeta', () => {
  test('the platform roles have an icon, a neutral tone, a description and permissions', () => {
    const meta = roleMeta()
    for (const name of ['platform_admin', 'platform_planner', 'platform_viewer']) {
      const role = { id: 900, name }
      expect(meta.toneFor(role)).toBe('neutral')
      expect(meta.iconFor(role)).not.toBe('mdi-shield-account-outline')
      expect(meta.descriptionFor(role)).toContain('Platform staff')
      expect(meta.permissionsFor(role).length).toBeGreaterThan(0)
    }
  })

  test('a role of the app without a preset falls back to the neutral preset', () => {
    const meta = roleMeta()
    const role = { id: 5, name: 'dispatcher' }
    expect(meta.iconFor(role)).toBe('mdi-shield-account-outline')
    expect(meta.descriptionFor(role)).toBe(en.rolesManagement.noDescription)
  })
})
