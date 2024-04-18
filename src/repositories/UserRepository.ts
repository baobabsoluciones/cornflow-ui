import client from '@/api/Api'
import { User } from '@/models/User'

export default class ExecutionRepository {
  getUserById(id: string): Promise<User> {
    return new Promise((resolve, reject) => {
      client
        .get(`/user/${id}/`)
        .then((response) => {
          if (response.status === 200) {
            const user = response.content
            resolve(
              new User(
                user.id,
                user.username,
                user.email,
                user.first_name,
                user.last_name,
              ),
            )
          } else {
            reject(new Error('Error getting user'))
          }
        })
        .catch((error) => {
          reject(error)
        })
    })
  }
}
