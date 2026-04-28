import { ApiError } from "../../../../shared/http/error-handler.js";
import { Prisma } from "@prisma/client";
import type {
  AuthPersistencePort,
  AuthUserPayload,
} from "../../domain/ports/auth-persistence.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { TokenServicePort } from "../../domain/ports/token-service.port.js";

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginOutput = {
  access_token: string;
  refresh_token: string;
  user: AuthUserPayload;
};

export class LoginUseCase {
  constructor(
    private readonly deps: {
      authPersistence: AuthPersistencePort;
      passwordHasher: PasswordHasherPort;
      tokenService: TokenServicePort;
    },
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.deps.authPersistence.findUserByEmail(input.email);
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Credenciales invalidas");
    }

    const valid = await this.deps.passwordHasher.verify(user.password_hash, input.password);
    if (!valid) {
      throw new ApiError(401, "UNAUTHORIZED", "Credenciales invalidas");
    }

    const payload: AuthUserPayload = {
      id: user.id,
      role: user.role,
      cliente_id: user.cliente_id,
      email: user.email,
    };

    let access_token: string;
    let refresh_token: string;
    let expires_at: Date;

    try {
      access_token = this.deps.tokenService.signAccessToken(payload);
      refresh_token = this.deps.tokenService.signRefreshToken(payload);
      expires_at = this.deps.tokenService.getRefreshTokenExpirationDate(refresh_token);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(500, "AUTH_TOKEN_ERROR", "No se pudo generar sesion");
    }

    try {
      await this.deps.authPersistence.createRefreshToken({
        usuario_id: user.id,
        token_hash: this.deps.tokenService.hashToken(refresh_token),
        expires_at,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ApiError(503, "AUTH_STORAGE_ERROR", "No se pudo guardar la sesion");
      }
      throw error;
    }

    return { access_token, refresh_token, user: payload };
  }
}

