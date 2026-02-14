import "dotenv/config";
import path from "node:path";
import { ChangeType, PrismaClient, RecordStatus } from "@prisma/client";
const adapterPkg = require("@prisma/adapter-libsql");

function resolveDbUrl(input?: string) {
  const raw = input?.trim();
  if (!raw) throw new Error("DATABASE_URL is missing in .env");

  if (raw.startsWith("file:")) {
    const maybeRel = raw.replace(/^file:/, "");
    const cleaned = maybeRel.replace(/^\.\/|^\.\\/, "");
    const absPath = path.isAbsolute(cleaned)
      ? cleaned
      : path.resolve(process.cwd(), cleaned);

    return `file:${absPath.replace(/\\/g, "/")}`;
  }

  return raw;
}

const dbUrl = resolveDbUrl(process.env.DATABASE_URL);

const AdapterCtor = adapterPkg.PrismaLibSql;


if (!AdapterCtor) {
  throw new Error(
    "Could not find Prisma libsql adapter export. Exports: " +
      Object.keys(adapterPkg).join(", ")
  );
}

const adapter = new AdapterCtor({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create a user (for now, simplest possible)
  const user = await prisma.user.upsert({
    where: { email: "david@example.com" },
    update: {},
    create: { email: "david@example.com" },
  });

  const record = await prisma.$transaction(async (tx) => {
    // 1) Create record container
    const newRecord = await tx.record.create({
      data: {
        ownerUserId: user.id,
        status: RecordStatus.ACTIVE,
        originalDeviceId: "dev-win11", // placeholder for now
      },
    });

    // 2) Create baseline/original version (version 1)
    const v1 = await tx.recordVersion.create({
      data: {
        recordId: newRecord.id,
        versionNumber: 1,
        isOriginal: true,
        contentText: "Initial record description. (Replace this later)",
        eventDateText: "last night around 10pm", // user-provided text, not normalized
        editedByUserId: user.id,
      },
    });

    // 3) Point record to current version
    await tx.record.update({
      where: { id: newRecord.id },
      data: { currentVersionId: v1.id },
    });

    // 4) Write audit log
    await tx.editHistory.create({
      data: {
        recordId: newRecord.id,
        versionId: v1.id,
        changeType: ChangeType.ADDED,
        changeSummary: "Created record and baseline version",
        actorUserId: user.id,
        systemGenerated: false,
      },
    });

    return { newRecord, v1 };
  });

  console.log("Created:", {
    recordId: record.newRecord.id,
    versionId: record.v1.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });