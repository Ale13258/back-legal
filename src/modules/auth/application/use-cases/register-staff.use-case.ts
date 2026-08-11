import { ApiError } from "../../../../shared/http/error-handler.js";
import { hashToken } from "../../../../shared/security/jwt.js";
import type { AuthPersistencePort } from "../../domain/ports/auth-persistence.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";

export type RegisterStaffInput = {
  token: string;
  password: string;
  confirm_password: string;
};

export type RegisterStaffOutput = {
  id: string;
  email: string;
  role: "analista_legal" | "abogada_junior" | "cliente";
  status: "active";
};

export class RegisterStaffUseCase {
  constructor(
    private readonly deps: {
      authPersistence: AuthPersistencePort;
      passwordHasher: PasswordHasherPort;
    },
  ) {}

  async execute(input: RegisterStaffInput): Promise<RegisterStaffOutput> {
    if (input.password !== input.confirm_password) {
      throw new ApiError(400, "VALIDATION_ERROR", "Las contraseñas no coinciden");
    }

    const token = input.token.trim();
    if (!token) {
      throw new ApiError(400, "VALIDATION_ERROR", "Token invalido");
    }

    const password_hash = await this.deps.passwordHasher.hash(input.password);
    const activated = await this.deps.authPersistence.activateStaffByInvitation({
      activation_token_hash: hashToken(token),
      password_hash,
      now: new Date(),
    });

    if (!activated) {
      throw new ApiError(400, "INVALID_INVITATION", "Invitacion invalida o expirada");
    }

    return {
      id: activated.id,
      email: activated.email,
      role: activated.role,
      status: "active",
    };
  }
}
