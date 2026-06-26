import { prisma } from "../../prisma";
import { AppError } from "../../middleware/errorHandler";
import { hashPassword } from "../../lib/password";
import { uniqueSlug } from "../../lib/slug";
import { SignupInput } from "./auth.schema";
import type { AdminUser, Organization } from "@prisma/client";

export async function signupService(input: SignupInput, ipHash: string) {
  const existing = await prisma.adminUser.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError(409, "Email already registered");

  const slug = await uniqueSlug(input.orgName);
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.orgName,
        slug,
        legalAuthorityConfirmed: true,
        consentAt: new Date(),
        consentIpHash: ipHash,
      },
    });
    const admin = await tx.adminUser.create({
      data: {
        organizationId: org.id,
        email: input.email,
        name: input.name,
        passwordHash,
        role: "OWNER",
      },
    });
    const orgWithConsent = await tx.organization.update({
      where: { id: org.id },
      data: { consentByAdminUserId: admin.id },
    });
    return { org: orgWithConsent, admin };
  });
}

export const publicUser = (a: AdminUser) => ({
  id: a.id,
  name: a.name,
  email: a.email,
  role: a.role,
  organizationId: a.organizationId,
});

export const publicOrg = (o: Organization) => ({
  id: o.id,
  name: o.name,
  slug: o.slug,
});
