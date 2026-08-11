import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../http/error-handler.js";
import { verifyAccessToken } from "./jwt.js";
import { isStaffRole, STAFF_ROLES, type AuthRole } from "./roles.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = req.header("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return next(new ApiError(401, "UNAUTHORIZED", "Token requerido"));
  }

  const token = auth.slice("Bearer ".length);
  req.user = verifyAccessToken(token);
  return next();
}

export function requireRole(...roles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHORIZED", "No autenticado"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "FORBIDDEN", "No autorizado"));
    }
    return next();
  };
}

export function requireStaff() {
  return requireRole(...STAFF_ROLES);
}

export function requireSuperAdmin() {
  return requireRole("super_admin");
}

/** @deprecated Prefer requireOwnershipOrStaff; alias retained for compatibility. */
export function requireOwnershipOrAdmin(paramName = "id") {
  return requireOwnershipOrStaff(paramName);
}

export function requireOwnershipOrStaff(paramName = "id") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHORIZED", "No autenticado"));
    }
    if (isStaffRole(req.user.role)) {
      return next();
    }

    const requestedId = req.params[paramName];
    if (req.user.cliente_id !== requestedId) {
      return next(new ApiError(403, "FORBIDDEN", "Recurso fuera de alcance"));
    }
    return next();
  };
}
