import client from '@cornflow-ui/core/api/Api'
import { User } from '@cornflow-ui/core/models/User'

interface RawUser {
  id: number
  username: string
  email: string
  first_name?: string
  last_name?: string
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

  changePassword(userId: string | number, password: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      client
        .put(`/user/${userId}/`, { password })
        .then((response) => {
          resolve(response.status === 200)
        })
        .catch(reject)
    })
  }
}
