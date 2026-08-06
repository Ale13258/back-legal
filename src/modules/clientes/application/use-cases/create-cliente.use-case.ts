import { ApiError } from "../../../../shared/http/error-handler.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import type { EmailSenderPort } from "../../../../shared/infrastructure/email/email-sender.port.js";
import { resolveOutboundFrom } from "../../../../shared/infrastructure/email/gmail-transport.js";
import {
  buildRegistrationInvitationUrl,
  computeInvitationExpiresAt,
  generateOpaqueToken,
} from "../../../../shared/security/opaque-token.js";
import { ensureCreditorForLegacyCliente } from "../../../cuentas/infrastructure/persistence/ensure-creditor-for-cliente.js";
import { buildCreditorPortalInvitationEmail } from "../../infrastructure/email/creditor-portal-invitation.template.js";

export type CreateClienteInput = {
  nombre: string;
  tipo_persona: "natural" | "juridica";
  documento: string;
  telefono?: string;
  email: string;
  direccion?: string;
  observaciones?: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class CreateClienteUseCase {
  constructor(private readonly deps: { emailSender: EmailSenderPort }) {}

  async execute(input: CreateClienteInput) {
    const email = normalizeEmail(input.email);

    const existingCliente = await prisma.cliente.findFirst({
      where: {
        OR: [{ email }, { documento: input.documento.trim() }],
      },
      select: { id: true },
    });
    if (existingCliente) {
      throw new ApiError(409, "CONFLICT", "Ya existe un cliente con ese email o documento");
    }

    const existingUser = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ApiError(409, "CONFLICT", "Ya existe un usuario con ese email");
    }

    const { token, token_hash } = generateOpaqueToken();
    const activation_expires_at = computeInvitationExpiresAt();

    const created = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: {
          nombre: input.nombre.trim(),
          tipo_persona: input.tipo_persona,
          documento: input.documento.trim(),
          telefono: input.telefono,
          email,
          direccion: input.direccion,
          observaciones: input.observaciones,
          is_active: true,
        },
      });

      await tx.usuario.create({
        data: {
          email,
          role: "cliente",
          cliente_id: cliente.id,
          password_hash: null,
          is_active: false,
          activated_at: null,
          activation_token_hash: token_hash,
          activation_expires_at,
        },
      });

      return cliente;
    });

    // Espejo creditor bajo LegalTech (Fase 1–2); no bloquea si falla después del commit.
    try {
      await ensureCreditorForLegacyCliente(created.id);
    } catch (error) {
      console.error("creditor_mirror_failed", { cliente_id: created.id, error });
    }

    try {
      const registration_url = buildRegistrationInvitationUrl(token);
      const content = buildCreditorPortalInvitationEmail({
        to: email,
        creditor_name: created.nombre,
        registration_url,
        expires_at: activation_expires_at,
      });
      await this.deps.emailSender.send({
        from: resolveOutboundFrom({ from_name: "LegalTech" }),
        to: email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        502,
        "EMAIL_SEND_FAILED",
        "Cliente creado, pero no se pudo enviar la invitacion. Usa reenvio.",
      );
    }

    return created;
  }
}
