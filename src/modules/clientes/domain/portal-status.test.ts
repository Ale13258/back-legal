import { describe, expect, it } from "vitest";
import { deriveClientePortalStatus } from "./portal-status.js";

describe("deriveClientePortalStatus", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("devuelve none sin usuario", () => {
    expect(deriveClientePortalStatus(null, now)).toBe("none");
    expect(deriveClientePortalStatus(undefined, now)).toBe("none");
  });

  it("devuelve pending si no activó y el token sigue vigente", () => {
    expect(
      deriveClientePortalStatus(
        {
          activated_at: null,
          is_active: false,
          activation_expires_at: new Date("2026-09-11T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe("pending");
  });

  it("devuelve expired si no activó y el token venció", () => {
    expect(
      deriveClientePortalStatus(
        {
          activated_at: null,
          is_active: false,
          activation_expires_at: new Date("2026-09-09T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe("expired");
  });

  it("devuelve active / inactive según is_active tras activar", () => {
    expect(
      deriveClientePortalStatus(
        {
          activated_at: new Date("2026-01-01T00:00:00.000Z"),
          is_active: true,
          activation_expires_at: null,
        },
        now,
      ),
    ).toBe("active");
    expect(
      deriveClientePortalStatus(
        {
          activated_at: new Date("2026-01-01T00:00:00.000Z"),
          is_active: false,
          activation_expires_at: null,
        },
        now,
      ),
    ).toBe("inactive");
  });
});
