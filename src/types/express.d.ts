import "express";
import type { AuthRole } from "../shared/security/roles.js";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        id: string;
        role: AuthRole;
        cliente_id: string | null;
        email: string;
      };
    }
  }
}
