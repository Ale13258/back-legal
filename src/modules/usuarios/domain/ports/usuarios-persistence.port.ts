import type { StaffRole } from "../../../../shared/security/roles.js";

export type StaffUsuarioStatus = "pending" | "active" | "inactive";

export type StaffUsuario = {
  id: string;
  email: string;
  role: StaffRole;
  is_active: boolean;
  status: StaffUsuarioStatus;
  created_at: Date;
  updated_at: Date;
};

export type CreatePendingStaffUsuarioInput = {
  email: string;
  role: Exclude<StaffRole, "super_admin">;
  activation_token_hash: string;
  activation_expires_at: Date;
};

export type RotatePendingInvitationInput = {
  activation_token_hash: string;
  activation_expires_at: Date;
};

export type UpdateStaffUsuarioInput = {
  email?: string;
  role?: StaffRole;
  is_active?: boolean;
  activation_token_hash?: string | null;
  activation_expires_at?: Date | null;
};

export type ListStaffUsuariosFilter = {
  role?: StaffRole;
  is_active?: boolean;
  status?: StaffUsuarioStatus;
};

export type PendingStaffInvitation = {
  id: string;
  email: string;
  role: Exclude<StaffRole, "super_admin">;
  activation_expires_at: Date;
};

export function deriveStaffUsuarioStatus(input: {
  activated_at: Date | null;
  is_active: boolean;
}): StaffUsuarioStatus {
  if (input.activated_at == null) {
    return "pending";
  }
  return input.is_active ? "active" : "inactive";
}

export interface UsuariosPersistencePort {
  listStaff(filter?: ListStaffUsuariosFilter): Promise<StaffUsuario[]>;
  findStaffById(id: string): Promise<StaffUsuario | null>;
  findByEmail(email: string): Promise<{ id: string } | null>;
  createPendingStaff(input: CreatePendingStaffUsuarioInput): Promise<StaffUsuario>;
  findPendingStaffById(id: string): Promise<PendingStaffInvitation | null>;
  rotatePendingInvitation(
    id: string,
    input: RotatePendingInvitationInput,
  ): Promise<PendingStaffInvitation | null>;
  updateStaff(id: string, input: UpdateStaffUsuarioInput): Promise<StaffUsuario>;
  /** Hard delete de staff (cascade refresh tokens). false si no existía. */
  deleteStaff(id: string): Promise<boolean>;
  countActiveSuperAdmins(): Promise<number>;
  revokeAllRefreshTokens(usuario_id: string): Promise<void>;
}
