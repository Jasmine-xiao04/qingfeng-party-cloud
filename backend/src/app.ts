import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "./utils/http.js";
import { clearCacheOnMutation } from "./middleware/cache.js";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import activityRoutes from "./routes/activities.js";
import importRoutes from "./routes/imports.js";
import pointsRoutes from "./routes/points.js";
import rankingsRoutes from "./routes/rankings.js";
import honorsRoutes from "./routes/honors.js";
import dashboardRoutes from "./routes/dashboard.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL?.split(",") ?? "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(clearCacheOnMutation);

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { service: "qingfeng-party-cloud", status: "ok" } });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/import", importRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/rankings", rankingsRoutes);
app.use("/api/honors", honorsRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((_req, _res, next) => next(new HttpError(404, "接口不存在")));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "服务器内部错误";
  if (status >= 500) console.error(error);
  res.status(status).json({ success: false, message });
});
