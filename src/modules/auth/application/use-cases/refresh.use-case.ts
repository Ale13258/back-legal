import { ApiError } from "../../../../shared/http/error-handler.js";
import { Prisma } from "@prisma/client";
import type {
  AuthPersistencePort,
  AuthUserPayload,
} from "../../domain/ports/auth-persistence.port.js";
import type { TokenServicePort } from "../../domain/ports/token-service.port.js";

export type RefreshInput = {
  refresh_token: string;
};

export type RefreshOutput = {
  access_token: string;
  refresh_token: string;
};

export class RefreshUseCase {
  constructor(
    private readonly deps: {
      authPersistence: AuthPersistencePort;
      tokenService: TokenServicePort;
    },
  ) {}

  async execute(input: RefreshInput): Promise<RefreshOutput> {
    let payload: AuthUserPayload;
    let token_hash: string;

    try {
      payload = this.deps.tokenService.verifyRefreshToken(input.refresh_token);
      token_hash = this.deps.tokenService.hashToken(input.refresh_token);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token invalido");
    }

    const savedToken = await this.deps.authPersistence.findActiveRefreshToken({
      usuario_id: payload.id,
      token_hash,
    });

    if (!savedToken) {
      throw new ApiError(401, "UNAUTHORIZED", "Refresh token revocado o invalido");
    }

    let access_token: string;
    let refresh_token: string;
    let newExpiresAt: Date;
    try {
      access_token = this.deps.tokenService.signAccessToken(payload);
      refresh_token = this.deps.tokenService.signRefreshToken(payload);
      newExpiresAt = this.deps.tokenService.getRefreshTokenExpirationDate(refresh_token);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "AUTH_TOKEN_ERROR", "No se pudo renovar la sesion");
    }

    try {
      await this.deps.authPersistence.rotateRefreshToken({
        existingRefreshTokenId: savedToken.id,
        usuario_id: payload.id,
        newTokenHash: this.deps.tokenService.hashToken(refresh_token),
        newExpiresAt,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new ApiError(503, "AUTH_STORAGE_ERROR", "No se pudo renovar la sesion");
      }
      throw error;
    }

    return { access_token, refresh_token };
  }
}

