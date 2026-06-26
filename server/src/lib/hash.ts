import { createHash } from "node:crypto";

export const hashIp = (ip: string) => createHash("sha256").update(ip).digest("hex");
