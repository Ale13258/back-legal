export type AuthContext = {
  role: "admin" | "cliente";
  cliente_id: string | null;
};

export type TipoPropiedad = "apartamento" | "local" | "parqueadero" | "otro";

export type Propiedad = {
  id: string;
  cliente_id: string;
  tipo_propiedad: TipoPropiedad;
  identificador: string;
  direccion: string | null;
  notas: string | null;
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
  propiedad_id: string;
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
};

export type Gestion = {
  id: string;
  propiedad_id: string;
  fecha: Date;
  estado: string;
  descripcion: string;
  created_at: Date;
  updated_at: Date;
};

export interface PropiedadesPersistencePort {
  listPropiedades(input: {
    cliente_id?: string;
    tipo_propiedad?: TipoPropiedad;
  }): Promise<Propiedad[]>;

  getPropiedadById(id: string): Promise<Propiedad | null>;

  createPropiedad(input: {
    cliente_id: string;
    tipo_propiedad: TipoPropiedad;
    identificador: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
  }): Promise<Propiedad>;

  updatePropiedad(input: {
    id: string;
    tipo_propiedad?: TipoPropiedad;
    identificador?: string;
    direccion?: string;
    notas?: string;
    saldo_inicial?: number;
  }): Promise<Propiedad>;

  deletePropiedadCascade(id: string): Promise<void>;

  listHistorialPagosByPropiedadId(propiedadId: string): Promise<HistorialPago[]>;

  createHistorialPagoAndUpdateSaldo(input: {
    propiedadId: string;
    periodo: string;
    concepto: ConceptoPago;
    valor_cobrado: number;
    valor_pagado: number;
    fecha_pago?: string;
    estado_pago: EstadoPago;
    observaciones?: string;
    fecha_inicio_cobro?: string | null;
    fecha_fin_cobro?: string | null;
  }): Promise<HistorialPago>;

  deleteHistorialPagoAndUpdateSaldo(input: {
    propiedadId: string;
    historialId: string;
  }): Promise<void>;

  listGestionesByPropiedadId(propiedadId: string): Promise<Gestion[]>;

  createGestionForPropiedad(input: {
    propiedadId: string;
    fecha: string;
    estado: string;
    descripcion: string;
  }): Promise<Gestion>;
}

