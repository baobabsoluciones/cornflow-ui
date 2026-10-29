/**
 * Deterministic avatar helpers. The tone is keyed by the user's username (or
 * other stable identifier) so the same user keeps the same tone across reloads
 * without any backend support.
 */

import type { CoreTone } from '@cornflow-ui/core/types/ui'
import type { UserRow } from './types'

const AVATAR_TONES: CoreTone[] = ['primary', 'success', 'warning', 'info', 'neutral']

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = Math.trunc(h * 31 + input.codePointAt(i))
  }
  return Math.abs(h)
}

function toneFor(user: UserRow): CoreTone {
  const seed = user.username || user.full_name || String(user.id)
  return AVATAR_TONES[hashString(seed) % AVATAR_TONES.length]
}

function initialsFor(user: UserRow): string {
  const source = (user.full_name || user.username || '').trim()
  if (!source) return '?'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return source.slice(0, 2).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts.at(-1)[0]).toUpperCase()
}

export function useUserAvatar() {
  return { toneFor, initialsFor }
}
