import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { ActivateUsuarioUseCase } from "./activate-usuario.use-case.js";

function staff(overrides: Partial<StaffUsuario> = {}): StaffUsuario {
  return {
    id: "u-1",
    email: "staff@test.com",
    role: "analista_legal",
    is_active: false,
    status: "inactive",
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
        is_active: input.is_active === true ? true : false,
        status: input.is_active === true ? "active" : "inactive",
      }),
    deleteStaff: async () => true,
    countActiveSuperAdmins: async () => 1,
    revokeAllRefreshTokens: async () => {},
    ...overrides,
  };
}

describe("ActivateUsuarioUseCase", () => {
  it("rechaza reactivar usuario pendiente", async () => {
    const useCase = new ActivateUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () => staff({ status: "pending", is_active: false }),
      }),
    });

    await assert.rejects(
      () => useCase.execute({ id: "u-1" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "BUSINESS_RULE_VIOLATION");
        return true;
      },
    );
  });

  it("reactiva staff inactivo", async () => {
    const useCase = new ActivateUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () => staff({ id: "u-2", status: "inactive", is_active: false }),
      }),
    });

    const result = await useCase.execute({ id: "u-2" });
    assert.equal(result.is_active, true);
    assert.equal(result.status, "active");
  });

  it("es idempotente si ya esta activo", async () => {
    const useCase = new ActivateUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () =>
          staff({ id: "u-3", status: "active", is_active: true }),
        updateStaff: async () => {
          throw new Error("no debe actualizar");
        },
      }),
    });

    const result = await useCase.execute({ id: "u-3" });
    assert.equal(result.is_active, true);
    assert.equal(result.status, "active");
  });
});
