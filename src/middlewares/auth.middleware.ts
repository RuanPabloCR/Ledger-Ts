import { FastifyRequest, FastifyReply } from 'fastify';
import { CustomerService } from '../services/customer.service.js';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = CustomerService.verifyToken(token);

    request.user = {
      ...decoded,
      role: 'CUSTOMER',
    };
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({ 
        error: `Forbidden: Required role ${allowedRoles.join(' or ')}` 
      });
    }
  };
}
