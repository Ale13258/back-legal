import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cobroFromDeudor,
  ensureDeudores,
  findDuplicateDocumentoIndexes,
  normalizeDeudores,
  parseStoredDeudores,
  overlayPrimaryFromCobroSnapshot,
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

  it("proyecta cobro_email null cuando no hay emails", () => {
    const cobro = cobroFromDeudor({
      nombre: "Ana",
      tipo_persona: "natural",
      documento: "123",
      emails: [],
      telefono: "3001234567",
    });
    assert.equal(cobro.cobro_email, null);
  });

  it("el snapshot cobro_* de la unidad gana sobre el deudor maestro compartido", () => {
    const deudores = overlayPrimaryFromCobroSnapshot(
      [
        {
          nombre: "Catalina Campo",
          tipo_persona: "natural",
          documento: "1023456789",
          emails: ["ocampocatalina9@gmail.com"],
          telefono: "3001112222",
        },
      ],
      {
        cobro_nombre: "Juan Pérez",
        cobro_tipo_persona: "natural",
        cobro_documento: "1.023.456.789",
        cobro_email: "juan@unidad.com",
      },
    );
    assert.equal(deudores[0]?.nombre, "Juan Pérez");
    assert.equal(deudores[0]?.emails[0], "juan@unidad.com");
    assert.equal(deudores[0]?.telefono, "3001112222");
  });

  it("normaliza trim en deudores, emails y telefono", () => {
    const [d] = normalizeDeudores([
      {
        nombre: " Ana ",
        tipo_persona: "juridica",
        documento: " NIT-1 ",
        emails: [" a@b.com ", " c@d.com "],
        telefono: " 300 ",
      },
    ]);
    assert.deepEqual(d, {
      nombre: "Ana",
      tipo_persona: "juridica",
      documento: "NIT-1",
      emails: ["a@b.com", "c@d.com"],
      telefono: "300",
    });
  });

  it("acepta deudor sin emails ni telefono", () => {
    const [d] = normalizeDeudores([
      {
        nombre: "Ana",
        tipo_persona: "natural",
        documento: "1",
        emails: [],
      },
    ]);
    assert.deepEqual(d, {
      nombre: "Ana",
      tipo_persona: "natural",
      documento: "1",
      emails: [],
      telefono: null,
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
        telefono: null,
      },
    ]);
  });

  it("sintetiza deudores sin email cuando cobro_email es null", () => {
    const deudores = ensureDeudores(null, {
      cobro_nombre: "Juan",
      cobro_tipo_persona: "natural",
      cobro_documento: "1",
      cobro_email: null,
    });
    assert.deepEqual(deudores, [
      {
        nombre: "Juan",
        tipo_persona: "natural",
        documento: "1",
        emails: [],
        telefono: null,
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
        telefono: null,
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

  it("limpia emails al parchear cobro_email null", () => {
    const next = patchPrimaryDeudor(
      [
        {
          nombre: "A",
          tipo_persona: "natural",
          documento: "1",
          emails: ["a@a.com", "a2@a.com"],
          telefono: "300",
        },
      ],
      { cobro_email: null },
    );
    assert.deepEqual(next[0]!.emails, []);
  });
});
