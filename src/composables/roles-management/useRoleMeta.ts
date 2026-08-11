/**
 * Presentation helpers for roles: icon, color, description and permissions
 * derived from a role name. Visuals come from a static mapping (presets);
 * description and permissions come from i18n so they translate per locale.
 *
 * Roles not declared in the presets fall back to a neutral preset so adding a
 * role from the UI works without a code change.
 */

import { useI18n } from 'vue-i18n'
import type { Role } from './types'

const ROLE_PRESETS: Record<string, { icon: string; color: string }> = {
  admin: { icon: 'mdi-shield-crown-outline', color: 'primary' },
  planner: { icon: 'mdi-clipboard-edit-outline', color: 'info' },
  viewer: { icon: 'mdi-eye-outline', color: 'success' },
  service: { icon: 'mdi-cog-outline', color: 'warning' },
  ie_viewer: { icon: 'mdi-eye-check-outline', color: 'secondary' },
}

const ROLE_PRESET_FALLBACK = {
  icon: 'mdi-shield-account-outline',
  color: 'primary',
}

function rolePresetKey(roleName: string): string {
  return roleName?.toLowerCase().replaceAll(/[\s-]+/g, '_') ?? ''
}

function preset(roleName: string): { icon: string; color: string } {
  return ROLE_PRESETS[rolePresetKey(roleName)] ?? ROLE_PRESET_FALLBACK
}

function iconFor(role: Role): string {
  return preset(role.name).icon
}

function colorFor(role: Role): string {
  return preset(role.name).color
}

function colorForName(name: string): string {
  return preset(name).color
}

export function useRoleMeta() {
  const { t, tm, rt } = useI18n()

  function descriptionFor(role: Role): string {
    const key = `rolesManagement.roleMeta.${rolePresetKey(role.name)}.description`
    const value = t(key)
    // vue-i18n returns the key path when the message is missing.
    return value === key ? t('rolesManagement.noDescription') : value
  }

  function permissionsFor(role: Role): string[] {
    const messages = tm(
      `rolesManagement.roleMeta.${rolePresetKey(role.name)}.permissions`,
    )
    if (!Array.isArray(messages)) return []
    return messages.map((m) => rt(m as string))
  }

  return {
    iconFor,
    colorFor,
    colorForName,
    descriptionFor,
    permissionsFor,
  }
}
