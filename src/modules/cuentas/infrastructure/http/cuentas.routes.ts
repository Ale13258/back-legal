import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireStaff } from "../../../../shared/security/auth.middleware.js";
import { CuentasPrismaRepository } from "../persistence/cuentas-prisma.repository.js";
import { CreateGestionUseCase } from "../../application/use-cases/create-gestion.use-case.js";
import { CreateHistorialPagoUseCase } from "../../application/use-cases/create-historial-pago.use-case.js";
import { CreateCuentaUseCase } from "../../application/use-cases/create-cuenta.use-case.js";
import { GetCuentaUseCase } from "../../application/use-cases/get-cuenta.use-case.js";
import { ListGestionesUseCase } from "../../application/use-cases/list-gestiones.use-case.js";
import { ListHistorialPagosUseCase } from "../../application/use-cases/list-historial-pagos.use-case.js";
import { ListCuentasUseCase } from "../../application/use-cases/list-cuentas.use-case.js";
import { UpdateCuentaUseCase } from "../../application/use-cases/update-cuenta.use-case.js";
import { DeleteCuentaUseCase } from "../../application/use-cases/delete-cuenta.use-case.js";
import { DeleteHistorialPagoUseCase } from "../../application/use-cases/delete-historial-pago.use-case.js";
import { UpdateHistorialPagoUseCase } from "../../application/use-cases/update-historial-pago.use-case.js";
import { UpdateGestionUseCase } from "../../application/use-cases/update-gestion.use-case.js";
import { DeleteGestionUseCase } from "../../application/use-cases/delete-gestion.use-case.js";
import {
  deudorFromCobro,
  findDuplicateDocumentoIndexes,
  normalizeDeudores,
} from "../../domain/deudores.js";
import type { DeudorCobro } from "../../domain/ports/cuentas-persistence.port.js";

const optionalEmail = z.preprocess(
  (val) => (val === "" ? null : val),
  z.string().trim().email().nullable().optional(),
);

const deudorCobroSchema = z.object({
  nombre: z.string().trim().min(1),
  tipo_persona: z.enum(["natural", "juridica"]),
  documento: z.string().trim().min(1),
  emails: z.array(z.string().trim().email()).default([]),
  telefono: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().trim().min(1).nullable().optional(),
  ),
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
  cobro_email: optionalEmail,
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

const cuentaBaseSchema = z.object({
  cliente_id: z.string().uuid(),
  tipo_cuenta: z.enum([
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
  cobro_email: optionalEmail,
});

const cuentaCreateSchema = cuentaBaseSchema.superRefine((data, ctx) => {
  if (data.deudores && data.deudores.length >= 1) return;
  const missing: Array<keyof typeof data> = [];
  if (!data.cobro_nombre) missing.push("cobro_nombre");
  if (!data.cobro_tipo_persona) missing.push("cobro_tipo_persona");
  if (!data.cobro_documento) missing.push("cobro_documento");
  for (const path of missing) {
    ctx.addIssue({
      code: "custom",
      message: "Requerido si no se envía deudores",
      path: [path],
    });
  }
});

const cuentaPatchSchema = cuentaBaseSchema
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

function resolveDeudoresForCreate(dto: z.infer<typeof cuentaCreateSchema>): DeudorCobro[] {
  if (dto.deudores && dto.deudores.length >= 1) {
    return normalizeDeudores(dto.deudores);
  }
  const cobro = cobroFieldsSchema.parse({
    cobro_nombre: dto.cobro_nombre,
    cobro_tipo_persona: dto.cobro_tipo_persona,
    cobro_documento: dto.cobro_documento,
    cobro_email: dto.cobro_email ?? null,
  });
  return [deudorFromCobro({ ...cobro, cobro_email: cobro.cobro_email ?? null })];
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

export const cuentasRouter = Router();
cuentasRouter.use(requireAuth);

const repo = new CuentasPrismaRepository();
const listCuentasUseCase = new ListCuentasUseCase({ cuentasPersistence: repo });
const getCuentaUseCase = new GetCuentaUseCase({ cuentasPersistence: repo });
const createCuentaUseCase = new CreateCuentaUseCase({ cuentasPersistence: repo });
const updateCuentaUseCase = new UpdateCuentaUseCase({ cuentasPersistence: repo });
const deleteCuentaUseCase = new DeleteCuentaUseCase({ cuentasPersistence: repo });
const deleteHistorialPagoUseCase = new DeleteHistorialPagoUseCase({ cuentasPersistence: repo });
const listHistorialPagosUseCase = new ListHistorialPagosUseCase({ cuentasPersistence: repo });
const createHistorialPagoUseCase = new CreateHistorialPagoUseCase({ cuentasPersistence: repo });
const updateHistorialPagoUseCase = new UpdateHistorialPagoUseCase({ cuentasPersistence: repo });
const listGestionesUseCase = new ListGestionesUseCase({ cuentasPersistence: repo });
const createGestionUseCase = new CreateGestionUseCase({ cuentasPersistence: repo });
const updateGestionUseCase = new UpdateGestionUseCase({ cuentasPersistence: repo });
const deleteGestionUseCase = new DeleteGestionUseCase({ cuentasPersistence: repo });

cuentasRouter.get("/", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const cliente_id = typeof req.query.cliente_id === "string" ? req.query.cliente_id : undefined;
    const tipo_cuenta =
      typeof req.query.tipo_cuenta === "string" ? (req.query.tipo_cuenta as any) : undefined;

    const items = await listCuentasUseCase.execute({ auth, cliente_id, tipo_cuenta });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

cuentasRouter.get("/:id", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const item = await getCuentaUseCase.execute({ auth, cuentaId: req.params.id });
    res.json(item);
  } catch (error) {
    next(error);
  }
});

cuentasRouter.post("/", requireStaff(), async (req, res, next) => {
  try {
    const dto = cuentaCreateSchema.parse(req.body);
    const deudores = resolveDeudoresForCreate(dto);
    const created = await createCuentaUseCase.execute({
      cliente_id: dto.cliente_id,
      tipo_cuenta: dto.tipo_cuenta,
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

cuentasRouter.patch("/:id", requireStaff(), async (req, res, next) => {
  try {
    const dto = cuentaPatchSchema.parse(req.body);
    const updated = await updateCuentaUseCase.execute({
      id: req.params.id,
      tipo_cuenta: dto.tipo_cuenta,
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

cuentasRouter.delete("/:id", requireStaff(), async (req, res, next) => {
  try {
    await deleteCuentaUseCase.execute({ id: req.params.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

cuentasRouter.get("/:id/historial", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const items = await listHistorialPagosUseCase.execute({
      auth,
      cuentaId: req.params.id,
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

cuentasRouter.post("/:id/historial", requireStaff(), async (req, res, next) => {
  try {
    const dto = historialCreateSchema.parse(req.body);
    const result = await createHistorialPagoUseCase.execute({
      cuentaId: req.params.id,
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

cuentasRouter.patch(
  "/:id/historial/:historialId",
  requireStaff(),
  async (req, res, next) => {
    try {
      const dto = historialCreateSchema.parse(req.body);
      const result = await updateHistorialPagoUseCase.execute({
        cuentaId: req.params.id,
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

cuentasRouter.delete(
  "/:id/historial/:historialId",
  requireStaff(),
  async (req, res, next) => {
    try {
      await deleteHistorialPagoUseCase.execute({
        cuentaId: req.params.id,
        historialId: req.params.historialId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

cuentasRouter.get("/:id/gestiones", async (req, res, next) => {
  try {
    const auth = { role: req.user!.role, cliente_id: req.user!.cliente_id };
    const items = await listGestionesUseCase.execute({
      auth,
      cuentaId: req.params.id,
    });
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

cuentasRouter.post("/:id/gestiones", requireStaff(), async (req, res, next) => {
  try {
    const dto = gestionCreateSchema.parse(req.body);
    const created = await createGestionUseCase.execute({
      cuentaId: req.params.id,
      fecha: dto.fecha,
      estado: dto.estado,
      descripcion: dto.descripcion,
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

cuentasRouter.patch(
  "/:id/gestiones/:gestionId",
  requireStaff(),
  async (req, res, next) => {
    try {
      const dto = gestionPatchSchema.parse(req.body);
      const updated = await updateGestionUseCase.execute({
        cuentaId: req.params.id,
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

cuentasRouter.delete(
  "/:id/gestiones/:gestionId",
  requireStaff(),
  async (req, res, next) => {
    try {
      await deleteGestionUseCase.execute({
        cuentaId: req.params.id,
        gestionId: req.params.gestionId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
