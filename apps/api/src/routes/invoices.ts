import { Router } from "express";
import { z } from "zod";
import { convexClient } from "../lib/convex";
import { ApiError } from "../middleware/errorHandler";
import { UserRequest } from "../middleware/validateUserContext";
import { api } from "../../../../convex/_generated/api";

const router = Router();

const getStatusLabel = (status?: string) => {
  if (status === "paid") return "Paid";
  if (status === "overdue") return "Overdue";
  if (status === "unpaid") return "Outstanding";
  if (status === "due" || status === "sent") return "Due";
  if (status === "void") return "Void";
  return "Due";
};

const getStatusClass = (status?: string) => {
  if (status === "paid") return "paid";
  if (status === "overdue") return "overdue";
  if (status === "unpaid") return "unpaid";
  if (status === "due" || status === "sent") return "sent";
  if (status === "void") return "cancelled";
  return "sent";
};

const withStatusMeta = (invoice: any) => ({
  ...invoice,
  statusLabel: getStatusLabel(invoice.status),
  statusClass: getStatusClass(invoice.status),
});

const createInvoiceSchema = z.object({
  customerId: z.string(),
  invoiceNumber: z.string(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().default("USD"),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPriceCents: z.number().int().nonnegative(),
  })),
  taxCents: z.number().int().nonnegative().default(0),
  discountCents: z.number().int().nonnegative().default(0),
  note: z.string().optional(),
});

// List invoices
router.get("/", async (req: UserRequest, res, next) => {
  try {
    const { status, customerId } = req.query;
    
    const invoices = await convexClient.query(api.invoices.list, {
      userId: req.userId! as any,
      status: status as any,
      customerId: customerId as any,
    });
    
    res.json({ invoices: invoices.map(withStatusMeta) });
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (req: UserRequest, res, next) => {
  try {
    const { status, customerId, cursor, limit } = req.query;
    const parsedLimit = limit ? Number(limit) : undefined;
    const rawCursor = typeof cursor === "string" ? cursor : undefined;
    const sanitizedCursor = rawCursor && rawCursor !== "undefined" && rawCursor !== "null" ? rawCursor : undefined;

    const result = await convexClient.query(api.invoices.listPaged, {
      userId: req.userId! as any,
      status: status as any,
      customerId: customerId as any,
      cursor: sanitizedCursor,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });

    res.json({
      ...result,
      invoices: (result.invoices || []).map(withStatusMeta),
    });
  } catch (error) {
    next(error);
  }
});

// Get invoice by ID
router.get("/:id", async (req: UserRequest, res, next) => {
  try {
    const invoice = await convexClient.query(api.invoices.get, {
      invoiceId: req.params.id as any,
      userId: req.userId! as any,
    });
    
    if (!invoice) {
      throw new ApiError(404, "Invoice not found");
    }
    
    res.json({ invoice: withStatusMeta(invoice) });
  } catch (error) {
    next(error);
  }
});

// Create invoice
router.post("/", async (req: UserRequest, res, next) => {
  try {
    const data = createInvoiceSchema.parse(req.body);
    
    const invoiceId = await convexClient.mutation(api.invoices.create, {
      userId: req.userId! as any,
      ...data,
      customerId: data.customerId as any,
    });
    
    res.status(201).json({ invoiceId, message: "Invoice created successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

// Update invoice
router.put("/:id", async (req: UserRequest, res, next) => {
  try {
    const data = createInvoiceSchema.parse(req.body);
    
    await convexClient.mutation(api.invoices.update, {
      invoiceId: req.params.id as any,
      userId: req.userId! as any,
      ...data,
      customerId: data.customerId as any,
    });
    
    res.json({ message: "Invoice updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

// Update invoice status
router.patch("/:id/status", async (req: UserRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(["draft", "due", "unpaid", "paid", "void", "sent", "overdue"])
    }).parse(req.body);
    
    await convexClient.mutation(api.invoices.updateStatus, {
      invoiceId: req.params.id as any,
      userId: req.userId! as any,
      status,
    });
    
    res.json({ message: "Invoice status updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

// Delete invoice
router.delete("/:id", async (req: UserRequest, res, next) => {
  try {
    await convexClient.mutation(api.invoices.remove, {
      invoiceId: req.params.id as any,
      userId: req.userId! as any,
    });
    
    res.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as invoicesRouter };
