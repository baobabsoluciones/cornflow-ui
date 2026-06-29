import client from '@/api/Api'

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

  getRoles(): Promise<Role[]> {
    return new Promise((resolve, reject) => {
      client
        .get('/roles/')
        .then((response) => {
          if (response.status === 200) {
            resolve(response.content as Role[])
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

  assignRoleToUser(userId: number, roleId: number): Promise<UserRoleAssignment> {
    return new Promise((resolve, reject) => {
      client
        .post('/user/role/', { user_id: userId, role_id: roleId })
        .then((response) => {
          if (response.status === 200 || response.status === 201) {
            resolve(response.content as UserRoleAssignment)
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
