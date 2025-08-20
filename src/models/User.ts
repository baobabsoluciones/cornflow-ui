import getUserFullName from '@/utils/user'

export class User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  fullName: string

  constructor(
    id: string,
    username: string,
    email: string,
    firstName: string,
    lastName: string,
  ) {
    this.id = id
    this.username = username
    this.email = email
    this.firstName = firstName
    this.lastName = lastName
    this.fullName = getUserFullName(firstName, lastName)
  }
}
