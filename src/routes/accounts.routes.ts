import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AccountService } from '../services/account.service.js';
import { AccountType, AssetCode } from '../models/account.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(AccountType),
  currency: z.nativeEnum(AssetCode).default(AssetCode.BRL),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
});

const queryFiltersSchema = z.object({
  type: z.nativeEnum(AccountType).optional(),
  currency: z.nativeEnum(AssetCode).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

const transactionQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

const accountResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  type: z.nativeEnum(AccountType),
  balance: z.bigint().transform((val) => val.toString()),
  currency: z.nativeEnum(AssetCode),
  createdAt: z.date(),
});

const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const accountListResponseSchema = z.object({
  accounts: z.array(accountResponseSchema),
  pagination: paginationSchema,
});

const balanceResponseSchema = z.object({
  accountId: z.string().uuid(),
  balance: z.bigint().transform((val) => val.toString()),
  currency: z.nativeEnum(AssetCode),
});

const transactionResponseSchema = z.object({
  id: z.string().uuid(),
  sourceAccountId: z.string().uuid(),
  targetAccountId: z.string().uuid(),
  amount: z.bigint().transform((val) => val.toString()) ,
  createdAt: z.date(),
});

const transactionListResponseSchema = z.object({
  accountId: z.string().uuid(),
  transactions: z.array(transactionResponseSchema),
  pagination: paginationSchema,
});

const errorResponseSchema = z.object({
  error: z.string(),
});

export async function accountRoutes(app: FastifyInstance) {
  const accountService = new AccountService();

  app.addHook('preHandler', authenticate);

  app.post(
    '/',
    {
      schema: {
        tags: ['Accounts'],
        description: 'Create a new account (requires authentication)',
        body: createAccountSchema,
        response: {
          201: accountResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const data = createAccountSchema.parse(request.body);
        
        const account = await accountService.create({
          ...data,
          ownerId: request.user.id,
        });

        return reply.status(201).send(account);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['Accounts'],
        description: 'List all accounts (requires authentication, only shows user\'s own accounts)',
        querystring: queryFiltersSchema,
        response: {
          200: accountListResponseSchema,
          401: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const filters = queryFiltersSchema.parse(request.query);
        const result = await accountService.findAll({
          ...filters,
          ownerId: request.user.id,
        });

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error) {
          return reply.status(500).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['Accounts'],
        description: 'Get account by ID (requires authentication)',
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: accountResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const account = await accountService.findById(id);

        if (account.ownerId !== request.user.id) {
          return reply.status(403).send({ error: 'Forbidden: You can only access your own accounts' });
        }

        return reply.status(200).send(account);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Account not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(500).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  app.get(
    '/:id/balance',
    {
      schema: {
        tags: ['Accounts'],
        description: 'Get account balance (requires authentication)',
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: balanceResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const account = await accountService.findById(id);

        if (account.ownerId !== request.user.id) {
          return reply.status(403).send({ error: 'Forbidden: You can only access your own accounts' });
        }

        const balance = await accountService.getBalance(id);

        return reply.status(200).send(balance);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Account not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(500).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  app.get(
    '/:id/transactions',
    {
      schema: {
        tags: ['Accounts'],
        description: 'Get account transaction history (requires authentication)',
        params: z.object({
          id: z.string().uuid(),
        }),
        querystring: transactionQuerySchema,
        response: {
          200: transactionListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const account = await accountService.findById(id);

        if (account.ownerId !== request.user.id) {
          return reply.status(403).send({ error: 'Forbidden: You can only access your own accounts' });
        }

        const filters = transactionQuerySchema.parse(request.query);
        const result = await accountService.getTransactions(id, filters);

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Account not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(500).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  app.put(
    '/:id',
    {
      schema: {
        tags: ['Accounts'],
        description: 'Update account (requires authentication)',
        params: z.object({
          id: z.string().uuid(),
        }),
        body: updateAccountSchema,
        response: {
          200: accountResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const account = await accountService.findById(id);

        if (account.ownerId !== request.user.id) {
          return reply.status(403).send({ error: 'Forbidden: You can only update your own accounts' });
        }

        const data = updateAccountSchema.parse(request.body);
        const updatedAccount = await accountService.update(id, data);

        return reply.status(200).send(updatedAccount);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Account not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(400).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  app.get(
    '/:id/ledger-entries',
    {
      schema: {
        tags: ['Accounts'],
        description: 'Get account ledger entries (requires authentication)',
        params: z.object({
          id: z.string().uuid(),
        }),
        querystring: z.object({
          page: z.coerce.number().min(1).default(1),
          limit: z.coerce.number().min(1).max(100).default(10),
        }),
        response: {
          200: z.object({
            accountId: z.string().uuid(),
            entries: z.array(z.object({
              id: z.string().uuid(),
              accountId: z.string().uuid(),
              transactionId: z.string().uuid(),
              amount: z.bigint().transform((val) => val.toString()),
              createdAt: z.date(),
            })),
            pagination: paginationSchema,
          }),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as { id: string };
        const account = await accountService.findById(id);

        if (account.ownerId !== request.user.id) {
          return reply.status(403).send({ error: 'Forbidden: You can only access your own accounts' });
        }

        const filters = request.query as { page?: number; limit?: number };
        const result = await accountService.getLedgerEntries(id, filters);

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Account not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(500).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
