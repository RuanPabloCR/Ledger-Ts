import { Repository } from 'typeorm';
import { Transaction, ActorType } from '../models/transaction.js';
import { LedgerEntry } from '../models/ledgerEntry.js';
import { Account } from '../models/account.js';
import { AppDataSource } from '../data-source.js';

export class TransactionService {
  private transactionRepository: Repository<Transaction>;
  private ledgerEntryRepository: Repository<LedgerEntry>;
  private accountRepository: Repository<Account>;

  constructor() {
    this.transactionRepository = AppDataSource.getRepository(Transaction);
    this.ledgerEntryRepository = AppDataSource.getRepository(LedgerEntry);
    this.accountRepository = AppDataSource.getRepository(Account);
  }

  async create(
    data: {
      description: string;
      actorId: string;
      actorType: ActorType;
      ledger_entries: Array<{
        accountId: string;
        amount: bigint;
      }>;
    },
    authenticatedUserId: string
  ) {
    const sum = data.ledger_entries.reduce((acc, entry) => acc + entry.amount, 0n);
    if (sum !== 0n) {
      throw new Error('Transaction must balance: sum of all ledger entries must be zero');
    }

    if (data.ledger_entries.length < 2) {
      throw new Error('Transaction must have at least 2 ledger entries');
    }

    if (data.ledger_entries.some(entry => entry.amount === 0n)) {
      throw new Error('Ledger entries cannot have zero amount');
    }

    const accountIds = data.ledger_entries.map(entry => entry.accountId);
    const accounts = await this.accountRepository.find({
      where: accountIds.map(id => ({ id })),
    });

    if (accounts.length !== accountIds.length) {
      throw new Error('One or more accounts not found');
    }

    const unauthorizedAccounts = accounts.filter(
      account => account.ownerId !== authenticatedUserId
    );

    if (unauthorizedAccounts.length > 0) {
      throw new Error('Forbidden: You can only create transactions with your own accounts');
    }

    const currencies = [...new Set(accounts.map(acc => acc.currency))];
    if (currencies.length > 1) {
      throw new Error('All accounts in a transaction must have the same currency');
    }

    for (const entry of data.ledger_entries) {
      const account = accounts.find(acc => acc.id === entry.accountId);
      if (!account) continue;

      if (account.type === 'ASSET') {
        const newBalance = account.balance + entry.amount;
        if (newBalance < 0n) {
          throw new Error(
            `Insufficient balance in account ${account.name}. Current: ${account.balance}, Required: ${-entry.amount}`
          );
        }
      }
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = Transaction.create({
        description: data.description,
        actorId: data.actorId,
        actorType: data.actorType,
        ledger_entries: [],
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      const ledgerEntries: LedgerEntry[] = [];
      for (const entryData of data.ledger_entries) {
        const entry = LedgerEntry.create({
          transactionId: savedTransaction.id,
          accountId: entryData.accountId,
          amount: entryData.amount,
        });

        const savedEntry = await queryRunner.manager.save(entry);
        ledgerEntries.push(savedEntry);

        const account = await queryRunner.manager.findOne(Account, {
          where: { id: entryData.accountId },
        });
        if (account) {
          account.balance = account.balance + entryData.amount;
          await queryRunner.manager.save(account);
        }
      }

      await queryRunner.commitTransaction();

      return {
        ...savedTransaction,
        ledger_entries: ledgerEntries,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findById(id: string, authenticatedUserId: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { id },
      relations: ['ledger_entries', 'ledger_entries.account'],
    });

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const accounts = transaction.ledger_entries?.map(entry => entry.account).filter(Boolean) || [];
    const unauthorizedAccounts = accounts.filter(
      account => account && account.ownerId !== authenticatedUserId
    );

    if (unauthorizedAccounts.length > 0) {
      throw new Error('Forbidden: You can only view your own transactions');
    }

    return transaction;
  }

  async findAll(
    filters: {
      accountId?: string;
      page?: number;
      limit?: number;
    },
    authenticatedUserId: string
  ) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 10, 100);
    const skip = (page - 1) * limit;

    let query = this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.ledger_entries', 'ledger_entry')
      .leftJoinAndSelect('ledger_entry.account', 'account')
      .where('account.ownerId = :userId', { userId: authenticatedUserId });

    if (filters.accountId) {

      const account = await this.accountRepository.findOne({
        where: { id: filters.accountId },
      });

      if (!account) {
        throw new Error('Account not found');
      }

      if (account.ownerId !== authenticatedUserId) {
        throw new Error('Forbidden: You can only view transactions from your own accounts');
      }

      query = query.andWhere('ledger_entry.accountId = :accountId', {
        accountId: filters.accountId,
      });
    }

    const [transactions, total] = await query
      .orderBy('transaction.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}