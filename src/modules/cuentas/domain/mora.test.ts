import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToYmd,
  compareYmd,
  computeDiasEnMora,
  dateToYmdUtc,
  inclusiveCalendarDays,
  lastDayYmdOfPeriod,
  moraStartYmdForPeriod,
} from "./mora.js";

describe("moraStartYmdForPeriod", () => {
  it("enero 2024: vence 31-ene, mora desde 1-feb", () => {
    assert.equal(moraStartYmdForPeriod("2024-01"), "2024-02-01");
  });
  it("febrero 2024 bisiesto: último día 29-feb, mora 1-mar", () => {
    assert.equal(lastDayYmdOfPeriod("2024-02"), "2024-02-29");
    assert.equal(moraStartYmdForPeriod("2024-02"), "2024-03-01");
  });
});

describe("computeDiasEnMora", () => {
  it("pagado antes de iniciar mora → 0", () => {
    const fecha_pago = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    const d = computeDiasEnMora({
      periodo: "2024-01",
      estado_pago: "pagado",
      fecha_pago,
      referenceTodayYmd: "2024-06-01",
    });
    assert.equal(d, 0);
  });

  it("pagado el primer día de mora → 1 día inclusivo", () => {
    const fecha_pago = new Date(Date.UTC(2024, 1, 1, 12, 0, 0));
    const d = computeDiasEnMora({
      periodo: "2024-01",
      estado_pago: "pagado",
      fecha_pago,
      referenceTodayYmd: "2024-06-01",
    });
    assert.equal(d, 1);
  });

  it("pendiente: cuenta hasta referenceTodayYmd", () => {
    const d = computeDiasEnMora({
      periodo: "2024-01",
      estado_pago: "pendiente",
      fecha_pago: null,
      referenceTodayYmd: "2024-02-05",
    });
    // mora desde 2024-02-01 hasta 2024-02-05 inclusive = 5 días
    assert.equal(d, 5);
  });

  it("pagado sin fecha_pago → 0", () => {
    const d = computeDiasEnMora({
      periodo: "2024-01",
      estado_pago: "pagado",
      fecha_pago: null,
      referenceTodayYmd: "2024-06-01",
    });
    assert.equal(d, 0);
  });
});

describe("helpers", () => {
  it("inclusiveCalendarDays", () => {
    assert.equal(inclusiveCalendarDays("2024-02-01", "2024-02-01"), 1);
    assert.equal(inclusiveCalendarDays("2024-02-01", "2024-02-05"), 5);
    assert.equal(inclusiveCalendarDays("2024-02-10", "2024-02-01"), 0);
  });
  it("dateToYmdUtc", () => {
    assert.equal(dateToYmdUtc(new Date(Date.UTC(2024, 5, 8))), "2024-06-08");
  });
  it("compareYmd", () => {
    assert.equal(compareYmd("2024-01-01", "2024-01-02"), -1);
  });
  it("addDaysToYmd", () => {
    assert.equal(addDaysToYmd("2024-01-31", 1), "2024-02-01");
  });
});
