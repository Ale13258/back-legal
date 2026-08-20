import { ApiError } from "../../../../shared/http/error-handler.js";
import type { UsuariosPersistencePort } from "../../domain/ports/usuarios-persistence.port.js";

export type DeleteUsuarioInput = {
  actorId: string;
  id: string;
};

export class DeleteUsuarioUseCase {
  constructor(private readonly deps: { usuariosPersistence: UsuariosPersistencePort }) {}

  async execute(input: DeleteUsuarioInput): Promise<void> {
    if (input.actorId === input.id) {
      throw new ApiError(400, "BUSINESS_RULE_VIOLATION", "No puedes eliminarte a ti mismo");
    }

    const existing = await this.deps.usuariosPersistence.findStaffById(input.id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }

    if (existing.role === "super_admin" && existing.status === "active") {
      const activeSuperAdmins = await this.deps.usuariosPersistence.countActiveSuperAdmins();
      if (activeSuperAdmins <= 1) {
        throw new ApiError(
          400,
          "BUSINESS_RULE_VIOLATION",
          "No se puede eliminar al ultimo super_admin activo",
        );
      }
    }

    const deleted = await this.deps.usuariosPersistence.deleteStaff(input.id);
    if (!deleted) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }
  }
}
