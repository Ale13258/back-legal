import { Router } from "express";
import { ApiError } from "../../../../shared/http/error-handler.js";
import { resolveOutboundFrom } from "../../../../shared/infrastructure/email/gmail-transport.js";
import {
  diffCampos,
  listarHistorial,
  registrarHistorial,
} from "../../../../shared/infrastructure/historial/historial-cambios.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { requireAuth, requireStaff } from "../../../../shared/security/auth.middleware.js";
import { isCronAuthorized } from "../../../../shared/security/cron-auth.js";
import { NodemailerGmailEmailSender } from "../../../payment-reminders/infrastructure/email/nodemailer-gmail.sender.js";
import {
  PAYMENT_REMINDER_LOGO_CID,
  getLegaltechLogoAttachment,
} from "../../../payment-reminders/infrastructure/email/payment-reminder-email-assets.js";
import { resolveAlertasAppUrl } from "../../../tutelas/infrastructure/http/tutelas.routes.js";
import {
  dateFromYmd,
  resolveDestinatariosAlertaTutelas,
  ymdFromDate,
} from "../../../tutelas/infrastructure/persistence/tutelas-prisma.repository.js";
import { EnviarAlertasPqrsUseCase } from "../../application/enviar-alertas-pqrs.use-case.js";
import { calcularVencimientoPqr } from "../../domain/alerta-pqr.js";
import {
  PqrsAlertaPrismaRepository,
  esResponsableValido,
  listarResponsablesPqr,
  pqrInclude,
  toPqrResponse,
} from "../persistence/pqrs-prisma.repository.js";
import { createPqrSchema, patchPqrSchema } from "./pqrs.schemas.js";

export function resolvePqrsLinks(): { label: string; url: string }[] {
  return [{ label: "Abrir PQR en LegalTech", url: `${resolveAlertasAppUrl()}/pqrs` }];
}

const enviarAlertas = new EnviarAlertasPqrsUseCase({
  repo: new PqrsAlertaPrismaRepository(),
  emailSender: new NodemailerGmailEmailSender(),
  from: () => resolveOutboundFrom({ from_name: "LegalTech" }),
  resolveDestinatarios: resolveDestinatariosAlertaTutelas,
  logoAttachment: getLegaltechLogoAttachment,
  logoCid: PAYMENT_REMINDER_LOGO_CID,
  pqrsLinks: resolvePqrsLinks,
});

/** Campos de la respuesta que quedan en la trazabilidad. */
const CAMPOS_HISTORIAL_PQR = [
  "responsable_email",
  "solicitante",
  "entidad",
  "asunto",
  "fecha_radicacion",
  "radicado",
  "vencimiento",
  "estado",
  "cerrada",
] as const;

async function findPqrActiva(id: string) {
  const row = await prisma.pqr.findFirst({ where: { id, deleted_at: null }, include: pqrInclude });
  if (!row) throw new ApiError(404, "NOT_FOUND", "PQR no encontrada");
  return row;
}

async function assertResponsable(responsableId: string | null | undefined): Promise<void> {
  if (!responsableId) return;
  if (!(await esResponsableValido(responsableId))) {
    throw new ApiError(400, "RESPONSABLE_INVALIDO", "El responsable debe ser un usuario activo del equipo");
  }
}

export const pqrsRouter = Router();

/** Vercel Cron: envía `Authorization: Bearer $CRON_SECRET`. Va antes de `requireAuth`. */
pqrsRouter.get("/alertas/cron", async (req, res, next) => {
  try {
    if (!isCronAuthorized(req)) {
      throw new ApiError(401, "UNAUTHORIZED", "Cron no autorizado");
    }
    res.json(await enviarAlertas.execute());
  } catch (error) {
    next(error);
  }
});

pqrsRouter.use(requireAuth, requireStaff());

pqrsRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.pqr.findMany({
      where: { deleted_at: null },
      include: pqrInclude,
      orderBy: [{ fecha_radicacion: "desc" }, { created_at: "desc" }],
    });
    res.json({ items: rows.map(toPqrResponse) });
  } catch (error) {
    next(error);
  }
});

pqrsRouter.get("/responsables", async (_req, res, next) => {
  try {
    res.json({ items: await listarResponsablesPqr() });
  } catch (error) {
    next(error);
  }
});

pqrsRouter.get("/:id/historial", async (req, res, next) => {
  try {
    res.json({ items: await listarHistorial("pqr", [req.params.id]) });
  } catch (error) {
    next(error);
  }
});

pqrsRouter.post("/", async (req, res, next) => {
  try {
    const dto = createPqrSchema.parse(req.body);
    await assertResponsable(dto.responsable_id);
    const vencimiento =
      dto.vencimiento !== undefined ? dto.vencimiento : calcularVencimientoPqr(dto.fecha_radicacion);

    const creada = await prisma.$transaction(async (tx) => {
      const row = await tx.pqr.create({
        data: {
          responsable_id: dto.responsable_id ?? null,
          solicitante: dto.solicitante,
          entidad: dto.entidad,
          asunto: dto.asunto,
          fecha_radicacion: dateFromYmd(dto.fecha_radicacion) as Date,
          radicado: dto.radicado ?? null,
          vencimiento: dateFromYmd(vencimiento),
          estado: dto.estado ?? null,
          cerrada: dto.cerrada ?? false,
        },
        include: pqrInclude,
      });
      const response = toPqrResponse(row);
      await registrarHistorial(tx, {
        entidad: "pqr",
        registro_id: row.id,
        accion: "creada",
        cambios: diffCampos(null, response, CAMPOS_HISTORIAL_PQR),
        usuario_email: req.user?.email,
      });
      return response;
    });
    res.status(201).json(creada);
  } catch (error) {
    next(error);
  }
});

pqrsRouter.patch("/:id", async (req, res, next) => {
  try {
    const dto = patchPqrSchema.parse(req.body);
    const current = await findPqrActiva(req.params.id);
    await assertResponsable(dto.responsable_id);

    const vencimiento =
      dto.vencimiento !== undefined
        ? dto.vencimiento
        : dto.fecha_radicacion !== undefined
          ? calcularVencimientoPqr(dto.fecha_radicacion)
          : undefined;
    const vencimientoCambia =
      vencimiento !== undefined && vencimiento !== ymdFromDate(current.vencimiento);

    const actualizada = await prisma.$transaction(async (tx) => {
      const row = await tx.pqr.update({
        where: { id: current.id },
        data: {
          responsable_id: dto.responsable_id,
          // Al asignar responsable dejan de usarse las iniciales importadas del Excel.
          ...(dto.responsable_id !== undefined ? { gestion: null } : {}),
          solicitante: dto.solicitante,
          entidad: dto.entidad,
          asunto: dto.asunto,
          fecha_radicacion: dateFromYmd(dto.fecha_radicacion) ?? undefined,
          radicado: dto.radicado,
          vencimiento: dateFromYmd(vencimiento),
          estado: dto.estado,
          cerrada: dto.cerrada,
          ...(vencimientoCambia
            ? { alerta_por_vencer_enviada_at: null, alerta_vencida_enviada_at: null }
            : {}),
        },
        include: pqrInclude,
      });
      const response = toPqrResponse(row);
      await registrarHistorial(tx, {
        entidad: "pqr",
        registro_id: row.id,
        accion: "actualizada",
        cambios: diffCampos(toPqrResponse(current), response, CAMPOS_HISTORIAL_PQR),
        usuario_email: req.user?.email,
      });
      return response;
    });
    res.json(actualizada);
  } catch (error) {
    next(error);
  }
});

/** Soft delete: la fila se conserva con fecha y autor para trazabilidad. */
pqrsRouter.delete("/:id", async (req, res, next) => {
  try {
    const current = await findPqrActiva(req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.pqr.update({
        where: { id: current.id },
        data: { deleted_at: new Date(), deleted_by: req.user?.email ?? null },
      });
      await registrarHistorial(tx, {
        entidad: "pqr",
        registro_id: current.id,
        accion: "eliminada",
        cambios: [],
        usuario_email: req.user?.email,
      });
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
