import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";

/** Vercel Cron envía `Authorization: Bearer $CRON_SECRET`. */
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(req.header("authorization") ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
