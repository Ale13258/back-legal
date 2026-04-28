import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { v1Router } from "./routes/v1.routes.js";
import { errorHandler, notFoundHandler } from "./shared/http/error-handler.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader("x-request-id", req.requestId);
    next();
  });

  app.use("/api/v1", v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
