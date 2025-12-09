import { FastifyInstance } from 'fastify';

export class AuthHelper {
  constructor(private app: FastifyInstance) {}

  async registerAndLogin(email = 'test@example.com', password = 'password123', name = 'Test User') {
    const registerResponse = await this.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, password, name },
    });

    if (registerResponse.statusCode !== 201) {
      throw new Error(`Registration failed: ${registerResponse.body}`);
    }

    const loginResponse = await this.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });

    if (loginResponse.statusCode !== 200) {
      throw new Error(`Login failed: ${loginResponse.body}`);
    }

    const loginBody = JSON.parse(loginResponse.body);
    return {
      customer: loginBody.customer,
      token: loginBody.token,
    };
  }

  getAuthHeader(token: string) {
    return {
      authorization: `Bearer ${token}`,
    };
  }
}
