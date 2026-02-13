import { ConvexHttpClient } from "convex/browser";

if (!process.env.CONVEX_URL) {
  throw new Error("CONVEX_URL environment variable is required");
}

export const convexClient = new ConvexHttpClient(process.env.CONVEX_URL);
