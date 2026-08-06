import crypto from "node:crypto";
import { hashToken } from "../security/jwt.js";

export type OpaqueTokenPair = {
  /** Token en claro; solo se envía por correo / API de activación. */
  token: string;
  /** SHA-256 hex para persistir. */
  token_hash: string;
};

export function generateOpaqueToken(): OpaqueTokenPair {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    token_hash: hashToken(token),
  };
}

export function getStaffInvitationTtlHours(): number {
  const raw = process.env.STAFF_INVITATION_TTL_HOURS?.trim();
  const parsed = raw ? Number(raw) : 72;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 72;
  }
  return parsed;
}

export function computeInvitationExpiresAt(now: Date = new Date()): Date {
  const hours = getStaffInvitationTtlHours();
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL?.trim().replace(/\/+$/, "");
  if (!url) {
    throw new Error("FRONTEND_URL debe estar configurado para enviar invitaciones");
  }
  return url;
}

export function buildRegistrationInvitationUrl(token: string): string {
  return `${getFrontendUrl()}/registro?token=${encodeURIComponent(token)}`;
}
