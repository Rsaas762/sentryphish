import { prisma } from "../prisma";

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "org";
  let candidate = base;
  let n = 1;
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}
