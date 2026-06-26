import { Response } from "express";
import { env } from "../env";

export const COOKIE_NAME = "sp_token";

const base = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: env.COOKIE_SECURE,
  path: "/",
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, { ...base, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, base);
}
