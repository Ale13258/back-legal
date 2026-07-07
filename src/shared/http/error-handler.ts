import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(
    new ApiError(
      404,
      "NOT_FOUND",
      `Ruta no encontrada: ${req.method} ${req.path}`,
    ),
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Payload invalido",
      details: err.flatten(),
      request_id: req.requestId ?? "unknown",
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      details: err.details,
      request_id: req.requestId ?? "unknown",
    });
  }

  if (
    err &&
    typeof err === "object" &&
    "type" in err &&
    (err as { type: string }).type === "entity.too.large"
  ) {
    return res.status(413).json({
      code: "PAYLOAD_TOO_LARGE",
      message: "El cuerpo de la solicitud supera el límite permitido",
      request_id: req.requestId ?? "unknown",
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        code: "CONFLICT",
        message: "Conflicto por valor unico duplicado",
        details: err.meta,
        request_id: req.requestId ?? "unknown",
      });
    }
    if (err.code === "P2003") {
      return res.status(409).json({
        code: "CONFLICT",
        message: "No se puede completar la operacion por registros asociados",
        details: err.meta,
        request_id: req.requestId ?? "unknown",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Registro no encontrado",
        details: err.meta,
        request_id: req.requestId ?? "unknown",
      });
    }
  }

  console.error("Unhandled error", {
    request_id: req.requestId ?? "unknown",
    method: req.method,
    path: req.path,
    error_name: err instanceof Error ? err.name : typeof err,
    error_message: err instanceof Error ? err.message : String(err),
    error: err,
  });
  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Error interno",
    request_id: req.requestId ?? "unknown",
  });
}
