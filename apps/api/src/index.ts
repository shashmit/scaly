import express from "express";
import cors from "cors";
import { customersRouter } from "./routes/customers";
import { invoicesRouter } from "./routes/invoices";
import { recurringRouter } from "./routes/recurring";
import { paymentsRouter } from "./routes/payments";
import { dashboardRouter } from "./routes/dashboard";
import { usersRouter } from "./routes/users";
import { aiRouter } from "./routes/ai";
import { errorHandler } from "./middleware/errorHandler";
import { validateUserContext } from "./middleware/validateUserContext";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes with user context validation
app.use("/api/customers", validateUserContext, customersRouter);
app.use("/api/invoices", validateUserContext, invoicesRouter);
app.use("/api/recurring", validateUserContext, recurringRouter);
app.use("/api/payments", validateUserContext, paymentsRouter);
app.use("/api/dashboard", validateUserContext, dashboardRouter);
app.use("/api/users", validateUserContext, usersRouter);
app.use("/api/ai", validateUserContext, aiRouter);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Convex URL: ${process.env.CONVEX_URL}`);
});
