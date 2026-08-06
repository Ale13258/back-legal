import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type { EmailSenderPort, SendEmailInput } from "../../../../shared/infrastructure/email/email-sender.port.js";
import type {
  PendingStaffInvitation,
  RotatePendingInvitationInput,
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { ResendInvitationUseCase } from "./resend-invitation.use-case.js";

function pendingStaff(overrides: Partial<StaffUsuario> = {}): StaffUsuario {
  return {
    id: "u-1",
    email: "pending@test.com",
    role: "analista_legal",
    is_active: false,
    status: "pending",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function pendingInvitation(
  overrides: Partial<PendingStaffInvitation> = {},
): PendingStaffInvitation {
  return {
    id: "u-1",
    email: "pending@test.com",
    role: "analista_legal",
    activation_expires_at: new Date(Date.now() + 3600_000),
    ...overrides,
  };
}

describe("ResendInvitationUseCase", () => {
  it("rota token y reenvia correo", async () => {
    process.env.FRONTEND_URL = "https://app.legaltech.test";
    process.env.GMAIL_FROM = "noreply@legaltech.test";

    let rotated: RotatePendingInvitationInput | null = null;
    const sent: SendEmailInput[] = [];

    const usuariosPersistence: UsuariosPersistencePort = {
      listStaff: async () => [],
      findStaffById: async () => pendingStaff(),
      findByEmail: async () => null,
      createPendingStaff: async () => pendingStaff(),
      findPendingStaffById: async () => pendingInvitation(),
      rotatePendingInvitation: async (_id, input) => {
        rotated = input;
        return pendingInvitation({
          activation_expires_at: input.activation_expires_at,
        });
      },
      updateStaff: async () => pendingStaff(),
      countActiveSuperAdmins: async () => 1,
      revokeAllRefreshTokens: async () => {},
    };

    const emailSender: EmailSenderPort = {
      send: async (input) => {
        sent.push(input);
        return { provider_id: "msg-2" };
      },
    };

    const useCase = new ResendInvitationUseCase({ usuariosPersistence, emailSender });
    const result = await useCase.execute({ id: "u-1" });

    assert.equal(result.status, "pending");
    assert.ok(rotated !== null);
    const tokenInput = rotated as RotatePendingInvitationInput;
    assert.match(tokenInput.activation_token_hash, /^[a-f0-9]{64}$/);
    assert.equal(sent.length, 1);
    assert.match(sent[0]!.text, /registro\?token=/);
  });

  it("rechaza reenvio de usuario ya activo", async () => {
    const usuariosPersistence: UsuariosPersistencePort = {
      listStaff: async () => [],
      findStaffById: async () =>
        pendingStaff({ status: "active", is_active: true, role: "abogada_junior" }),
      findByEmail: async () => null,
      createPendingStaff: async () => pendingStaff(),
      findPendingStaffById: async () => null,
      rotatePendingInvitation: async () => null,
      updateStaff: async () => pendingStaff(),
      countActiveSuperAdmins: async () => 1,
      revokeAllRefreshTokens: async () => {},
    };

    const useCase = new ResendInvitationUseCase({
      usuariosPersistence,
      emailSender: { send: async () => ({ provider_id: "x" }) },
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
});
