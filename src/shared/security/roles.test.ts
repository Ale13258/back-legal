import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  signAccessToken,
  verifyAccessToken,
} from "./jwt.js";
import { isAuthRole, isStaffRole, STAFF_ROLES } from "./roles.js";

describe("roles y jwt staff", () => {
  for (const role of STAFF_ROLES) {
    it(`acepta access token con role ${role}`, () => {
      const token = signAccessToken({
        id: "u-1",
        role,
        cliente_id: null,
        email: `${role}@test.com`,
      });
      const payload = verifyAccessToken(token);
      assert.equal(payload.role, role);
      assert.equal(isStaffRole(payload.role), true);
    });
  }

  it("rechaza role legacy admin", () => {
    assert.equal(isAuthRole("admin"), false);
  });
});
