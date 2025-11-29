import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { z } from 'zod';
import { Account } from './account.js';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string = '';

  @Column('uuid', { name: 'source_account_id' })
  sourceAccountId: string = '';

  @Column('uuid', { name: 'target_account_id' })
  targetAccountId: string = '';

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number = 0;

  @Column('uuid', { name: 'prev_transaction_id', nullable: true })
  prevTransactionId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date = new Date();

  @ManyToOne(() => Account, account => account.outgoingTransactions)
  @JoinColumn({ name: 'source_account_id' })
  sourceAccount?: Account | null;

  @ManyToOne(() => Account, account => account.incomingTransactions)
  @JoinColumn({ name: 'target_account_id' })
  targetAccount?: Account | null;

  get props() {
    return {
      id: this.id,
      sourceAccountId: this.sourceAccountId,
      targetAccountId: this.targetAccountId,
      amount: this.amount,
      sourceAccount: this.sourceAccount,
      targetAccount: this.targetAccount,
      prevTransactionId: this.prevTransactionId,
    };
  }

  static schema = z.object({
    sourceAccountId: z.string().uuid(),
    targetAccountId: z.string().uuid(),
    amount: z.number().positive(),
    prevTransactionId: z.string().uuid().optional(),
  });

  static create(data: z.infer<typeof Transaction.schema>) {
    const transaction = new Transaction();
    Object.assign(transaction, data);
    return transaction;
  }
}