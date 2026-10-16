import type {
  EmailSenderPort,
  SendEmailAttachment,
} from "../../../shared/infrastructure/email/email-sender.port.js";
import { getBusinessTodayYmd } from "../../cuentas/domain/business-calendar.js";
import {
  clasificarAlertaTutela,
  type EstadoAlertaTutela,
  type TipoAlertaTutela,
} from "../domain/alerta-tutela.js";
import { addDaysYmd, esDiaHabil } from "../domain/dias-habiles-co.js";
import { ETAPA_TUTELA_LABELS } from "../domain/etapa-tutela.js";
import {
  buildTutelaAlertaEmail,
  type TutelaAlertaItem,
  type TutelaAlertaLink,
} from "../infrastructure/email/tutela-alerta.template.js";

export type TutelaParaAlerta = EstadoAlertaTutela & {
  id: string;
  radicado: string | null;
  juzgado: string | null;
  accionante: string;
  accionado: string;
  derecho: string;
  cliente_nombre: string | null;
  nota: string | null;
};

export interface TutelasAlertaRepository {
  /** Tutelas activas con vencimiento ≤ `hastaYmd` y alguna alerta pendiente. */
  listarCandidatas(hastaYmd: string): Promise<TutelaParaAlerta[]>;
  /** Marca solo las que aún no tenían el flag. `claimed` = filas realmente actualizadas. */
  marcarAlertas(input: { por_vencer: string[]; vencidas: string[]; at: Date }): Promise<{ claimed: number }>;
}

export type EnviarAlertasTutelasDeps = {
  repo: TutelasAlertaRepository;
  emailSender: EmailSenderPort;
  from: () => string;
  resolveDestinatarios: () => Promise<string[]>;
  logoAttachment: () => SendEmailAttachment;
  logoCid: string;
  tutelasLinks: () => TutelaAlertaLink[];
  now?: () => Date;
};

export type EnviarAlertasTutelasResult = {
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

export function toTutelaAlertaItem(
  t: TutelaParaAlerta & { vencimiento: string },
  tipo: TipoAlertaTutela,
): TutelaAlertaItem {
  return {
    tipo,
    radicado: t.radicado,
    juzgado: t.juzgado,
    accionante: t.accionante,
    accionado: t.accionado,
    derecho: t.derecho,
    etapa_label: ETAPA_TUTELA_LABELS[t.etapa],
    vencimiento: t.vencimiento,
    cliente_nombre: t.cliente_nombre,
    nota: t.nota,
  };
}

export class EnviarAlertasTutelasUseCase {
  constructor(private readonly deps: EnviarAlertasTutelasDeps) {}

  private inflight: Promise<EnviarAlertasTutelasResult> | null = null;

  async execute(): Promise<EnviarAlertasTutelasResult> {
    if (this.inflight) return this.inflight;
    this.inflight = this.run().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private async run(): Promise<EnviarAlertasTutelasResult> {
    const now = this.deps.now?.() ?? new Date();
    const hoy = getBusinessTodayYmd(now);
    // Los términos solo corren en días hábiles: fines de semana y festivos no se envía nada.
    if (!esDiaHabil(hoy)) {
      return { hoy, enviado: false, destinatarios: 0, por_vencer: 0, vencidas: 0 };
    }
    const candidatas = await this.deps.repo.listarCandidatas(
      addDaysYmd(hoy, VENTANA_CANDIDATAS_DIAS),
    );

    const items: Array<TutelaAlertaItem & { id: string }> = [];
    for (const t of candidatas) {
      const tipo = clasificarAlertaTutela(t, hoy);
      if (!tipo || !t.vencimiento) continue;
      items.push({ id: t.id, ...toTutelaAlertaItem({ ...t, vencimiento: t.vencimiento }, tipo) });
    }

    const vencidas = items.filter((i) => i.tipo === "vencida");
    const porVencer = items.filter((i) => i.tipo === "por_vencer");
    const result: EnviarAlertasTutelasResult = {
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

    const content = buildTutelaAlertaEmail({
      hoy,
      items,
      logo_cid: this.deps.logoCid,
      tutelas_links: this.deps.tutelasLinks(),
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
