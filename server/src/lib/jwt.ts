import jwt from "jsonwebtoken";
import { env } from "../env";

export interface AuthTokenPayload {
  adminUserId: string;
  organizationId: string;
  role: "OWNER" | "ADMIN";
}

export const signAuthToken = (p: AuthTokenPayload) =>
  jwt.sign(p, env.JWT_SECRET, { expiresIn: "7d" });

export const verifyAuthToken = (token: string): AuthTokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
