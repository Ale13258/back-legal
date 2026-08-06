import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { hashToken } from "../../../../shared/security/jwt.js";
import type {
  ActivateStaffByInvitationInput,
  AuthPersistencePort,
} from "../../domain/ports/auth-persistence.port.js";
import type { PasswordHasherPort } from "../../domain/ports/password-hasher.port.js";
import { RegisterStaffUseCase } from "./register-staff.use-case.js";

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

const passwordHasher: PasswordHasherPort = {
  hash: async (password) => `argon:${password}`,
  verify: async () => true,
};

describe("RegisterStaffUseCase", () => {
  it("activa staff con token valido una sola vez", async () => {
    const token = "one-time-token";
    let activations = 0;
    let lastInput: ActivateStaffByInvitationInput | null = null;

    const authPersistence = createPersistence({
      activateStaffByInvitation: async (input) => {
        activations += 1;
        lastInput = input;
        if (activations > 1) {
          return null;
        }
        return {
          id: "u-1",
          email: "staff@test.com",
          role: "analista_legal",
        };
      },
    });

    const useCase = new RegisterStaffUseCase({ authPersistence, passwordHasher });

    const first = await useCase.execute({
      token,
      password: "secret1",
      confirm_password: "secret1",
    });
    assert.deepEqual(first, {
      id: "u-1",
      email: "staff@test.com",
      role: "analista_legal",
      status: "active",
    });
    assert.ok(lastInput !== null);
    const activation = lastInput as ActivateStaffByInvitationInput;
    assert.equal(activation.activation_token_hash, hashToken(token));
    assert.equal(activation.password_hash, "argon:secret1");

    await assert.rejects(
      () =>
        useCase.execute({
          token,
          password: "secret1",
          confirm_password: "secret1",
        }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "INVALID_INVITATION");
        return true;
      },
    );
  });

  it("resuelve carrera: solo una activacion concurrente gana", async () => {
    let winners = 0;
    const authPersistence = createPersistence({
      activateStaffByInvitation: async () => {
        winners += 1;
        if (winners === 1) {
          return {
            id: "u-race",
            email: "race@test.com",
            role: "abogada_junior",
          };
        }
        return null;
      },
    });

    const useCase = new RegisterStaffUseCase({ authPersistence, passwordHasher });
    const input = {
      token: "race-token",
      password: "secret12",
      confirm_password: "secret12",
    };

    const results = await Promise.allSettled([
      useCase.execute(input),
      useCase.execute(input),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(winners, 2);
  });

  it("rechaza contraseñas que no coinciden", async () => {
    const useCase = new RegisterStaffUseCase({
      authPersistence: createPersistence(),
      passwordHasher,
    });

    await assert.rejects(
      () =>
        useCase.execute({
          token: "t",
          password: "aaaaaa",
          confirm_password: "bbbbbb",
        }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "VALIDATION_ERROR");
        return true;
      },
    );
  });
});
