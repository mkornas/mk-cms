import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: this.normalizeEmail(email) } });
  }

  /** Email lookup that also loads the (normally hidden) password hash, for auth. */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  count(): Promise<number> {
    return this.users.count();
  }

  /** All users, oldest first (user-management listing). */
  list(): Promise<User[]> {
    return this.users.find({ order: { createdAt: 'ASC' } });
  }

  async update(
    id: string,
    patch: { name?: string; status?: UserStatus; isSuperAdmin?: boolean },
  ): Promise<User> {
    await this.users.update(id, patch);
    return this.users.findOneByOrFail({ id });
  }

  /**
   * Self-service profile update for the current user: only the display name
   * and/or avatar. Fields left `undefined` are untouched; passing `avatarUrl:
   * null` explicitly clears the avatar. No-op patches skip the write.
   */
  async updateProfile(
    id: string,
    patch: { name?: string; avatarUrl?: string | null },
  ): Promise<User> {
    const fields: { name?: string; avatarUrl?: string | null } = {};
    if (patch.name !== undefined) fields.name = patch.name;
    if (patch.avatarUrl !== undefined) fields.avatarUrl = patch.avatarUrl;
    if (Object.keys(fields).length > 0) await this.users.update(id, fields);
    return this.users.findOneByOrFail({ id });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.users.update(id, { passwordHash });
  }

  async delete(id: string): Promise<void> {
    await this.users.delete(id);
  }

  create(input: {
    email: string;
    name: string;
    passwordHash: string;
    status?: UserStatus;
    isSuperAdmin?: boolean;
  }): Promise<User> {
    const user = this.users.create({
      email: this.normalizeEmail(input.email),
      name: input.name,
      passwordHash: input.passwordHash,
      status: input.status ?? UserStatus.Active,
      isSuperAdmin: input.isSuperAdmin ?? false,
    });
    return this.users.save(user);
  }
}
