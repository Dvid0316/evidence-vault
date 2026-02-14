import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./middleware/auth";
import { auditContext } from "./middleware/audit";
import { authRouter } from "./routes/auth";
import { attachmentRouter } from "./routes/attachment";
import { caseRouter } from "./routes/case";
import { dashboardRouter } from "./routes/dashboard";
import { exhibitRouter } from "./routes/exhibit";
import { recordRouter } from "./routes/record";
import { publicShareRouter, shareRouter } from "./routes/share";
import { tagRouter } from "./routes/tag";
import { userRouter } from "./routes/user";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// === SECURITY MIDDLEWARE ===
app.use(helmet());

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3001"];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// Strict limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

app.use(express.json());
app.use(auditContext);

if (!isProd) {
  app.use(express.static("src/public"));
}

/** DEV-ONLY: List all registered routes (temporary) */
function listRoutes(): { method: string; path: string }[] {
  const routes: { method: string; path: string }[] = [];
  const stack = (app as unknown as { _router?: { stack: unknown[] } })._router?.stack ?? [];
  function walk(s: unknown[], prefix = "") {
    for (const layer of s as { route?: { path: string; methods: Record<string, boolean> }; name?: string; handle?: { stack?: unknown[] } }[]) {
      if (layer.route) {
        const path = (prefix + layer.route.path).replace(/\/+/g, "/") || "/";
        const methods = Object.keys(layer.route.methods).filter((m) => m !== "_all").map((m) => m.toUpperCase());
        for (const method of methods) routes.push({ method, path });
      } else if (layer.name === "router" && layer.handle?.stack) {
        walk(layer.handle.stack as unknown[], prefix);
      }
    }
  }
  walk(stack as unknown[]);
  return routes;
}

// === PUBLIC ROUTES (no auth required) ===

// Routes debug endpoint (dev only)
if (!isProd) {
  app.get("/__routes", (_req: Request, res: Response) => {
    res.json({ routes: listRoutes() });
  });
}

// Auth routes with strict rate limiting
app.use("/auth/register", authLimiter);
app.use("/auth/login", authLimiter);
app.use(authRouter);

// Public share link viewing
app.use(publicShareRouter);

// === API RATE LIMIT (all routes below) ===
app.use(apiLimiter);

// === AUTH MIDDLEWARE (all routes below require a valid JWT) ===
app.use(requireAuth);

// === PROTECTED ROUTES ===
app.use(recordRouter);
app.use(userRouter);
app.use(attachmentRouter);
app.use(shareRouter);
app.use(exhibitRouter);
app.use(caseRouter);
app.use(tagRouter);
app.use(dashboardRouter);

// === PRODUCTION: Serve React frontend ===
if (isProd) {
  const clientDist = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port} [${isProd ? "production" : "development"}]`);
  if (!isProd) {
    const routes = listRoutes();
    console.log("Mounted routes:");
    for (const r of routes) console.log(`  ${r.method.padEnd(6)} ${r.path}`);
  }
});
