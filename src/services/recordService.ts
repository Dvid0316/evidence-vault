import { ChangeType, RecordStatus } from "@prisma/client";
import { prisma } from "../db";
import type { AuditInfo } from "../middleware/audit";

interface CreateRecordArgs {
  ownerUserId: string;
  contentText: string;
  eventDateText?: string | null;
  originalDeviceId?: string | null;
  audit?: AuditInfo;
}

export async function createRecord(args: CreateRecordArgs) {
  const { ownerUserId, contentText, eventDateText = null, originalDeviceId = null, audit } = args;

  const trimmed = contentText.trim();
  if (!trimmed) throw new Error("contentText is required");

  if (!ownerUserId) throw new Error("ownerUserId is required");

  return prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true },
    });
    if (!owner) throw new Error("ownerUserId not found");

    const record = await tx.record.create({
      data: { ownerUserId, originalDeviceId },
      select: { id: true, ownerUserId: true, createdAt: true, status: true },
    });

    const v1 = await tx.recordVersion.create({
      data: {
        recordId: record.id,
        versionNumber: 1,
        isOriginal: true,
        contentText: trimmed,
        eventDateText,
        editedByUserId: ownerUserId,
      },
      select: {
        id: true,
        versionNumber: true,
        createdAt: true,
        contentText: true,
        eventDateText: true,
      },
    });

    await tx.record.update({
      where: { id: record.id },
      data: { currentVersionId: v1.id },
      select: { id: true, currentVersionId: true },
    });

    await tx.editHistory.create({
      data: {
        recordId: record.id,
        versionId: v1.id,
        changeType: ChangeType.ADDED,
        changeSummary: "Created record",
        actorUserId: ownerUserId,
        systemGenerated: false,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
      select: { id: true },
    });

    const recordWithVersion = {
      ...record,
      currentVersionId: v1.id,
      currentVersion: v1,
    };
    return { record: recordWithVersion, version: v1 };
  });
}

export async function getRecord(recordId: string) {
  const record = await prisma.record.findUnique({
    where: { id: recordId },
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
    },
  });
  if (!record || !record.currentVersion) return null;
  return record;
}

interface AddVersionArgs {
  recordId: string;
  contentText: string;
  actorUserId?: string;
  eventDateText?: string | null;
  changeType?: ChangeType;
  changeSummary?: string;
  audit?: AuditInfo;
}

export async function addVersion(args: AddVersionArgs) {
  const {
    recordId,
    contentText,
    actorUserId,
    eventDateText = null,
    changeType = ChangeType.MODIFIED,
    changeSummary = "Updated record",
    audit,
  } = args;

  const trimmed = (contentText ?? "").trim();
  if (!trimmed) throw new Error("contentText cannot be empty");

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: { id: true, ownerUserId: true, currentVersionId: true },
    });
    if (!record) throw new Error(`Record not found: ${recordId}`);

    // Ownership guardrail (optional but recommended)
    if (actorUserId && record.ownerUserId !== actorUserId) {
      throw new Error("Forbidden: actor does not own this record");
    }

    // Optional: validate actor exists (only if provided)
    if (actorUserId) {
      const actor = await tx.user.findUnique({
        where: { id: actorUserId },
        select: { id: true },
      });
      if (!actor) throw new Error(`User not found: ${actorUserId}`);
    }

    const currentVersion = record.currentVersionId
      ? await tx.recordVersion.findUnique({
          where: { id: record.currentVersionId },
          select: {
            id: true,
            versionNumber: true,
            contentText: true,
            createdAt: true,
            eventDateText: true,
          },
        })
      : null;

    if (currentVersion && currentVersion.contentText === trimmed) {
      return {
        created: false,
        reason: "contentText matches current version",
        currentVersionId: currentVersion.id,
        currentVersionNumber: currentVersion.versionNumber,
        currentVersion,
      };
    }

    const nextVersionNumber = (currentVersion?.versionNumber ?? 0) + 1;

    const newVersion = await tx.recordVersion.create({
      data: {
        recordId: record.id,
        versionNumber: nextVersionNumber,
        contentText: trimmed,
        eventDateText,
        editedByUserId: actorUserId ?? null,
        isOriginal: false,
      },
      select: {
        id: true,
        recordId: true,
        versionNumber: true,
        createdAt: true,
        contentText: true,
        eventDateText: true,
      },
    });

    await tx.record.update({
      where: { id: record.id },
      data: { currentVersionId: newVersion.id },
    });

    await tx.editHistory.create({
      data: {
        recordId: record.id,
        versionId: newVersion.id,
        changeType,
        changeSummary,
        actorUserId: actorUserId ?? null,
        systemGenerated: changeType === ChangeType.SYSTEM,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
    });

    return { created: true, version: newVersion };
  });
}

interface SetRecordStatusArgs {
  recordId: string;
  actorUserId: string;
  status: RecordStatus;
  audit?: AuditInfo;
}

export async function setRecordStatus(args: SetRecordStatusArgs) {
  const { recordId, actorUserId, status, audit } = args;

  if (!actorUserId) throw new Error("actorUserId is required");

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        createdAt: true,
        currentVersionId: true,
        currentVersion: {
          select: { id: true, versionNumber: true, createdAt: true, contentText: true, eventDateText: true },
        },
      },
    });
    if (!record) throw new Error("Record not found");

    const actor = await tx.user.findUnique({
      where: { id: actorUserId },
      select: { id: true },
    });
    if (!actor) throw new Error("actorUserId not found");

    if (record.status === status) {
      return record;
    }

    const updated = await tx.record.update({
      where: { id: recordId },
      data: { status },
      select: {
        id: true,
        ownerUserId: true,
        status: true,
        createdAt: true,
        currentVersionId: true,
        currentVersion: {
          select: { id: true, versionNumber: true, createdAt: true, contentText: true, eventDateText: true },
        },
      },
    });

    const action = status === RecordStatus.ARCHIVED ? "Archived" : "Unarchived";
    await tx.editHistory.create({
      data: {
        recordId,
        changeType: ChangeType.MODIFIED,
        changeSummary: `${action} record`,
        actorUserId,
        systemGenerated: false,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
      select: { id: true },
    });

    return updated;
  });
}

interface RestoreVersionArgs {
  recordId: string;
  versionId: string;
  actorUserId: string;
  audit?: AuditInfo;
}

export async function restoreVersion(args: RestoreVersionArgs) {
  const { recordId, versionId, actorUserId, audit } = args;

  if (!actorUserId) throw new Error("actorUserId is required");
  if (!versionId) throw new Error("versionId is required");

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: { id: true, currentVersionId: true },
    });
    if (!record) throw new Error("Record not found");

    const actor = await tx.user.findUnique({
      where: { id: actorUserId },
      select: { id: true },
    });
    if (!actor) throw new Error("actorUserId not found");

    const sourceVersion = await tx.recordVersion.findUnique({
      where: { id: versionId },
      select: { id: true, recordId: true, versionNumber: true, contentText: true, eventDateText: true },
    });
    if (!sourceVersion || sourceVersion.recordId !== recordId) {
      throw new Error("Version not found or does not belong to this record");
    }

    const currentVersion = record.currentVersionId
      ? await tx.recordVersion.findUnique({
          where: { id: record.currentVersionId },
          select: { versionNumber: true },
        })
      : null;
    const nextVersionNumber = (currentVersion?.versionNumber ?? 0) + 1;

    const newVersion = await tx.recordVersion.create({
      data: {
        recordId: record.id,
        versionNumber: nextVersionNumber,
        contentText: sourceVersion.contentText,
        eventDateText: sourceVersion.eventDateText,
        editedByUserId: actorUserId,
        isOriginal: false,
      },
      select: {
        id: true,
        versionNumber: true,
        createdAt: true,
        contentText: true,
        eventDateText: true,
      },
    });

    await tx.record.update({
      where: { id: record.id },
      data: { currentVersionId: newVersion.id },
    });

    await tx.editHistory.create({
      data: {
        recordId: record.id,
        versionId: newVersion.id,
        changeType: ChangeType.MODIFIED,
        changeSummary: `Restored version ${sourceVersion.versionNumber} (${versionId})`,
        actorUserId,
        systemGenerated: false,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
      select: { id: true },
    });

    return { restored: true, recordId, version: newVersion };
  });
}
