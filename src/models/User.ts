export class User {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string

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
  }
}
