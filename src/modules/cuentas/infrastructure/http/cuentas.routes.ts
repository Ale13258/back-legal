import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import {
  requireAuth,
  requireRole,
} from "../../../../shared/security/auth.middleware.js";
import { ApiError } from "../../../../shared/http/error-handler.js";

const createSchema = z.object({
  cliente_id: z.string().uuid(),
  propiedad_id: z.string().uuid().nullable().optional(),
  numero_cuenta: z.string().min(1),
  tipo: z.enum(["juridica", "extrajudicial", "acuerdo_de_pago"]),
  estado: z.enum(["activa", "cerrada", "en_proceso"]),
  etapa_proceso: z.enum(["inicial", "notificacion", "conciliacion", "demanda", "ejecucion"]),
});

const patchSchema = createSchema
  .omit({ cliente_id: true, numero_cuenta: true })
  .partial();

export const cuentasRouter = Router();
cuentasRouter.use(requireAuth);

cuentasRouter.get("/:id", async (req, res, next) => {
  try {
    const item = await prisma.cuenta.findUnique({ where: { id: req.params.id } });
    if (!item) throw new ApiError(404, "NOT_FOUND", "Cuenta no encontrada");
    if (req.user?.role === "cliente" && req.user.cliente_id !== item.cliente_id) {
      throw new ApiError(403, "FORBIDDEN", "Recurso fuera de alcance");
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

cuentasRouter.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const dto = createSchema.parse(req.body);
    const created = await prisma.cuenta.create({ data: dto });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

cuentasRouter.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const dto = patchSchema.parse(req.body);
    const updated = await prisma.cuenta.update({
      where: { id: req.params.id },
      data: dto,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});
