import { ApiError } from "../../../../shared/http/error-handler.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import type { EmailSenderPort } from "../../../../shared/infrastructure/email/email-sender.port.js";
import { resolveOutboundFrom } from "../../../../shared/infrastructure/email/gmail-transport.js";
import {
  buildRegistrationInvitationUrl,
  computeInvitationExpiresAt,
  generateOpaqueToken,
} from "../../../../shared/security/opaque-token.js";
import { buildCreditorPortalInvitationEmail } from "../../infrastructure/email/creditor-portal-invitation.template.js";

export type ResendClienteInvitationInput = {
  id: string;
};

export class ResendClienteInvitationUseCase {
  constructor(private readonly deps: { emailSender: EmailSenderPort }) {}

  async execute(input: ResendClienteInvitationInput) {
    const cliente = await prisma.cliente.findUnique({ where: { id: input.id } });
    if (!cliente) {
      throw new ApiError(404, "NOT_FOUND", "Cliente no encontrado");
    }

    const pending = await prisma.usuario.findFirst({
      where: {
        cliente_id: cliente.id,
        role: "cliente",
        activated_at: null,
        password_hash: null,
        activation_token_hash: { not: null },
        is_active: false,
      },
    });

    if (!pending) {
      throw new ApiError(
        400,
        "BUSINESS_RULE_VIOLATION",
        "Solo se puede reenviar invitacion a clientes pendientes de activacion",
      );
    }

    const { token, token_hash } = generateOpaqueToken();
    const activation_expires_at = computeInvitationExpiresAt();

    const rotated = await prisma.usuario.updateMany({
      where: {
        id: pending.id,
        activated_at: null,
        password_hash: null,
        activation_token_hash: { not: null },
      },
      data: {
        activation_token_hash: token_hash,
        activation_expires_at,
        email: cliente.email,
      },
    });

    if (rotated.count !== 1) {
      throw new ApiError(409, "CONFLICT", "La invitacion ya no esta pendiente");
    }

    try {
      const registration_url = buildRegistrationInvitationUrl(token);
      const content = buildCreditorPortalInvitationEmail({
        to: cliente.email,
        creditor_name: cliente.nombre,
        registration_url,
        expires_at: activation_expires_at,
      });
      await this.deps.emailSender.send({
        from: resolveOutboundFrom({ from_name: "LegalTech" }),
        to: cliente.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      const detail = error instanceof Error ? error.message : "Error al enviar correo";
      throw new ApiError(
        502,
        "EMAIL_SEND_FAILED",
        `Token renovado, pero no se pudo enviar la invitacion: ${detail}`,
      );
    }

    return cliente;
  }
}
