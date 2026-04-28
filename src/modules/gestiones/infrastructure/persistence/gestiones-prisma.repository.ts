import { prisma } from "../../../../shared/infrastructure/prisma/prisma.client.js";
import type {
  GestionesPersistencePort,
  Gestion,
} from "../../domain/ports/gestiones-persistence.port.js";

export class GestionesPrismaRepository implements GestionesPersistencePort {
  async listGestiones(): Promise<Gestion[]> {
    return (await prisma.gestion.findMany({
      orderBy: [{ fecha: "desc" }, { created_at: "desc" }],
    })) as unknown as Gestion[];
  }
}

