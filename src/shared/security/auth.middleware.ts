import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../http/error-handler.js";
import { verifyAccessToken } from "./jwt.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = req.header("authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return next(new ApiError(401, "UNAUTHORIZED", "Token requerido"));
  }

  const token = auth.slice("Bearer ".length);
  req.user = verifyAccessToken(token);
  return next();
}

export function requireRole(...roles: Array<"admin" | "cliente">) {
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

export function requireOwnershipOrAdmin(paramName = "id") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHORIZED", "No autenticado"));
    }
    if (req.user.role === "admin") {
      return next();
    }

    const requestedId = req.params[paramName];
    if (req.user.cliente_id !== requestedId) {
      return next(new ApiError(403, "FORBIDDEN", "Recurso fuera de alcance"));
    }
    return next();
  };
}
