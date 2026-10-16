import type { Prisma } from "@prisma/client";
import { listarHistorial } from "../../../../shared/infrastructure/historial/historial-cambios.js";
import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import { STAFF_ROLES } from "../../../../shared/security/roles.js";
import type {
  TutelaParaAlerta,
  TutelasAlertaRepository,
} from "../../application/enviar-alertas-tutelas.use-case.js";
import { ETAPAS_TUTELA_SIN_ALERTA } from "../../domain/etapa-tutela.js";

export const tutelaInclude = {
  cliente: { select: { nombre: true } },
} satisfies Prisma.TutelaInclude;

type TutelaRow = Prisma.TutelaGetPayload<{ include: typeof tutelaInclude }>;

export function ymdFromDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function dateFromYmd(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

export function toTutelaResponse(row: TutelaRow) {
  const { cliente, ...tutela } = row;
  return {
    ...tutela,
    fecha_radicacion: ymdFromDate(row.fecha_radicacion),
    fecha_etapa: ymdFromDate(row.fecha_etapa),
    vencimiento: ymdFromDate(row.vencimiento),
    cliente_nombre: cliente?.nombre ?? null,
  };
}

function toTutelaParaAlerta(row: TutelaRow): TutelaParaAlerta {
  return {
    id: row.id,
    radicado: row.radicado,
    juzgado: row.juzgado,
    accionante: row.accionante,
    accionado: row.accionado,
    derecho: row.derecho,
    cliente_nombre: row.cliente?.nombre ?? null,
    nota: row.nota,
    etapa: row.etapa,
    vencimiento: ymdFromDate(row.vencimiento),
    alerta_por_vencer_enviada_at: row.alerta_por_vencer_enviada_at,
    alerta_vencida_enviada_at: row.alerta_vencida_enviada_at,
  };
}

export class TutelasAlertaPrismaRepository implements TutelasAlertaRepository {
  async listarCandidatas(hastaYmd: string): Promise<TutelaParaAlerta[]> {
    const rows = await prisma.tutela.findMany({
      where: {
        deleted_at: null,
        vencimiento: { not: null, lte: dateFromYmd(hastaYmd) as Date },
        etapa: { notIn: [...ETAPAS_TUTELA_SIN_ALERTA] },
        OR: [{ alerta_por_vencer_enviada_at: null }, { alerta_vencida_enviada_at: null }],
      },
      include: tutelaInclude,
    });
    return rows.map(toTutelaParaAlerta);
  }

  async marcarAlertas(input: { por_vencer: string[]; vencidas: string[]; at: Date }): Promise<{ claimed: number }> {
    const ops = [];
    if (input.por_vencer.length > 0) {
      ops.push(
        prisma.tutela.updateMany({
          where: { id: { in: input.por_vencer }, alerta_por_vencer_enviada_at: null },
          data: { alerta_por_vencer_enviada_at: input.at },
        }),
      );
    }
    if (input.vencidas.length > 0) {
      ops.push(
        prisma.tutela.updateMany({
          where: { id: { in: input.vencidas }, alerta_vencida_enviada_at: null },
          data: { alerta_vencida_enviada_at: input.at },
        }),
      );
    }
    if (ops.length === 0) return { claimed: 0 };
    const results = await prisma.$transaction(ops);
    return { claimed: results.reduce((n, r) => n + r.count, 0) };
  }
}

/** Campos internos que no salen en el informe del propietario. */
const CAMPOS_INTERNOS_INFORME = new Set(["nota", "observaciones", "cliente_nombre"]);

/** Tutelas del cliente para su informe: sin nota interna ni usuario que hizo cada cambio. */
export async function listarTutelasParaInformeCliente(clienteId: string) {
  const rows = await prisma.tutela.findMany({
    where: { cliente_id: clienteId, deleted_at: null },
    orderBy: [{ fecha_radicacion: { sort: "desc", nulls: "last" } }, { created_at: "desc" }],
  });
  const historial = await listarHistorial(
    "tutela",
    rows.map((r) => r.id),
  );
  return rows.map((row) => ({
    id: row.id,
    radicado: row.radicado,
    juzgado: row.juzgado,
    accionante: row.accionante,
    accionado: row.accionado,
    derecho: row.derecho,
    etapa: row.etapa,
    fecha_radicacion: ymdFromDate(row.fecha_radicacion),
    fecha_etapa: ymdFromDate(row.fecha_etapa),
    vencimiento: ymdFromDate(row.vencimiento),
    created_at: row.created_at.toISOString(),
    historial: historial
      .filter((h) => h.registro_id === row.id)
      .map((h) => ({
        accion: h.accion,
        created_at: h.created_at,
        cambios: h.cambios.filter((c) => !CAMPOS_INTERNOS_INFORME.has(c.campo)),
      }))
      .filter((h) => h.accion !== "actualizada" || h.cambios.length > 0),
  }));
}

/** `TUTELAS_ALERTA_EMAILS` (separados por coma) o, si no existe, todo el staff activo. */
export async function resolveDestinatariosAlertaTutelas(): Promise<string[]> {
  const fromEnv = (process.env.TUTELAS_ALERTA_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  const staff = await prisma.usuario.findMany({
    where: {
      role: { in: [...STAFF_ROLES] },
      is_active: true,
      activated_at: { not: null },
    },
    select: { email: true },
  });
  return staff.map((u) => u.email);
}
