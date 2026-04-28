import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import {
  requireAuth,
  requireOwnershipOrAdmin,
  requireRole,
} from "../../../../shared/security/auth.middleware.js";

const clienteCreateSchema = z.object({
  nombre: z.string().min(1),
  tipo_persona: z.enum(["natural", "juridica"]),
  documento: z.string().min(1),
  telefono: z.string().optional(),
  email: z.string().email(),
  direccion: z.string().optional(),
  observaciones: z.string().optional(),
});

const clientePatchSchema = clienteCreateSchema.partial();

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

clientesRouter.get("/", requireRole("admin"), async (req, res, next) => {
  try {
    const search = String(req.query.search || "");
    const tipo_persona =
      req.query.tipo_persona === "natural" || req.query.tipo_persona === "juridica"
        ? req.query.tipo_persona
        : undefined;

    const items = await prisma.cliente.findMany({
      where: {
        ...(tipo_persona ? { tipo_persona } : {}),
        ...(search
          ? {
              OR: [
                { nombre: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { documento: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { created_at: "desc" },
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

clientesRouter.get("/:id", requireOwnershipOrAdmin("id"), async (req, res, next) => {
  try {
    const item = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ code: "NOT_FOUND", message: "Cliente no encontrado" });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

clientesRouter.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const dto = clienteCreateSchema.parse(req.body);
    const created = await prisma.cliente.create({ data: dto });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

clientesRouter.patch("/:id", requireOwnershipOrAdmin("id"), async (req, res, next) => {
  try {
    const dto = clientePatchSchema.parse(req.body);
    const updated = await prisma.cliente.update({
      where: { id: req.params.id },
      data: dto,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

clientesRouter.get("/:id/propiedades", requireOwnershipOrAdmin("id"), async (req, res, next) => {
  try {
    const items = await prisma.propiedad.findMany({
      where: { cliente_id: req.params.id },
      orderBy: { created_at: "desc" },
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

clientesRouter.get("/:id/cuentas", requireOwnershipOrAdmin("id"), async (req, res, next) => {
  try {
    const items = await prisma.cuenta.findMany({
      where: { cliente_id: req.params.id },
      orderBy: { created_at: "desc" },
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});
