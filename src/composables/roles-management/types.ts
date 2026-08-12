export interface UserRow {
  id: number
  username: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  role_names: string[]
  /** Account locked after too many failed login attempts. */
  locked: boolean
  /** Whether the user has two-factor authentication enabled. */
  mfaEnabled: boolean
  /** Role IDs kept for API calls (parallel to role_names). */
  _role_ids: number[]
}

/** Editable profile fields for a user (password is handled elsewhere). */
export interface UserProfileValue {
  first_name: string
  last_name: string
  email: string
}

export interface RoleFormValue {
  id?: number
  name: string
}

export type { Role } from '@cornflow-ui/core/repositories/RoleRepository'
