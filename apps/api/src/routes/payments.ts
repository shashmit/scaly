import { Router } from "express";
import { z } from "zod";
import { convexClient } from "../lib/convex";
import { ApiError } from "../middleware/errorHandler";
import { UserRequest } from "../middleware/validateUserContext";
import { api } from "../../../../convex/_generated/api";

const router = Router();

const recordPaymentSchema = z.object({
  invoiceId: z.string(),
  amountCents: z.number().int().positive(),
  paidAt: z.string(),
  method: z.string().optional(),
  reference: z.string().optional(),
});

// List payments for an invoice
router.get("/invoice/:invoiceId", async (req: UserRequest, res, next) => {
  try {
    const payments = await convexClient.query(api.payments.listByInvoice, {
      invoiceId: req.params.invoiceId as any,
      userId: req.userId!,
    });
    
    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

// Record a payment
router.post("/", async (req: UserRequest, res, next) => {
  try {
    const data = recordPaymentSchema.parse(req.body);
    
    const paymentId = await convexClient.mutation(api.payments.record, {
      userId: req.userId!,
      ...data,
    });
    
    res.status(201).json({ paymentId, message: "Payment recorded successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

export { router as paymentsRouter };
