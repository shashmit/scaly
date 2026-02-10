import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    email: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    taxId: v.optional(v.string()),
    paymentTermsDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customers", args);
  },
});
