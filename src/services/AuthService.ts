import client from '../api/Api';

class AuthService {
  async login(username: string, password: string): Promise<boolean> {
    const response = await client.post('/login/', { username, password }, { 'Content-Type': 'application/json' });
    const isAuthenticated = response.status === 200;
    const token = response.content.token;

    if (isAuthenticated) {
      sessionStorage.setItem('isAuthenticated', 'true');
      sessionStorage.setItem('token', token);
    } else {
      sessionStorage.setItem('isAuthenticated', 'false');
    }

    return isAuthenticated;
  }

  logout(): void {
    sessionStorage.setItem('isAuthenticated', 'false');
    sessionStorage.removeItem('token');
  }

  getToken = () => sessionStorage.getItem('token');

  isAuthenticated(): boolean {
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
    return isAuthenticated;
  }
}

export default new AuthService();