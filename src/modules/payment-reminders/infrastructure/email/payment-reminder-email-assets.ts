import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PAYMENT_REMINDER_LOGO_CID = "legaltech-logo@legaltech";
export const PAYMENT_REMINDER_ICON_PHONE_CID = "icon-telefono@legaltech";
export const PAYMENT_REMINDER_ICON_EMAIL_CID = "icon-email@legaltech";
export const PAYMENT_REMINDER_ICON_INSTAGRAM_CID = "icon-instagram@legaltech";

const assetsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets");

function resolveAssetPath(filename: string): string {
  const candidates = [
    path.join(assetsDir, filename),
    path.join(
      process.cwd(),
      "src/modules/payment-reminders/infrastructure/email/assets",
      filename,
    ),
    path.join(
      process.cwd(),
      "dist/modules/payment-reminders/infrastructure/email/assets",
      filename,
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`No se encontró el asset de correo: ${filename}`);
}

function readAssetAttachment(filename: string, cid: string) {
  return {
    filename,
    content: readFileSync(resolveAssetPath(filename)),
    cid,
  };
}

export function getLegaltechLogoAttachment() {
  return readAssetAttachment("legaltech-logo.png", PAYMENT_REMINDER_LOGO_CID);
}

/** Adjuntos embebidos (CID) para que Gmail muestre el correo como HTML, no como imagen remota. */
export function getPaymentReminderEmailAttachments(): {
  filename: string;
  content: Buffer;
  cid: string;
}[] {
  return [
    readAssetAttachment("legaltech-logo.png", PAYMENT_REMINDER_LOGO_CID),
    readAssetAttachment("icon-telefono.png", PAYMENT_REMINDER_ICON_PHONE_CID),
    readAssetAttachment("icon-email.png", PAYMENT_REMINDER_ICON_EMAIL_CID),
    readAssetAttachment("icon-instagram.png", PAYMENT_REMINDER_ICON_INSTAGRAM_CID),
  ];
}
