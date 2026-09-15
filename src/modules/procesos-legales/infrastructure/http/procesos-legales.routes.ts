import { Router } from "express";
import { z } from "zod";
import { ETAPA_PROCESO_VALUES } from "../../domain/etapa-proceso.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import {
  requireAuth,
  requireStaff,
} from "../../../../shared/security/auth.middleware.js";
import { ApiError } from "../../../../shared/http/error-handler.js";

const createSchema = z.object({
  cuenta_id: z.string().uuid(),
  /** Ignorado: compat con front que aún lo envía; el dueño sale de la cuenta. */
  cliente_id: z.string().uuid().optional(),
  numero_cuenta: z.string().min(1),
  tipo: z.enum(["juridica", "extrajudicial", "acuerdo_de_pago"]),
  estado: z.enum(["activa", "cerrada", "en_proceso"]),
  etapa_proceso: z.enum(ETAPA_PROCESO_VALUES),
});

const patchSchema = createSchema.omit({ numero_cuenta: true, cliente_id: true }).partial();

type ProcesoConCuenta = {
  cuenta: { cliente_id: string };
  id: string;
  cuenta_id: string;
  numero_cuenta: string;
  tipo: string;
  estado: string;
  etapa_proceso: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function toProcesoResponse(row: ProcesoConCuenta) {
  const { cuenta, ...proceso } = row;
  return { ...proceso, cliente_id: cuenta.cliente_id };
}

export const procesosLegalesRouter = Router();
procesosLegalesRouter.use(requireAuth);

procesosLegalesRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await prisma.procesoLegal.findFirst({
      where: { id: req.params.id, deleted_at: null },
      include: { cuenta: { select: { cliente_id: true } } },
    });
    if (!item) throw new ApiError(404, "NOT_FOUND", "Proceso legal no encontrado");
    if (req.user?.role === "cliente" && req.user.cliente_id !== item.cuenta.cliente_id) {
      throw new ApiError(403, "FORBIDDEN", "Recurso fuera de alcance");
    }
    res.json(toProcesoResponse(item));
  } catch (error) {
    next(error);
  }
});

procesosLegalesRouter.post("/", requireStaff(), async (req, res, next) => {
  try {
    const { cliente_id: _ignored, ...dto } = createSchema.parse(req.body);
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: dto.cuenta_id, deleted_at: null },
      select: { id: true, cliente_id: true },
    });
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }
    const created = await prisma.procesoLegal.create({
      data: dto,
      include: { cuenta: { select: { cliente_id: true } } },
    });
    res.status(201).json(toProcesoResponse(created));
  } catch (error) {
    next(error);
  }
});

procesosLegalesRouter.patch("/:id", requireStaff(), async (req, res, next) => {
  try {
    const dto = patchSchema.parse(req.body);
    const existing = await prisma.procesoLegal.findFirst({
      where: { id: req.params.id, deleted_at: null },
    });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Proceso legal no encontrado");
    }
    if (dto.cuenta_id) {
      const cuenta = await prisma.cuenta.findFirst({
        where: { id: dto.cuenta_id, deleted_at: null },
        select: { id: true },
      });
      if (!cuenta) {
        throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
      }
    }
    const updated = await prisma.procesoLegal.update({
      where: { id: req.params.id },
      data: dto,
      include: { cuenta: { select: { cliente_id: true } } },
    });
    res.json(toProcesoResponse(updated));
  } catch (error) {
    next(error);
  }
});

/** Soft delete: marca deleted_at. No borra la fila ni confunde con estado=cerrada. */
procesosLegalesRouter.delete("/:id", requireStaff(), async (req, res, next) => {
  try {
    const existing = await prisma.procesoLegal.findFirst({
      where: { id: req.params.id, deleted_at: null },
    });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", "Proceso legal no encontrado");
    }

    await prisma.procesoLegal.update({
      where: { id: req.params.id },
      data: { deleted_at: new Date() },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
