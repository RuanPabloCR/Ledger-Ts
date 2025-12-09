import { fastify, FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { DataSource } from 'typeorm';
import { authRoutes } from '../../src/routes/auth.routes.js';
import { accountRoutes } from '../../src/routes/accounts.routes.js';
import { transactionRoutes } from '../../src/routes/transactions.routes.js';

export async function createTestServer(dataSource: DataSource): Promise<FastifyInstance> {
  const app = fastify({
    logger: false,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('testDataSource', dataSource);

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(accountRoutes, { prefix: '/api/accounts' });
  app.register(transactionRoutes, { prefix: '/api/transactions' });
  app.get('/', async () => ({ status: 'ok' }));

  await app.ready();
  return app;
}
