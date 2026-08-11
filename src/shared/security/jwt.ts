import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { ApiError } from "../http/error-handler.js";
import { isAuthRole, type AuthRole } from "./roles.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev_access_secret";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev_refresh_secret";
const ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"];
const REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || "1d") as jwt.SignOptions["expiresIn"];

type UserPayload = {
  id: string;
  role: AuthRole;
  cliente_id: string | null;
  email: string;
};

function toUserPayloadOrThrow(decoded: unknown, tokenType: "Access" | "Refresh"): UserPayload {
  if (!decoded || typeof decoded === "string") {
    throw new ApiError(401, "UNAUTHORIZED", `${tokenType} token invalido`);
  }

  const candidate = decoded as Record<string, unknown>;
  const isClienteIdValid = typeof candidate.cliente_id === "string" || candidate.cliente_id === null;

  if (
    typeof candidate.id !== "string" ||
    !isAuthRole(candidate.role) ||
    !isClienteIdValid ||
    typeof candidate.email !== "string"
  ) {
    throw new ApiError(401, "UNAUTHORIZED", `${tokenType} token invalido`);
  }

  return {
    id: candidate.id,
    role: candidate.role,
    cliente_id: candidate.cliente_id as string | null,
    email: candidate.email,
  };
}

function assertJwtConfigOrThrow() {
  try {
    jwt.sign({ sub: "access-config-check" }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
    jwt.sign({ sub: "refresh-config-check" }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  } catch (error) {
    throw new Error(
      `Configuracion JWT invalida: ${(error as Error).message || "verifica secretos y expiraciones"}`,
    );
  }
}

assertJwtConfigOrThrow();

export function signAccessToken(payload: UserPayload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

export function signRefreshToken(payload: UserPayload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

export function verifyAccessToken(token: string): UserPayload {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    return toUserPayloadOrThrow(decoded, "Access");
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Access token invalido");
  }
}

export function verifyRefreshToken(token: string): UserPayload {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET);
    return toUserPayloadOrThrow(decoded, "Refresh");
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Refresh token invalido");
  }
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshTokenExpirationDate(token: string): Date {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded === "string" || typeof decoded.exp !== "number") {
    throw new ApiError(500, "AUTH_TOKEN_ERROR", "No se pudo determinar expiracion del refresh token");
  }

  return new Date(decoded.exp * 1000);
}

export function getAccessTokenExpiresInSeconds(token: string): number {
  const decoded = jwt.decode(token);
  if (
    !decoded ||
    typeof decoded === "string" ||
    typeof decoded.exp !== "number" ||
    typeof decoded.iat !== "number"
  ) {
    throw new ApiError(500, "AUTH_TOKEN_ERROR", "No se pudo determinar expiracion del access token");
  }

  return decoded.exp - decoded.iat;
}
