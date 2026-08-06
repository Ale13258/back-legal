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

export type UpdateUsuarioInput = {
  id: string;
  email?: string;
  role?: StaffRole;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function roleLabel(role: "analista_legal" | "abogada_junior"): string {
  return role === "analista_legal" ? "Analista legal" : "Abogada junior";
}

export class UpdateUsuarioUseCase {
  constructor(
    private readonly deps: {
      usuariosPersistence: UsuariosPersistencePort;
      emailSender: EmailSenderPort;
    },
  ) {}

  async execute(input: UpdateUsuarioInput): Promise<StaffUsuario> {
    const existing = await this.deps.usuariosPersistence.findStaffById(input.id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    const nextEmail =
      input.email !== undefined ? normalizeEmail(input.email) : undefined;

    if (nextEmail && nextEmail !== existing.email) {
      const conflict = await this.deps.usuariosPersistence.findByEmail(nextEmail);
      if (conflict) {
        throw new ApiError(409, "CONFLICT", "El email ya esta en uso");
      }
    }

    const demotingLastSuperAdmin =
      existing.role === "super_admin" &&
      existing.is_active &&
      existing.status === "active" &&
      input.role !== undefined &&
      input.role !== "super_admin";

    if (demotingLastSuperAdmin) {
      const activeSuperAdmins = await this.deps.usuariosPersistence.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        throw new ApiError(
          400,
          "BUSINESS_RULE_VIOLATION",
          "No se puede degradar al ultimo super_admin activo",
        );
      }
    }

    const emailChanged = nextEmail !== undefined && nextEmail !== existing.email;
    const isPending = existing.status === "pending";

    if (emailChanged && isPending) {
      const { token, token_hash } = generateOpaqueToken();
      const activation_expires_at = computeInvitationExpiresAt();

      const updated = await this.deps.usuariosPersistence.updateStaff(input.id, {
        email: nextEmail,
        role: input.role,
        activation_token_hash: token_hash,
        activation_expires_at,
      });

      const pendingRole =
        updated.role === "analista_legal" || updated.role === "abogada_junior"
          ? updated.role
          : null;

      if (!pendingRole) {
        throw new ApiError(
          400,
          "BUSINESS_RULE_VIOLATION",
          "Usuario pendiente con rol no invitable",
        );
      }

      const registration_url = buildRegistrationInvitationUrl(token);
      const content = buildStaffInvitationEmail({
        to: updated.email,
        registration_url,
        role_label: roleLabel(pendingRole),
        expires_at: activation_expires_at,
      });

      try {
        await this.deps.emailSender.send({
          from: resolveOutboundFrom({ from_name: "LegalTech" }),
          to: updated.email,
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
          "Email actualizado, pero no se pudo reenviar la invitacion",
        );
      }

      return updated;
    }

    return this.deps.usuariosPersistence.updateStaff(input.id, {
      email: nextEmail,
      role: input.role,
    });
  }
}
