/**
 * Deterministic avatar helpers. The background color is keyed by the user's
 * username (or other stable identifier) so the same user keeps the same color
 * across reloads without any backend support.
 */

import type { UserRow } from './types'

const AVATAR_PALETTE = [
  '#5B6BB5',
  '#2E8B6A',
  '#B8763F',
  '#A24F8E',
  '#3F8BC4',
  '#C45E5E',
  '#6F8B36',
  '#7A4FB2',
]

function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = Math.trunc(h * 31 + input.codePointAt(i))
  }
  return Math.abs(h)
}

function colorFor(user: UserRow): string {
  const seed = user.username || user.full_name || String(user.id)
  return AVATAR_PALETTE[hashString(seed) % AVATAR_PALETTE.length]
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
  return { colorFor, initialsFor }
}
