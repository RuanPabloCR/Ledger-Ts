import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TransactionService } from '../services/transaction.service.js';
import { ActorType } from '../models/transaction.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const createTransactionSchema = z.object({
  description: z.string().min(1),
  actorType: z.nativeEnum(ActorType).optional(),
  ledger_entries: z.array(z.object({
    accountId: z.string().uuid(),
    amount: z.string().regex(/^-?\d+$/, 'Amount must be a valid integer string'),
  })).min(2),
});

const transactionParamsSchema = z.object({
  id: z.string().uuid(),
});

const transactionQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

const ledgerEntryResponseSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  amount: z.bigint().transform((val) => val.toString()),
});

const transactionResponseSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  actorId: z.string().uuid(),
  actorType: z.nativeEnum(ActorType),
  createdAt: z.date(),
  ledger_entries: z.array(ledgerEntryResponseSchema),
});

const transactionListResponseSchema = z.object({
  transactions: z.array(transactionResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

export async function transactionRoutes(app: FastifyInstance) {
  const testDs = (app as any).testDataSource;
  const transactionService = new TransactionService(testDs);

  // Todas as rotas requerem autenticação
  app.addHook('preHandler', authenticate);

  app.post(
    '/',
    {
      schema: {
        tags: ['Transactions'],
        description: 'Create a new transaction (requires authentication)',
        body: createTransactionSchema,
        response: {
          201: transactionResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const data = createTransactionSchema.parse(request.body);

        // Converter strings para BigInt
        const ledgerEntries = data.ledger_entries.map(entry => ({
          accountId: entry.accountId,
          amount: BigInt(entry.amount),
        }));

        const transaction = await transactionService.create(
          {
            description: data.description,
            actorId: request.user.id,
            actorType: data.actorType || ActorType.USER,
            ledger_entries: ledgerEntries,
          },
          request.user.id
        );

        return reply.status(201).send(transaction);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Forbidden')) {
            return reply.status(403).send({ error: error.message });
          }
          if (error.message.includes('not found')) {
            return reply.status(404).send({ error: error.message });
          }
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
        tags: ['Transactions'],
        description: 'List all transactions (requires authentication, only shows user\'s own transactions)',
        querystring: transactionQuerySchema,
        response: {
          200: transactionListResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request: AuthenticatedRequest, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }

        const filters = transactionQuerySchema.parse(request.query);
        const result = await transactionService.findAll(filters, request.user.id);

        return reply.status(200).send(result);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Forbidden')) {
            return reply.status(403).send({ error: error.message });
          }
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
        tags: ['Transactions'],
        description: 'Get transaction by ID (requires authentication)',
        params: transactionParamsSchema,
        response: {
          200: transactionResponseSchema,
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
        const transaction = await transactionService.findById(id, request.user.id);

        return reply.status(200).send(transaction);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('Forbidden')) {
            return reply.status(403).send({ error: error.message });
          }
          if (error.message === 'Transaction not found') {
            return reply.status(404).send({ error: error.message });
          }
          return reply.status(500).send({ error: error.message });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
