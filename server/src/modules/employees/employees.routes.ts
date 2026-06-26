import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../lib/asyncHandler";
import { AppError } from "../../middleware/errorHandler";
import { requireAuth } from "../../middleware/auth";
import { employeeInputSchema } from "./employees.schema";
import {
  listEmployees,
  createEmployee,
  deactivateEmployee,
  importCsv,
} from "./employees.service";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });

export const employeesRouter = Router();
employeesRouter.use(requireAuth);

employeesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const employees = await listEmployees(req.auth!.organizationId);
    res.json({ employees });
  })
);

employeesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = employeeInputSchema.parse(req.body);
    const employee = await createEmployee(req.auth!.organizationId, input);
    res.status(201).json({ employee });
  })
);

employeesRouter.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "No file uploaded (field name must be 'file')");
    const summary = await importCsv(req.auth!.organizationId, req.file.buffer.toString("utf8"));
    res.json(summary);
  })
);

employeesRouter.patch(
  "/:id/deactivate",
  asyncHandler(async (req, res) => {
    const employee = await deactivateEmployee(req.auth!.organizationId, req.params.id);
    res.json({ employee });
  })
);
