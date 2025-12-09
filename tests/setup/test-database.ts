import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { Customer } from '../../src/models/customer.js';
import { Account } from '../../src/models/account.js';
import { Transaction } from '../../src/models/transaction.js';
import { LedgerEntry } from '../../src/models/ledgerEntry.js';

export class TestDatabase {
  private container?: StartedPostgreSqlContainer;
  private dataSource?: DataSource;

  async start(): Promise<DataSource> {
    console.log('🐳 Starting PostgreSQL container...');

    this.container = await new PostgreSqlContainer('postgres:15-alpine')
      .withExposedPorts(5432)
      .start();

    console.log(`✅ PostgreSQL container started on port ${this.container.getMappedPort(5432)}`);

    this.dataSource = new DataSource({
      type: 'postgres',
      host: this.container.getHost(),
      port: this.container.getMappedPort(5432),
      username: this.container.getUsername(),
      password: this.container.getPassword(),
      database: this.container.getDatabase(),
      synchronize: true,
      logging: false,
      entities: [Customer, Account, Transaction, LedgerEntry],
    });

    await this.dataSource.initialize();
    console.log('✅ Database initialized');

    return this.dataSource;
  }

  async clear(): Promise<void> {
    if (!this.dataSource) return;

    await this.dataSource.query('TRUNCATE TABLE ledger_entries CASCADE');
    await this.dataSource.query('TRUNCATE TABLE transactions CASCADE');
    await this.dataSource.query('TRUNCATE TABLE accounts CASCADE');
    await this.dataSource.query('TRUNCATE TABLE customers CASCADE');
  }

  async stop(): Promise<void> {
    if (this.dataSource) {
      await this.dataSource.destroy();
    }
    if (this.container) {
      await this.container.stop();
      console.log('🛑 PostgreSQL container stopped');
    }
  }
}
