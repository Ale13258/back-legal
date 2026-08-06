import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type { EmailSenderPort, SendEmailInput } from "../../../../shared/infrastructure/email/email-sender.port.js";
import type {
  CreatePendingStaffUsuarioInput,
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { CreateUsuarioUseCase } from "./create-usuario.use-case.js";

function pendingStaff(overrides: Partial<StaffUsuario> = {}): StaffUsuario {
  return {
    id: "u-pending",
    email: "nuevo@test.com",
    role: "analista_legal",
    is_active: false,
    status: "pending",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("CreateUsuarioUseCase", () => {
  it("crea usuario pendiente y envia invitacion sin exponer token", async () => {
    process.env.FRONTEND_URL = "https://app.legaltech.test";
    process.env.GMAIL_FROM = "noreply@legaltech.test";
    process.env.GMAIL_FROM_NAME = "LegalTech";

    let createdInput: CreatePendingStaffUsuarioInput | null = null;
    const sent: SendEmailInput[] = [];

    const usuariosPersistence: UsuariosPersistencePort = {
      listStaff: async () => [],
      findStaffById: async () => null,
      findByEmail: async () => null,
      createPendingStaff: async (input) => {
        createdInput = input;
        return pendingStaff({ email: input.email, role: input.role });
      },
      findPendingStaffById: async () => null,
      rotatePendingInvitation: async () => null,
      updateStaff: async () => pendingStaff(),
      countActiveSuperAdmins: async () => 1,
      revokeAllRefreshTokens: async () => {},
    };

    const emailSender: EmailSenderPort = {
      send: async (input) => {
        sent.push(input);
        return { provider_id: "msg-1" };
      },
    };

    const useCase = new CreateUsuarioUseCase({ usuariosPersistence, emailSender });
    const result = await useCase.execute({
      email: " Nuevo@Test.com ",
      role: "analista_legal",
    });

    assert.equal(result.status, "pending");
    assert.equal(result.email, "nuevo@test.com");
    assert.ok(createdInput !== null);
    const persisted = createdInput as CreatePendingStaffUsuarioInput;
    assert.equal(persisted.email, "nuevo@test.com");
    assert.match(persisted.activation_token_hash, /^[a-f0-9]{64}$/);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]!.to, "nuevo@test.com");
    assert.match(sent[0]!.text, /https:\/\/app\.legaltech\.test\/registro\?token=/);
    assert.doesNotMatch(JSON.stringify(result), /token/);
  });

  it("rechaza email duplicado", async () => {
    const usuariosPersistence: UsuariosPersistencePort = {
      listStaff: async () => [],
      findStaffById: async () => null,
      findByEmail: async () => ({ id: "existing" }),
      createPendingStaff: async () => {
        throw new Error("no debe crear");
      },
      findPendingStaffById: async () => null,
      rotatePendingInvitation: async () => null,
      updateStaff: async () => pendingStaff(),
      countActiveSuperAdmins: async () => 1,
      revokeAllRefreshTokens: async () => {},
    };

    const useCase = new CreateUsuarioUseCase({
      usuariosPersistence,
      emailSender: { send: async () => ({ provider_id: "x" }) },
    });

    await assert.rejects(
      () => useCase.execute({ email: "dup@test.com", role: "abogada_junior" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        return true;
      },
    );
  });

  it("propaga fallo de correo tras crear pendiente", async () => {
    process.env.FRONTEND_URL = "https://app.legaltech.test";
    process.env.GMAIL_FROM = "noreply@legaltech.test";

    const usuariosPersistence: UsuariosPersistencePort = {
      listStaff: async () => [],
      findStaffById: async () => null,
      findByEmail: async () => null,
      createPendingStaff: async () => pendingStaff(),
      findPendingStaffById: async () => null,
      rotatePendingInvitation: async () => null,
      updateStaff: async () => pendingStaff(),
      countActiveSuperAdmins: async () => 1,
      revokeAllRefreshTokens: async () => {},
    };

    const useCase = new CreateUsuarioUseCase({
      usuariosPersistence,
      emailSender: {
        send: async () => {
          throw new ApiError(502, "EMAIL_SEND_FAILED", "smtp down");
        },
      },
    });

    await assert.rejects(
      () => useCase.execute({ email: "nuevo@test.com", role: "analista_legal" }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "EMAIL_SEND_FAILED");
        return true;
      },
    );
  });
});
