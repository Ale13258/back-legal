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
import { EnviarAlertasTutelasUseCase } from "../../application/enviar-alertas-tutelas.use-case.js";
import { getBusinessTodayYmd } from "../../../cuentas/domain/business-calendar.js";
import { calcularVencimientoEtapa } from "../../domain/etapa-tutela.js";
import {
  TutelasAlertaPrismaRepository,
  dateFromYmd,
  resolveDestinatariosAlertaTutelas,
  toTutelaResponse,
  tutelaInclude,
  ymdFromDate,
} from "../persistence/tutelas-prisma.repository.js";
import { createTutelaSchema, patchTutelaSchema } from "./tutelas.schemas.js";

const TUTELAS_APP_URL_PRODUCCION = "https://app.abogadosdigitales.com.co";

/** Los correos de alerta siempre abren producción, aunque se envíen desde un backend local. */
export function resolveAlertasAppUrl(): string {
  return (process.env.TUTELAS_APP_URL?.trim() || TUTELAS_APP_URL_PRODUCCION).replace(/\/+$/, "");
}

export function resolveTutelasLinks(): { label: string; url: string }[] {
  return [{ label: "Abrir tutelas en LegalTech", url: `${resolveAlertasAppUrl()}/tutelas` }];
}

const alertaRepo = new TutelasAlertaPrismaRepository();
const emailSender = new NodemailerGmailEmailSender();
const outboundFrom = () => resolveOutboundFrom({ from_name: "LegalTech" });

const enviarAlertas = new EnviarAlertasTutelasUseCase({
  repo: alertaRepo,
  emailSender,
  from: outboundFrom,
  resolveDestinatarios: resolveDestinatariosAlertaTutelas,
  logoAttachment: getLegaltechLogoAttachment,
  logoCid: PAYMENT_REMINDER_LOGO_CID,
  tutelasLinks: resolveTutelasLinks,
});

async function assertClienteExiste(clienteId: string | null | undefined): Promise<void> {
  if (!clienteId) return;
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) throw new ApiError(400, "CLIENTE_NOT_FOUND", "El cliente indicado no existe");
}

async function findTutelaActiva(id: string) {
  const row = await prisma.tutela.findFirst({ where: { id, deleted_at: null }, include: tutelaInclude });
  if (!row) throw new ApiError(404, "NOT_FOUND", "Tutela no encontrada");
  return row;
}

/** Campos de la respuesta que quedan en la trazabilidad. */
const CAMPOS_HISTORIAL_TUTELA = [
  "fecha_radicacion",
  "radicado",
  "juzgado",
  "accionante",
  "accionado",
  "derecho",
  "cliente_nombre",
  "etapa",
  "fecha_etapa",
  "vencimiento",
  "nota",
] as const;

export const tutelasRouter = Router();

/** Vercel Cron: envía `Authorization: Bearer $CRON_SECRET`. Va antes de `requireAuth`. */
tutelasRouter.get("/alertas/cron", async (req, res, next) => {
  try {
    if (!isCronAuthorized(req)) {
      throw new ApiError(401, "UNAUTHORIZED", "Cron no autorizado");
    }
    res.json(await enviarAlertas.execute());
  } catch (error) {
    next(error);
  }
});

tutelasRouter.use(requireAuth, requireStaff());

tutelasRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await prisma.tutela.findMany({
      where: { deleted_at: null },
      include: tutelaInclude,
      orderBy: [{ fecha_radicacion: { sort: "desc", nulls: "last" } }, { created_at: "desc" }],
    });
    res.json({ items: rows.map(toTutelaResponse) });
  } catch (error) {
    next(error);
  }
});

tutelasRouter.get("/:id/historial", async (req, res, next) => {
  try {
    res.json({ items: await listarHistorial("tutela", [req.params.id]) });
  } catch (error) {
    next(error);
  }
});

tutelasRouter.post("/", async (req, res, next) => {
  try {
    const dto = createTutelaSchema.parse(req.body);
    await assertClienteExiste(dto.cliente_id);
    const etapa = dto.etapa ?? "radicacion";
    const fechaRadicacion = dto.fecha_radicacion ?? null;
    const fechaEtapa =
      dto.fecha_etapa !== undefined
        ? dto.fecha_etapa
        : etapa === "radicacion"
          ? (fechaRadicacion ?? getBusinessTodayYmd())
          : getBusinessTodayYmd();
    const vencimiento =
      dto.vencimiento !== undefined
        ? dto.vencimiento
        : calcularVencimientoEtapa({ etapa, fecha_etapa: fechaEtapa, fecha_radicacion: fechaRadicacion });

    const creada = await prisma.$transaction(async (tx) => {
      const row = await tx.tutela.create({
        data: {
          cliente_id: dto.cliente_id ?? null,
          fecha_radicacion: dateFromYmd(dto.fecha_radicacion ?? null),
          radicado: dto.radicado ?? null,
          juzgado: dto.juzgado ?? null,
          accionante: dto.accionante,
          accionado: dto.accionado,
          derecho: dto.derecho ?? "PETICION",
          vencimiento: dateFromYmd(vencimiento),
          etapa,
          fecha_etapa: dateFromYmd(fechaEtapa),
          observaciones: dto.observaciones ?? null,
          nota: dto.nota ?? null,
        },
        include: tutelaInclude,
      });
      const response = toTutelaResponse(row);
      await registrarHistorial(tx, {
        entidad: "tutela",
        registro_id: row.id,
        accion: "creada",
        cambios: diffCampos(null, response, CAMPOS_HISTORIAL_TUTELA),
        usuario_email: req.user?.email,
      });
      return response;
    });
    res.status(201).json(creada);
  } catch (error) {
    next(error);
  }
});

tutelasRouter.patch("/:id", async (req, res, next) => {
  try {
    const dto = patchTutelaSchema.parse(req.body);
    const current = await findTutelaActiva(req.params.id);
    await assertClienteExiste(dto.cliente_id);

    const etapa = dto.etapa ?? current.etapa;
    const etapaCambia = dto.etapa !== undefined && dto.etapa !== current.etapa;
    const fechaRadicacion =
      dto.fecha_radicacion !== undefined ? dto.fecha_radicacion : ymdFromDate(current.fecha_radicacion);
    const fechaEtapa =
      dto.fecha_etapa !== undefined
        ? dto.fecha_etapa
        : etapaCambia
          ? getBusinessTodayYmd()
          : ymdFromDate(current.fecha_etapa);
    const baseCambia = etapaCambia || dto.fecha_etapa !== undefined || dto.fecha_radicacion !== undefined;
    const vencimiento =
      dto.vencimiento !== undefined
        ? dto.vencimiento
        : baseCambia
          ? calcularVencimientoEtapa({ etapa, fecha_etapa: fechaEtapa, fecha_radicacion: fechaRadicacion })
          : undefined;
    const vencimientoCambia =
      vencimiento !== undefined && vencimiento !== ymdFromDate(current.vencimiento);

    const actualizada = await prisma.$transaction(async (tx) => {
      const row = await tx.tutela.update({
        where: { id: current.id },
        data: {
          cliente_id: dto.cliente_id,
          fecha_radicacion: dateFromYmd(dto.fecha_radicacion),
          radicado: dto.radicado,
          juzgado: dto.juzgado,
          accionante: dto.accionante,
          accionado: dto.accionado,
          derecho: dto.derecho,
          vencimiento: dateFromYmd(vencimiento),
          etapa: dto.etapa,
          fecha_etapa: dateFromYmd(fechaEtapa),
          observaciones: dto.observaciones,
          nota: dto.nota,
          ...(vencimientoCambia
            ? { alerta_por_vencer_enviada_at: null, alerta_vencida_enviada_at: null }
            : {}),
        },
        include: tutelaInclude,
      });
      const response = toTutelaResponse(row);
      await registrarHistorial(tx, {
        entidad: "tutela",
        registro_id: row.id,
        accion: "actualizada",
        cambios: diffCampos(toTutelaResponse(current), response, CAMPOS_HISTORIAL_TUTELA),
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
tutelasRouter.delete("/:id", async (req, res, next) => {
  try {
    const current = await findTutelaActiva(req.params.id);
    await prisma.$transaction(async (tx) => {
      await tx.tutela.update({
        where: { id: current.id },
        data: { deleted_at: new Date(), deleted_by: req.user?.email ?? null },
      });
      await registrarHistorial(tx, {
        entidad: "tutela",
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