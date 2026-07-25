import client from '@cornflow-ui/core/api/Api'
import { User } from '@cornflow-ui/core/models/User'

interface RawUser {
  id: number
  username: string
  email: string
  first_name?: string
  last_name?: string
  locked?: boolean
}

export default class UserRepository {
  getAllUsers(): Promise<RawUser[]> {
    return new Promise((resolve, reject) => {
      client
        .get('/user/')
        .then((response) => {
          if (response.status === 200) {
            resolve(response.content as RawUser[])
          } else {
            reject(new Error('Error getting users'))
          }
        })
        .catch(reject)
    })
  }

  getUserById(id: string | number): Promise<User> {
    return new Promise((resolve, reject) => {
      client
        .get(`/user/${id}/`)
        .then((response) => {
          if (response.status === 200) {
            const raw = response.content as RawUser
            resolve(
              new User(
                String(raw.id),
                raw.username,
                raw.email,
                raw.first_name || '',
                raw.last_name || '',
              ),
            )
          } else {
            reject(new Error('Error getting user'))
          }
        })
        .catch(reject)
    })
  }

  updateUser(
    userId: string | number,
    data: { email?: string; first_name?: string; last_name?: string },
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      client
        .put(`/user/${userId}/`, data)
        .then((response) => {
          if (response.status === 200) {
            resolve(true)
          } else {
            const message =
              (response.content as { error?: string })?.error ||
              'Error updating user'
            reject(new Error(message))
          }
        })
        .catch(reject)
    })
  }

  changePassword(
    userId: string | number,
    password: string,
    currentPassword?: string,
  ): Promise<{ success: boolean; message?: string }> {
    const body: Record<string, string> = { password }
    if (currentPassword) {
      body.current_password = currentPassword
    }
    return new Promise((resolve, reject) => {
      client
        .put(`/user/${userId}/`, body)
        .then((response) => {
          if (response.status === 200) {
            resolve({ success: true })
          } else {
            resolve({
              success: false,
              message: (response.content as { error?: string })?.error,
            })
          }
        })
        .catch(reject)
    })
  }

  unlockUser(userId: string | number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      client
        .put(`/user/${userId}/unlock/`, {})
        .then((response) => {
          resolve(response.status === 200)
        })
        .catch(reject)
    })
  }

  resetMfa(userId: string | number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      client
        .remove(`/user/${userId}/mfa/`)
        .then((response) => {
          resolve(response.status === 200)
        })
        .catch(reject)
    })
  }
}
