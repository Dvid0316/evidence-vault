import { ChangeType } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { createHash } from "crypto";
import { createReadStream, readFileSync } from "fs";
import path from "path";
import { prisma } from "../db";
import { getAuditInfo } from "../middleware/audit";

export const attachmentRouter = Router();

const upload = multer({ dest: "uploads/" });

attachmentRouter.post("/records/:recordId/attachments", upload.single("file"), async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file is required" });

    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) return res.status(404).json({ error: "Record not found" });

    // Compute SHA-256 hash of uploaded file
    const fileBuffer = readFileSync(file.path);
    const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

    const attachment = await prisma.attachment.create({
      data: {
        recordId,
        fileType: file.mimetype || "application/octet-stream",
        storagePath: file.path,
        fileHash,
        isActive: true,
      },
      select: {
        id: true,
        recordId: true,
        fileType: true,
        uploadedAt: true,
        fileHash: true,
      },
    });

    res.json({
      attachment: {
        ...attachment,
        originalName: file.originalname,
        size: file.size,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

attachmentRouter.get("/records/:recordId/attachments", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) return res.status(404).json({ error: "Record not found" });

    const attachments = await prisma.attachment.findMany({
      where: { recordId, isActive: true },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        recordId: true,
        fileType: true,
        uploadedAt: true,
        fileHash: true,
        storagePath: true,
      },
    });

    res.json({ recordId, attachments });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

attachmentRouter.get("/attachments/:attachmentId/download", async (req, res) => {
  try {
    const attachmentId = String(req.params.attachmentId);
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, recordId: true, storagePath: true, fileType: true, isActive: true },
    });
    if (!attachment || !attachment.isActive) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Auto-log DOWNLOAD access
    const audit = getAuditInfo(req);
    await prisma.editHistory.create({
      data: {
        recordId: attachment.recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `DOWNLOAD attachment ${attachmentId.slice(0, 8)}…`,
        systemGenerated: true,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      },
    }).catch(() => {}); // Don't fail the download if logging fails

    res.setHeader("Content-Type", attachment.fileType);
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(attachment.storagePath)}"`);
    const stream = createReadStream(attachment.storagePath);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Verify a single attachment integrity (recompute hash and compare)
attachmentRouter.get("/attachments/:attachmentId/verify", async (req, res) => {
  try {
    const attachmentId = String(req.params.attachmentId);
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, storagePath: true, fileHash: true, isActive: true },
    });
    if (!attachment || !attachment.isActive) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const fileBuffer = readFileSync(attachment.storagePath);
    const computedHash = createHash("sha256").update(fileBuffer).digest("hex");
    const match = computedHash === attachment.fileHash;

    res.json({
      attachmentId: attachment.id,
      storedHash: attachment.fileHash,
      computedHash,
      match,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Batch verify all active attachments for a record
attachmentRouter.get("/records/:recordId/attachments/verify", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) return res.status(404).json({ error: "Record not found" });

    const attachments = await prisma.attachment.findMany({
      where: { recordId, isActive: true },
      select: { id: true, storagePath: true, fileHash: true },
    });

    const results = attachments.map((att) => {
      try {
        const fileBuffer = readFileSync(att.storagePath);
        const computedHash = createHash("sha256").update(fileBuffer).digest("hex");
        const match = computedHash === att.fileHash;
        return { attachmentId: att.id, storedHash: att.fileHash, computedHash, match };
      } catch {
        return { attachmentId: att.id, storedHash: att.fileHash, computedHash: null, match: false, error: "File not found on disk" };
      }
    });

    const allPassed = results.every((r) => r.match);
    res.json({ recordId, results, allPassed });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

attachmentRouter.delete("/attachments/:attachmentId", async (req, res) => {
  try {
    const attachmentId = String(req.params.attachmentId);
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, isActive: true },
    });
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { isActive: false },
    });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
