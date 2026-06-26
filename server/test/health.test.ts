import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/prisma";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("database", () => {
  it("connects and starts empty", async () => {
    const count = await prisma.organization.count();
    expect(count).toBe(0);
  });
});
