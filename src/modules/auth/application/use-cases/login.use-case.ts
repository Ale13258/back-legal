import { ApiError } from "../../../../shared/http/error-handler.js";
import {
  getPrismaErrorCode,
  isPrismaKnownRequestError,
} from "../../../../shared/infrastructure/prisma/prisma-errors.js";
import {
  computeSessionExpiresAt,
  getIdleTimeoutSeconds,
  minDate,
} from "../../../../shared/security/session-policy.js";
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
  expires_in: number;
  session_expires_at: string;
  idle_timeout_seconds: number;
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
    // Pendientes (sin password/activación) e inactivos: mismo 401 genérico.
    if (
      !user ||
      !user.is_active ||
      user.activated_at == null ||
      user.password_hash == null
    ) {
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
    const now = new Date();
    const session_expires_at = computeSessionExpiresAt(now);

    try {
      access_token = this.deps.tokenService.signAccessToken(payload);
      refresh_token = this.deps.tokenService.signRefreshToken(payload);
      const jwtRefreshExpiresAt = this.deps.tokenService.getRefreshTokenExpirationDate(refresh_token);
      expires_at = minDate(jwtRefreshExpiresAt, session_expires_at);
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
        session_expires_at,
        last_used_at: now,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (isPrismaKnownRequestError(error)) {
        const prisma_code = getPrismaErrorCode(error);
        console.error("auth_storage_error", { code: prisma_code, error });
        throw new ApiError(503, "AUTH_STORAGE_ERROR", "No se pudo guardar la sesion", {
          prisma_code,
        });
      }
      throw error;
    }

    return {
      access_token,
      refresh_token,
      expires_in: this.deps.tokenService.getAccessTokenExpiresInSeconds(access_token),
      session_expires_at: session_expires_at.toISOString(),
      idle_timeout_seconds: getIdleTimeoutSeconds(),
      user: payload,
    };
  }
}

