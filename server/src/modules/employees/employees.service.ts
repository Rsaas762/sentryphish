import { parse } from "csv-parse/sync";
import { prisma } from "../../prisma";
import { AppError } from "../../middleware/errorHandler";
import { employeeInputSchema, EmployeeInput } from "./employees.schema";

export function listEmployees(organizationId: string) {
  return prisma.employee.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

export function createEmployee(organizationId: string, input: EmployeeInput) {
  return prisma.employee.upsert({
    where: { organizationId_email: { organizationId, email: input.email } },
    update: { name: input.name, department: input.department ?? null },
    create: {
      organizationId,
      name: input.name,
      email: input.email,
      department: input.department ?? null,
    },
  });
}

export async function deactivateEmployee(organizationId: string, id: string) {
  const employee = await prisma.employee.findFirst({ where: { id, organizationId } });
  if (!employee) throw new AppError(404, "Employee not found");
  return prisma.employee.update({ where: { id }, data: { active: false } });
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export async function importCsv(organizationId: string, csv: string): Promise<ImportSummary> {
  let records: Record<string, string>[];
  try {
    records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    throw new AppError(400, "Could not parse CSV");
  }

  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < records.length; i++) {
    const parsed = employeeInputSchema.safeParse({
      name: records[i].name,
      email: records[i].email,
      department: records[i].department,
    });
    if (!parsed.success) {
      summary.skipped++;
      summary.errors.push({ row: i + 2, reason: "Invalid name or email" }); // +2: header row + 1-based
      continue;
    }
    const exists = await prisma.employee.findUnique({
      where: { organizationId_email: { organizationId, email: parsed.data.email } },
    });
    await createEmployee(organizationId, parsed.data);
    if (exists) summary.updated++;
    else summary.created++;
  }
  return summary;
}
