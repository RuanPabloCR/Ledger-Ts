import { Repository, DataSource } from 'typeorm';
import { Account, AccountType, AssetCode } from '../models/account.js';
import { Customer } from '../models/customer.js';
import { Transaction } from '../models/transaction.js';
import { LedgerEntry } from '../models/ledgerEntry.js';
import { AppDataSource } from '../data-source.js';

export class AccountService {
  private accountRepository: Repository<Account>;
  private customerRepository: Repository<Customer>;
  private transactionRepository: Repository<Transaction>;
  private ledgerEntryRepository: Repository<LedgerEntry>;

  constructor(dataSource?: DataSource) {
    const ds = dataSource || AppDataSource;
    this.accountRepository = ds.getRepository(Account);
    this.customerRepository = ds.getRepository(Customer);
    this.transactionRepository = ds.getRepository(Transaction);
    this.ledgerEntryRepository = ds.getRepository(LedgerEntry);
  }

  async create(data: {
    name: string;
    type: AccountType;
    currency: AssetCode;
    ownerId: string;
  }) {

    const customer = await this.customerRepository.findOne({
      where: { id: data.ownerId },
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const account = Account.create({
      ...data,
      balance: 0n,
    });

    await this.accountRepository.save(account);

    return account;
  }

  async findAll(filters?: {
    type?: AccountType;
    currency?: AssetCode;
    ownerId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 10, 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters?.type) where.type = filters.type;
    if (filters?.currency) where.currency = filters.currency;
    if (filters?.ownerId) where.ownerId = filters.ownerId;

    const [accounts, total] = await this.accountRepository.findAndCount({
      where,
      relations: ['owner'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      accounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const account = await this.accountRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!account) {
      throw new Error('Account not found');
    }

    return account;
  }

  async getBalance(id: string) {
    const account = await this.findById(id);

    return {
      accountId: account.id,
      balance: account.balance,
      currency: account.currency,
    };
  }

  async recalculateBalance(accountId: string): Promise<bigint> {
    const ledgerEntries = await this.ledgerEntryRepository.find({
      where: { accountId },
    });

    let totalBalance = 0n;
    for (const entry of ledgerEntries) {
      totalBalance += entry.amount;
    }

    await this.accountRepository.update(accountId, { balance: totalBalance });

    return totalBalance;
  }

  async getBalanceRealTime(id: string): Promise<{
    accountId: string;
    balance: bigint;
    cachedBalance: bigint;
    currency: AssetCode;
    inSync: boolean;
  }> {
    const account = await this.findById(id);
    const realTimeBalance = await this.recalculateBalance(id);
    
    return {
      accountId: account.id,
      balance: realTimeBalance,
      cachedBalance: account.balance,
      currency: account.currency,
      inSync: realTimeBalance === account.balance,
    };
  }

  async getLedgerEntries(
    accountId: string,
    filters?: {
      page?: number;
      limit?: number;
    }
  ): Promise<{
    accountId: string;
    entries: LedgerEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {

    // Verificar se a conta existe kk
    await this.findById(accountId);

    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 10, 100);
    const skip = (page - 1) * limit;

    const [entries, total] = await this.ledgerEntryRepository.findAndCount({
      where: { accountId },
      relations: ['transaction'],
      skip,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      accountId,
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactions(
    id: string,
    filters?: {
      page?: number;
      limit?: number;
    }
  ) {
    const account = await this.findById(id);

    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 10, 100);
    const skip = (page - 1) * limit;

    const ledgerEntries = await this.ledgerEntryRepository.find({
      where: { accountId: id },
      relations: ['transaction'],
      order: { createdAt: 'DESC' },
    });

    const uniqueTransactions = Array.from(
      new Map(ledgerEntries.map(entry => [entry.transaction?.id, entry.transaction])).values()
    ).filter(t => t !== undefined) as Transaction[];

    const total = uniqueTransactions.length;
    const paginatedTransactions = uniqueTransactions.slice(skip, skip + limit);

    return {
      accountId: account.id,
      transactions: paginatedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(
    id: string,
    data: {
      name?: string;
    }
  ) {
    const account = await this.findById(id);

    if (data.name !== undefined) {
      account.name = data.name;
    }

    await this.accountRepository.save(account);

    return account;
  }
}
