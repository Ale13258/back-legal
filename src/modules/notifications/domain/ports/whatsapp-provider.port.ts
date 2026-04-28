export type SendTemplateInput = {
  to: string;
  template: string;
  variables: Record<string, string>;
};

export interface WhatsAppProviderPort {
  sendTemplateMessage(input: SendTemplateInput): Promise<{ provider_message_id: string }>;
}
