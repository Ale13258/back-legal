import { z } from "zod";
import { ETAPA_TUTELA_VALUES } from "../../domain/etapa-tutela.js";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD");
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const createTutelaSchema = z.object({
  cliente_id: z.string().uuid().nullable().optional(),
  fecha_radicacion: ymd.nullable().optional(),
  /** Día en que la tutela entró a la etapa actual; si se omite y la etapa cambia, hoy. */
  fecha_etapa: ymd.nullable().optional(),
  /** Si se omite, se calcula con el término de la etapa. */
  vencimiento: ymd.nullable().optional(),
  radicado: optionalText,
  juzgado: optionalText,
  accionante: z.string().trim().min(1),
  accionado: z.string().trim().min(1),
  derecho: z.string().trim().min(1).optional(),
  etapa: z.enum(ETAPA_TUTELA_VALUES).optional(),
  observaciones: optionalText,
  nota: optionalText.pipe(z.string().max(500).nullable().optional()),
});

export const patchTutelaSchema = createTutelaSchema.partial();
export type CreateTutelaDto = z.infer<typeof createTutelaSchema>;
export type PatchTutelaDto = z.infer<typeof patchTutelaSchema>;
