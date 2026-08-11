import type {
  ListStaffUsuariosFilter,
  StaffUsuario,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";

export class ListUsuariosUseCase {
  constructor(private readonly deps: { usuariosPersistence: UsuariosPersistencePort }) {}

  execute(filter?: ListStaffUsuariosFilter): Promise<StaffUsuario[]> {
    return this.deps.usuariosPersistence.listStaff(filter);
  }
}
