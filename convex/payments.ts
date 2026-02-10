import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    amountCents: v.number(),
    paidAt: v.string(),
    method: v.optional(v.string()),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paymentId = await ctx.db.insert("payments", args);

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();

    const paidTotal = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    if (paidTotal >= invoice.totalCents) {
      await ctx.db.patch(args.invoiceId, { status: "paid" });
    }

    return paymentId;
  },
});
