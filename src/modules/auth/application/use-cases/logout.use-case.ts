import type { AuthPersistencePort } from "../../domain/ports/auth-persistence.port.js";
import type { TokenServicePort } from "../../domain/ports/token-service.port.js";

export type LogoutInput = {
  refresh_token: string;
};

export class LogoutUseCase {
  constructor(
    private readonly deps: {
      authPersistence: AuthPersistencePort;
      tokenService: TokenServicePort;
    },
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const payload = this.deps.tokenService.verifyRefreshToken(input.refresh_token);
    const token_hash = this.deps.tokenService.hashToken(input.refresh_token);

    await this.deps.authPersistence.revokeRefreshTokens({
      usuario_id: payload.id,
      token_hash,
    });
  }
}

