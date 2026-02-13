import { cronJobs } from "convex/server";
import { internal, api } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "process-recurring-invoices",
  { hourUTC: 0, minuteUTC: 0 }, // Run at midnight UTC
  internal.recurring.processRecurring
);

crons.daily(
  "fetch-exchange-rates",
  { hourUTC: 1, minuteUTC: 0 },
  api.actions.rates.fetchRates
);

export default crons;
