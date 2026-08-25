import { ApiError } from "../../../../shared/http/error-handler.js";
import type { EmailSenderPort } from "../../../../shared/infrastructure/email/email-sender.port.js";
import { resolveOutboundFrom } from "../../../../shared/infrastructure/email/gmail-transport.js";
import {
  buildRegistrationInvitationUrl,
  computeInvitationExpiresAt,
  generateOpaqueToken,
} from "../../../../shared/security/opaque-token.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { buildStaffInvitationEmail } from "../../infrastructure/email/staff-invitation.template.js";

export type ResendInvitationInput = {
  id: string;
};

function roleLabel(role: "analista_legal" | "abogada_junior"): string {
  return role === "analista_legal" ? "Analista legal" : "Abogada junior";
}

export class ResendInvitationUseCase {
  constructor(
    private readonly deps: {
      usuariosPersistence: UsuariosPersistencePort;
      emailSender: EmailSenderPort;
    },
  ) {}

  async execute(input: ResendInvitationInput): Promise<StaffUsuario> {
    const pending = await this.deps.usuariosPersistence.findPendingStaffById(input.id);
    if (!pending) {
      const existing = await this.deps.usuariosPersistence.findStaffById(input.id);
      if (!existing) {
        throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
      }
      throw new ApiError(
        400,
        "BUSINESS_RULE_VIOLATION",
        "Solo se puede reenviar invitacion a usuarios pendientes",
      );
    }

    const { token, token_hash } = generateOpaqueToken();
    const activation_expires_at = computeInvitationExpiresAt();

    const rotated = await this.deps.usuariosPersistence.rotatePendingInvitation(input.id, {
      activation_token_hash: token_hash,
      activation_expires_at,
    });

    if (!rotated) {
      throw new ApiError(
        409,
        "CONFLICT",
        "La invitacion ya no esta pendiente; no se puede reenviar",
      );
    }

    try {
      const registration_url = buildRegistrationInvitationUrl(token);
      const content = buildStaffInvitationEmail({
        to: rotated.email,
        registration_url,
        role_label: roleLabel(rotated.role),
        expires_at: activation_expires_at,
      });
      await this.deps.emailSender.send({
        from: resolveOutboundFrom({ from_name: "LegalTech" }),
        to: rotated.email,
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

    const staff = await this.deps.usuariosPersistence.findStaffById(input.id);
    if (!staff) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }
    return staff;
  }
}
