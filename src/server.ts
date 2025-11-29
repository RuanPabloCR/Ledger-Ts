import 'reflect-metadata';
import { fastify } from 'fastify';
import { serializerCompiler, validatorCompiler,
    jsonSchemaTransform, type ZodTypeProvider
 } from 'fastify-type-provider-zod';
import { fastifySwagger } from "@fastify/swagger";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { AppDataSource } from './data-source.js';
import { authRoutes } from './routes/auth.routes.js';

const app = fastify({logger: true}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(fastifySwagger, {
    openapi: {
        info: {
            title: 'Ledger API',
            version: '1.0.0',
        },
    },
    transform: jsonSchemaTransform,
});
app.register(ScalarApiReference, {
    routePrefix: '/docs',
}); 
app.withTypeProvider<ZodTypeProvider>();

app.register(authRoutes, { prefix: '/api/auth' });

app.get('/', async (request, reply) => {
    return { hello: 'world' };
});

AppDataSource.initialize()
  .then(() => {
    app.log.info('Database connected successfully');
    
    return app.listen({ port: 3333, host: '0.0.0.0' });
  })
  .then(() => {
    console.log('Server is running on http://localhost:3333');
    console.log('Docs available at http://localhost:3333/docs');
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });