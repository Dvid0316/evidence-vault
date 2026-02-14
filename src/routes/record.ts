import { ChangeType, RecordStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db";
import { getAuditInfo } from "../middleware/audit";
import { addVersion, createRecord, getRecord, restoreVersion, setRecordStatus } from "../services/recordService";

export const recordRouter = Router();

// POST /records must be first (before /:recordId) so it matches exactly
recordRouter.post("/records", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const contentText = String(req.body?.contentText ?? "").trim();
    const eventDateText = req.body?.eventDateText ?? null;
    const originalDeviceId = req.body?.originalDeviceId ?? null;

    if (!contentText) return res.status(400).json({ error: "contentText is required" });

    const result = await createRecord({
      ownerUserId,
      contentText,
      eventDateText,
      originalDeviceId,
      audit: getAuditInfo(req),
    });

    res.json({ created: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

recordRouter.post("/records/:recordId/restore", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const versionId = String(req.body?.versionId ?? "");
    const actorUserId = (req as any).userId as string;

    if (!versionId) return res.status(400).json({ error: "versionId is required" });

    const result = await restoreVersion({ recordId, versionId, actorUserId, audit: getAuditInfo(req) });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found") return res.status(404).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

recordRouter.post("/records/:recordId/archive", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const actorUserId = (req as any).userId as string;

    const result = await setRecordStatus({ recordId, actorUserId, status: RecordStatus.ARCHIVED, audit: getAuditInfo(req) });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found") return res.status(404).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

recordRouter.post("/records/:recordId/unarchive", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const actorUserId = (req as any).userId as string;

    const result = await setRecordStatus({ recordId, actorUserId, status: RecordStatus.ACTIVE, audit: getAuditInfo(req) });
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found") return res.status(404).json({ error: msg });
    return res.status(400).json({ error: msg });
  }
});

recordRouter.post("/records/:recordId/versions", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const contentText = String(req.body?.contentText ?? "");
    const actorUserId = (req as any).userId as string;

    const result = await addVersion({
      recordId,
      contentText,
      actorUserId,
      eventDateText: req.body?.eventDateText ?? null,
      changeType: (req.body?.changeType as ChangeType) ?? ChangeType.MODIFIED,
      changeSummary: req.body?.changeSummary ?? "Updated record",
      audit: getAuditInfo(req),
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

recordRouter.get(/^\/records\/([^/]+)\/versions$/, async (req, res) => {
  const recordId = String(req.path.match(/\/records\/([^/]+)\/versions/)?.[1] ?? "");
  const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
  if (!record) return res.status(404).json({ error: "Record not found" });

  const versions = await prisma.recordVersion.findMany({
    where: { recordId },
    orderBy: { versionNumber: "desc" },
    select: { id: true, versionNumber: true, createdAt: true, contentText: true, eventDateText: true },
  });
  res.json({ recordId, versions });
});

recordRouter.get(/^\/records\/([^/]+)\/history$/, async (req, res) => {
  const recordId = String(req.path.match(/\/records\/([^/]+)\/history/)?.[1] ?? "");
  const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
  if (!record) return res.status(404).json({ error: "Record not found" });

  const history = await prisma.editHistory.findMany({
    where: { recordId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      changeType: true,
      changeSummary: true,
      actorUserId: true,
      versionId: true,
      systemGenerated: true,
      ipAddress: true,
      userAgent: true,
    },
  });
  res.json({ recordId, history });
});

// Access logging
recordRouter.post("/records/:recordId/access-log", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const actorUserId = (req as any).userId as string;
    const action = String(req.body?.action ?? "").trim();

    const validActions = ["VIEW", "DOWNLOAD", "SHARE_VIEW"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${validActions.join(", ")}` });
    }

    const record = await prisma.record.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) return res.status(404).json({ error: "Record not found" });

    const audit = getAuditInfo(req);
    await prisma.editHistory.create({
      data: {
        recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `${action} by ${actorUserId}`,
        actorUserId,
        systemGenerated: true,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      },
    });

    res.json({ logged: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

recordRouter.get("/records", async (req, res) => {
  const ownerUserId = (req as any).userId as string;
  const search = String(req.query?.search ?? "").trim();
  const caseIdParam = String(req.query?.caseId ?? "").trim();
  const tagIdParam = String(req.query?.tagId ?? "").trim();
  const statusParam = String(req.query?.status ?? "").trim();
  const sortParam = String(req.query?.sort ?? "createdAt").trim();
  const orderParam = String(req.query?.order ?? "desc").trim();

  const where: Record<string, unknown> = { ownerUserId };

  if (search) {
    where.currentVersion = { contentText: { contains: search } };
  }

  // Case filter
  if (caseIdParam === "none") {
    where.caseId = null;
  } else if (caseIdParam) {
    where.caseId = caseIdParam;
  }

  // Tag filter — records that have this tag
  if (tagIdParam) {
    where.tags = { some: { tagId: tagIdParam } };
  }

  // Status filter (default: show all, let frontend filter)
  if (statusParam === "ACTIVE" || statusParam === "ARCHIVED") {
    where.status = statusParam;
  }

  // Sort
  const validSorts = ["createdAt"];
  const sortField = validSorts.includes(sortParam) ? sortParam : "createdAt";
  const sortOrder = orderParam === "asc" ? "asc" as const : "desc" as const;

  const rows = await prisma.record.findMany({
    where,
    orderBy: { [sortField]: sortOrder },
    select: {
      id: true,
      ownerUserId: true,
      status: true,
      createdAt: true,
      caseId: true,
      currentVersionId: true,
      currentVersion: {
        select: { id: true, versionNumber: true, createdAt: true, contentText: true, eventDateText: true },
      },
      case: {
        select: { id: true, name: true },
      },
      tags: {
        select: {
          tag: {
            select: { id: true, name: true, color: true },
          },
        },
        orderBy: { tag: { name: "asc" } },
      },
    },
  });

  const records = rows.filter((r) => r.currentVersion !== null).map((r) => ({
    id: r.id,
    ownerUserId: r.ownerUserId,
    status: r.status,
    createdAt: r.createdAt,
    caseId: r.caseId,
    currentVersionId: r.currentVersionId,
    currentVersion: r.currentVersion,
    case: r.case,
    tags: r.tags.map((rt) => rt.tag),
  }));

  res.json({ ownerUserId, records });
});

recordRouter.get("/records/:recordId", async (req, res) => {
  const recordId = String(req.params.recordId);
  const record = await getRecord(recordId);
  if (!record) return res.status(404).json({ error: "Record not found" });
  res.json(record);
});
