import 'reflect-metadata';

import { fastify } from 'fastify';
import { serializerCompiler, validatorCompiler,
    jsonSchemaTransform, type ZodTypeProvider
 } from 'fastify-type-provider-zod';
import { fastifySwagger } from "@fastify/swagger";
import ScalarApiReference from "@scalar/fastify-api-reference";

const app = fastify().withTypeProvider<ZodTypeProvider>();

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

app.listen({ port: 3333, host: '0.0.0.0' }).then(() => { 
  console.log('Server is running on http://localhost:3333');
  console.log('Docs available at http://localhost:3333/docs');
});
