import { ChangeType } from "@prisma/client";
import { Router } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../db";
import { getAuditInfo } from "../middleware/audit";

/** Public routes — no auth required */
export const publicShareRouter = Router();

/** Protected routes — require auth */
export const shareRouter = Router();

shareRouter.post("/records/:recordId/share", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const expiresAtStr = req.body?.expiresAt ?? null;

    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) return res.status(404).json({ error: "Record not found" });

    const token = randomUUID();
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;

    const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";

    const shareLink = await prisma.shareLink.create({
      data: {
        recordId,
        token,
        expiresAt,
      },
      select: {
        id: true,
        recordId: true,
        token: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    res.json({
      shareLink: {
        ...shareLink,
        url: `${BASE_URL}/share/${token}`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

shareRouter.get("/records/:recordId/shares", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) return res.status(404).json({ error: "Record not found" });

    const BASE_URL = process.env.BASE_URL ?? "http://localhost:3001";

    const shareLinks = await prisma.shareLink.findMany({
      where: { recordId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        recordId: true,
        token: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    const result = shareLinks.map((sl) => ({
      ...sl,
      url: `${BASE_URL}/share/${sl.token}`,
    }));

    res.json({ recordId, shareLinks: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

shareRouter.delete("/shares/:linkId", async (req, res) => {
  try {
    const linkId = String(req.params.linkId);
    const link = await prisma.shareLink.findUnique({ where: { id: linkId }, select: { id: true, revokedAt: true } });
    if (!link) return res.status(404).json({ error: "Share link not found" });
    if (link.revokedAt) return res.status(400).json({ error: "Already revoked" });

    await prisma.shareLink.update({
      where: { id: linkId },
      data: { revokedAt: new Date() },
    });
    res.json({ revoked: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// === Public: share token viewing ===
publicShareRouter.get("/share/:token", async (req, res) => {
  try {
    const token = String(req.params.token);
    const link = await prisma.shareLink.findUnique({
      where: { token },
      select: {
        id: true,
        recordId: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    if (!link) return res.status(404).json({ error: "Share link not found" });
    if (link.revokedAt) return res.status(404).json({ error: "Share link has been revoked" });
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(404).json({ error: "Share link has expired" });
    }

    const record = await prisma.record.findUnique({
      where: { id: link.recordId },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        createdAt: true,
        currentVersion: {
          select: { id: true, versionNumber: true, createdAt: true, contentText: true, eventDateText: true },
        },
      },
    });

    if (!record || !record.currentVersion) {
      return res.status(404).json({ error: "Record not found" });
    }

    // Auto-log SHARE_VIEW access
    const audit = getAuditInfo(req);
    await prisma.editHistory.create({
      data: {
        recordId: link.recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `SHARE_VIEW via token ${token.slice(0, 8)}…`,
        systemGenerated: true,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      },
    }).catch(() => {}); // Don't fail the request if logging fails

    res.json({ record });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
