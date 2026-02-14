import { Router } from "express";
import { getAuditInfo } from "../middleware/audit";
import {
  assignRecordToCase,
  createCase,
  getCase,
  listCases,
  removeRecordFromCase,
  updateCase,
} from "../services/caseService";

export const caseRouter = Router();

caseRouter.post("/cases", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const name = String(req.body?.name ?? "").trim();
    const description = req.body?.description ?? null;
    const caseNumber = req.body?.caseNumber ?? null;

    if (!name) return res.status(400).json({ error: "name is required" });

    const caseRow = await createCase({ ownerUserId, name, description, caseNumber });
    res.json({ case: caseRow });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) return res.status(400).json({ error: msg });
    res.status(500).json({ error: msg });
  }
});

caseRouter.get("/cases", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const cases = await listCases(ownerUserId);
    res.json({ cases });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

caseRouter.get("/cases/:caseId", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const caseId = String(req.params.caseId);
    const caseRow = await getCase(caseId, ownerUserId);
    res.json({ case: caseRow });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Case not found") return res.status(404).json({ error: msg });
    res.status(500).json({ error: msg });
  }
});

caseRouter.patch("/cases/:caseId", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const caseId = String(req.params.caseId);
    const { name, description, caseNumber, isActive } = req.body ?? {};

    const caseRow = await updateCase({ caseId, ownerUserId, name, description, caseNumber, isActive });
    res.json({ case: caseRow });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Case not found") return res.status(404).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

caseRouter.post("/records/:recordId/case", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const recordId = String(req.params.recordId);
    const caseId = String(req.body?.caseId ?? "");

    if (!caseId) return res.status(400).json({ error: "caseId is required" });

    await assignRecordToCase({ recordId, caseId, ownerUserId, audit: getAuditInfo(req) });
    res.json({ assigned: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found" || msg === "Case not found") return res.status(404).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

caseRouter.delete("/records/:recordId/case", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const recordId = String(req.params.recordId);

    await removeRecordFromCase({ recordId, ownerUserId, audit: getAuditInfo(req) });
    res.json({ removed: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found") return res.status(404).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});
