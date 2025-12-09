import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { TestDatabase } from '../setup/test-database.js';
import { createTestServer } from '../setup/test-server.js';
import { AuthHelper } from '../helpers/auth-helper.js';
import { TestFixtures } from '../setup/fixtures.js';
import { AccountType, AssetCode } from '../../src/models/account.js';
import { ActorType } from '../../src/models/transaction.js';

describe('Transaction Routes', () => {
  let testDb: TestDatabase;
  let app: FastifyInstance;
  let authHelper: AuthHelper;
  let fixtures: TestFixtures;
  let token: string;
  let customerId: string;

  beforeAll(async () => {
    testDb = new TestDatabase();
    const dataSource = await testDb.start();
    app = await createTestServer(dataSource);
    authHelper = new AuthHelper(app);
    fixtures = new TestFixtures(dataSource);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  beforeEach(async () => {
    await testDb.clear();
    const { customer, token: authToken } = await authHelper.registerAndLogin();
    token = authToken;
    customerId = customer.id;
  });

  describe('POST /api/transactions', () => {
    let accountDebit: any;
    let accountCredit: any;

    beforeEach(async () => {
      accountDebit = await fixtures.createAccount(customerId, {
        name: 'Debit Account',
        balance: 50000n,
        type: AccountType.ASSET,
      });
      accountCredit = await fixtures.createAccount(customerId, {
        name: 'Credit Account',
        balance: 0n,
        type: AccountType.ASSET,
      });
    });

    it('should create a valid transaction', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
        payload: {
          description: 'Transfer',
          actorType: ActorType.USER,
          ledger_entries: [
            { accountId: accountDebit.id, amount: '-10000' },
            { accountId: accountCredit.id, amount: '10000' },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.description).toBe('Transfer');
      expect(body.ledger_entries).toHaveLength(2);
    });

    it('should reject transaction without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        payload: {
          description: 'Test',
          ledger_entries: [
            { accountId: accountDebit.id, amount: '-1000' },
            { accountId: accountCredit.id, amount: '1000' },
          ],
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject transaction with only one entry', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
        payload: {
          description: 'Invalid',
          actorType: ActorType.USER,
          ledger_entries: [
            { accountId: accountDebit.id, amount: '-10000' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject transaction with unbalanced entries', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
        payload: {
          description: 'Unbalanced',
          actorType: ActorType.USER,
          ledger_entries: [
            { accountId: accountDebit.id, amount: '-10000' },
            { accountId: accountCredit.id, amount: '5000' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain('sum');
    });

    it('should reject transaction with insufficient balance', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
        payload: {
          description: 'Overdraft',
          actorType: ActorType.USER,
          ledger_entries: [
            { accountId: accountDebit.id, amount: '-100000' },
            { accountId: accountCredit.id, amount: '100000' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain('balance');
    });

    it('should reject transaction with other users accounts', async () => {
      const otherCustomer = await fixtures.createCustomer({ email: 'other@test.com' });
      const otherAccount = await fixtures.createAccount(otherCustomer.id, { balance: 50000n });

      const response = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
        payload: {
          description: 'Unauthorized',
          actorType: ActorType.USER,
          ledger_entries: [
            { accountId: accountDebit.id, amount: '-10000' },
            { accountId: otherAccount.id, amount: '10000' },
          ],
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject transaction with mixed currencies', async () => {
      const usdAccount = await fixtures.createAccount(customerId, {
        currency: AssetCode.USD,
        balance: 10000n,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
        payload: {
          description: 'Mixed currencies',
          actorType: ActorType.USER,
          ledger_entries: [
            { accountId: accountDebit.id, amount: '-10000' },
            { accountId: usdAccount.id, amount: '10000' },
          ],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.body).toContain('currency');
    });
  });

  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      const account1 = await fixtures.createAccount(customerId, { balance: 50000n });
      const account2 = await fixtures.createAccount(customerId, { balance: 0n });

      await fixtures.createTransaction(customerId, [
        { accountId: account1.id, amount: -10000n },
        { accountId: account2.id, amount: 10000n },
      ]);

      await fixtures.createTransaction(customerId, [
        { accountId: account1.id, amount: -5000n },
        { accountId: account2.id, amount: 5000n },
      ]);
    });

    it('should list all user transactions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.transactions).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });

    it('should paginate transactions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/transactions?page=1&limit=1',
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.transactions).toHaveLength(1);
      expect(body.pagination.totalPages).toBe(2);
    });

    it('should not show other users transactions', async () => {
      const otherCustomer = await fixtures.createCustomer({ email: 'other@test.com' });
      const otherAcc1 = await fixtures.createAccount(otherCustomer.id, { balance: 10000n });
      const otherAcc2 = await fixtures.createAccount(otherCustomer.id);
      await fixtures.createTransaction(otherCustomer.id, [
        { accountId: otherAcc1.id, amount: -5000n },
        { accountId: otherAcc2.id, amount: 5000n },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/transactions',
        headers: authHelper.getAuthHeader(token),
      });

      const body = JSON.parse(response.body);
      expect(body.transactions).toHaveLength(2);
    });

    it('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/transactions',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/transactions/:id', () => {
    let transactionId: string;
    let account1: any;
    let account2: any;

    beforeEach(async () => {
      account1 = await fixtures.createAccount(customerId, { balance: 50000n });
      account2 = await fixtures.createAccount(customerId);
      const transaction = await fixtures.createTransaction(customerId, [
        { accountId: account1.id, amount: -10000n },
        { accountId: account2.id, amount: 10000n },
      ]);
      transactionId = transaction.id;
    });

    it('should get transaction by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/transactions/${transactionId}`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(transactionId);
      expect(body.ledger_entries).toHaveLength(2);
    });

    it('should reject access to other users transaction', async () => {
      const otherCustomer = await fixtures.createCustomer({ email: 'other@test.com' });
      const otherAcc1 = await fixtures.createAccount(otherCustomer.id, { balance: 10000n });
      const otherAcc2 = await fixtures.createAccount(otherCustomer.id);
      const otherTransaction = await fixtures.createTransaction(otherCustomer.id, [
        { accountId: otherAcc1.id, amount: -5000n },
        { accountId: otherAcc2.id, amount: 5000n },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/transactions/${otherTransaction.id}`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/transactions/00000000-0000-0000-0000-000000000000`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
