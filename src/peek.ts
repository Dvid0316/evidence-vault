import "dotenv/config";
import { prisma } from "./db";

async function run() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true },
    take: 5,
  });

  const records = await prisma.record.findMany({
    select: { id: true, ownerUserId: true, currentVersionId: true },
    take: 5,
  });

  console.log({ users, records });
}

run()
  .catch(console.error)
  .finally(() => process.exit(0));
