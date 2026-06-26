import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

async function signupAgent(email: string, orgName: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/signup").send({
    name: "Owner",
    orgName,
    email,
    password: "hunter2pass",
    legalAuthorityConfirmed: true,
  });
  return agent;
}

describe("employees", () => {
  it("imports a CSV, dedupes within the org, reports a summary", async () => {
    const agent = await signupAgent("a@acme.test", "Acme");
    const csv = [
      "name,email,department",
      "Anna Berg,anna@acme.test,Reception",
      "Bo Lind,bo@acme.test,IT",
      "Anna Berg,anna@acme.test,Reception", // duplicate -> update, not new
      "broken-row-no-email,,Ops", // invalid -> error
    ].join("\n");

    const res = await agent
      .post("/api/employees/import")
      .attach("file", Buffer.from(csv), "employees.csv");

    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.updated).toBe(1);
    expect(res.body.errors.length).toBe(1);

    const list = await agent.get("/api/employees");
    expect(list.body.employees.length).toBe(2);
  });

  it("adds and deactivates a single employee", async () => {
    const agent = await signupAgent("b@acme.test", "Acme2");
    const created = await agent
      .post("/api/employees")
      .send({ name: "Cara Nyman", email: "cara@acme.test", department: "HR" });
    expect(created.status).toBe(201);
    const id = created.body.employee.id;

    const off = await agent.patch(`/api/employees/${id}/deactivate`);
    expect(off.status).toBe(200);
    expect(off.body.employee.active).toBe(false);
  });

  it("isolates employees between orgs", async () => {
    const orgA = await signupAgent("owner@a.test", "OrgA");
    const orgB = await signupAgent("owner@b.test", "OrgB");

    const made = await orgA
      .post("/api/employees")
      .send({ name: "Secret Staff", email: "secret@a.test", department: "Exec" });
    const aId = made.body.employee.id;

    // Org B cannot see Org A's employees
    const bList = await orgB.get("/api/employees");
    expect(bList.body.employees.length).toBe(0);

    // Org B cannot deactivate Org A's employee
    const cross = await orgB.patch(`/api/employees/${aId}/deactivate`);
    expect(cross.status).toBe(404);

    // And the employee in Org A is untouched
    const aList = await orgA.get("/api/employees");
    expect(aList.body.employees[0].active).toBe(true);
  });

  it("requires authentication", async () => {
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(401);
  });
});
