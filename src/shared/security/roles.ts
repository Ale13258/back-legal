export const STAFF_ROLES = ["super_admin", "analista_legal", "abogada_junior"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type AuthRole = StaffRole | "cliente";

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export function isSuperAdminRole(role: string): boolean {
  return role === "super_admin";
}

export function isAuthRole(value: unknown): value is AuthRole {
  return (
    value === "super_admin" ||
    value === "analista_legal" ||
    value === "abogada_junior" ||
    value === "cliente"
  );
}
