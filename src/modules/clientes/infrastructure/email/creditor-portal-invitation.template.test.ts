import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCreditorPortalInvitationEmail } from "./creditor-portal-invitation.template.js";

describe("creditor-portal-invitation.template", () => {
  it("incluye URL de registro e identidad del acreedor", () => {
    const content = buildCreditorPortalInvitationEmail({
      to: "edificio@test.com",
      creditor_name: "Edificio San Martin",
      registration_url: "https://app.test/registro?token=abc",
      expires_at: new Date("2026-08-10T12:00:00.000Z"),
    });

    assert.match(content.subject, /informes/i);
    assert.match(content.text, /Edificio San Martin/);
    assert.match(content.text, /registro\?token=abc/);
    assert.doesNotMatch(content.html, /copia y pega/i);
    assert.doesNotMatch(content.text, /password|contraseña\s*:/i);
  });
});
