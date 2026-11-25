import client from '../api/Api'
import { clearReturnTo } from '@cornflow-ui/core/utils/returnTo'

class AuthService {
  async initialize(): Promise<void> {
    // Cornflow auth doesn't need initialization
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
      // A server with refresh-token sessions also returns a refresh token; an older one does not,
      // and then the session ends when the access token does, as before
      const refreshToken = response.content.refresh_token
      if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken)
      else sessionStorage.removeItem('refreshToken')
      // isAdmin and userRoles are determined after fetching user role assignments (see general store fetchUser)
      sessionStorage.removeItem('isAdmin')
      sessionStorage.removeItem('userRoles')
    } else {
      sessionStorage.setItem('isAuthenticated', 'false')
    }

    return isAuthenticated
  }

  logout(): void {
    // Close the session on the server too (best effort: the user is signed out either way)
    const refreshToken = sessionStorage.getItem('refreshToken')
    if (refreshToken) {
      Promise.resolve(client.post('/logout/', { refresh_token: refreshToken })).catch(() => {})
    }
    clearReturnTo()
    sessionStorage.removeItem('refreshToken')
    sessionStorage.setItem('isAuthenticated', 'false')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('userId')
    sessionStorage.removeItem('isAdmin')
    sessionStorage.removeItem('userRoles')
  }

  isAdmin(): boolean {
    return sessionStorage.getItem('isAdmin') === 'true'
  }

  getToken = () => sessionStorage.getItem('token')

  getUserId = () => sessionStorage.getItem('userId')

  isAuthenticated(): boolean {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true'
    return isAuthenticated
  }

  // Renewal of a Cornflow session is done by the API client (see `Api.ts`) when a request is
  // answered with an expired token; this is the hook of the external (OpenID) providers
  async refreshToken(): Promise<{ token: string; expiresAt: number } | null> {
    return null
  }
}

export default new AuthService()
