import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CustomerService } from '../services/customer.service.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
const customerResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.date(),
});

const loginResponseSchema = z.object({
  customer: customerResponseSchema,
  token: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

const authHeaderSchema = z.object({
  authorization: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  const customerService = new CustomerService();

  app.post('/register', {
    schema: {
      tags: ['Auth'],
      description: 'Register a new customer',
      body: registerSchema,
      response: {
        201: customerResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);
      const customer = await customerService.register(data);
      
      return reply.status(201).send(customer);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.post('/login', {
    schema: {
      tags: ['Auth'],
      description: 'Login with email and password',
      body: loginSchema,
      response: {
        200: loginResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const data = loginSchema.parse(request.body);
      const result = await customerService.login(data);
      
      return reply.status(200).send(result);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(401).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  app.get('/me', {
    schema: {
      tags: ['Auth'],
      description: 'Get current user data',
      headers: authHeaderSchema,
      response: {
        200: customerResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid token' });
      }

      const token = authHeader.substring(7);
      const decoded = CustomerService.verifyToken(token);
      
      const customer = await customerService.findById(decoded.id);
      
      return reply.status(200).send(customer);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(401).send({ error: error.message });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}
