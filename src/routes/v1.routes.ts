import { Router } from "express";
import { prisma } from "../shared/infrastructure/prisma/prisma.client.js";
import { authRouter } from "../modules/auth/infrastructure/http/auth.routes.js";
import { clientesRouter } from "../modules/clientes/infrastructure/http/clientes.routes.js";
import { cuentasRouter } from "../modules/cuentas/infrastructure/http/cuentas.routes.js";
import { procesosLegalesRouter } from "../modules/procesos-legales/infrastructure/http/procesos-legales.routes.js";
import { gestionesRouter } from "../modules/gestiones/infrastructure/http/gestiones.routes.js";
import { metricsRouter } from "../modules/metrics/infrastructure/http/metrics.routes.js";
import { paymentRemindersRouter } from "../modules/payment-reminders/infrastructure/http/payment-reminders.routes.js";
import { usuariosRouter } from "../modules/usuarios/infrastructure/http/usuarios.routes.js";

export const v1Router = Router();

v1Router.get("/", (_req, res) => {
  res.json({ message: "API funcionando" });
});

v1Router.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "ok",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    });
  } catch {
    res.status(503).json({
      status: "degraded",
      database: "unavailable",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    });
  }
});

v1Router.use("/auth", authRouter);
v1Router.use("/usuarios", usuariosRouter);
v1Router.use("/clientes", clientesRouter);
v1Router.use("/cuentas", cuentasRouter);
v1Router.use("/procesos-legales", procesosLegalesRouter);
v1Router.use("/gestiones", gestionesRouter);
v1Router.use("/metrics", metricsRouter);
v1Router.use("/payment-reminders", paymentRemindersRouter);
