import { z } from "zod";

export const employeeInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().optional().nullable(),
});
export type EmployeeInput = z.infer<typeof employeeInputSchema>;
