import { Repository } from 'typeorm';
import { Account, AccountType, AssetCode } from '../models/account.js';
import { Customer } from '../models/customer.js';
import { Transaction } from '../models/transaction.js';
import { AppDataSource } from '../data-source.js';

export class AccountService {
  private accountRepository: Repository<Account>;
  private customerRepository: Repository<Customer>;
  private transactionRepository: Repository<Transaction>;

  constructor() {
    this.accountRepository = AppDataSource.getRepository(Account);
    this.customerRepository = AppDataSource.getRepository(Customer);
    this.transactionRepository = AppDataSource.getRepository(Transaction);
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
      balance: 0,
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

    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: [{ sourceAccountId: id }, { targetAccountId: id }],
        relations: ['sourceAccount', 'targetAccount'],
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }
    );

    return {
      accountId: account.id,
      transactions,
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

  async delete(id: string) {
    const account = await this.findById(id);

    if (account.balance > 0) {
      throw new Error('Cannot delete account with positive balance');
    }

    const transactionsCount = await this.transactionRepository.count({
      where: [{ sourceAccountId: id }, { targetAccountId: id }],
    });

    if (transactionsCount > 0) {
      throw new Error('Cannot delete account with transaction history');
    }

    await this.accountRepository.remove(account);

    return { message: 'Account deleted successfully' };
  }
}
