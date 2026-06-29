export interface UserRow {
  id: number
  username: string
  full_name: string
  email: string
  role_names: string[]
  /** Role IDs kept for API calls (parallel to role_names). */
  _role_ids: number[]
}

export interface RoleFormValue {
  id?: number
  name: string
}

export type { Role } from '@/repositories/RoleRepository'
