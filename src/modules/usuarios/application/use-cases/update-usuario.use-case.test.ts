import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { UpdateUsuarioUseCase } from "./update-usuario.use-case.js";

function staff(overrides: Partial<StaffUsuario> = {}): StaffUsuario {
  return {
    id: "sa-1",
    email: "sa@test.com",
    role: "super_admin",
    is_active: true,
    status: "active",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("UpdateUsuarioUseCase", () => {
  it("rechaza degradar al ultimo super_admin activo", async () => {
    const usuariosPersistence: UsuariosPersistencePort = {
      listStaff: async () => [],
      findStaffById: async () => staff(),
      findByEmail: async () => null,
      createPendingStaff: async () => staff({ status: "pending", is_active: false }),
      findPendingStaffById: async () => null,
      rotatePendingInvitation: async () => null,
      updateStaff: async () => {
        throw new Error("no debe actualizar");
      },
      deleteStaff: async () => true,
      countActiveSuperAdmins: async () => 1,
      revokeAllRefreshTokens: async () => {},
    };

    const useCase = new UpdateUsuarioUseCase({
      usuariosPersistence,
      emailSender: { send: async () => ({ provider_id: "msg-1" }) },
    });

    await assert.rejects(
      () => useCase.execute({ id: "sa-1", role: "analista_legal" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "BUSINESS_RULE_VIOLATION");
        return true;
      },
    );
  });
});
