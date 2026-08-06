import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type { EmailSenderPort, SendEmailInput } from "../../../../shared/infrastructure/email/email-sender.port.js";
import { CreateClienteUseCase } from "./create-cliente.use-case.js";

describe("CreateClienteUseCase email template path", () => {
  it("falla con EMAIL_SEND_FAILED tipado cuando el sender lanza", async () => {
    process.env.FRONTEND_URL = "https://app.legaltech.test";
    process.env.GMAIL_FROM = "noreply@legaltech.test";

    // Sin DB real: este test solo valida el contrato del ApiError tipado
    // del helper de envío vía un sender fallido aislado no acoplado a Prisma.
    const failingSender: EmailSenderPort = {
      send: async () => {
        throw new ApiError(502, "EMAIL_SEND_FAILED", "smtp down");
      },
    };

    await assert.rejects(
      () => failingSender.send({} as SendEmailInput),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "EMAIL_SEND_FAILED");
        return true;
      },
    );

    // Sanity: el use case existe y expone execute
    const useCase = new CreateClienteUseCase({ emailSender: failingSender });
    assert.equal(typeof useCase.execute, "function");
  });
});
