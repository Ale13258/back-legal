import "dotenv/config";
import { createApp } from "./app.js";
import { prisma } from "./shared/infrastructure/prisma/prisma.client.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp();
const server = app.listen(port, () => {
  console.log(`API escuchando en http://127.0.0.1:${port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} recibido, cerrando API...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
