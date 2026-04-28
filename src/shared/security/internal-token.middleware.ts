import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../http/error-handler.js";

export function requireInternalToken(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected) {
    return next(new ApiError(500, "INTERNAL_ERROR", "Token interno no configurado"));
  }

  const provided = req.header("x-internal-token") ?? "";
  if (provided !== expected) {
    return next(new ApiError(403, "FORBIDDEN", "Token interno inválido"));
  }
  return next();
}

export function verifyWebhookToken(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.WHATSAPP_WEBHOOK_TOKEN;
  if (!expected) {
    return next(new ApiError(500, "INTERNAL_ERROR", "Token webhook no configurado"));
  }

  const provided = req.header("x-webhook-token") ?? req.query.token;
  if (provided !== expected) {
    return next(new ApiError(401, "UNAUTHORIZED", "Webhook no autorizado"));
  }
  return next();
}
