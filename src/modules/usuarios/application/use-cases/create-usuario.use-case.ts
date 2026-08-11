import { ApiError } from "../../../../shared/http/error-handler.js";
import type { EmailSenderPort } from "../../../../shared/infrastructure/email/email-sender.port.js";
import { resolveOutboundFrom } from "../../../../shared/infrastructure/email/gmail-transport.js";
import {
  buildRegistrationInvitationUrl,
  computeInvitationExpiresAt,
  generateOpaqueToken,
} from "../../../../shared/security/opaque-token.js";
import type { StaffRole } from "../../../../shared/security/roles.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { buildStaffInvitationEmail } from "../../infrastructure/email/staff-invitation.template.js";

export const INVITABLE_STAFF_ROLES = ["analista_legal", "abogada_junior"] as const;
export type InvitableStaffRole = (typeof INVITABLE_STAFF_ROLES)[number];

export type CreateUsuarioInput = {
  email: string;
  role: InvitableStaffRole;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function roleLabel(role: StaffRole): string {
  switch (role) {
    case "analista_legal":
      return "Analista legal";
    case "abogada_junior":
      return "Abogada junior";
    default:
      return role;
  }
}

export class CreateUsuarioUseCase {
  constructor(
    private readonly deps: {
      usuariosPersistence: UsuariosPersistencePort;
      emailSender: EmailSenderPort;
    },
  ) {}

  async execute(input: CreateUsuarioInput): Promise<StaffUsuario> {
    const email = normalizeEmail(input.email);
    const existing = await this.deps.usuariosPersistence.findByEmail(email);
    if (existing) {
      throw new ApiError(409, "CONFLICT", "El usuario ya existe");
    }

    const { token, token_hash } = generateOpaqueToken();
    const activation_expires_at = computeInvitationExpiresAt();

    const created = await this.deps.usuariosPersistence.createPendingStaff({
      email,
      role: input.role,
      activation_token_hash: token_hash,
      activation_expires_at,
    });

    try {
      await this.sendInvitation({
        email,
        role: input.role,
        token,
        expires_at: activation_expires_at,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        502,
        "EMAIL_SEND_FAILED",
        "Usuario creado, pero no se pudo enviar la invitacion. Usa reenvio.",
      );
    }

    return created;
  }

  private async sendInvitation(input: {
    email: string;
    role: InvitableStaffRole;
    token: string;
    expires_at: Date;
  }): Promise<void> {
    const registration_url = buildRegistrationInvitationUrl(input.token);
    const content = buildStaffInvitationEmail({
      to: input.email,
      registration_url,
      role_label: roleLabel(input.role),
      expires_at: input.expires_at,
    });

    await this.deps.emailSender.send({
      from: resolveOutboundFrom({ from_name: "LegalTech" }),
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  }
}
