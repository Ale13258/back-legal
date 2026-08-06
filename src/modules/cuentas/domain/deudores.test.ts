import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cobroFromDeudor,
  ensureDeudores,
  findDuplicateDocumentoIndexes,
  normalizeDeudores,
  parseStoredDeudores,
  patchPrimaryDeudor,
} from "./deudores.js";

describe("deudores", () => {
  it("proyecta cobro_* desde deudores[0].emails[0]", () => {
    const cobro = cobroFromDeudor({
      nombre: " Ana ",
      tipo_persona: "natural",
      documento: " 123 ",
      emails: [" a@b.com ", "c@d.com"],
    });
    assert.equal(cobro.cobro_nombre, " Ana ");
    assert.equal(cobro.cobro_documento, " 123 ");
    assert.equal(cobro.cobro_email, " a@b.com ");
  });

  it("normaliza trim en deudores y emails", () => {
    const [d] = normalizeDeudores([
      {
        nombre: " Ana ",
        tipo_persona: "juridica",
        documento: " NIT-1 ",
        emails: [" a@b.com ", " c@d.com "],
      },
    ]);
    assert.deepEqual(d, {
      nombre: "Ana",
      tipo_persona: "juridica",
      documento: "NIT-1",
      emails: ["a@b.com", "c@d.com"],
    });
  });

  it("detecta documentos duplicados (case-insensitive)", () => {
    const idxs = findDuplicateDocumentoIndexes([
      { nombre: "A", tipo_persona: "natural", documento: "AbC", emails: ["a@a.com"] },
      { nombre: "B", tipo_persona: "natural", documento: "abc", emails: ["b@b.com"] },
    ]);
    assert.deepEqual(idxs, [1]);
  });

  it("sintetiza deudores desde cobro_* si el JSON falta", () => {
    const deudores = ensureDeudores(null, {
      cobro_nombre: "Juan",
      cobro_tipo_persona: "natural",
      cobro_documento: "1",
      cobro_email: "j@j.com",
    });
    assert.deepEqual(deudores, [
      {
        nombre: "Juan",
        tipo_persona: "natural",
        documento: "1",
        emails: ["j@j.com"],
      },
    ]);
  });

  it("lee legacy email singular como emails[]", () => {
    const parsed = parseStoredDeudores([
      {
        nombre: "Juan",
        tipo_persona: "natural",
        documento: "1",
        email: "j@j.com",
      },
    ]);
    assert.deepEqual(parsed, [
      {
        nombre: "Juan",
        tipo_persona: "natural",
        documento: "1",
        emails: ["j@j.com"],
      },
    ]);
  });

  it("parchea solo emails[0] del deudor primario en update legacy", () => {
    const next = patchPrimaryDeudor(
      [
        {
          nombre: "A",
          tipo_persona: "natural",
          documento: "1",
          emails: ["a@a.com", "a2@a.com"],
        },
        {
          nombre: "B",
          tipo_persona: "juridica",
          documento: "2",
          emails: ["b@b.com"],
        },
      ],
      { cobro_email: " nuevo@a.com " },
    );
    assert.deepEqual(next[0]!.emails, ["nuevo@a.com", "a2@a.com"]);
    assert.deepEqual(next[1]!.emails, ["b@b.com"]);
  });
});
