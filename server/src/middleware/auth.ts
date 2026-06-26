import { Request, Response, NextFunction } from "express";
import { verifyAuthToken, AuthTokenPayload } from "../lib/jwt";
import { COOKIE_NAME } from "../lib/cookie";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.auth = verifyAuthToken(token);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}
