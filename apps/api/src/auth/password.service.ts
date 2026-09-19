import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing via argon2id (through the prebuilt @node-rs/argon2 binary —
 * no native toolchain needed). Parameters are argon2's sensible defaults.
 */
@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  async verify(hashValue: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashValue, plain);
    } catch {
      return false;
    }
  }
}
