import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(100);
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    customerId: v.id("customers"),
    invoiceNumber: v.string(),
    issueDate: v.string(),
    dueDate: v.string(),
    currency: v.string(),
    subtotalCents: v.number(),
    taxCents: v.number(),
    discountCents: v.number(),
    totalCents: v.number(),
    note: v.optional(v.string()),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPriceCents: v.number(),
        amountCents: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: args.organizationId,
      customerId: args.customerId,
      invoiceNumber: args.invoiceNumber,
      issueDate: args.issueDate,
      dueDate: args.dueDate,
      currency: args.currency,
      subtotalCents: args.subtotalCents,
      taxCents: args.taxCents,
      discountCents: args.discountCents,
      totalCents: args.totalCents,
      note: args.note,
      status: "draft",
    });

    await Promise.all(
      args.lineItems.map((item) =>
        ctx.db.insert("invoiceLineItems", {
          invoiceId,
          ...item,
        })
      )
    );

    return invoiceId;
  },
});

export const markAsSent = mutation({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, { status: "sent" });
  },
});
