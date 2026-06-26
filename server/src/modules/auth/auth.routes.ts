import { Router } from "express";
import { prisma } from "../../prisma";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/errorHandler";
import { hashIp } from "../../lib/hash";
import { verifyPassword } from "../../lib/password";
import { signAuthToken } from "../../lib/jwt";
import { setAuthCookie, clearAuthCookie } from "../../lib/cookie";
import { requireAuth } from "../../middleware/auth";
import { signupSchema, loginSchema } from "./auth.schema";
import { signupService, publicUser, publicOrg } from "./auth.service";

export const authRouter = Router();

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const input = signupSchema.parse(req.body);
    const ipHash = hashIp(req.ip ?? "unknown");
    const { admin, org } = await signupService(input, ipHash);
    setAuthCookie(
      res,
      signAuthToken({ adminUserId: admin.id, organizationId: org.id, role: admin.role })
    );
    res.status(201).json({ user: publicUser(admin), organization: publicOrg(org) });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({
      where: { email },
      include: { organization: true },
    });
    if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
      throw new AppError(401, "Invalid credentials");
    }
    setAuthCookie(
      res,
      signAuthToken({
        adminUserId: admin.id,
        organizationId: admin.organizationId,
        role: admin.role,
      })
    );
    res.json({ user: publicUser(admin), organization: publicOrg(admin.organization) });
  })
);

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.auth!.adminUserId },
      include: { organization: true },
    });
    if (!admin) throw new AppError(401, "Session user not found");
    res.json({ user: publicUser(admin), organization: publicOrg(admin.organization) });
  })
);
