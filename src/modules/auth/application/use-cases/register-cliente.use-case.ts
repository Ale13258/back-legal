import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  AuthPersistencePort,
  AuthUserPayload,
} from "../../domain/ports/auth-persistence.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";

export type RegisterClienteInput = {
  email: string;
  password: string;
};

export class RegisterClienteUseCase {
  constructor(
    private readonly deps: {
      authPersistence: AuthPersistencePort;
      passwordHasher: PasswordHasherPort;
    },
  ) {}

  async execute(input: RegisterClienteInput): Promise<AuthUserPayload> {
    const cliente = await this.deps.authPersistence.findClienteByEmail(input.email);
    if (!cliente) {
      throw new ApiError(400, "BUSINESS_RULE_VIOLATION", "El email no existe en clientes");
    }

    const exists = await this.deps.authPersistence.findUserByEmail(input.email);
    if (exists) {
      throw new ApiError(409, "CONFLICT", "El usuario ya existe");
    }

    const password_hash = await this.deps.passwordHasher.hash(input.password);

    return this.deps.authPersistence.createUserForCliente({
      email: input.email,
      password_hash,
      role: "cliente",
      cliente_id: cliente.id,
    });
  }
}

