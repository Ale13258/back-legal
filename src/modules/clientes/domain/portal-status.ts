export type ClientePortalStatus = "none" | "pending" | "active" | "expired" | "inactive";

export type PortalUsuarioSnapshot = {
  activated_at: Date | null;
  is_active: boolean;
  activation_expires_at: Date | null;
};

/** Deriva el estado de acceso al portal a partir del usuario role=cliente ligado a la ficha. */
export function deriveClientePortalStatus(
  user: PortalUsuarioSnapshot | null | undefined,
  now: Date = new Date(),
): ClientePortalStatus {
  if (!user) return "none";
  if (user.activated_at == null) {
    if (user.activation_expires_at != null && user.activation_expires_at.getTime() <= now.getTime()) {
      return "expired";
    }
    return "pending";
  }
  return user.is_active ? "active" : "inactive";
}
