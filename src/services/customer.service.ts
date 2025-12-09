import { Repository, DataSource } from 'typeorm';
import { Customer } from '../models/customer.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../data-source.js';

const JWT_SECRET = process.env.JWT_SECRET || 'flamengotetracampeao';
const SALT_ROUNDS = 10;

export class CustomerService {
  private customerRepository: Repository<Customer>;

  constructor(dataSource?: DataSource) {
    const ds = dataSource || AppDataSource;
    this.customerRepository = ds.getRepository(Customer);
  }

  async register(data: { email: string; password: string; name: string }) {
    const existingCustomer = await this.customerRepository.findOne({
      where: { email: data.email },
    });

    if (existingCustomer) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    const customer = Customer.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
    });

    await this.customerRepository.save(customer);

    const { password, ...customerWithoutPassword } = customer;
    return customerWithoutPassword;
  }

  async login(data: { email: string; password: string }) {
    const customer = await this.customerRepository.findOne({
      where: { email: data.email },
    });

    if (!customer) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, customer.password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      {
        id: customer.id,
        email: customer.email,
        name: customer.name,
      },
      JWT_SECRET,
      {
        expiresIn: '1d',
      }
    );

    const { password, ...customerWithoutPassword } = customer;

    return {
      customer: customerWithoutPassword,
      token,
    };
  }

  async findById(id: string) {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['accounts'],
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    const { password, ...customerWithoutPassword } = customer;
    return customerWithoutPassword;
  }

  static verifyToken(token: string) {
    try {
      return jwt.verify(token, JWT_SECRET) as {
        id: string;
        email: string;
        name: string;
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
