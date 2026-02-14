import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { getJwtSecret, requireAuth } from "../middleware/auth";

export const authRouter = Router();

const SALT_ROUNDS = 10;

authRouter.post("/auth/register", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email) return res.status(400).json({ error: "email is required" });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "password must be at least 6 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return res.status(400).json({ error: "email already registered" });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { email, passwordHash },
      select: { id: true, email: true, createdAt: true },
    });

    const token = jwt.sign(
      { userId: user.id, role: "user" },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({
      user: { id: user.id, email: user.email, role: "user" },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

authRouter.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email) return res.status(400).json({ error: "email is required" });
    if (!password) return res.status(400).json({ error: "password is required" });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, role: "user" },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    res.json({
      user: { id: user.id, email: user.email, role: "user" },
      token,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

authRouter.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      user: { id: user.id, email: user.email, role: (req as any).userRole ?? "user" },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
