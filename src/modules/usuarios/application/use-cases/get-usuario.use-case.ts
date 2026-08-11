import { ApiError } from "../../../../shared/http/error-handler.js";
import type {
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";

export class GetUsuarioUseCase {
  constructor(private readonly deps: { usuariosPersistence: UsuariosPersistencePort }) {}

  async execute(id: string): Promise<StaffUsuario> {
    const user = await this.deps.usuariosPersistence.findStaffById(id);
    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "Usuario no encontrado");
    }
    return user;
  }
}
