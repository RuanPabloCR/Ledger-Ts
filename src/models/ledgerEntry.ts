import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { z } from 'zod';
import { Account } from './account.js';
import { Transaction } from './transaction.js';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'transaction_id' })
  transactionId: string = '';

  @Column('uuid', { name: 'account_id' })
  accountId: string = '';

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: bigint | undefined) => value !== undefined ? value.toString() : '0',
      from: (value: string) => BigInt(value || '0'),
    },
  })
  amount: bigint = 0n;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date = new Date();

  @ManyToOne(() => Transaction, transaction => transaction.ledger_entries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'transaction_id' })
  transaction?: Transaction;

  @ManyToOne(() => Account, account => account.ledger_entries)
  @JoinColumn({ name: 'account_id' })
  account?: Account;

  static schema = z.object({
    transactionId: z.string().uuid(),
    accountId: z.string().uuid(),
    amount: z.bigint(),
  });

  static responseSchema = z.object({
    id: z.string().uuid(),
    transactionId: z.string().uuid(),
    accountId: z.string().uuid(),
    amount: z.bigint(),
    createdAt: z.date(),
  });

  static create(data: z.infer<typeof LedgerEntry.schema>) {
    const entry = new LedgerEntry();
    Object.assign(entry, data);
    return entry;
  }
}