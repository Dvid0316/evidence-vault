import { Router } from "express";
import { prisma } from "../db";

export const userRouter = Router();

userRouter.get("/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, createdAt: true },
    });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

userRouter.post("/users", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim();
    if (!email) return res.status(400).json({ error: "email is required" });

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return res.status(400).json({ error: "email already exists" });

    const user = await prisma.user.create({
      data: { email },
      select: { id: true, email: true, createdAt: true },
    });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
