import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStaffInvitationEmail } from "./staff-invitation.template.js";

describe("staff-invitation.template", () => {
  it("incluye URL de registro y no incluye contraseña", () => {
    const content = buildStaffInvitationEmail({
      to: "nuevo@test.com",
      registration_url: "https://app.test/registro?token=abc",
      role_label: "Analista legal",
      expires_at: new Date("2026-08-01T12:00:00.000Z"),
    });

    assert.match(content.subject, /Invitación/);
    assert.match(content.text, /https:\/\/app\.test\/registro\?token=abc/);
    assert.match(content.html, /href="https:\/\/app\.test\/registro\?token=abc"/);
    assert.match(content.html, /Activar cuenta/);
    assert.match(content.html, /copia y pega/i);
    assert.match(content.text, /Analista legal/);
    assert.doesNotMatch(content.text, /password|contraseña\s*:/i);
    assert.doesNotMatch(content.html, /password|contraseña\s*:/i);
  });
});
