import client from '@cornflow-ui/core/api/Api'
import { PLATFORM_ADMIN_REQUIRED, TOTP_REQUIRED } from '@cornflow-ui/core/utils/platformRoles'

export interface Role {
  id: number
  name: string
}

export interface UserRoleAssignment {
  id: number
  user_id: number
  role_id: number
  /** Username of the assigned user (returned by GET /user/role/). */
  user: string
  /** Role name (returned by GET /user/role/). */
  role: string
}

export default class RoleRepository {
  // ── Roles CRUD ──────────────────────────────────────────────────

  /**
   * The roles of the deployment. On a Cornflow with platform roles only a platform administrator
   * may list them: a 403 rejects with `PLATFORM_ADMIN_REQUIRED`.
   */
  getRoles(): Promise<Role[]> {
    return new Promise((resolve, reject) => {
      client
        .get('/roles/')
        .then((response) => {
          if (response.status === 200) {
            resolve(response.content as Role[])
          } else if (response.status === 403) {
            reject(new Error(PLATFORM_ADMIN_REQUIRED))
          } else {
            reject(new Error('Error getting roles'))
          }
        })
        .catch(reject)
    })
  }

  createRole(name: string): Promise<Role> {
    return new Promise((resolve, reject) => {
      client
        .post('/roles/', { name })
        .then((response) => {
          if (response.status === 200 || response.status === 201) {
            resolve(response.content as Role)
          } else {
            reject(new Error('Error creating role'))
          }
        })
        .catch(reject)
    })
  }

  updateRole(id: number, name: string): Promise<Role> {
    return new Promise((resolve, reject) => {
      client
        .put(`/roles/${id}/`, { name })
        .then((response) => {
          if (response.status === 200) {
            resolve(response.content as Role)
          } else {
            reject(new Error('Error updating role'))
          }
        })
        .catch(reject)
    })
  }

  deleteRole(id: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      client
        .remove(`/roles/${id}/`)
        .then((response) => {
          resolve(response.status === 200 || response.status === 204)
        })
        .catch(reject)
    })
  }

  // ── User–Role assignments ────────────────────────────────────────

  /**
   * GET /user/role/
   * If the current user is an admin, returns ALL user–role assignments.
   * Otherwise returns only the assignments for the current user.
   */
  getAllUserRoleAssignments(): Promise<UserRoleAssignment[]> {
    return new Promise((resolve, reject) => {
      client
        .get('/user/role/')
        .then((response) => {
          if (response.status === 200) {
            resolve(response.content as UserRoleAssignment[])
          } else {
            reject(new Error('Error getting user role assignments'))
          }
        })
        .catch(reject)
    })
  }

  getUserRole(userId: number, roleId: number): Promise<UserRoleAssignment> {
    return new Promise((resolve, reject) => {
      client
        .get(`/user/role/${userId}/${roleId}/`)
        .then((response) => {
          if (response.status === 200) {
            resolve(response.content as UserRoleAssignment)
          } else {
            reject(new Error('Error getting user role'))
          }
        })
        .catch(reject)
    })
  }

  /**
   * Gives a role to a user. Granting a platform role asks an administrator who has two-factor
   * authentication for a fresh code (`totpCode`); without a valid one the promise rejects with
   * `TOTP_REQUIRED`. The code is sent only when given.
   */
  assignRoleToUser(
    userId: number,
    roleId: number,
    totpCode?: string,
  ): Promise<UserRoleAssignment> {
    const body: Record<string, unknown> = { user_id: userId, role_id: roleId }
    if (totpCode) body.totp_code = totpCode
    return new Promise((resolve, reject) => {
      client
        .post('/user/role/', body)
        .then((response) => {
          if (response.status === 200 || response.status === 201) {
            resolve(response.content as UserRoleAssignment)
          } else if (
            response.status === 400 &&
            /two-factor/i.test((response.content as { error?: string })?.error ?? '')
          ) {
            reject(new Error(TOTP_REQUIRED))
          } else {
            reject(new Error('Error assigning role to user'))
          }
        })
        .catch(reject)
    })
  }

  removeRoleFromUser(userId: number, roleId: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      client
        .remove(`/user/role/${userId}/${roleId}/`)
        .then((response) => {
          resolve(response.status === 200 || response.status === 204)
        })
        .catch(reject)
    })
  }
}
