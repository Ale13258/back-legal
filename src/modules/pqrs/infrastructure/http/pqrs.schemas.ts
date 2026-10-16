import { z } from "zod";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha en formato YYYY-MM-DD");
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const createPqrSchema = z.object({
  /** Usuario del staff que lleva la PQR. */
  responsable_id: z.string().uuid().nullable().optional(),
  solicitante: z.string().trim().min(1),
  entidad: z.string().trim().min(1),
  asunto: z.string().trim().min(1),
  fecha_radicacion: ymd,
  radicado: optionalText,
  /** Si se omite, 15 días hábiles desde la radicación. */
  vencimiento: ymd.nullable().optional(),
  estado: optionalText.pipe(z.string().max(500).nullable().optional()),
  cerrada: z.boolean().optional(),
});

export const patchPqrSchema = createPqrSchema.partial();
export type CreatePqrDto = z.infer<typeof createPqrSchema>;
export type PatchPqrDto = z.infer<typeof patchPqrSchema>;
