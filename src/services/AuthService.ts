import client from '../api/Api'

class AuthService {
  async initialize(): Promise<void> {
    // Cornflow auth doesn't need initialization
    return Promise.resolve()
  }

  async login(username: string, password: string): Promise<boolean> {
    const response = await client.post(
      '/login/',
      { username, password },
      { 'Content-Type': 'application/json' },
    )
    const isAuthenticated = response.status === 200
    const token = response.content.token
    const userId = response.content.id

    if (isAuthenticated) {
      sessionStorage.setItem('isAuthenticated', 'true')
      sessionStorage.setItem('token', token)
      sessionStorage.setItem('userId', userId)
    } else {
      sessionStorage.setItem('isAuthenticated', 'false')
    }

    return isAuthenticated
  }

  async signup(email: string, username: string, password: string): Promise<boolean> {
    const response = await client.post(
      '/signup/',
      { email, username, password },
      { 'Content-Type': 'application/json' },
    )
    
    return response.status === 201
  }

  logout(): void {
    sessionStorage.setItem('isAuthenticated', 'false')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('userId')
  }

  getToken = () => sessionStorage.getItem('token')

  getUserId = () => sessionStorage.getItem('userId')

  isAuthenticated(): boolean {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true'
    return isAuthenticated
  }

  // Cornflow doesn't support token refresh from front-end side, tokens are managed by the backend
  async refreshToken(): Promise<{ token: string; expiresAt: number } | null> {
    return null
  }
}

export default new AuthService()
