import { Router } from "express";
import { prisma } from "../db";

export const dashboardRouter = Router();

dashboardRouter.get("/dashboard", async (req, res) => {
  try {
    const ownerUserId = (req as any).userId as string;

    // --- Summary counts ---
    const [totalRecords, activeRecords, archivedRecords, totalExhibits, totalAttachments, totalCases, activeCases] =
      await Promise.all([
        prisma.record.count({ where: { ownerUserId } }),
        prisma.record.count({ where: { ownerUserId, status: "ACTIVE" } }),
        prisma.record.count({ where: { ownerUserId, status: "ARCHIVED" } }),
        prisma.exhibit.count({ where: { ownerUserId } }),
        prisma.attachment.count({
          where: { isActive: true, record: { ownerUserId } },
        }),
        prisma.case.count({ where: { ownerUserId } }),
        prisma.case.count({ where: { ownerUserId, isActive: true } }),
      ]);

    const summary = { totalRecords, activeRecords, archivedRecords, totalExhibits, totalAttachments, totalCases, activeCases };

    // --- Records by case ---
    const userRecords = await prisma.record.findMany({
      where: { ownerUserId },
      select: { caseId: true },
    });
    const caseCounts = new Map<string | null, number>();
    for (const r of userRecords) {
      caseCounts.set(r.caseId, (caseCounts.get(r.caseId) ?? 0) + 1);
    }
    const userCases = await prisma.case.findMany({
      where: { ownerUserId },
      select: { id: true, name: true, caseNumber: true },
    });
    const caseMap = new Map(userCases.map((c) => [c.id, c]));
    const recordsByCase: { caseId: string | null; caseName: string; caseNumber: string | null; count: number }[] = [];
    for (const [cId, count] of caseCounts) {
      if (cId === null) {
        recordsByCase.push({ caseId: null, caseName: "Unassigned", caseNumber: null, count });
      } else {
        const c = caseMap.get(cId);
        recordsByCase.push({ caseId: cId, caseName: c?.name ?? "Unknown", caseNumber: c?.caseNumber ?? null, count });
      }
    }
    recordsByCase.sort((a, b) => b.count - a.count);

    // --- Records by tag ---
    const tagGroups = await prisma.recordTag.groupBy({
      by: ["tagId"],
      where: { record: { ownerUserId } },
      _count: { tagId: true },
    });
    const tagIds = tagGroups.map((g) => g.tagId);
    const tags = tagIds.length > 0
      ? await prisma.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true, name: true, color: true } })
      : [];
    const tagMap = new Map(tags.map((t) => [t.id, t]));
    const recordsByTag = tagGroups
      .map((g) => {
        const t = tagMap.get(g.tagId);
        return { tagId: g.tagId, tagName: t?.name ?? "Unknown", tagColor: t?.color ?? "#6c757d", count: g._count.tagId };
      })
      .sort((a, b) => b.count - a.count);

    // --- Recent activity ---
    const recentActivity = await prisma.editHistory.findMany({
      where: { record: { ownerUserId } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        changeType: true,
        changeSummary: true,
        actorUserId: true,
        recordId: true,
        ipAddress: true,
      },
    });

    // --- Integrity status ---
    const integrityStatus = {
      totalAttachments,
      verified: 0,
      lastVerifiedAt: null as string | null,
    };

    // --- Exhibit progress ---
    const exhibitRows = await prisma.exhibit.findMany({
      where: { ownerUserId },
      orderBy: { exhibitCode: "asc" },
      select: {
        exhibitCode: true,
        label: true,
        recordId: true,
        record: {
          select: {
            _count: { select: { attachments: { where: { isActive: true } } } },
          },
        },
      },
    });
    const exhibitProgress = exhibitRows.map((e) => ({
      exhibitCode: e.exhibitCode,
      label: e.label,
      recordId: e.recordId,
      hasAttachments: (e.record._count.attachments ?? 0) > 0,
    }));

    // --- Timeline data (last 14 days) ---
    const now = new Date();
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const startDate = new Date(days[0] + "T00:00:00.000Z");

    // Get all records, versions, and attachments created since startDate for this user
    const [timeRecords, timeVersions, timeAttachments] = await Promise.all([
      prisma.record.findMany({
        where: { ownerUserId, createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      prisma.recordVersion.findMany({
        where: { record: { ownerUserId }, createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),
      prisma.attachment.findMany({
        where: { record: { ownerUserId }, uploadedAt: { gte: startDate } },
        select: { uploadedAt: true },
      }),
    ]);

    const dateKey = (d: Date) => d.toISOString().slice(0, 10);
    const recByDay = new Map<string, number>();
    const verByDay = new Map<string, number>();
    const attByDay = new Map<string, number>();
    for (const r of timeRecords) recByDay.set(dateKey(r.createdAt), (recByDay.get(dateKey(r.createdAt)) ?? 0) + 1);
    for (const v of timeVersions) verByDay.set(dateKey(v.createdAt), (verByDay.get(dateKey(v.createdAt)) ?? 0) + 1);
    for (const a of timeAttachments) attByDay.set(dateKey(a.uploadedAt), (attByDay.get(dateKey(a.uploadedAt)) ?? 0) + 1);

    const timelineData = days.map((date) => ({
      date,
      records: recByDay.get(date) ?? 0,
      versions: verByDay.get(date) ?? 0,
      attachments: attByDay.get(date) ?? 0,
    }));

    res.json({
      summary,
      recordsByCase,
      recordsByTag,
      recentActivity,
      integrityStatus,
      exhibitProgress,
      timelineData,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
