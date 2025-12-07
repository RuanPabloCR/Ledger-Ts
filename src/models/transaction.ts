import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { z } from 'zod';
import { Account } from './account.js';
import { LedgerEntry } from './ledgerEntry.js';

export enum ActorType {
  USER = 'USER',
  SYSTEM = 'SYSTEM',
  WEBHOOK = 'WEBHOOK'
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string = '';

  @Column('text')
  description: string = '';

  @Column('uuid')
  actorId: string = '';

  @Column({
    type: 'enum',
    enum: ActorType,
    default: ActorType.USER
  })
  actorType: ActorType = ActorType.USER;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date = new Date();

  @OneToMany(() => LedgerEntry, ledgerEntry => ledgerEntry.transaction, {
    cascade: true 
  })
  ledger_entries?: LedgerEntry[];

  get props() {
    return {
      id: this.id,
      description: this.description,
      actorId: this.actorId,
      actorType: this.actorType,
      createdAt: this.createdAt,
      ledger_entries: this.ledger_entries,
    };
  }

  static schema = z.object({
    description: z.string().min(1),
    actorId: z.string().uuid(),
    actorType: z.nativeEnum(ActorType).default(ActorType.USER),
    ledger_entries: z.array(z.object({
      accountId: z.string().uuid(),
      amount: z.bigint(),
    })).min(2),
  });

  static responseSchema = z.object({
    id: z.string().uuid(),
    description: z.string(),
    actorId: z.string().uuid(),
    actorType: z.nativeEnum(ActorType),
    createdAt: z.date(),
    ledger_entries: z.array(z.object({
      id: z.string().uuid(),
      accountId: z.string().uuid(),
      amount: z.bigint(),
    })),
  });

  static create(data: z.infer<typeof Transaction.schema>) {
    const transaction = new Transaction();
    Object.assign(transaction, {
      description: data.description,
      actorId: data.actorId,
      actorType: data.actorType,
    });
    return transaction;
  }
}