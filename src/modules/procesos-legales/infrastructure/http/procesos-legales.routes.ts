import { Router } from "express";
import {
  assertNumeroCuentaDisponible,
  type ActiveProcesoByNumeroFinder,
} from "../../application/assert-numero-cuenta-disponible.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import {
  requireAuth,
  requireStaff,
} from "../../../../shared/security/auth.middleware.js";
import { ApiError } from "../../../../shared/http/error-handler.js";
import {
  createProcesoLegalSchema,
  patchProcesoLegalSchema,
} from "./procesos-legales.schemas.js";

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

const numeroCuentaRepo: ActiveProcesoByNumeroFinder = {
  findFirst: (args) => prisma.procesoLegal.findFirst(args),
};

export const procesosLegalesRouter = Router();
procesosLegalesRouter.use(requireAuth);

/** Listado staff: evita N+1 del dashboard (antes: GET por cada cliente). */
procesosLegalesRouter.get("/", requireStaff(), async (_req, res, next) => {
  try {
    const rows = await prisma.procesoLegal.findMany({
      where: {
        deleted_at: null,
        cuenta: { deleted_at: null },
      },
      include: { cuenta: { select: { cliente_id: true } } },
      orderBy: { created_at: "desc" },
    });
    const items = rows.map((row) => toProcesoResponse(row));
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

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
    const { cliente_id: _ignored, ...dto } = createProcesoLegalSchema.parse(req.body);
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: dto.cuenta_id, deleted_at: null },
      select: { id: true, cliente_id: true },
    });
    if (!cuenta) {
      throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    }
    await assertNumeroCuentaDisponible(numeroCuentaRepo, dto.numero_cuenta);
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
    const dto = patchProcesoLegalSchema.parse(req.body);
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
    if (dto.numero_cuenta) {
      await assertNumeroCuentaDisponible(
        numeroCuentaRepo,
        dto.numero_cuenta,
        req.params.id,
      );
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
