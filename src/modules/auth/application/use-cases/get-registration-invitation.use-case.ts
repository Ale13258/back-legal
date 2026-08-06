import { ApiError } from "../../../../shared/http/error-handler.js";
import { hashToken } from "../../../../shared/security/jwt.js";
import type { AuthPersistencePort } from "../../domain/ports/auth-persistence.port.js";

export type GetRegistrationInvitationInput = {
  token: string;
};

export type GetRegistrationInvitationOutput = {
  email: string;
  role: "analista_legal" | "abogada_junior" | "cliente";
};

export class GetRegistrationInvitationUseCase {
  constructor(private readonly deps: { authPersistence: AuthPersistencePort }) {}

  async execute(input: GetRegistrationInvitationInput): Promise<GetRegistrationInvitationOutput> {
    const token = input.token.trim();
    if (!token) {
      throw new ApiError(400, "VALIDATION_ERROR", "Token invalido");
    }

    const invitation = await this.deps.authPersistence.findValidRegistrationInvitation(
      hashToken(token),
      new Date(),
    );

    if (!invitation) {
      throw new ApiError(400, "INVALID_INVITATION", "Invitacion invalida o expirada");
    }

    return {
      email: invitation.email,
      role: invitation.role,
    };
  }
}
