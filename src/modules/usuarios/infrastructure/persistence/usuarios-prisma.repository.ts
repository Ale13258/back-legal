import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { STAFF_ROLES, type StaffRole } from "../../../../shared/security/roles.js";
import type {
  CreatePendingStaffUsuarioInput,
  ListStaffUsuariosFilter,
  PendingStaffInvitation,
  RotatePendingInvitationInput,
  StaffUsuario,
  UpdateStaffUsuarioInput,
  UsuariosPersistencePort,
} from "../../domain/ports/usuarios-persistence.port.js";
import { deriveStaffUsuarioStatus } from "../../domain/ports/usuarios-persistence.port.js";

type StaffRow = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  activated_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toStaffUsuario(row: StaffRow): StaffUsuario {
  return {
    id: row.id,
    email: row.email,
    role: row.role as StaffRole,
    is_active: row.is_active,
    status: deriveStaffUsuarioStatus({
      activated_at: row.activated_at,
      is_active: row.is_active,
    }),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const staffSelect = {
  id: true,
  email: true,
  role: true,
  is_active: true,
  activated_at: true,
  created_at: true,
  updated_at: true,
} as const;

function toPendingInvitation(row: {
  id: string;
  email: string;
  role: string;
  activation_expires_at: Date | null;
}): PendingStaffInvitation | null {
  if (
    row.activation_expires_at == null ||
    (row.role !== "analista_legal" && row.role !== "abogada_junior")
  ) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    activation_expires_at: row.activation_expires_at,
  };
}

export class UsuariosPrismaRepository implements UsuariosPersistencePort {
  async listStaff(filter?: ListStaffUsuariosFilter): Promise<StaffUsuario[]> {
    const items = await prisma.usuario.findMany({
      where: {
        role: filter?.role ? filter.role : { in: [...STAFF_ROLES] },
        ...(filter?.is_active === undefined ? {} : { is_active: filter.is_active }),
        ...(filter?.status === "pending"
          ? { activated_at: null }
          : filter?.status === "active"
            ? { activated_at: { not: null }, is_active: true }
            : filter?.status === "inactive"
              ? { activated_at: { not: null }, is_active: false }
              : {}),
        cliente_id: null,
      },
      select: staffSelect,
      orderBy: { created_at: "desc" },
    });

    return items.map(toStaffUsuario);
  }

  async findStaffById(id: string): Promise<StaffUsuario | null> {
    const item = await prisma.usuario.findFirst({
      where: {
        id,
        role: { in: [...STAFF_ROLES] },
        cliente_id: null,
      },
      select: staffSelect,
    });

    return item ? toStaffUsuario(item) : null;
  }

  findByEmail(email: string) {
    return prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  async createPendingStaff(input: CreatePendingStaffUsuarioInput): Promise<StaffUsuario> {
    const created = await prisma.usuario.create({
      data: {
        email: input.email,
        password_hash: null,
        role: input.role,
        cliente_id: null,
        is_active: false,
        activated_at: null,
        activation_token_hash: input.activation_token_hash,
        activation_expires_at: input.activation_expires_at,
      },
      select: staffSelect,
    });

    return toStaffUsuario(created);
  }

  async findPendingStaffById(id: string): Promise<PendingStaffInvitation | null> {
    const item = await prisma.usuario.findFirst({
      where: {
        id,
        cliente_id: null,
        activated_at: null,
        password_hash: null,
        activation_token_hash: { not: null },
        role: { in: ["analista_legal", "abogada_junior"] },
      },
      select: {
        id: true,
        email: true,
        role: true,
        activation_expires_at: true,
      },
    });

    return item ? toPendingInvitation(item) : null;
  }

  async rotatePendingInvitation(
    id: string,
    input: RotatePendingInvitationInput,
  ): Promise<PendingStaffInvitation | null> {
    const result = await prisma.usuario.updateMany({
      where: {
        id,
        cliente_id: null,
        activated_at: null,
        password_hash: null,
        activation_token_hash: { not: null },
        role: { in: ["analista_legal", "abogada_junior"] },
      },
      data: {
        activation_token_hash: input.activation_token_hash,
        activation_expires_at: input.activation_expires_at,
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findPendingStaffById(id);
  }

  async updateStaff(id: string, input: UpdateStaffUsuarioInput): Promise<StaffUsuario> {
    const updated = await prisma.usuario.update({
      where: { id },
      data: {
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
        ...(input.activation_token_hash !== undefined
          ? { activation_token_hash: input.activation_token_hash }
          : {}),
        ...(input.activation_expires_at !== undefined
          ? { activation_expires_at: input.activation_expires_at }
          : {}),
      },
      select: staffSelect,
    });

    return toStaffUsuario(updated);
  }

  async deleteStaff(id: string): Promise<boolean> {
    const result = await prisma.usuario.deleteMany({
      where: {
        id,
        role: { in: [...STAFF_ROLES] },
        cliente_id: null,
      },
    });
    return result.count > 0;
  }

  countActiveSuperAdmins(): Promise<number> {
    return prisma.usuario.count({
      where: {
        role: "super_admin",
        is_active: true,
        activated_at: { not: null },
        cliente_id: null,
      },
    });
  }

  async revokeAllRefreshTokens(usuario_id: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: {
        usuario_id,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
  }
}
