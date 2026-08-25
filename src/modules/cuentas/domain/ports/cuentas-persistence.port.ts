import type { AuthRole } from "../../../../shared/security/roles.js";

export type AuthContext = {
  role: AuthRole;
  cliente_id: string | null;
};

export type TipoCuenta =
  | "apartamento"
  | "oficina"
  | "local"
  | "casa"
  | "bodega"
  | "garaje"
  | "parqueadero"
  | "otro";

export type TipoPersona = "natural" | "juridica";

export type CobroFields = {
  cobro_nombre: string;
  cobro_tipo_persona: TipoPersona;
  cobro_documento: string;
  cobro_email: string | null;
};

export type DeudorCobro = {
  /** Presente cuando ya está persistido. */
  id?: string;
  nombre: string;
  tipo_persona: TipoPersona;
  documento: string;
  /** Puede estar vacío. cobro_email = emails[0] ?? null. */
  emails: string[];
  telefono?: string | null;
};

export type Cuenta = {
  id: string;
  cliente_id: string;
  /** Acreedor bajo tenant SaaS (Fase 1–2). Null solo hasta backfill. */
  creditor_id: string | null;
  tipo_cuenta: TipoCuenta;
  identificador: string;
  direccion: string | null;
  notas: string | null;
  cobro_nombre: string;
  cobro_tipo_persona: TipoPersona;
  cobro_documento: string;
  cobro_email: string | null;
  /** Siempre len >= 1. cobro_* = proyección de deudores[0]. Persistidos en tablas deudores + cuenta_deudores. */
  deudores: DeudorCobro[];
  monto_a_la_fecha: unknown; // Prisma Decimal (runtime) -> JSON compatible
  edad_mora_dias: number | null;
  fecha_inicio_cobro: Date | null;
  fecha_fin_cobro: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ConceptoPago = "administracion" | "intereses" | "extraordinaria" | "otros";
export type EstadoPago = "pendiente" | "parcial" | "pagado" | "vencido";

export type HistorialPago = {
  id: string;
  cuenta_id: string;
  periodo: string;
  concepto: ConceptoPago;
  valor_cobrado: unknown;
  valor_pagado: unknown;
  fecha_pago: Date | null;
  estado_pago: EstadoPago;
  monto_a_la_fecha: unknown;
  dias_en_mora: number | null;
  fecha_inicio_cobro: Date | null;
  fecha_fin_cobro: Date | null;
  observaciones: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type Gestion = {
  id: string;
  cuenta_id: string;
  fecha: Date;
  tipo: "manual" | "email_reminder";
  estado: string;
  /** Manual: texto. Correo: JSON con subject, body_html, etc. */
  descripcion: string;
  created_at: Date;
  updated_at: Date;
};

export interface CuentasPersistencePort {
  listCuentas(input: {
    cliente_id?: string;
    tipo_cuenta?: TipoCuenta;
  }): Promise<Cuenta[]>;

  getCuentaById(id: string): Promise<Cuenta | null>;

  createCuenta(input: {
    cliente_id: string;
    tipo_cuenta: TipoCuenta;
    identificador: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
    fecha_inicio_cobro?: string | null;
    deudores: DeudorCobro[];
  }): Promise<Cuenta>;

  updateCuenta(input: {
    id: string;
    tipo_cuenta?: TipoCuenta;
    identificador?: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
    /** Replace completo del array; sincroniza cobro_* = deudores[0]. */
    deudores?: DeudorCobro[];
    /** Legacy: parchea deudores[0] + cobro_* si no viene deudores. */
    cobro_nombre?: string;
    cobro_tipo_persona?: TipoPersona;
    cobro_documento?: string;
    cobro_email?: string | null;
    fecha_inicio_cobro?: string | null;
  }): Promise<Cuenta>;

  deleteCuentaCascade(id: string): Promise<void>;

  listHistorialPagosByCuentaId(cuentaId: string): Promise<HistorialPago[]>;

  createHistorialPagoAndUpdateSaldo(input: {
    cuentaId: string;
    periodo: string;
    concepto: ConceptoPago;
    valor_cobrado: number;
    valor_pagado: number;
    fecha_pago?: string | null;
    estado_pago: EstadoPago;
    observaciones?: string;
    fecha_inicio_cobro?: string | null;
    fecha_fin_cobro?: string | null;
  }): Promise<HistorialPago>;

  deleteHistorialPagoAndUpdateSaldo(input: {
    cuentaId: string;
    historialId: string;
  }): Promise<void>;

  updateHistorialPagoAndUpdateSaldo(input: {
    cuentaId: string;
    historialId: string;
    periodo: string;
    concepto: ConceptoPago;
    valor_cobrado: number;
    valor_pagado: number;
    fecha_pago?: string | null;
    estado_pago: EstadoPago;
    observaciones?: string;
    fecha_inicio_cobro?: string | null;
    fecha_fin_cobro?: string | null;
  }): Promise<HistorialPago>;

  listGestionesByCuentaId(cuentaId: string): Promise<Gestion[]>;

  createGestionForCuenta(input: {
    cuentaId: string;
    fecha: string;
    estado: string;
    descripcion: string;
  }): Promise<Gestion>;

  updateGestionForCuenta(input: {
    cuentaId: string;
    gestionId: string;
    fecha?: string;
    estado?: string;
    descripcion?: string;
  }): Promise<Gestion>;

  deleteGestionForCuenta(input: {
    cuentaId: string;
    gestionId: string;
  }): Promise<void>;
}

