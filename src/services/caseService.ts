import { ChangeType } from "@prisma/client";
import { prisma } from "../db";
import type { AuditInfo } from "../middleware/audit";

interface CreateCaseArgs {
  ownerUserId: string;
  name: string;
  description?: string | null;
  caseNumber?: string | null;
}

export async function createCase(args: CreateCaseArgs) {
  const { ownerUserId, name, description, caseNumber } = args;
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Case name is required");

  const existing = await prisma.case.findUnique({
    where: { ownerUserId_name: { ownerUserId, name: trimmedName } },
    select: { id: true },
  });
  if (existing) throw new Error("A case with this name already exists");

  return prisma.case.create({
    data: {
      ownerUserId,
      name: trimmedName,
      description: description ?? null,
      caseNumber: caseNumber ?? null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      caseNumber: true,
      createdAt: true,
      isActive: true,
      _count: { select: { records: true } },
    },
  });
}

export async function listCases(ownerUserId: string) {
  return prisma.case.findMany({
    where: { ownerUserId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      caseNumber: true,
      createdAt: true,
      isActive: true,
      _count: { select: { records: true } },
    },
  });
}

export async function getCase(caseId: string, ownerUserId: string) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      ownerUserId: true,
      name: true,
      description: true,
      caseNumber: true,
      createdAt: true,
      isActive: true,
      _count: { select: { records: true } },
    },
  });
  if (!c) throw new Error("Case not found");
  if (c.ownerUserId !== ownerUserId) throw new Error("Case not found");
  const { ownerUserId: _o, ...rest } = c;
  return rest;
}

interface UpdateCaseArgs {
  caseId: string;
  ownerUserId: string;
  name?: string;
  description?: string | null;
  caseNumber?: string | null;
  isActive?: boolean;
}

export async function updateCase(args: UpdateCaseArgs) {
  const { caseId, ownerUserId, name, description, caseNumber, isActive } = args;

  const existing = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, ownerUserId: true },
  });
  if (!existing || existing.ownerUserId !== ownerUserId) throw new Error("Case not found");

  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Case name is required");
    data.name = trimmed;
  }
  if (description !== undefined) data.description = description;
  if (caseNumber !== undefined) data.caseNumber = caseNumber;
  if (isActive !== undefined) data.isActive = isActive;

  return prisma.case.update({
    where: { id: caseId },
    data,
    select: {
      id: true,
      name: true,
      description: true,
      caseNumber: true,
      createdAt: true,
      isActive: true,
      _count: { select: { records: true } },
    },
  });
}

interface AssignRecordToCaseArgs {
  recordId: string;
  caseId: string;
  ownerUserId: string;
  audit?: AuditInfo;
}

export async function assignRecordToCase(args: AssignRecordToCaseArgs) {
  const { recordId, caseId, ownerUserId, audit } = args;

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: { id: true, ownerUserId: true },
    });
    if (!record || record.ownerUserId !== ownerUserId) throw new Error("Record not found");

    const caseRow = await tx.case.findUnique({
      where: { id: caseId },
      select: { id: true, ownerUserId: true, name: true },
    });
    if (!caseRow || caseRow.ownerUserId !== ownerUserId) throw new Error("Case not found");

    await tx.record.update({
      where: { id: recordId },
      data: { caseId },
    });

    await tx.editHistory.create({
      data: {
        recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `Assigned to case: ${caseRow.name}`,
        actorUserId: ownerUserId,
        systemGenerated: false,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
    });
  });
}

interface RemoveRecordFromCaseArgs {
  recordId: string;
  ownerUserId: string;
  audit?: AuditInfo;
}

export async function removeRecordFromCase(args: RemoveRecordFromCaseArgs) {
  const { recordId, ownerUserId, audit } = args;

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: { id: true, ownerUserId: true, caseId: true },
    });
    if (!record || record.ownerUserId !== ownerUserId) throw new Error("Record not found");

    await tx.record.update({
      where: { id: recordId },
      data: { caseId: null },
    });

    await tx.editHistory.create({
      data: {
        recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: "Removed from case",
        actorUserId: ownerUserId,
        systemGenerated: false,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
    });
  });
}
