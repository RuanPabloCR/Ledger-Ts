import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { z } from 'zod';
import { Customer } from './customer.js';
import { Transaction } from './transaction.js';

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY'
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string = '';

  @Column()
  name: string = '';

  @Column({ name: 'owner_id' })
  ownerId: string = '';

  @Column({
    type: 'enum',
    enum: AccountType,
  })
  type: AccountType = AccountType.ASSET;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  balance: number = 0;

  @Column({
    type: 'enum',
    enum: ['BRL', 'USD', 'GBP'],
    default: 'BRL'
  })
  currency: AssetCode = 'BRL';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date = new Date();

  @ManyToOne(() => Customer, customer => customer.accounts)
  owner?: Customer;

  @OneToMany(() => Transaction, transaction => transaction.sourceAccount)
  outgoingTransactions: Transaction[] = [];

  @OneToMany(() => Transaction, transaction => transaction.targetAccount)
  incomingTransactions: Transaction[] = [];

  get props() {
    return {
      id: this.id,
      name: this.name,
      ownerId: this.ownerId,
      type: this.type,
      balance: this.balance,
      currency: this.currency,
    };
  }

  static schema = z.object({
    name: z.string().min(1),
    type: z.enum(["ASSET", "LIABILITY", "EQUITY"]),
    balance: z.number().min(0),
    currency: z.enum(["BRL", "USD", "GBP"]).default("BRL"),
  });

  static create(data: z.infer<typeof Account.schema> & { ownerId: string }) {
    const account = new Account();
    Object.assign(account, data);
    return account;
  }
}
 