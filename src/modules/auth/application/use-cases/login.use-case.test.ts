import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  AuthPersistencePort,
  PersistedAuthUser,
} from "../../domain/ports/auth-persistence.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import type { TokenServicePort } from "../../domain/ports/token-service.port.js";
import { LoginUseCase } from "./login.use-case.js";

const inactiveUser: PersistedAuthUser = {
  id: "u-1",
  email: "inactive@test.com",
  role: "analista_legal",
  cliente_id: null,
  password_hash: "hash",
  is_active: false,
  activated_at: new Date("2026-01-01T00:00:00.000Z"),
};

const pendingUser: PersistedAuthUser = {
  id: "u-2",
  email: "pending@test.com",
  role: "abogada_junior",
  cliente_id: null,
  password_hash: null,
  is_active: false,
  activated_at: null,
};

const activeUser: PersistedAuthUser = {
  id: "u-3",
  email: "active@test.com",
  role: "analista_legal",
  cliente_id: null,
  password_hash: "hash",
  is_active: true,
  activated_at: new Date("2026-01-01T00:00:00.000Z"),
};

const payload = {
  id: inactiveUser.id,
  email: inactiveUser.email,
  role: inactiveUser.role,
  cliente_id: null,
};

function createAuthPersistence(user: PersistedAuthUser | null): AuthPersistencePort {
  return {
    findUserByEmail: async () => user,
    findClienteByEmail: async () => null,
    createUserForCliente: async () => payload,
    findValidRegistrationInvitation: async () => null,
    activateStaffByInvitation: async () => null,
    createRefreshToken: async () => ({ id: "rt-1" }),
    findActiveRefreshToken: async () => null,
    rotateRefreshToken: async () => ({ newRefreshTokenId: "rt-new" }),
    touchRefreshTokenLastUsed: async () => {},
    revokeRefreshTokens: async () => {},
  };
}

function createPasswordHasher(verifyResult = true): PasswordHasherPort {
  return {
    hash: async () => "hash",
    verify: async () => verifyResult,
  };
}

const tokenService: TokenServicePort = {
  signAccessToken: () => "access",
  signRefreshToken: () => "refresh",
  verifyRefreshToken: () => payload,
  hashToken: () => "hashed",
  getRefreshTokenExpirationDate: () => new Date(Date.now() + 60_000),
  getAccessTokenExpiresInSeconds: () => 900,
};

describe("LoginUseCase is_active / pending", () => {
  it("rechaza usuario inactivo con credenciales invalidas", async () => {
    const useCase = new LoginUseCase({
      authPersistence: createAuthPersistence(inactiveUser),
      passwordHasher: createPasswordHasher(true),
      tokenService,
    });

    await assert.rejects(
      () => useCase.execute({ email: inactiveUser.email, password: "x" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        assert.equal(error.code, "UNAUTHORIZED");
        return true;
      },
    );
  });

  it("rechaza usuario pendiente sin verificar password", async () => {
    let verified = false;
    const passwordHasher: PasswordHasherPort = {
      hash: async () => "hash",
      verify: async () => {
        verified = true;
        return true;
      },
    };

    const useCase = new LoginUseCase({
      authPersistence: createAuthPersistence(pendingUser),
      passwordHasher,
      tokenService,
    });

    await assert.rejects(
      () => useCase.execute({ email: pendingUser.email, password: "x" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        assert.equal(error.code, "UNAUTHORIZED");
        return true;
      },
    );
    assert.equal(verified, false);
  });

  it("permite login de usuario activo", async () => {
    const useCase = new LoginUseCase({
      authPersistence: createAuthPersistence(activeUser),
      passwordHasher: createPasswordHasher(true),
      tokenService,
    });

    const result = await useCase.execute({ email: activeUser.email, password: "secret" });
    assert.equal(result.access_token, "access");
    assert.equal(result.user.email, activeUser.email);
  });
});
