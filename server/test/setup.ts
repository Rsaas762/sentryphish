import { beforeEach, afterAll } from "vitest";
import { prisma } from "../src/prisma";
import { resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});
