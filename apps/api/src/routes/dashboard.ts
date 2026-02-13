import { Router } from "express";
import { convexClient } from "../lib/convex";
import { UserRequest } from "../middleware/validateUserContext";
import { api } from "../../../../convex/_generated/api";

const router = Router();

// Get dashboard metrics
router.get("/metrics", async (req: UserRequest, res, next) => {
  try {
    const dashboard = await convexClient.query(api.invoices.getDashboardKpis, {
      userId: req.userId! as any,
    });
    
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// Get revenue analytics
router.get("/analytics", async (req: UserRequest, res, next) => {
  try {
    const [analytics, dashboard] = await Promise.all([
      convexClient.query(api.payments.getRevenueAnalyticsComputed, {
        userId: req.userId! as any,
      }),
      convexClient.query(api.invoices.getDashboardKpis, {
        userId: req.userId! as any,
      }),
    ]);
    
    res.json({
      ...analytics,
      dashboardKpisByType: dashboard.kpisByType,
    });
  } catch (error) {
    next(error);
  }
});

export { router as dashboardRouter };
