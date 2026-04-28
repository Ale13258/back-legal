import type { AuthUserPayload } from "./auth-persistence.port.js";

export interface TokenServicePort {
  signAccessToken(payload: AuthUserPayload): string;
  signRefreshToken(payload: AuthUserPayload): string;
  verifyRefreshToken(token: string): AuthUserPayload;
  getRefreshTokenExpirationDate(token: string): Date;
  hashToken(token: string): string;
}

