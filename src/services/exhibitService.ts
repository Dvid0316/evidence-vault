import { ChangeType } from "@prisma/client";
import { prisma } from "../db";
import type { AuditInfo } from "../middleware/audit";

/**
 * Convert a zero-based index to an exhibit code: 0→A, 1→B, ... 25→Z, 26→AA, 27→AB, ...
 */
function indexToExhibitCode(index: number): string {
  let code = "";
  let n = index;
  do {
    code = String.fromCharCode(65 + (n % 26)) + code;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return code;
}

/**
 * Convert an exhibit code back to a zero-based index.
 */
function exhibitCodeToIndex(code: string): number {
  let index = 0;
  for (let i = 0; i < code.length; i++) {
    index = index * 26 + (code.charCodeAt(i) - 64);
  }
  return index - 1;
}

export async function getNextExhibitCode(ownerUserId: string): Promise<string> {
  const exhibits = await prisma.exhibit.findMany({
    where: { ownerUserId },
    orderBy: { exhibitCode: "desc" },
    select: { exhibitCode: true },
    take: 1,
  });
  if (exhibits.length === 0) return "A";
  return indexToExhibitCode(exhibitCodeToIndex(exhibits[0].exhibitCode) + 1);
}

interface DesignateExhibitArgs {
  recordId: string;
  ownerUserId: string;
  label?: string | null;
  audit?: AuditInfo;
}

export async function designateExhibit(args: DesignateExhibitArgs) {
  const { recordId, ownerUserId, label, audit } = args;

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: { id: true, ownerUserId: true },
    });
    if (!record) throw new Error("Record not found");
    if (record.ownerUserId !== ownerUserId) {
      throw new Error("Record does not belong to this user");
    }

    const existing = await tx.exhibit.findUnique({
      where: { recordId },
      select: { id: true },
    });
    if (existing) throw new Error("Record already designated as an exhibit");

    // Calculate next code within transaction (find highest existing and increment)
    const topExhibit = await tx.exhibit.findMany({
      where: { ownerUserId },
      orderBy: { exhibitCode: "desc" },
      select: { exhibitCode: true },
      take: 1,
    });
    const exhibitCode = topExhibit.length === 0
      ? "A"
      : indexToExhibitCode(exhibitCodeToIndex(topExhibit[0].exhibitCode) + 1);

    const exhibit = await tx.exhibit.create({
      data: {
        recordId,
        ownerUserId,
        exhibitCode,
        label: label ?? null,
      },
      select: {
        id: true,
        recordId: true,
        ownerUserId: true,
        exhibitCode: true,
        label: true,
        createdAt: true,
      },
    });

    await tx.editHistory.create({
      data: {
        recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `Designated as Exhibit ${exhibitCode}`,
        actorUserId: ownerUserId,
        systemGenerated: true,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
      select: { id: true },
    });

    return exhibit;
  });
}

interface RemoveExhibitArgs {
  exhibitId: string;
  actorUserId: string;
  audit?: AuditInfo;
}

export async function removeExhibit(args: RemoveExhibitArgs) {
  const { exhibitId, actorUserId, audit } = args;

  return prisma.$transaction(async (tx) => {
    const exhibit = await tx.exhibit.findUnique({
      where: { id: exhibitId },
      select: { id: true, recordId: true, exhibitCode: true },
    });
    if (!exhibit) throw new Error("Exhibit not found");

    await tx.exhibit.delete({ where: { id: exhibitId } });

    await tx.editHistory.create({
      data: {
        recordId: exhibit.recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `Removed exhibit designation (was Exhibit ${exhibit.exhibitCode})`,
        actorUserId,
        systemGenerated: true,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
      select: { id: true },
    });
  });
}

export async function listExhibits(ownerUserId: string) {
  return prisma.exhibit.findMany({
    where: { ownerUserId },
    orderBy: { exhibitCode: "asc" },
    select: {
      id: true,
      recordId: true,
      ownerUserId: true,
      exhibitCode: true,
      label: true,
      createdAt: true,
      record: {
        select: {
          currentVersion: {
            select: {
              contentText: true,
              versionNumber: true,
            },
          },
        },
      },
    },
  });
}

export async function getExhibitForRecord(recordId: string) {
  return prisma.exhibit.findUnique({
    where: { recordId },
    select: {
      id: true,
      recordId: true,
      ownerUserId: true,
      exhibitCode: true,
      label: true,
      createdAt: true,
    },
  });
}
