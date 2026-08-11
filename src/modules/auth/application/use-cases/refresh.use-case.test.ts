import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { clearRefreshRotationCacheForTests } from "../../../../shared/security/refresh-rotation-cache.js";
import type {
  AuthPersistencePort,
  AuthPersistenceRotateRefreshTokenInput,
  ActiveRefreshToken,
} from "../../domain/ports/auth-persistence.port.js";
import type { TokenServicePort } from "../../domain/ports/token-service.port.js";
import { RefreshUseCase } from "./refresh.use-case.js";

const payload = {
  id: "user-1",
  role: "super_admin" as const,
  cliente_id: null,
  email: "admin@test.com",
};

const sessionExpiresAt = new Date("2026-06-10T12:00:00.000Z");

function createMocks(savedToken: ActiveRefreshToken | null) {
  const authPersistence: AuthPersistencePort = {
    findUserByEmail: async () => null,
    findClienteByEmail: async () => null,
    createUserForCliente: async () => payload,
    findValidRegistrationInvitation: async () => null,
    activateStaffByInvitation: async () => null,
    createRefreshToken: async () => ({ id: "new-id" }),
    findActiveRefreshToken: async () => savedToken,
    rotateRefreshToken: async () => ({ newRefreshTokenId: "rt-new" }),
    touchRefreshTokenLastUsed: async () => {},
    revokeRefreshTokens: async () => {},
  };

  const tokenService: TokenServicePort = {
    signAccessToken: () => "access-new",
    signRefreshToken: () => "refresh-new",
    verifyRefreshToken: () => payload,
    getRefreshTokenExpirationDate: () => new Date(Date.now() + 86_400_000),
    getAccessTokenExpiresInSeconds: () => 900,
    hashToken: (token) => `hash:${token}`,
  };

  return { authPersistence, tokenService };
}

function createSavedToken(overrides: Partial<ActiveRefreshToken> = {}): ActiveRefreshToken {
  return {
    id: "rt-1",
    usuario_id: payload.id,
    token_hash: "hash:refresh-old",
    revoked_at: null,
    session_expires_at: sessionExpiresAt,
    last_used_at: new Date(),
    ...overrides,
  };
}

describe("RefreshUseCase", () => {
  beforeEach(() => {
    clearRefreshRotationCacheForTests();
  });

  it("rechaza refresh revocado o ausente en BD", async () => {
    const { authPersistence, tokenService } = createMocks(null);
    const useCase = new RefreshUseCase({ authPersistence, tokenService });

    await assert.rejects(
      () => useCase.execute({ refresh_token: "refresh-old" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        return true;
      },
    );
  });

  it("rota refresh y devuelve metadatos de sesion", async () => {
    const rotation = {
      input: null as AuthPersistenceRotateRefreshTokenInput | null,
    };
    const savedToken = createSavedToken();

    const { authPersistence, tokenService } = createMocks(savedToken);
    authPersistence.rotateRefreshToken = async (input) => {
      rotation.input = input;
      return { newRefreshTokenId: "rt-new" };
    };

    const useCase = new RefreshUseCase({ authPersistence, tokenService });
    const result = await useCase.execute({ refresh_token: "refresh-old" });

    assert.ok(rotation.input);
    assert.equal(rotation.input.session_expires_at.toISOString(), sessionExpiresAt.toISOString());
    assert.equal(result.access_token, "access-new");
    assert.equal(result.refresh_token, "refresh-new");
    assert.equal(result.expires_in, 900);
    assert.equal(result.session_expires_at, sessionExpiresAt.toISOString());
    assert.equal(result.idle_timeout_seconds, 1800);
  });

  it("rechaza refresh cuando findActiveRefreshToken no encuentra token por idle o tope absoluto", async () => {
    const expiredSessionToken = createSavedToken({
      session_expires_at: new Date("2020-01-01T00:00:00.000Z"),
      last_used_at: new Date("2020-01-01T00:00:00.000Z"),
    });

    const { authPersistence, tokenService } = createMocks(null);
    const originalFind = authPersistence.findActiveRefreshToken;
    authPersistence.findActiveRefreshToken = async (input) => {
      const token = await originalFind(input);
      if (!token) return null;
      return expiredSessionToken;
    };

    const useCase = new RefreshUseCase({ authPersistence, tokenService });

    await assert.rejects(
      () => useCase.execute({ refresh_token: "refresh-old" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 401);
        return true;
      },
    );
  });

  it("no extiende session_expires_at al rotar", async () => {
    const originalSessionExpiresAt = new Date("2026-06-09T08:00:00.000Z");
    const rotation = {
      input: null as AuthPersistenceRotateRefreshTokenInput | null,
    };
    const savedToken = createSavedToken({
      session_expires_at: originalSessionExpiresAt,
    });

    const { authPersistence, tokenService } = createMocks(savedToken);
    authPersistence.rotateRefreshToken = async (input) => {
      rotation.input = input;
      return { newRefreshTokenId: "rt-new" };
    };

    const useCase = new RefreshUseCase({ authPersistence, tokenService });
    const result = await useCase.execute({ refresh_token: "refresh-old" });

    assert.ok(rotation.input);
    assert.equal(rotation.input.session_expires_at.toISOString(), originalSessionExpiresAt.toISOString());
    assert.equal(result.session_expires_at, originalSessionExpiresAt.toISOString());
  });

  it("reutiliza la rotacion cacheada cuando llega el mismo refresh en paralelo", async () => {
    let rotateCalls = 0;
    const savedToken = createSavedToken();
    const { authPersistence, tokenService } = createMocks(savedToken);
    authPersistence.rotateRefreshToken = async () => {
      rotateCalls += 1;
      return { newRefreshTokenId: "rt-new" };
    };

    const useCase = new RefreshUseCase({ authPersistence, tokenService });
    const [first, second] = await Promise.all([
      useCase.execute({ refresh_token: "refresh-old" }),
      useCase.execute({ refresh_token: "refresh-old" }),
    ]);

    assert.equal(rotateCalls, 1);
    assert.equal(first.refresh_token, second.refresh_token);
    assert.equal(first.access_token, second.access_token);
  });
});
