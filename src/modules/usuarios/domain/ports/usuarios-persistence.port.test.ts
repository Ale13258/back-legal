import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveStaffUsuarioStatus } from "./usuarios-persistence.port.js";

describe("deriveStaffUsuarioStatus", () => {
  it("prioriza pending cuando no hay activated_at", () => {
    assert.equal(
      deriveStaffUsuarioStatus({ activated_at: null, is_active: true }),
      "pending",
    );
    assert.equal(
      deriveStaffUsuarioStatus({ activated_at: null, is_active: false }),
      "pending",
    );
  });

  it("distingue active e inactive tras activacion", () => {
    const activated = new Date("2026-01-01T00:00:00.000Z");
    assert.equal(
      deriveStaffUsuarioStatus({ activated_at: activated, is_active: true }),
      "active",
    );
    assert.equal(
      deriveStaffUsuarioStatus({ activated_at: activated, is_active: false }),
      "inactive",
    );
  });
});
