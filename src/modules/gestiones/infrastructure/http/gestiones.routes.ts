import { Router } from "express";
import { requireAuth, requireRole } from "../../../../shared/security/auth.middleware.js";
import { GestionesPrismaRepository } from "../persistence/gestiones-prisma.repository.js";
import { ListGestionesUseCase } from "../../application/use-cases/list-gestiones.use-case.js";

export const gestionesRouter = Router();
gestionesRouter.use(requireAuth, requireRole("admin"));

const repo = new GestionesPrismaRepository();
const listGestionesUseCase = new ListGestionesUseCase({ gestionesPersistence: repo });

gestionesRouter.get("/", async (_req, res, next) => {
  try {
    const items = await listGestionesUseCase.execute();
    res.json({ items });
  } catch (error) {
    next(error);
  }
});
