import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../../../shared/security/auth.middleware.js";
import { PropiedadesPrismaRepository } from "../persistence/propiedades-prisma.repository.js";
import { CreateGestionUseCase } from "../../application/use-cases/create-gestion.use-case.js";
import { CreateHistorialPagoUseCase } from "../../application/use-cases/create-historial-pago.use-case.js";
import { CreatePropiedadUseCase } from "../../application/use-cases/create-propiedad.use-case.js";
import { GetPropiedadUseCase } from "../../application/use-cases/get-propiedad.use-case.js";
import { ListGestionesUseCase } from "../../application/use-cases/list-gestiones.use-case.js";
import { ListHistorialPagosUseCase } from "../../application/use-cases/list-historial-pagos.use-case.js";
import { ListPropiedadesUseCase } from "../../application/use-cases/list-propiedades.use-case.js";
import { UpdatePropiedadUseCase } from "../../application/use-cases/update-propiedad.use-case.js";
import { DeletePropiedadUseCase } from "../../application/use-cases/delete-propiedad.use-case.js";
import { DeleteHistorialPagoUseCase } from "../../application/use-cases/delete-historial-pago.use-case.js";
import { UpdateHistorialPagoUseCase } from "../../application/use-cases/update-historial-pago.use-case.js";
import { UpdateGestionUseCase } from "../../application/use-cases/update-gestion.use-case.js";
import { DeleteGestionUseCase } from "../../application/use-cases/delete-gestion.use-case.js";
import {
  deudorFromCobro,
  findDuplicateDocumentoIndexes,
  normalizeDeudores,
} from "../../domain/deudores.js";
import type { DeudorCobro } from "../../domain/ports/propiedades-persistence.port.js";

const deudorCobroSchema = z.object({
  nombre: z.string().trim().min(1),
  tipo_persona: z.enum(["natural", "juridica"]),
  documento: z.string().trim().min(1),
  emails: z.array(z.string().trim().email()).min(1),
});

const deudoresSchema = z
  .array(deudorCobroSchema)
  .min(1)
  .superRefine((items, ctx) => {
    for (const i of findDuplicateDocumentoIndexes(items)) {
      ctx.addIssue({
        code: "custom",
        message: "documento duplicado en la misma unidad",
        path: [i, "documento"],
      });
    }
  });

const cobroFieldsSchema = z.object({
  cobro_nombre: z.string().trim().min(1),
  cobro_tipo_persona: z.enum(["natural", "juridica"]),
  cobro_documento: z.string().trim().min(1),
  cobro_email: z.string().trim().email(),
});

function normalizeYmdInput(val: unknown): unknown {
  if (val === "") return undefined;
  if (val === null || val === undefined) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  return val;
}

const optionalYmdOrNull = z.preprocess(
  normalizeYmdInput,
  z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]).optional(),
);

const propiedadBaseSchema = z.object({
  cliente_id: z.string().uuid(),
  tipo_propiedad: z.enum([
    "apartamento",
    "oficina",
    "local",
    "casa",
    "bodega",
    "garaje",
    "parqueadero",
    "otro",
  ]),
  identificador: z.string().min(1),
  direccion: z.string().optional(),
  notas: z.string().optional(),
  saldo_inicial: z.coerce.number().min(0).optional(),
  fecha_inicio_cobro: optionalYmdOrNull,
  deudores: deudoresSchema.optional(),
  cobro_nombre: z.string().trim().min(1).optional(),
  cobro_tipo_persona: z.enum(["natural", "juridica"]).optional(),
  cobro_documento: z.string().trim().min(1).optional(),
  cobro_email: z.string().trim().email().optional(),
});

const propiedadCreateSchema = propiedadBaseSchema.superRefine((data, ctx) => {
  if (data.deudores && data.deudores.length >= 1) return;
  const missing: Array<keyof typeof data> = [];
  if (!data.cobro_nombre) missing.push("cobro_nombre");
  if (!data.cobro_tipo_persona) missing.push("cobro_tipo_persona");
  if (!data.cobro_documento) missing.push("cobro_documento");
  if (!data.cobro_email) missing.push("cobro_email");
  for (const path of missing) {
    ctx.addIssue({
      code: "custom",
      message: "Requerido si no se envía deudores",
      path: [path],
    });
  }
});

const propiedadPatchSchema = propiedadBaseSchema
  .omit({ cliente_id: true })
  .partial()
  .superRefine((data, ctx) => {
    if (data.deudores === undefined) return;
    // deudores presente → replace; ya validado por deudoresSchema si no es undefined
    if (data.deudores.length < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Se requiere al menos un deudor de cobro",
        path: ["deudores"],
      });
    }
  });

function resolveDeudoresForCreate(dto: z.infer<typeof propiedadCreateSchema>): DeudorCobro[] {
  if (dto.deudores && dto.deudores.length >= 1) {
    return normalizeDeudores(dto.deudores);
  }
  const cobro = cobroFieldsSchema.parse({
    cobro_nombre: dto.cobro_nombre,
    cobro_tipo_persona: dto.cobro_tipo_persona,
    cobro_documento: dto.cobro_documento,
    cobro_email: dto.cobro_email,
  });
  return [deudorFromCobro(cobro)];
}

const historialCreateSchema = z
  .object({
    periodo: z.string().regex(/^\d{4}-\d{2}$/),
    concepto: z.enum(["administracion", "intereses", "extraordinaria", "otros"]),
    valor_cobrado: z.coerce.number().min(0),
    valor_pagado: z.coerce.number().min(0),
    fecha_pago: optionalYmdOrNull,
    estado_pago: z.enum(["pendiente", "parcial", "pagado", "vencido"]),
    observaciones: z.string().optional(),
    fecha_inicio_cobro: optionalYmdOrNull,
    fecha_fin_cobro: optionalYmdOrNull,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.fecha_inicio_cobro != null &&
      data.fecha_fin_cobro != null &&
      data.fecha_fin_cobro < data.fecha_inicio_cobro
    ) {
      ctx.addIssue({
        code: "custom",
        message: "fecha_fin_cobro debe ser >= fecha_inicio_cobro",
        path: ["fecha_fin_cobro"],
      });
    }
  });

const gestionCreateSchema = z.object({
  fecha: z.string(),
  estado: z.string().min(1),
  descripcion: z.string().min(1),
});

const gestionPatchSchema = gestionCreateSchema.partial();

export const propiedadesRouter = Router();
propiedadesRouter.use(requireAuth);

const repo = new PropiedadesPrismaRepository();
const listPropiedadesUseCase = new ListPropiedadesUseCase({ propiedadesPersistence: repo });
const getPropiedadUseCase = new GetPropiedadUseCase({ propiedadesPersistence: repo });
const createPropiedadUseCase = new CreatePropiedadUseCase({ propiedadesPersistence: repo });
const updatePropiedadUseCase = new UpdatePropiedadUseCase({ propiedadesPersistence: repo });
const deletePropiedadUseCase = new DeletePropiedadUseCase({ propiedadesPersistence: repo });
const deleteHistorialPagoUseCase = new DeleteHistorialPagoUseCase({ propiedadesPersistence: repo });
const listHistorialPagosUseCase = new ListHistorialPagosUseCase({ propiedadesPersistence: repo });
const createHistorialPagoUseCase = new CreateHistorialPagoUseCase({ propiedadesPersistence: repo });
const updateHistorialPagoUseCase = new UpdateHistorialPagoUseCase({ propiedadesPersistence: repo });
const listGestionesUseCase = new ListGestionesUseCase({ propiedadesPersistence: repo });
const createGestionUseCase = new CreateGestionUseCase({ propiedadesPersistence: repo });
const updateGestionUseCase = new UpdateGestionUseCase({ propiedadesPersistence: repo });
const deleteGestionUseCase = new DeleteGestionUseCase({ propiedadesPersistence: repo });

propiedadesRouter.get("/", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const cliente_id = typeof req.query.cliente_id === "string" ? req.query.cliente_id : undefined;
    const tipo_propiedad =
      typeof req.query.tipo_propiedad === "string" ? (req.query.tipo_propiedad as any) : undefined;

    const items = await listPropiedadesUseCase.execute({ auth, cliente_id, tipo_propiedad });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.get("/:id", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const item = await getPropiedadUseCase.execute({ auth, propiedadId: req.params.id });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const dto = propiedadCreateSchema.parse(req.body);
    const deudores = resolveDeudoresForCreate(dto);
    const created = await createPropiedadUseCase.execute({
      cliente_id: dto.cliente_id,
      tipo_propiedad: dto.tipo_propiedad,
      identificador: dto.identificador,
      direccion: dto.direccion,
      notas: dto.notas,
      saldo_inicial: dto.saldo_inicial,
      deudores,
      fecha_inicio_cobro: dto.fecha_inicio_cobro,
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.patch("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const dto = propiedadPatchSchema.parse(req.body);
    const updated = await updatePropiedadUseCase.execute({
      id: req.params.id,
      tipo_propiedad: dto.tipo_propiedad,
      identificador: dto.identificador,
      direccion: dto.direccion,
      notas: dto.notas,
      saldo_inicial: dto.saldo_inicial,
      deudores: dto.deudores ? normalizeDeudores(dto.deudores) : undefined,
      cobro_nombre: dto.deudores ? undefined : dto.cobro_nombre,
      cobro_tipo_persona: dto.deudores ? undefined : dto.cobro_tipo_persona,
      cobro_documento: dto.deudores ? undefined : dto.cobro_documento,
      cobro_email: dto.deudores ? undefined : dto.cobro_email,
      fecha_inicio_cobro: dto.fecha_inicio_cobro,
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    await deletePropiedadUseCase.execute({ id: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.get("/:id/historial", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const items = await listHistorialPagosUseCase.execute({
      auth,
      propiedadId: req.params.id,
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.post("/:id/historial", requireRole("admin"), async (req, res, next) => {
  try {
    const dto = historialCreateSchema.parse(req.body);
    const result = await createHistorialPagoUseCase.execute({
      propiedadId: req.params.id,
      periodo: dto.periodo,
      concepto: dto.concepto,
      valor_cobrado: dto.valor_cobrado,
      valor_pagado: dto.valor_pagado,
      fecha_pago: dto.fecha_pago,
      estado_pago: dto.estado_pago,
      observaciones: dto.observaciones,
      fecha_inicio_cobro: dto.fecha_inicio_cobro,
      fecha_fin_cobro: dto.fecha_fin_cobro,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.patch(
  "/:id/historial/:historialId",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const dto = historialCreateSchema.parse(req.body);
      const result = await updateHistorialPagoUseCase.execute({
        propiedadId: req.params.id,
        historialId: req.params.historialId,
        periodo: dto.periodo,
        concepto: dto.concepto,
        valor_cobrado: dto.valor_cobrado,
        valor_pagado: dto.valor_pagado,
        fecha_pago: dto.fecha_pago,
        estado_pago: dto.estado_pago,
        observaciones: dto.observaciones,
        fecha_inicio_cobro: dto.fecha_inicio_cobro,
        fecha_fin_cobro: dto.fecha_fin_cobro,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

propiedadesRouter.delete(
  "/:id/historial/:historialId",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      await deleteHistorialPagoUseCase.execute({
        propiedadId: req.params.id,
        historialId: req.params.historialId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

propiedadesRouter.get("/:id/gestiones", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const items = await listGestionesUseCase.execute({
      auth,
      propiedadId: req.params.id,
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.post("/:id/gestiones", requireRole("admin"), async (req, res, next) => {
  try {
    const dto = gestionCreateSchema.parse(req.body);
    const created = await createGestionUseCase.execute({
      propiedadId: req.params.id,
      fecha: dto.fecha,
      estado: dto.estado,
      descripcion: dto.descripcion,
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

propiedadesRouter.patch(
  "/:id/gestiones/:gestionId",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const dto = gestionPatchSchema.parse(req.body);
      const updated = await updateGestionUseCase.execute({
        propiedadId: req.params.id,
        gestionId: req.params.gestionId,
        fecha: dto.fecha,
        estado: dto.estado,
        descripcion: dto.descripcion,
      });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

propiedadesRouter.delete(
  "/:id/gestiones/:gestionId",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      await deleteGestionUseCase.execute({
        propiedadId: req.params.id,
        gestionId: req.params.gestionId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
