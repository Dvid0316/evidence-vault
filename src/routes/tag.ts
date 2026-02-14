import { Router } from "express";
import { getAuditInfo } from "../middleware/audit";
import {
  addTagToRecord,
  createTag,
  deleteTag,
  getRecordTags,
  listTags,
  removeTagFromRecord,
} from "../services/tagService";

export const tagRouter = Router();

tagRouter.post("/tags", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const name = String(req.body?.name ?? "").trim();
    const color = req.body?.color ?? undefined;

    if (!name) return res.status(400).json({ error: "name is required" });

    const tag = await createTag({ ownerUserId, name, color });
    res.json({ tag });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) return res.status(400).json({ error: msg });
    res.status(500).json({ error: msg });
  }
});

tagRouter.get("/tags", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const tags = await listTags(ownerUserId);
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

tagRouter.delete("/tags/:tagId", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const tagId = String(req.params.tagId);

    await deleteTag({ tagId, ownerUserId });
    res.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Tag not found") return res.status(404).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

tagRouter.post("/records/:recordId/tags", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const recordId = String(req.params.recordId);
    const tagId = String(req.body?.tagId ?? "");

    if (!tagId) return res.status(400).json({ error: "tagId is required" });

    await addTagToRecord({ recordId, tagId, ownerUserId, audit: getAuditInfo(req) });
    res.json({ added: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found" || msg === "Tag not found") return res.status(404).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

tagRouter.delete("/records/:recordId/tags/:tagId", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;
    const recordId = String(req.params.recordId);
    const tagId = String(req.params.tagId);

    await removeTagFromRecord({ recordId, tagId, ownerUserId, audit: getAuditInfo(req) });
    res.json({ removed: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Record not found" || msg === "Tag not found") return res.status(404).json({ error: msg });
    res.status(400).json({ error: msg });
  }
});

tagRouter.get("/records/:recordId/tags", async (req, res) => {
  try {
    const recordId = String(req.params.recordId);
    const tags = await getRecordTags(recordId);
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
