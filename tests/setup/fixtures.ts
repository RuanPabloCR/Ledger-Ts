import { Customer } from '../../src/models/customer.js';
import { Account, AccountType, AssetCode } from '../../src/models/account.js';
import { Transaction, ActorType } from '../../src/models/transaction.js';
import { LedgerEntry } from '../../src/models/ledgerEntry.js';
import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';

export class TestFixtures {
  constructor(private dataSource: DataSource) {}

  async createCustomer(data?: Partial<Customer>): Promise<Customer> {
    const customerRepo = this.dataSource.getRepository(Customer);
    
    const customer = customerRepo.create({
      email: data?.email || `user-${Date.now()}@test.com`,
      name: data?.name || 'Test User',
      password: data?.password 
        ? await bcrypt.hash(data.password, 10)
        : await bcrypt.hash('password123', 10),
    });

    return await customerRepo.save(customer);
  }

  async createAccount(ownerId: string, data?: Partial<Account>): Promise<Account> {
    const accountRepo = this.dataSource.getRepository(Account);
    
    const account = accountRepo.create({
      name: data?.name || `Account ${Date.now()}`,
      ownerId,
      type: data?.type || AccountType.ASSET,
      currency: data?.currency || AssetCode.BRL,
      balance: data?.balance || 0n,
    });

    return await accountRepo.save(account);
  }

  async createTransaction(
    actorId: string,
    ledgerEntries: { accountId: string; amount: bigint }[],
    data?: Partial<Transaction>
  ): Promise<Transaction> {
    const transactionRepo = this.dataSource.getRepository(Transaction);
    const ledgerEntryRepo = this.dataSource.getRepository(LedgerEntry);
    const accountRepo = this.dataSource.getRepository(Account);

    const transaction = transactionRepo.create({
      description: data?.description || 'Test transaction',
      actorId,
      actorType: data?.actorType || ActorType.USER,
    });

    const savedTransaction = await transactionRepo.save(transaction);

    for (const entry of ledgerEntries) {
      const ledgerEntry = ledgerEntryRepo.create({
        transactionId: savedTransaction.id,
        accountId: entry.accountId,
        amount: entry.amount,
      });
      await ledgerEntryRepo.save(ledgerEntry);

      // Update account balance
      const account = await accountRepo.findOne({ where: { id: entry.accountId } });
      if (account) {
        account.balance = account.balance + entry.amount;
        await accountRepo.save(account);
      }
    }

    return savedTransaction;
  }

  async clearAll(): Promise<void> {
    const entities = this.dataSource.entityMetadatas;
    
    await this.dataSource.query('SET session_replication_role = replica;');
    
    for (const entity of entities) {
      const repository = this.dataSource.getRepository(entity.name);
      await repository.clear();
    }
    
    await this.dataSource.query('SET session_replication_role = DEFAULT;');
  }
}
