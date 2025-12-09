import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { TestDatabase } from '../setup/test-database.js';
import { createTestServer } from '../setup/test-server.js';
import { AuthHelper } from '../helpers/auth-helper.js';
import { TestFixtures } from '../setup/fixtures.js';
import { AccountType, AssetCode } from '../../src/models/account.js';

describe('Account Routes', () => {
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

  describe('POST /api/accounts', () => {
    it('should create a new account with valid data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: authHelper.getAuthHeader(token),
        payload: {
          name: 'Checking Account',
          type: AccountType.ASSET,
          currency: AssetCode.BRL,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Checking Account');
      expect(body.type).toBe(AccountType.ASSET);
      expect(body.ownerId).toBe(customerId);
      expect(body.balance).toBe('0');
    });

    it('should create account with default currency', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: authHelper.getAuthHeader(token),
        payload: {
          name: 'Savings',
          type: AccountType.ASSET,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.currency).toBe(AssetCode.BRL);
    });

    it('should reject creation without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        payload: {
          name: 'Checking Account',
          type: AccountType.ASSET,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject empty account name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/accounts',
        headers: authHelper.getAuthHeader(token),
        payload: {
          name: '',
          type: AccountType.ASSET,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/accounts', () => {
    beforeEach(async () => {
      await fixtures.createAccount(customerId, { name: 'Account 1', type: AccountType.ASSET });
      await fixtures.createAccount(customerId, { name: 'Account 2', type: AccountType.LIABILITY });
      await fixtures.createAccount(customerId, { name: 'Account 3', type: AccountType.EQUITY });
    });

    it('should list all user accounts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts',
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accounts).toHaveLength(3);
      expect(body.pagination.total).toBe(3);
    });

    it('should filter accounts by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts?type=ASSET',
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accounts).toHaveLength(1);
      expect(body.accounts[0].type).toBe(AccountType.ASSET);
    });

    it('should paginate results', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts?page=1&limit=2',
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accounts).toHaveLength(2);
      expect(body.pagination.totalPages).toBe(2);
    });

    it('should not show other users accounts', async () => {
      const otherCustomer = await fixtures.createCustomer({ email: 'other@test.com' });
      await fixtures.createAccount(otherCustomer.id, { name: 'Other Account' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts',
        headers: authHelper.getAuthHeader(token),
      });

      const body = JSON.parse(response.body);
      expect(body.accounts.every((acc: any) => acc.ownerId === customerId)).toBe(true);
    });

    it('should reject without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/accounts',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/accounts/:id', () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await fixtures.createAccount(customerId, { name: 'Test Account' });
      accountId = account.id;
    });

    it('should get account by id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/accounts/${accountId}`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(accountId);
      expect(body.name).toBe('Test Account');
    });

    it('should reject access to other users account', async () => {
      const otherCustomer = await fixtures.createCustomer({ email: 'other@test.com' });
      const otherAccount = await fixtures.createAccount(otherCustomer.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/accounts/${otherAccount.id}`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 404 for non-existent account', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/accounts/00000000-0000-0000-0000-000000000000`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/accounts/:id/balance', () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await fixtures.createAccount(customerId, { 
        name: 'Test Account',
        balance: 10000n,
      });
      accountId = account.id;
    });

    it('should get account balance', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/accounts/${accountId}/balance`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accountId).toBe(accountId);
      expect(body.balance).toBe('10000');
      expect(body.currency).toBeDefined();
    });

    it('should reject access to other users account balance', async () => {
      const otherCustomer = await fixtures.createCustomer({ email: 'other@test.com' });
      const otherAccount = await fixtures.createAccount(otherCustomer.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/accounts/${otherAccount.id}/balance`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('PUT /api/accounts/:id', () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await fixtures.createAccount(customerId, { name: 'Old Name' });
      accountId = account.id;
    });

    it('should update account name', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/accounts/${accountId}`,
        headers: authHelper.getAuthHeader(token),
        payload: {
          name: 'New Account Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('New Account Name');
    });

    it('should reject update of other users account', async () => {
      const otherCustomer = await fixtures.createCustomer({ email: 'other@test.com' });
      const otherAccount = await fixtures.createAccount(otherCustomer.id);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/accounts/${otherAccount.id}`,
        headers: authHelper.getAuthHeader(token),
        payload: { name: 'Hacked Name' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject empty name', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/accounts/${accountId}`,
        headers: authHelper.getAuthHeader(token),
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/accounts/:id/ledger-entries', () => {
    let accountId: string;

    beforeEach(async () => {
      const account = await fixtures.createAccount(customerId, { balance: 10000n });
      const account2 = await fixtures.createAccount(customerId, { balance: 0n });
      accountId = account.id;

      await fixtures.createTransaction(customerId, [
        { accountId: account.id, amount: -5000n },
        { accountId: account2.id, amount: 5000n },
      ]);
    });

    it('should get account ledger entries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/accounts/${accountId}/ledger-entries`,
        headers: authHelper.getAuthHeader(token),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.accountId).toBe(accountId);
      expect(body.entries).toBeInstanceOf(Array);
      expect(body.pagination).toBeDefined();
    });
  });
});
