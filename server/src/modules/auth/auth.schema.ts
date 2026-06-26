import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1),
  orgName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  legalAuthorityConfirmed: z.literal(true, {
    errorMap: () => ({
      message: "You must confirm you have legal authority to run simulations.",
    }),
  }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
