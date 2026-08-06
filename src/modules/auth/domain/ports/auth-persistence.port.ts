import type { AuthRole } from "../../../../shared/security/roles.js";

export type { AuthRole };
export type AuthUserPayload = {
  id: string;
  role: AuthRole;
  cliente_id: string | null;
  email: string;
};

export type PersistedAuthUser = {
  id: string;
  role: AuthRole;
  cliente_id: string | null;
  email: string;
  password_hash: string | null;
  is_active: boolean;
  activated_at: Date | null;
};

export type PersistedCliente = {
  id: string;
  email: string;
};

export type ActiveRefreshToken = {
  id: string;
  usuario_id: string;
  token_hash: string;
  revoked_at: Date | null;
  session_expires_at: Date;
  last_used_at: Date;
};

export type AuthPersistenceRotateRefreshTokenInput = {
  existingRefreshTokenId: string;
  usuario_id: string;
  newTokenHash: string;
  newExpiresAt: Date;
  session_expires_at: Date;
  last_used_at: Date;
};

export type AuthPersistenceRevokeRefreshTokensInput = {
  usuario_id: string;
  token_hash: string;
};

export type RegistrationInvitation = {
  email: string;
  role: "analista_legal" | "abogada_junior" | "cliente";
  expires_at: Date;
};

export type ActivateStaffByInvitationInput = {
  activation_token_hash: string;
  password_hash: string;
  now: Date;
};

export type ActivateStaffByInvitationResult = {
  id: string;
  email: string;
  role: "analista_legal" | "abogada_junior" | "cliente";
};

export interface AuthPersistencePort {
  findUserByEmail(email: string): Promise<PersistedAuthUser | null>;
  findClienteByEmail(email: string): Promise<PersistedCliente | null>;

  createUserForCliente(input: {
    email: string;
    password_hash: string;
    role: "cliente";
    cliente_id: string;
  }): Promise<AuthUserPayload>;

  findValidRegistrationInvitation(
    activation_token_hash: string,
    now: Date,
  ): Promise<RegistrationInvitation | null>;

  activateStaffByInvitation(
    input: ActivateStaffByInvitationInput,
  ): Promise<ActivateStaffByInvitationResult | null>;

  createRefreshToken(input: {
    usuario_id: string;
    token_hash: string;
    expires_at: Date;
    session_expires_at: Date;
    last_used_at: Date;
  }): Promise<{ id: string }>;

  findActiveRefreshToken(input: {
    usuario_id: string;
    token_hash: string;
  }): Promise<ActiveRefreshToken | null>;

  rotateRefreshToken(
    input: AuthPersistenceRotateRefreshTokenInput,
  ): Promise<{ newRefreshTokenId: string }>;

  touchRefreshTokenLastUsed(input: { id: string; last_used_at: Date }): Promise<void>;

  revokeRefreshTokens(input: AuthPersistenceRevokeRefreshTokensInput): Promise<void>;
}
