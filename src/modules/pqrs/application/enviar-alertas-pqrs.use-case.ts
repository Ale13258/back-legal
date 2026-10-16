import type {
  EmailSenderPort,
  SendEmailAttachment,
} from "../../../shared/infrastructure/email/email-sender.port.js";
import type { AlertaLink } from "../../../shared/infrastructure/email/alerta-terminos.layout.js";
import { getBusinessTodayYmd } from "../../cuentas/domain/business-calendar.js";
import { addDaysYmd, esDiaHabil } from "../../tutelas/domain/dias-habiles-co.js";
import { clasificarAlertaPqr, type EstadoAlertaPqr } from "../domain/alerta-pqr.js";
import { buildPqrAlertaEmail, type PqrAlertaItem } from "../infrastructure/email/pqr-alerta.template.js";

export type PqrParaAlerta = EstadoAlertaPqr & {
  id: string;
  gestion: string | null;
  solicitante: string;
  entidad: string;
  asunto: string;
  radicado: string | null;
  estado: string | null;
};

export interface PqrsAlertaRepository {
  /** PQR abiertas con vencimiento ≤ `hastaYmd` y alguna alerta pendiente. */
  listarCandidatas(hastaYmd: string): Promise<PqrParaAlerta[]>;
  /** Marca solo las que aún no tenían el flag. `claimed` = filas realmente actualizadas. */
  marcarAlertas(input: { por_vencer: string[]; vencidas: string[]; at: Date }): Promise<{ claimed: number }>;
}

export type EnviarAlertasPqrsDeps = {
  repo: PqrsAlertaRepository;
  emailSender: EmailSenderPort;
  from: () => string;
  resolveDestinatarios: () => Promise<string[]>;
  logoAttachment: () => SendEmailAttachment;
  logoCid: string;
  pqrsLinks: () => AlertaLink[];
  now?: () => Date;
};

export type EnviarAlertasPqrsResult = {
  hoy: string;
  enviado: boolean;
  destinatarios: number;
  por_vencer: number;
  vencidas: number;
};

/** Holgura en días calendario: 2 hábiles nunca superan una semana, ni con Semana Santa. */
const VENTANA_CANDIDATAS_DIAS = 10;

function uniqueEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export class EnviarAlertasPqrsUseCase {
  constructor(private readonly deps: EnviarAlertasPqrsDeps) {}

  private inflight: Promise<EnviarAlertasPqrsResult> | null = null;

  async execute(): Promise<EnviarAlertasPqrsResult> {
    if (this.inflight) return this.inflight;
    this.inflight = this.run().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async run(): Promise<EnviarAlertasPqrsResult> {
    const now = this.deps.now?.() ?? new Date();
    const hoy = getBusinessTodayYmd(now);
    if (!esDiaHabil(hoy)) {
      return { hoy, enviado: false, destinatarios: 0, por_vencer: 0, vencidas: 0 };
    }
    const candidatas = await this.deps.repo.listarCandidatas(addDaysYmd(hoy, VENTANA_CANDIDATAS_DIAS));

    const items: Array<PqrAlertaItem & { id: string }> = [];
    for (const p of candidatas) {
      const tipo = clasificarAlertaPqr(p, hoy);
      if (!tipo || !p.vencimiento) continue;
      items.push({
        id: p.id,
        tipo,
        gestion: p.gestion,
        solicitante: p.solicitante,
        entidad: p.entidad,
        asunto: p.asunto,
        radicado: p.radicado,
        vencimiento: p.vencimiento,
        estado: p.estado,
      });
    }

    const vencidas = items.filter((i) => i.tipo === "vencida");
    const porVencer = items.filter((i) => i.tipo === "por_vencer");
    const result: EnviarAlertasPqrsResult = {
      hoy,
      enviado: false,
      destinatarios: 0,
      por_vencer: porVencer.length,
      vencidas: vencidas.length,
    };
    if (items.length === 0) return result;

    const destinatarios = uniqueEmails(await this.deps.resolveDestinatarios());
    result.destinatarios = destinatarios.length;
    if (destinatarios.length === 0) return result;

    const content = buildPqrAlertaEmail({
      hoy,
      items,
      logo_cid: this.deps.logoCid,
      pqrs_links: this.deps.pqrsLinks(),
    });

    // Marcar antes del SMTP: si el cron se reintenta (Gmail tarda ~1 min), no se manda otra vez.
    const { claimed } = await this.deps.repo.marcarAlertas({
      por_vencer: porVencer.map((i) => i.id),
      vencidas: vencidas.map((i) => i.id),
      at: now,
    });
    if (claimed === 0) return result;

    await this.deps.emailSender.send({
      from: this.deps.from(),
      to: destinatarios.join(", "),
      subject: content.subject,
      html: content.html,
      text: content.text,
      attachments: [this.deps.logoAttachment()],
    });

    result.enviado = true;
    return result;
  }
}
