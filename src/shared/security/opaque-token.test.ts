import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRegistrationInvitationUrl,
  computeInvitationExpiresAt,
  generateOpaqueToken,
  getStaffInvitationTtlHours,
} from "./opaque-token.js";
import { hashToken } from "./jwt.js";

describe("opaque-token", () => {
  it("genera token opaco y hash sha256", () => {
    const pair = generateOpaqueToken();
    assert.ok(pair.token.length >= 32);
    assert.equal(pair.token_hash, hashToken(pair.token));
    assert.notEqual(pair.token, pair.token_hash);
  });

  it("usa TTL de 72h por defecto", () => {
    delete process.env.STAFF_INVITATION_TTL_HOURS;
    assert.equal(getStaffInvitationTtlHours(), 72);
    const now = new Date("2026-07-29T12:00:00.000Z");
    const expires = computeInvitationExpiresAt(now);
    assert.equal(expires.toISOString(), "2026-08-01T12:00:00.000Z");
  });

  it("construye URL de registro", () => {
    process.env.FRONTEND_URL = "https://front.test/";
    const url = buildRegistrationInvitationUrl("abc+1");
    assert.equal(url, "https://front.test/registro?token=abc%2B1");
  });
});
