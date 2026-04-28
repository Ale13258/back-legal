import type { AuthUserPayload } from "../../domain/ports/auth-persistence.port.js";
import type { TokenServicePort } from "../../domain/ports/token-service.port.js";
import {
  getRefreshTokenExpirationDate,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../../../shared/security/jwt.js";

export class JwtTokenService implements TokenServicePort {
  signAccessToken(payload: AuthUserPayload): string {
    return signAccessToken(payload);
  }

  signRefreshToken(payload: AuthUserPayload): string {
    return signRefreshToken(payload);
  }

  verifyRefreshToken(token: string): AuthUserPayload {
    return verifyRefreshToken(token) as AuthUserPayload;
  }

  getRefreshTokenExpirationDate(token: string): Date {
    return getRefreshTokenExpirationDate(token);
  }

  hashToken(token: string): string {
    return hashToken(token);
  }
}

