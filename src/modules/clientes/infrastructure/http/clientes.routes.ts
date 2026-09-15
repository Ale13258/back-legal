import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { NodemailerGmailEmailSender } from "../../../../shared/infrastructure/email/nodemailer-gmail.sender.js";
import {
  requireAuth,
  requireOwnershipOrStaff,
  requireStaff,
} from "../../../../shared/security/auth.middleware.js";
import { CreateClienteUseCase } from "../../application/use-cases/create-cliente.use-case.js";
import { ResendClienteInvitationUseCase } from "../../application/use-cases/resend-cliente-invitation.use-case.js";
import {
  LEGALTECH_TENANT_DOCUMENTO,
  LEGALTECH_TENANT_EMAIL,
} from "../../../cuentas/infrastructure/persistence/ensure-creditor-for-cliente.js";

/** Tenant SaaS interno: no es cliente de cartera y no debe listarse en la UI. */
const notLegalTechTenant = {
  NOT: {
    OR: [{ email: LEGALTECH_TENANT_EMAIL }, { documento: LEGALTECH_TENANT_DOCUMENTO }],
  },
};

const clienteCreateSchema = z.object({
  nombre: z.string().min(1),
  tipo_persona: z.enum(["natural", "juridica"]),
  documento: z.string().min(1),
  telefono: z.string().optional(),
  email: z.string().email(),
  direccion: z.string().optional(),
  observaciones: z.string().optional(),
});

const clientePatchSchema = z.object({
  nombre: z.string().min(1).optional(),
  tipo_persona: z.enum(["natural", "juridica"]).optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  direccion: z.string().optional(),
  observaciones: z.string().optional(),
});

export const clientesRouter = Router();
clientesRouter.use(requireAuth);

const emailSender = new NodemailerGmailEmailSender();
const createClienteUseCase = new CreateClienteUseCase({ emailSender });
const resendClienteInvitationUseCase = new ResendClienteInvitationUseCase({ emailSender });

clientesRouter.get("/", requireStaff(), async (req, res, next) => {
  try {
    const search = String(req.query.search || "");
    const tipo_persona =
      req.query.tipo_persona === "natural" || req.query.tipo_persona === "juridica"
        ? req.query.tipo_persona
        : undefined;

    const items = await prisma.cliente.findMany({
      where: {
        ...notLegalTechTenant,
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

clientesRouter.get("/:id", requireOwnershipOrStaff("id"), async (req, res, next) => {
  try {
    const item = await prisma.cliente.findFirst({
      where: { id: req.params.id, ...notLegalTechTenant },
    });
    if (!item) return res.status(404).json({ code: "NOT_FOUND", message: "Cliente no encontrado" });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

clientesRouter.post("/", requireStaff(), async (req, res, next) => {
  try {
    const dto = clienteCreateSchema.parse(req.body);
    if (
      dto.email.trim().toLowerCase() === LEGALTECH_TENANT_EMAIL ||
      dto.documento.trim() === LEGALTECH_TENANT_DOCUMENTO
    ) {
      return res.status(400).json({
        code: "BUSINESS_RULE_VIOLATION",
        message: "No se puede registrar el tenant interno LegalTech como cliente de cartera",
      });
    }
    const created = await createClienteUseCase.execute(dto);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

clientesRouter.post("/:id/resend-invitation", requireStaff(), async (req, res, next) => {
  try {
    const item = await resendClienteInvitationUseCase.execute({ id: req.params.id });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

clientesRouter.patch("/:id", requireOwnershipOrStaff("id"), async (req, res, next) => {
  try {
    const dto = clientePatchSchema.parse(req.body);
    const existing = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ code: "NOT_FOUND", message: "Cliente no encontrado" });
    }
    const updated = await prisma.cliente.update({
      where: { id: req.params.id },
      data: dto,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

clientesRouter.get("/:id/cuentas", requireOwnershipOrStaff("id"), async (req, res, next) => {
  try {
    const items = await prisma.cuenta.findMany({
      where: { cliente_id: req.params.id, deleted_at: null },
      orderBy: { created_at: "desc" },
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

clientesRouter.get("/:id/procesos-legales", requireOwnershipOrStaff("id"), async (req, res, next) => {
  try {
    const rows = await prisma.procesoLegal.findMany({
      where: {
        deleted_at: null,
        cuenta: { cliente_id: req.params.id, deleted_at: null },
      },
      include: { cuenta: { select: { cliente_id: true } } },
      orderBy: { created_at: "desc" },
    });
    // Compat front: cliente_id se deriva de la cuenta (ya no es columna del proceso).
    const items = rows.map(({ cuenta, ...proceso }) => ({
      ...proceso,
      cliente_id: cuenta.cliente_id,
    }));
    res.json({ items });
  } catch (error) {
    next(error);
  }
});
