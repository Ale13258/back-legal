import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { DeactivateUsuarioUseCase } from "./deactivate-usuario.use-case.js";

function staff(overrides: Partial<StaffUsuario> = {}): StaffUsuario {
  return {
    id: "u-1",
    email: "staff@test.com",
    role: "analista_legal",
    is_active: true,
    status: "active",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createPersistence(
  overrides: Partial<UsuariosPersistencePort> = {},
): UsuariosPersistencePort {
  return {
    listStaff: async () => [],
    findStaffById: async () => null,
    findByEmail: async () => null,
    createPendingStaff: async () => staff({ status: "pending", is_active: false }),
    findPendingStaffById: async () => null,
    rotatePendingInvitation: async () => null,
    updateStaff: async (id, input) =>
      staff({
        id,
        is_active: input.is_active === false ? false : true,
        status: input.is_active === false ? "inactive" : "active",
      }),
    countActiveSuperAdmins: async () => 1,
    revokeAllRefreshTokens: async () => {},
    ...overrides,
  };
}

describe("DeactivateUsuarioUseCase", () => {
  it("rechaza auto-desactivacion", async () => {
    const useCase = new DeactivateUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () => staff({ id: "me" }),
      }),
    });

    await assert.rejects(
      () => useCase.execute({ actorId: "me", id: "me" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "BUSINESS_RULE_VIOLATION");
        return true;
      },
    );
  });

  it("rechaza desactivar al ultimo super_admin activo", async () => {
    const revoked: string[] = [];
    const useCase = new DeactivateUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () => staff({ id: "sa-1", role: "super_admin" }),
        countActiveSuperAdmins: async () => 1,
        updateStaff: async () => {
          throw new Error("no debe actualizar");
        },
        revokeAllRefreshTokens: async (id) => {
          revoked.push(id);
        },
      }),
    });

    await assert.rejects(
      () => useCase.execute({ actorId: "actor", id: "sa-1" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "BUSINESS_RULE_VIOLATION");
        return true;
      },
    );
    assert.deepEqual(revoked, []);
  });

  it("desactiva staff y revoca refresh tokens", async () => {
    const revoked: string[] = [];
    const useCase = new DeactivateUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () => staff({ id: "u-2" }),
        countActiveSuperAdmins: async () => 2,
        updateStaff: async (id, input) =>
          staff({
            id,
            is_active: input.is_active === false ? false : true,
            status: input.is_active === false ? "inactive" : "active",
          }),
        revokeAllRefreshTokens: async (id) => {
          revoked.push(id);
        },
      }),
    });

    const result = await useCase.execute({ actorId: "actor", id: "u-2" });
    assert.equal(result.is_active, false);
    assert.equal(result.status, "inactive");
    assert.deepEqual(revoked, ["u-2"]);
  });
});
