import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { DeleteUsuarioUseCase } from "./delete-usuario.use-case.js";

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
    updateStaff: async () => staff(),
    deleteStaff: async () => true,
    countActiveSuperAdmins: async () => 1,
    revokeAllRefreshTokens: async () => {},
    ...overrides,
  };
}

describe("DeleteUsuarioUseCase", () => {
  it("rechaza auto-eliminacion", async () => {
    const useCase = new DeleteUsuarioUseCase({
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

  it("rechaza eliminar al ultimo super_admin activo", async () => {
    const deleted: string[] = [];
    const useCase = new DeleteUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () =>
          staff({ id: "sa-1", role: "super_admin", status: "active", is_active: true }),
        countActiveSuperAdmins: async () => 1,
        deleteStaff: async (id) => {
          deleted.push(id);
          return true;
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
    assert.deepEqual(deleted, []);
  });

  it("elimina staff pendiente", async () => {
    const deleted: string[] = [];
    const useCase = new DeleteUsuarioUseCase({
      usuariosPersistence: createPersistence({
        findStaffById: async () =>
          staff({ id: "u-2", status: "pending", is_active: false }),
        deleteStaff: async (id) => {
          deleted.push(id);
          return true;
        },
      }),
    });

    await useCase.execute({ actorId: "actor", id: "u-2" });
    assert.deepEqual(deleted, ["u-2"]);
  });

  it("404 si no existe", async () => {
    const useCase = new DeleteUsuarioUseCase({
      usuariosPersistence: createPersistence(),
    });

    await assert.rejects(
      () => useCase.execute({ actorId: "actor", id: "missing" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 404);
        return true;
      },
    );
  });
});
