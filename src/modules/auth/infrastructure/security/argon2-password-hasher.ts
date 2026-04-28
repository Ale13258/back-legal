import argon2 from "argon2";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";

export class Argon2PasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    return argon2.verify(hash, plain);
  }
}

