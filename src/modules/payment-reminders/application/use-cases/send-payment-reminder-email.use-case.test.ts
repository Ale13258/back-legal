import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "../../../../shared/http/error-handler.js";
import type { EmailSenderPort, SendEmailInput } from "../../domain/ports/email-sender.port.js";
import type {
  PaymentReminderEmailRecord,
  PaymentReminderEmailWithBody,
  PaymentRemindersPersistencePort,
  PropiedadForReminder,
} from "../../domain/ports/payment-reminders-persistence.port.js";
import { SendPaymentReminderEmailUseCase } from "./send-payment-reminder-email.use-case.js";

process.env.GMAIL_FROM ??= "notificaciones@test.local";

const propiedadId = "11111111-1111-1111-1111-111111111111";
const sampleBodyHtml = "<!DOCTYPE html><html lang=\"es\"><body><p>Hola</p></body></html>";
const sampleBodyText = "Hola, le recordamos su pago pendiente.";

function basePropiedad(overrides: Partial<PropiedadForReminder> = {}): PropiedadForReminder {
  return {
    id: propiedadId,
    identificador: "APT-101",
    direccion: "Calle 1 # 2-3",
    monto_a_la_fecha: 150000,
    cobro_nombre: "Juan Pérez",
    cobro_email: "cobro@example.com",
    ...overrides,
  };
}

function createMocks() {
  const logs: PaymentReminderEmailWithBody[] = [];
  const queuedBodies: { body_html: string; body_text: string }[] = [];
  const gestiones: { email_reminder_id: string; descripcion: string; fecha: Date }[] = [];
  let propiedad: PropiedadForReminder | null = basePropiedad();
  let lastSendInput: SendEmailInput | null = null;

  const persistence: PaymentRemindersPersistencePort = {
    async findPropiedadForReminder() {
      return propiedad;
    },
    async createQueued(input) {
      queuedBodies.push({ body_html: input.body_html, body_text: input.body_text });
      const row: PaymentReminderEmailWithBody = {
        id: "log-1",
        propiedad_id: input.propiedad_id,
        cliente_email: input.cliente_email,
        extra_recipients: input.extra_recipients,
        subject: input.subject,
        status: "queued",
        provider_id: null,
        error_message: null,
        sent_at: null,
        created_at: new Date("2026-05-21T12:00:00.000Z"),
        gestion_id: null,
        body_html: input.body_html,
        body_text: input.body_text,
      };
      logs.push(row);
      return row;
    },
    async markSentWithGestion(input) {
      gestiones.push({
        email_reminder_id: input.id,
        descripcion: input.descripcion,
        fecha: input.sent_at,
      });
      const row: PaymentReminderEmailWithBody = {
        ...logs[0],
        status: "sent",
        provider_id: input.provider_id,
        sent_at: input.sent_at,
        error_message: null,
        gestion_id: "gestion-1",
        body_html: queuedBodies[0]?.body_html ?? null,
        body_text: queuedBodies[0]?.body_text ?? null,
      };
      logs[0] = row;
      return row;
    },
    async markFailed(input) {
      const row: PaymentReminderEmailWithBody = {
        ...logs[0],
        status: "failed",
        error_message: input.error_message,
      };
      logs[0] = row;
      return row;
    },
    async findById(id: string) {
      return logs.find((row) => row.id === id) ?? null;
    },
    async listByPropiedad() {
      return logs;
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
    setPropiedad(p: PropiedadForReminder | null) {
      propiedad = p;
    },
    getLogs() {
      return logs;
    },
    getGestiones() {
      return gestiones;
    },
    getQueuedBodies() {
      return queuedBodies;
    },
    getLastSendInput() {
      return lastSendInput;
    },
  };
}

function baseInput() {
  return {
    propiedad_id: propiedadId,
    body_html: sampleBodyHtml,
    body_text: sampleBodyText,
  };
}

describe("SendPaymentReminderEmailUseCase", () => {
  it("envía correo con el HTML y texto del admin", async () => {
    const mocks = createMocks();
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    const result = await useCase.execute(baseInput());

    assert.equal(result.status, "sent");
    assert.equal(result.cliente_email, "cobro@example.com");
    assert.deepEqual(result.extra_recipients, []);
    assert.equal(result.provider_id, "<test@mail>");
    assert.equal(result.subject, "Recordatorio de pago - APT-101");
    assert.equal(result.gestion_id, "gestion-1");
    assert.equal(result.body_html, sampleBodyHtml);
    assert.equal(result.body_text, sampleBodyText);

    const sent = mocks.getLastSendInput();
    assert.equal(sent?.html, sampleBodyHtml);
    assert.equal(sent?.text, sampleBodyText);
    assert.equal(sent?.to, "cobro@example.com");
    assert.ok(sent?.attachments && sent.attachments.length >= 4);
    assert.equal(sent.attachments[0]?.contentDisposition, "inline");

    const gestiones = mocks.getGestiones();
    assert.equal(gestiones.length, 1);
    assert.equal(gestiones[0]?.email_reminder_id, "log-1");
    assert.match(gestiones[0]?.descripcion ?? "", /Asunto: Recordatorio de pago - APT-101/);
    assert.match(gestiones[0]?.descripcion ?? "", /Para: cobro@example.com/);
  });

  it("persiste body_html y body_text al encolar", async () => {
    const mocks = createMocks();
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    await useCase.execute(baseInput());

    const bodies = mocks.getQueuedBodies();
    assert.equal(bodies.length, 1);
    assert.equal(bodies[0]?.body_html, sampleBodyHtml);
    assert.equal(bodies[0]?.body_text, sampleBodyText);
  });

  it("404 si la propiedad no existe", async () => {
    const mocks = createMocks();
    mocks.setPropiedad(null);
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
    mocks.setPropiedad(basePropiedad({ cobro_email: "   " }));
    const useCase = new SendPaymentReminderEmailUseCase({
      persistence: mocks.persistence,
      emailSender: mocks.emailSender,
    });

    await assert.rejects(
      () => useCase.execute(baseInput()),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 400 &&
        err.message === "La propiedad no tiene un email de cobro válido",
    );
  });

  it("400 si no hay saldo pendiente", async () => {
    const mocks = createMocks();
    mocks.setPropiedad(basePropiedad({ monto_a_la_fecha: 0 }));
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

    assert.equal(result.status, "sent");
    assert.equal(result.subject, "Pago pendiente APT-101");
    assert.equal(result.cliente_email, "cobro@example.com");
    assert.deepEqual(result.extra_recipients, ["extra@example.com"]);
    assert.equal(result.gestion_id, "gestion-1");

    const sent = mocks.getLastSendInput();
    assert.equal(sent?.subject, "Pago pendiente APT-101");
    assert.equal(sent?.to, "cobro@example.com, extra@example.com");

    const queued = mocks.getLogs()[0] as PaymentReminderEmailRecord;
    assert.equal(queued.cliente_email, "cobro@example.com");
    assert.deepEqual(queued.extra_recipients, ["extra@example.com"]);
  });

  it("marca failed, no crea gestión y relanza si el envío SMTP falla", async () => {
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
    assert.equal(mocks.getLogs()[0]?.status, "failed");
    assert.equal(mocks.getGestiones().length, 0);
  });
});
