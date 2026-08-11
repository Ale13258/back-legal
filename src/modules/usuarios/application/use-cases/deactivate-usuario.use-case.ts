import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";

export type DeactivateUsuarioInput = {
  actorId: string;
  id: string;
};

export class DeactivateUsuarioUseCase {
  constructor(private readonly deps: { usuariosPersistence: UsuariosPersistencePort }) {}

  async execute(input: DeactivateUsuarioInput): Promise<StaffUsuario> {
    if (input.actorId === input.id) {
      throw new ApiError(400, "BUSINESS_RULE_VIOLATION", "No puedes desactivarte a ti mismo");
    }

    const existing = await this.deps.usuariosPersistence.findStaffById(input.id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    if (!existing.is_active) {
      return existing;
    }

    if (existing.role === "super_admin") {
      const activeSuperAdmins = await this.deps.usuariosPersistence.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        throw new ApiError(
          400,
          "BUSINESS_RULE_VIOLATION",
          "No se puede desactivar al ultimo super_admin activo",
        );
      }
    }

    const updated = await this.deps.usuariosPersistence.updateStaff(input.id, {
      is_active: false,
    });
    await this.deps.usuariosPersistence.revokeAllRefreshTokens(input.id);
    return updated;
  }
}
