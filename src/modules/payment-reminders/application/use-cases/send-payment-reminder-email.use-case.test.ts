import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { parseEmailGestionDescripcion } from "../../domain/email-gestion-descripcion.js";
import type { EmailSenderPort, SendEmailInput } from "../../domain/ports/email-sender.port.js";
import type {
  PaymentRemindersPersistencePort,
  CuentaForReminder,
  ReminderGestionRecord,
} from "../../domain/ports/payment-reminders-persistence.port.js";
import { SendPaymentReminderEmailUseCase } from "./send-payment-reminder-email.use-case.js";

process.env.GMAIL_FROM ??= "notificaciones@test.local";

const cuentaId = "11111111-1111-1111-1111-111111111111";
const sampleBodyHtml = "<!DOCTYPE html><html lang=\"es\"><body><p>Hola</p></body></html>";
const sampleBodyText = "Hola, le recordamos su pago pendiente.";

function baseCuenta(overrides: Partial<CuentaForReminder> = {}): CuentaForReminder {
  return {
    id: cuentaId,
    identificador: "APT-101",
    direccion: "Calle 1 # 2-3",
    monto_a_la_fecha: 150000,
    cobro_nombre: "Juan Pérez",
    cobro_email: "cobro@example.com",
    ...overrides,
  };
}

function createMocks() {
  const gestiones: ReminderGestionRecord[] = [];
  let cuenta: CuentaForReminder | null = baseCuenta();
  let lastSendInput: SendEmailInput | null = null;

  const persistence: PaymentRemindersPersistencePort = {
    async findCuentaForReminder() {
      return cuenta;
    },
    async createSentEmailGestion(input) {
      const row: ReminderGestionRecord = {
        id: "gestion-1",
        cuenta_id: input.cuenta_id,
        fecha: input.sent_at,
        tipo: "email_reminder",
        estado: "enviado",
        descripcion: input.descripcion,
        created_at: input.sent_at,
        updated_at: input.sent_at,
      };
      gestiones.push(row);
      return row;
    },
    async findEmailGestionById(id) {
      return gestiones.find((g) => g.id === id) ?? null;
    },
    async listEmailGestionesByCuenta() {
      return gestiones;
    },
  };

  const emailSender: EmailSenderPort = {
    async send(input) {
      lastSendInput = input;
      return { provider_id: "<test@mail>" };
    },
  };

  return {
    persistence,
    emailSender,
    setCuenta(p: CuentaForReminder | null) {
      cuenta = p;
    },
    getGestiones() {
      return gestiones;
    },
    getLastSendInput() {
      return lastSendInput;
    },
  };
}

function baseInput() {
  return {
    cuenta_id: cuentaId,
    body_html: sampleBodyHtml,
    body_text: sampleBodyText,
  };
}

describe("SendPaymentReminderEmailUseCase", () => {
  it("envía correo y guarda el cuerpo en la gestión", async () => {
    const mocks = createMocks();
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    const result = await useCase.execute(baseInput());
    const email = parseEmailGestionDescripcion(result.descripcion);

    assert.equal(result.estado, "enviado");
    assert.equal(result.tipo, "email_reminder");
    assert.equal(result.id, "gestion-1");
    assert.ok(email);
    assert.equal(email.cliente_email, "cobro@example.com");
    assert.deepEqual(email.extra_recipients, []);
    assert.equal(email.provider_id, "<test@mail>");
    assert.equal(email.subject, "Recordatorio de pago - APT-101");
    assert.equal(email.body_html, sampleBodyHtml);
    assert.equal(email.body_text, sampleBodyText);

    const sent = mocks.getLastSendInput();
    assert.equal(sent?.html, sampleBodyHtml);
    assert.equal(sent?.text, sampleBodyText);
    assert.equal(sent?.to, "cobro@example.com");
    assert.ok(sent?.attachments && sent.attachments.length >= 4);
    assert.equal(sent.attachments[0]?.contentDisposition, "inline");

    assert.equal(mocks.getGestiones().length, 1);
  });

  it("404 si la cuenta no existe", async () => {
    const mocks = createMocks();
    mocks.setCuenta(null);
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    await assert.rejects(
      () => useCase.execute(baseInput()),
      (err: unknown) => err instanceof ApiError && err.status === 404,
    );
  });

  it("400 si no hay email de cobro", async () => {
    const mocks = createMocks();
    mocks.setCuenta(baseCuenta({ cobro_email: "   " }));
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    await assert.rejects(
      () => useCase.execute(baseInput()),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 400 &&
        err.message === "La cuenta no tiene un email de cobro válido",
    );
  });

  it("400 si no hay saldo pendiente", async () => {
    const mocks = createMocks();
    mocks.setCuenta(baseCuenta({ monto_a_la_fecha: 0 }));
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    await assert.rejects(
      () => useCase.execute(baseInput()),
      (err: unknown) => err instanceof ApiError && err.status === 400,
    );
  });

  it("400 si el HTML contiene script", async () => {
    const mocks = createMocks();
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    await assert.rejects(
      () =>
        useCase.execute({
          ...baseInput(),
          body_html: "<html><body><script>alert(1)</script></body></html>",
        }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 400 &&
        err.message === "El HTML del correo contiene contenido no permitido",
    );
  });

  it("400 si el HTML contiene javascript:", async () => {
    const mocks = createMocks();
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    await assert.rejects(
      () =>
        useCase.execute({
          ...baseInput(),
          body_html: '<html><body><a href="javascript:alert(1)">click</a></body></html>',
        }),
      (err: unknown) => err instanceof ApiError && err.status === 400,
    );
  });

  it("envía con asunto personalizado y destinatarios adicionales separados", async () => {
    const mocks = createMocks();
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    const result = await useCase.execute({
      ...baseInput(),
      subject: "Pago pendiente APT-101",
      extra_recipients: ["cobro@example.com", "extra@example.com"],
    });
    const email = parseEmailGestionDescripcion(result.descripcion);

    assert.equal(result.estado, "enviado");
    assert.ok(email);
    assert.equal(email.subject, "Pago pendiente APT-101");
    assert.equal(email.cliente_email, "cobro@example.com");
    assert.deepEqual(email.extra_recipients, ["extra@example.com"]);

    const sent = mocks.getLastSendInput();
    assert.equal(sent?.subject, "Pago pendiente APT-101");
    assert.equal(sent?.to, "cobro@example.com, extra@example.com");
  });

  it("no crea gestión y relanza si el envío SMTP falla", async () => {
    const mocks = createMocks();
    const failingSender: EmailSenderPort = {
      async send() {
        throw new ApiError(502, "EMAIL_SEND_FAILED", "SMTP down");
      },
    };
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: failingSender,
    });

    await assert.rejects(
      () => useCase.execute(baseInput()),
      (err: unknown) => err instanceof ApiError && err.status === 502,
    );
    assert.equal(mocks.getGestiones().length, 0);
  });
});
