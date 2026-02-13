import { Router } from "express";
import { z } from "zod";
import { convexClient } from "../lib/convex";
import { ApiError } from "../middleware/errorHandler";
import { UserRequest } from "../middleware/validateUserContext";
import { api } from "../../../../convex/_generated/api";

const router = Router();

const createRecurringSchema = z.object({
  customerId: z.string(),
  currency: z.string().default("USD"),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPriceCents: z.number().int().nonnegative(),
  })),
  note: z.string().optional(),
  interval: z.enum(["weekly", "monthly", "quarterly", "biannually", "yearly"]),
  startDate: z.string().optional(), // YYYY-MM-DD
  generateFirstImmediately: z.boolean().optional(),
});

const updateRecurringSchema = z.object({
  interval: z.enum(["weekly", "monthly", "quarterly", "biannually", "yearly"]).optional(),
  nextRunDate: z.string().optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  note: z.string().optional(),
});

router.get("/", async (req: UserRequest, res, next) => {
  try {
    const recurring = await convexClient.query(api.recurring.list, {
      userId: req.userId! as any,
    });
    res.json({ recurring });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req: UserRequest, res, next) => {
  try {
    const data = createRecurringSchema.parse(req.body);
    
    // @ts-ignore - api.recurring might not be typed yet
    const result = await convexClient.mutation(api.recurring.create, {
      ...data,
      userId: req.userId! as any,
      customerId: data.customerId as any,
    });
    
    // Result contains { recurringId, invoiceId }
    res.status(201).json({ ...result, message: "Recurring invoice scheduled successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

router.patch("/:id", async (req: UserRequest, res, next) => {
  try {
    const { id } = req.params;
    const data = updateRecurringSchema.parse(req.body);
    
    // @ts-ignore
    await convexClient.mutation(api.recurring.update, {
      id: id as any,
      userId: req.userId! as any,
      ...data,
    });
    
    res.json({ message: "Recurring invoice updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

router.delete("/:id", async (req: UserRequest, res, next) => {
  try {
    const { id } = req.params;
    
    // @ts-ignore
    await convexClient.mutation(api.recurring.remove, {
      id: id as any,
      userId: req.userId! as any,
    });
    
    res.json({ message: "Recurring invoice deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export const recurringRouter = router;
