import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { hashToken } from "../../../../shared/security/jwt.js";
import type { AuthPersistencePort } from "../../domain/ports/auth-persistence.port.js";
import { GetRegistrationInvitationUseCase } from "./get-registration-invitation.use-case.js";

function createPersistence(
  overrides: Partial<AuthPersistencePort> = {},
): AuthPersistencePort {
  return {
    findUserByEmail: async () => null,
    findClienteByEmail: async () => null,
    createUserForCliente: async () => ({
      id: "x",
      email: "x@test.com",
      role: "cliente",
      cliente_id: "c1",
    }),
    findValidRegistrationInvitation: async () => null,
    activateStaffByInvitation: async () => null,
    createRefreshToken: async () => ({ id: "rt" }),
    findActiveRefreshToken: async () => null,
    rotateRefreshToken: async () => ({ newRefreshTokenId: "rt2" }),
    touchRefreshTokenLastUsed: async () => {},
    revokeRefreshTokens: async () => {},
    ...overrides,
  };
}

describe("GetRegistrationInvitationUseCase", () => {
  it("devuelve email y rol para token valido", async () => {
    const token = "plain-token-value";
    let seenHash: string | null = null;

    const useCase = new GetRegistrationInvitationUseCase({
      authPersistence: createPersistence({
        findValidRegistrationInvitation: async (activation_token_hash) => {
          seenHash = activation_token_hash;
          return {
            email: "invitado@test.com",
            role: "abogada_junior",
            expires_at: new Date(Date.now() + 60_000),
          };
        },
      }),
    });

    const result = await useCase.execute({ token });
    assert.deepEqual(result, {
      email: "invitado@test.com",
      role: "abogada_junior",
    });
    assert.equal(seenHash, hashToken(token));
  });

  it("rechaza token invalido o expirado", async () => {
    const useCase = new GetRegistrationInvitationUseCase({
      authPersistence: createPersistence(),
    });

    await assert.rejects(
      () => useCase.execute({ token: "bad" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 400);
        assert.equal(error.code, "INVALID_INVITATION");
        return true;
      },
    );
  });
});
