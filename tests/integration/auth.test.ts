import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { TestDatabase } from '../setup/test-database.js';
import { createTestServer } from '../setup/test-server.js';
import { AuthHelper } from '../helpers/auth-helper.js';

describe('Auth Routes', () => {
  let testDb: TestDatabase;
  let app: FastifyInstance;
  let authHelper: AuthHelper;

  beforeAll(async () => {
    testDb = new TestDatabase();
    const dataSource = await testDb.start();
    app = await createTestServer(dataSource);
    authHelper = new AuthHelper(app);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.clear();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new customer with valid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'john@example.com',
          password: 'password123',
          name: 'John Doe',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.email).toBe('john@example.com');
      expect(body.name).toBe('John Doe');
      expect(body).not.toHaveProperty('password');
    });

    it('should reject registration with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'password123',
          name: 'John Doe',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject registration with short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'john@example.com',
          password: '12345',
          name: 'John Doe',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject registration with duplicate email', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'john@example.com',
          password: 'password123',
          name: 'John Doe',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'john@example.com',
          password: 'password456',
          name: 'Jane Doe',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already');
    });

    it('should reject registration with missing fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'john@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'john@example.com',
          password: 'password123',
          name: 'John Doe',
        },
      });
    });

    it('should login with valid credentials', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'john@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('token');
      expect(body.customer.email).toBe('john@example.com');
    });

    it('should reject login with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'invalid@example.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject login with invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'john@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject login with malformed data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'not-an-email',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let token: string;

    beforeEach(async () => {
      const { token: authToken } = await authHelper.registerAndLogin(
        'john@example.com',
        'password123',
        'John Doe'
      );
      token = authToken;
    });

    it('should return current user with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.email).toBe('john@example.com');
      expect(body.name).toBe('John Doe');
    });

    it('should reject request without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: {
          authorization: 'InvalidFormat',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
