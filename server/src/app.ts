import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { env } from "./env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";

export function createApp() {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  // app.use("/api/employees", employeesRouter);  // Task 5

  app.use(errorHandler);
  return app;
}
