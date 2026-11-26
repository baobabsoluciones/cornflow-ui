export interface UserRow {
  id: number
  username: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  role_names: string[]
  /** Locked after too many failed sign-in attempts. */
  locked: boolean
  /** Has two-factor authentication on. */
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
