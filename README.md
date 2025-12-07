# Ledger-TS

API de contabilidade de dupla entrada (Double-Entry Bookkeeping) construída com TypeScript, Fastify e TypeORM.

## 📋 Sobre o Projeto

Sistema de ledger contábil que implementa o padrão de contabilidade de dupla entrada, permitindo o gerenciamento de contas, transações e lançamentos contábeis com precisão de 4 casas decimais (10^-4).

### Principais Recursos

- Autenticação JWT
- Sistema de contas com tipos (ASSET, LIABILITY, EQUITY)
- Suporte multi-moeda (BRL, USD, GBP)
- Contabilidade de dupla entrada
- Histórico completo de transações
- Validação com Zod
- Documentação automática com Swagger/Scalar

## 🛠️ Tecnologias

- **Node.js** + **TypeScript**
- **Fastify** - Framework web
- **TypeORM** - ORM para PostgreSQL
- **PostgreSQL** - Banco de dados
- **Zod** - Validação de schemas
- **JWT** - Autenticação
- **Docker** - Containerização

##  Start
4. Inicie o banco de dados PostgreSQL:
```bash
docker-compose up -d
```

5. Execute o servidor em modo de desenvolvimento:
```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3333`

Documentação da API disponível em `http://localhost:3333/docs`

## 📊 Estrutura do Projeto

```
Ledger-Ts/
├── src/
│   ├── models/          # Entidades TypeORM
│   │   ├── account.ts
│   │   ├── customer.ts
│   │   ├── transaction.ts
│   │   └── ledgerEntry.ts
│   ├── routes/          # Rotas da API
│   │   ├── accounts.routes.ts
│   │   └── auth.routes.ts
│   ├── services/        # Lógica de negócio
│   │   ├── account.service.ts
│   │   └── customer.service.ts
│   ├── middlewares/     # Middlewares customizados
│   ├── data-source.ts   # Configuração TypeORM
│   └── server.ts        # Inicialização do servidor
├── docker-compose.yml
├── tsconfig.json
└── package.json
```

## 🔑 Endpoints Principais

### Autenticação

- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Dados do usuário autenticado

### Contas

- `POST /api/accounts` - Criar conta
- `GET /api/accounts` - Listar contas (com filtros)
- `GET /api/accounts/:id` - Buscar conta por ID
- `GET /api/accounts/:id/balance` - Consultar saldo
- `GET /api/accounts/:id/transactions` - Histórico de transações
- `PUT /api/accounts/:id` - Atualizar conta
- `DELETE /api/accounts/:id` - Deletar conta

## 💡 Modelo de Dados

### Customer (Cliente)
- ID, email, nome, senha (hash)

### Account (Conta)
- Tipos: ASSET, LIABILITY, EQUITY
- Moedas: BRL, USD, GBP
- Saldo armazenado como BigInt (precisão de 4 casas decimais)

### Transaction (Transação)
- Descrição, ator (USER, SYSTEM, WEBHOOK)
- Relacionada a múltiplos lançamentos

### LedgerEntry (Lançamento)
- Valor (BigInt)
- Referência à conta e transação

O projeto inclui um `docker-compose.yml` para facilitar o setup do PostgreSQL:

```bash
# Iniciar
docker-compose up -d
```

## Scripts

```bash
npm run dev
```