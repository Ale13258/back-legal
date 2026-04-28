import { Router } from "express";
import { authRouter } from "../modules/auth/infrastructure/http/auth.routes.js";
import { clientesRouter } from "../modules/clientes/infrastructure/http/clientes.routes.js";
import { propiedadesRouter } from "../modules/propiedades/infrastructure/http/propiedades.routes.js";
import { cuentasRouter } from "../modules/cuentas/infrastructure/http/cuentas.routes.js";
import { gestionesRouter } from "../modules/gestiones/infrastructure/http/gestiones.routes.js";
import { metricsRouter } from "../modules/metrics/infrastructure/http/metrics.routes.js";
import { notificationsRouter } from "../modules/notifications/infrastructure/http/notifications.routes.js";

export const v1Router = Router();

v1Router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

v1Router.use("/auth", authRouter);
v1Router.use("/clientes", clientesRouter);
v1Router.use("/propiedades", propiedadesRouter);
v1Router.use("/cuentas", cuentasRouter);
v1Router.use("/gestiones", gestionesRouter);
v1Router.use("/metrics", metricsRouter);
v1Router.use("/notifications", notificationsRouter);
