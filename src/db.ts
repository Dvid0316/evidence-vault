import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing");

export const prisma = new PrismaClient({
  adapter: new PrismaLibSql({ url }),
});
