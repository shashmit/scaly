import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { 
    userId: v.id("users"),
    search: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    try {
      if (args.search) {
        // Use full text search if search term is provided
        const customers = await ctx.db
          .query("customers")
          .withSearchIndex("search_all", (q) => 
            q.search("name", args.search!).eq("userId", args.userId)
          )
          .collect();
        return { customers, error: null };
      }

      const customers = await ctx.db
        .query("customers")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      return { customers, error: null };
    } catch (err: any) {
      console.error("Failed to list customers:", err);
      return { customers: [], error: err.message || "Failed to list customers" };
    }
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    shippingAddress: v.optional(v.string()),
    taxId: v.optional(v.string()),
    gstNumber: v.optional(v.string()),
    paymentTermsDays: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const customerId = await ctx.db.insert("customers", args);
      return { customerId, error: null };
    } catch (err: any) {
      console.error("Failed to create customer:", err);
      return { customerId: null, error: err.message || "Failed to create customer" };
    }
  },
});

export const get = query({
  args: {
    customerId: v.id("customers"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer || customer.userId !== args.userId) {
      return null;
    }
    return customer;
  },
});

export const getByName = query({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customers")
      .withIndex("by_user_name", (q) =>
        q.eq("userId", args.userId).eq("name", args.name)
      )
      .unique();
  },
});

export const update = mutation({
  args: {
    customerId: v.id("customers"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    shippingAddress: v.optional(v.string()),
    taxId: v.optional(v.string()),
    gstNumber: v.optional(v.string()),
    paymentTermsDays: v.optional(v.number()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, userId, ...updates } = args;
    const customer = await ctx.db.get(customerId);
    
    if (!customer || customer.userId !== userId) {
      throw new Error("Customer not found or access denied");
    }
    
    await ctx.db.patch(customerId, updates);
  },
});

export const remove = mutation({
  args: {
    customerId: v.id("customers"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    
    if (!customer || customer.userId !== args.userId) {
      throw new Error("Customer not found or access denied");
    }
    
    await ctx.db.delete(args.customerId);
  },
});
