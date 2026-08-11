import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPaymentReminderEmailHtml,
  buildPaymentReminderPlainText,
  formatCurrencyCop,
} from "./payment-reminder.template.js";

describe("payment-reminder.template", () => {
  it("formatea COP y genera HTML con datos de la cuenta", () => {
    const input = {
      clienteNombre: "María",
      cuentaIdentificador: "LOC-9",
      cuentaDireccion: "Carrera 10",
      montoPendiente: 250000,
      fechaCorte: "21 de mayo de 2026",
    };

    assert.match(formatCurrencyCop(250000), /\$|COP/);
    const html = buildPaymentReminderEmailHtml(input);
    assert.match(html, /María/);
    assert.match(html, /LOC-9/);
    assert.match(html, /Carrera 10/);
    assert.match(html, /LegalTech/);
    assert.match(html, /cid:legaltech-logo@legaltech/);
    assert.match(html, /abogadosdigitales\.com\.co/);
    assert.match(html, /analistalegal@abogadosdigitales\.com\.co/);
    assert.match(html, /abogadojunior@abogadosdigitales\.com\.co/);
    assert.match(html, /SÍGUENOS/);
    assert.match(html, /\+573027636712/);
    assert.match(html, /border-left:1px solid #b884ca/);

    const text = buildPaymentReminderPlainText(input);
    assert.match(text, /María/);
    assert.match(text, /LOC-9/);
  });

  it("incluye bloque de nota cuando se envía texto adicional", () => {
    const html = buildPaymentReminderEmailHtml({
      clienteNombre: "Juan",
      cuentaIdentificador: "APT-1",
      cuentaDireccion: "Calle 1",
      montoPendiente: 100000,
      fechaCorte: "hoy",
      nota: "Favor consignar antes del viernes.\nGracias.",
    });
    const text = buildPaymentReminderPlainText({
      clienteNombre: "Juan",
      cuentaIdentificador: "APT-1",
      cuentaDireccion: "Calle 1",
      montoPendiente: 100000,
      fechaCorte: "hoy",
      nota: "Favor consignar antes del viernes.",
    });
    assert.match(html, /Nota/);
    assert.match(html, /Favor consignar antes del viernes/);
    assert.match(html, /Gracias/);
    assert.match(text, /Nota:/);
    assert.match(text, /Favor consignar antes del viernes/);
  });

  it("escapa HTML en nombres con caracteres especiales", () => {
    const html = buildPaymentReminderEmailHtml({
      clienteNombre: 'A & B <script>',
      cuentaIdentificador: "X",
      cuentaDireccion: null,
      montoPendiente: 1,
      fechaCorte: "hoy",
    });
    assert.doesNotMatch(html, /<script>/);
    assert.match(html, /A &amp; B/);
  });
});
