import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAccessTokenExpiresInSeconds,
  signAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "./jwt.js";

const payload = {
  id: "user-1",
  role: "super_admin" as const,
  cliente_id: null,
  email: "admin@test.com",
};

describe("jwt", () => {
  it("access token incluye expires_in coherente con exp-iat", () => {
    const token = signAccessToken(payload);
    const expiresIn = getAccessTokenExpiresInSeconds(token);

    assert.ok(expiresIn >= 890 && expiresIn <= 900, `esperado ~900s, recibido ${expiresIn}`);
  });

  it("verifyAccessToken rechaza token malformado", () => {
    assert.throws(() => verifyAccessToken("token-invalido"), /Access token invalido/);
  });

  it("verifyRefreshToken rechaza token malformado", () => {
    assert.throws(() => verifyRefreshToken("token-invalido"), /Refresh token invalido/);
  });
});
