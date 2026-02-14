import { ChangeType } from "@prisma/client";
import { prisma } from "../db";
import type { AuditInfo } from "../middleware/audit";

interface CreateTagArgs {
  ownerUserId: string;
  name: string;
  color?: string;
}

export async function createTag(args: CreateTagArgs) {
  const { ownerUserId, color } = args;
  const name = args.name.trim().toLowerCase();
  if (!name) throw new Error("Tag name is required");

  const existing = await prisma.tag.findUnique({
    where: { ownerUserId_name: { ownerUserId, name } },
    select: { id: true },
  });
  if (existing) throw new Error("A tag with this name already exists");

  return prisma.tag.create({
    data: {
      ownerUserId,
      name,
      color: color ?? "#6c757d",
    },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
      _count: { select: { records: true } },
    },
  });
}

export async function listTags(ownerUserId: string) {
  return prisma.tag.findMany({
    where: { ownerUserId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      createdAt: true,
      _count: { select: { records: true } },
    },
  });
}

interface AddTagToRecordArgs {
  recordId: string;
  tagId: string;
  ownerUserId: string;
  audit?: AuditInfo;
}

export async function addTagToRecord(args: AddTagToRecordArgs) {
  const { recordId, tagId, ownerUserId, audit } = args;

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: { id: true, ownerUserId: true },
    });
    if (!record || record.ownerUserId !== ownerUserId) throw new Error("Record not found");

    const tag = await tx.tag.findUnique({
      where: { id: tagId },
      select: { id: true, ownerUserId: true, name: true },
    });
    if (!tag || tag.ownerUserId !== ownerUserId) throw new Error("Tag not found");

    // Upsert: ignore if already exists
    const existing = await tx.recordTag.findUnique({
      where: { recordId_tagId: { recordId, tagId } },
      select: { id: true },
    });
    if (existing) return; // already tagged

    await tx.recordTag.create({
      data: { recordId, tagId },
    });

    await tx.editHistory.create({
      data: {
        recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `Tagged: ${tag.name}`,
        actorUserId: ownerUserId,
        systemGenerated: false,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
    });
  });
}

interface RemoveTagFromRecordArgs {
  recordId: string;
  tagId: string;
  ownerUserId: string;
  audit?: AuditInfo;
}

export async function removeTagFromRecord(args: RemoveTagFromRecordArgs) {
  const { recordId, tagId, ownerUserId, audit } = args;

  return prisma.$transaction(async (tx) => {
    const record = await tx.record.findUnique({
      where: { id: recordId },
      select: { id: true, ownerUserId: true },
    });
    if (!record || record.ownerUserId !== ownerUserId) throw new Error("Record not found");

    const tag = await tx.tag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true },
    });
    if (!tag) throw new Error("Tag not found");

    const rt = await tx.recordTag.findUnique({
      where: { recordId_tagId: { recordId, tagId } },
      select: { id: true },
    });
    if (!rt) return; // not tagged

    await tx.recordTag.delete({
      where: { id: rt.id },
    });

    await tx.editHistory.create({
      data: {
        recordId,
        changeType: ChangeType.SYSTEM,
        changeSummary: `Untagged: ${tag.name}`,
        actorUserId: ownerUserId,
        systemGenerated: false,
        ipAddress: audit?.ipAddress,
        userAgent: audit?.userAgent,
      },
    });
  });
}

export async function getRecordTags(recordId: string) {
  const rts = await prisma.recordTag.findMany({
    where: { recordId },
    select: {
      tag: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: { tag: { name: "asc" } },
  });
  return rts.map((rt) => rt.tag);
}

interface DeleteTagArgs {
  tagId: string;
  ownerUserId: string;
}

export async function deleteTag(args: DeleteTagArgs) {
  const { tagId, ownerUserId } = args;

  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    select: { id: true, ownerUserId: true },
  });
  if (!tag || tag.ownerUserId !== ownerUserId) throw new Error("Tag not found");

  await prisma.$transaction(async (tx) => {
    await tx.recordTag.deleteMany({ where: { tagId } });
    await tx.tag.delete({ where: { id: tagId } });
  });
}
