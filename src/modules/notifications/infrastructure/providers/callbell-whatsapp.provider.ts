import { randomUUID } from "node:crypto";
import type { SendTemplateInput, WhatsAppProviderPort } from "../../domain/ports/whatsapp-provider.port.js";

function normalizeE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("57")) return `+${digits}`;
  if (digits.length === 10) return `+57${digits}`;
  return `+${digits}`;
}

export class CallbellWhatsAppProvider implements WhatsAppProviderPort {
  private readonly endpoint = "https://api.callbell.eu/v1/messages/send";
  private readonly apiKey = process.env.CALLBELL_API_KEY ?? "";

  async sendTemplateMessage(input: SendTemplateInput): Promise<{ provider_message_id: string }> {
    if (!this.apiKey) {
      throw new Error("CALLBELL_API_KEY no configurada");
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: normalizeE164(input.to),
        from: "whatsapp",
        type: "text",
        content: {
          text: `${input.template}: ${Object.values(input.variables).join(" | ")}`,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`Callbell error (${response.status}): ${body}`);
      (error as Error & { code?: string }).code = `CALLBELL_${response.status}`;
      throw error;
    }

    const json = (await response.json()) as { id?: string; message_id?: string };
    return { provider_message_id: json.message_id ?? json.id ?? randomUUID() };
  }
}
