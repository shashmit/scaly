import { Router } from "express";
import { z } from "zod";
import { convexClient } from "../lib/convex";
import { ApiError } from "../middleware/errorHandler";
import { UserRequest } from "../middleware/validateUserContext";
import { api } from "../../../../convex/_generated/api";

const router = Router();

const updateSettingsSchema = z.object({
  defaultCurrency: z.string().length(3).optional(),
  dashboardLayout: z.array(z.string()).optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

// Get current user profile
router.get("/me", async (req: UserRequest, res, next) => {
  try {
    const user = await convexClient.query(api.users.getByClerkId, {
      clerkUserId: req.auth.userId!,
    });
    
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

// Update user settings
router.patch("/me/settings", async (req: UserRequest, res, next) => {
  try {
    const data = updateSettingsSchema.parse(req.body);
    
    if (data.defaultCurrency) {
      await convexClient.mutation(api.users.updateDefaultCurrency, {
        clerkUserId: req.auth.userId!,
        currency: data.defaultCurrency,
      });
    }

    if (data.dashboardLayout) {
      await convexClient.mutation(api.users.updateDashboardLayout, {
        clerkUserId: req.auth.userId!,
        layout: data.dashboardLayout,
      });
    }

    if (data.theme) {
      await convexClient.mutation(api.users.updateTheme, {
        clerkUserId: req.auth.userId!,
        theme: data.theme,
      });
    }
    
    res.json({ message: "Settings updated successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new ApiError(400, "Validation error", error.errors));
    } else {
      next(error);
    }
  }
});

export { router as usersRouter };
