import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";

export type ActivateUsuarioInput = {
  id: string;
};

export class ActivateUsuarioUseCase {
  constructor(private readonly deps: { usuariosPersistence: UsuariosPersistencePort }) {}

  async execute(input: ActivateUsuarioInput): Promise<StaffUsuario> {
    const existing = await this.deps.usuariosPersistence.findStaffById(input.id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    if (existing.status === "pending") {
      throw new ApiError(
        400,
        "BUSINESS_RULE_VIOLATION",
        "El usuario pendiente debe completar la invitacion; no se puede reactivar asi",
      );
    }

    if (existing.is_active && existing.status === "active") {
      return existing;
    }

    return this.deps.usuariosPersistence.updateStaff(input.id, {
      is_active: true,
    });
  }
}
