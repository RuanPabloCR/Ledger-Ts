import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { z } from 'zod';
import { Customer } from './customer.js';
import { Transaction } from './transaction.js';
import { LedgerEntry } from './ledgerEntry.js';

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY'
}

export enum AssetCode{
  BRL = 'BRL',
  USD = 'USD',
  GBP = 'GBP'
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  name: string = '';

  @Column('uuid', { name: 'owner_id' })
  ownerId: string = '';

  @Column({
    type: 'enum',
    enum: AccountType,
  })
  type: AccountType = AccountType.ASSET;

  @Column({
    type: 'bigint',
    default: '0',
    transformer: {
      to: (value: bigint | undefined) => value !== undefined ? value.toString() : '0',
      from: (value: string) => BigInt(value || '0'),
    },
  })
  balance: bigint = 0n;

  @Column({
    type: 'enum',
    enum: AssetCode,
    default: AssetCode.BRL,
  })
  currency: AssetCode = AssetCode.BRL;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date = new Date();

  @ManyToOne(() => Customer, customer => customer.accounts)
  owner?: Customer;

  @OneToMany(() => LedgerEntry, ledgerEntry => ledgerEntry.account)
  ledger_entries?: LedgerEntry[];

  get props() {
    return {
      id: this.id,
      name: this.name,
      ownerId: this.ownerId,
      type: this.type,
      balance: this.balance,
      currency: this.currency,
      createdAt: this.createdAt,
    };
  }

  static schema = z.object({
    name: z.string().min(1),
    type: z.nativeEnum(AccountType),
    balance: z.bigint().default(0n),
    currency: z.nativeEnum(AssetCode).default(AssetCode.BRL),
  });

  static responseSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    ownerId: z.string().uuid(),
    type: z.nativeEnum(AccountType),
    balance: z.bigint(),
    currency: z.nativeEnum(AssetCode),
    createdAt: z.date(),
  });

  static create(data: z.infer<typeof Account.schema> & { ownerId: string }) {
    const account = new Account();
    Object.assign(account, { ...data, balance: data.balance || 0n });
    return account;
  }
}
 