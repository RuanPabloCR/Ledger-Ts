import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';
import { z } from 'zod';
import { Account } from './account.js';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string = '';

  @Column({ unique: true })
  email: string = '';

  @Column()
  password: string = '';

  @Column()
  name: string = '';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date = new Date();

  @OneToMany(() => Account, account => account.owner)
  accounts: Account[] = [];

  get props() {
    return {
      id: this.id,
      email: this.email,
      password: this.password,
      name: this.name,
      account: this.accounts,
    };
  }

  static schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
  });

  static create(data: z.infer<typeof Customer.schema>) {
    const customer = new Customer();
    Object.assign(customer, data);
    return customer;
  }
}   