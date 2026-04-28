import "dotenv/config";
import { whatsappWorker } from "../modules/notifications/infrastructure/queue/whatsapp.worker.js";
import { prisma } from "../shared/infrastructure/prisma/prisma.client.js";

console.log("Worker WhatsApp iniciado");

whatsappWorker.on("error", (error) => {
  console.error("worker_runtime_error", error.message);
});

async function shutdown(signal: string) {
  console.log(`${signal} recibido, cerrando worker...`);
  await whatsappWorker.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
