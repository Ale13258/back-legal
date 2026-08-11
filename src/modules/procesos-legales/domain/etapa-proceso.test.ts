import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import {
  ETAPA_PROCESO_DEFAULT,
  ETAPA_PROCESO_VALUES,
  ETAPAS_PROCESO_ORDENADAS,
  coerceLegacyEtapaProceso,
  isEtapaProceso,
} from "./etapa-proceso.js";

const etapaSchema = z.enum(ETAPA_PROCESO_VALUES);

describe("etapa-proceso", () => {
  it("define 13 etapas en orden del flujo", () => {
    assert.equal(ETAPAS_PROCESO_ORDENADAS.length, 13);
    assert.equal(ETAPAS_PROCESO_ORDENADAS[0]?.value, "radicacion");
    assert.equal(ETAPAS_PROCESO_ORDENADAS.at(-1)?.value, "terminacion");
  });

  it("default es radicacion", () => {
    assert.equal(ETAPA_PROCESO_DEFAULT, "radicacion");
  });

  it("isEtapaProceso reconoce slugs válidos", () => {
    assert.equal(isEtapaProceso("mandamiento_de_pago"), true);
    assert.equal(isEtapaProceso("inicial"), false);
  });

  it("coerceLegacyEtapaProceso mapea legacy y fallback", () => {
    assert.equal(coerceLegacyEtapaProceso("sentencia"), "sentencia");
    assert.equal(coerceLegacyEtapaProceso("inicial"), "radicacion");
    assert.equal(coerceLegacyEtapaProceso("conciliacion"), "subsanacion");
    assert.equal(coerceLegacyEtapaProceso("demanda"), "mandamiento_de_pago");
    assert.equal(coerceLegacyEtapaProceso(null), "radicacion");
    assert.equal(coerceLegacyEtapaProceso("invalido"), "radicacion");
  });

  it("zod acepta radicacion y rechaza inicial", () => {
    assert.equal(etapaSchema.safeParse("radicacion").success, true);
    assert.equal(etapaSchema.safeParse("inicial").success, false);
  });
});
