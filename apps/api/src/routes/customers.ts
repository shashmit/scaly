import { Router } from "express";
import { z } from "zod";
import { convexClient } from "../lib/convex";
import { ApiError } from "../middleware/errorHandler";
import { UserRequest } from "../middleware/validateUserContext";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

const router = Router();

const createCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  taxId: z.string().optional(),
  gstNumber: z.string().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  currency: z.string().length(3).optional(),
});

const updateCustomerSchema = createCustomerSchema.partial();

// List customers
router.get("/", async (req: UserRequest, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const customers = await convexClient.query(api.customers.list, {
      userId: req.userId! as Id<"users">,
      search,
    });
    res.json({ customers });
  } catch (error) {
    next(error);
  }
});

// Get customer by ID
router.get("/:id", async (req: UserRequest, res, next) => {
  try {
    const customer = await convexClient.query(api.customers.get, {
      customerId: req.params.id as any,
      userId: req.userId! as Id<"users">,
    });
    
    if (!customer) {
      throw new ApiError(404, "Customer not found");
    }
    
    res.json({ customer });
  } catch (error) {
    next(error);
  }
});

// Create customer
router.post("/", async (req: UserRequest, res, next) => {
  try {
    const data = createCustomerSchema.parse(req.body);
    
    const customerId = await convexClient.mutation(api.customers.create, {
      userId: req.userId! as Id<"users">,
      ...data,
    });
    
    res.status(201).json({ customerId, message: "Customer created successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

// Update customer
router.patch("/:id", async (req: UserRequest, res, next) => {
  try {
    const data = updateCustomerSchema.parse(req.body);
    
    await convexClient.mutation(api.customers.update, {
      customerId: req.params.id as any,
      userId: req.userId! as Id<"users">,
      ...data,
    });
    
    res.json({ message: "Customer updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

// Delete customer
router.delete("/:id", async (req: UserRequest, res, next) => {
  try {
    await convexClient.mutation(api.customers.remove, {
      customerId: req.params.id as any,
      userId: req.userId! as Id<"users">,
    });
    
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export { router as customersRouter };
