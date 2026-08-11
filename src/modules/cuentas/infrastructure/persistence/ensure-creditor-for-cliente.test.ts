import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEGALTECH_TENANT_DOCUMENTO,
  LEGALTECH_TENANT_EMAIL,
  LEGALTECH_TENANT_NOMBRE,
} from "./ensure-creditor-for-cliente.js";

describe("ensure-creditor-for-cliente constants", () => {
  it("usa identidad LegalTech estable para el tenant SaaS", () => {
    assert.equal(LEGALTECH_TENANT_NOMBRE, "LegalTech");
    assert.equal(LEGALTECH_TENANT_EMAIL, "tenant@legaltech.com");
    assert.equal(LEGALTECH_TENANT_DOCUMENTO, "900000000-0");
  });
});
