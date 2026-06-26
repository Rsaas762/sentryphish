import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";
import { signAuthToken, verifyAuthToken } from "../src/lib/jwt";
import { hashIp } from "../src/lib/hash";
import { slugify } from "../src/lib/slug";

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("hunter2pass");
    expect(hash).not.toBe("hunter2pass");
    expect(await verifyPassword("hunter2pass", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("jwt", () => {
  it("round-trips the payload", () => {
    const token = signAuthToken({ adminUserId: "a1", organizationId: "o1", role: "OWNER" });
    const decoded = verifyAuthToken(token);
    expect(decoded.adminUserId).toBe("a1");
    expect(decoded.organizationId).toBe("o1");
    expect(decoded.role).toBe("OWNER");
  });
  it("rejects a tampered token", () => {
    expect(() => verifyAuthToken("not.a.token")).toThrow();
  });
});

describe("hashIp", () => {
  it("is deterministic and not the raw ip", () => {
    expect(hashIp("1.2.3.4")).toBe(hashIp("1.2.3.4"));
    expect(hashIp("1.2.3.4")).not.toContain("1.2.3.4");
  });
});

describe("slugify", () => {
  it("kebab-cases and strips punctuation", () => {
    expect(slugify("Acme Clinic AB!")).toBe("acme-clinic-ab");
  });
});
