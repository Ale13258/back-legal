import { z } from "zod";
import { ETAPA_PROCESO_VALUES } from "../../domain/etapa-proceso.js";

export const createProcesoLegalSchema = z.object({
  cuenta_id: z.string().uuid(),
  /** Ignorado: compat con front que aún lo envía; el dueño sale de la cuenta. */
  cliente_id: z.string().uuid().optional(),
  numero_cuenta: z.string().trim().min(1),
  tipo: z.enum(["juridica", "extrajudicial", "acuerdo_de_pago"]),
  estado: z.enum(["activa", "cerrada", "en_proceso"]),
  etapa_proceso: z.enum(ETAPA_PROCESO_VALUES),
});

export const patchProcesoLegalSchema = createProcesoLegalSchema
  .omit({ cliente_id: true })
  .partial();
