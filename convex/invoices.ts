import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const matchesStatus = (status: string | undefined, value: string) => {
  if (!status) return true;
  if (status === "due") return value === "due" || value === "sent";
  if (status === "unpaid") return value === "unpaid" || value === "overdue";
  return value === status;
};

export const list = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("due"),
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("sent"),
      v.literal("overdue")
    )),
    customerId: v.optional(v.id("customers")),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId));
    
    const invoices = await query.order("desc").take(100);
    
    return invoices.filter(inv => {
      if (!matchesStatus(args.status, inv.status)) return false;
      if (args.customerId && inv.customerId !== args.customerId) return false;
      return true;
    });
  },
});

export const listPaged = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("due"),
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("sent"),
      v.literal("overdue")
    )),
    customerId: v.optional(v.id("customers")),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: args.limit ?? 20,
      });

    const filtered = result.page.filter(inv => {
      if (!matchesStatus(args.status, inv.status)) return false;
      if (args.customerId && inv.customerId !== args.customerId) return false;
      return true;
    });

    return {
      invoices: filtered,
      cursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    customerId: v.id("customers"),
    invoiceNumber: v.string(),
    issueDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    currency: v.string(),
    taxCents: v.optional(v.number()),
    discountCents: v.optional(v.number()),
    note: v.optional(v.string()),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPriceCents: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Get customer details for snapshot
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    if (customer.userId !== args.userId) throw new Error("Access denied to customer");

    // Calculate amounts
    let subtotalCents = 0;
    const lineItemsWithAmounts = args.lineItems.map(item => {
      const amountCents = item.quantity * item.unitPriceCents;
      subtotalCents += amountCents;
      return { ...item, amountCents };
    });

    const taxCents = args.taxCents || 0;
    const discountCents = args.discountCents || 0;
    const totalCents = subtotalCents + taxCents - discountCents;

    // Calculate USD equivalent
    let totalCentsUSD: number | undefined;
    if (args.currency === "USD") {
      totalCentsUSD = totalCents;
    } else {
      const rateDoc = await ctx.db
        .query("rates")
        .withIndex("by_currency", (q) => q.eq("currency", args.currency))
        .unique();
      if (rateDoc?.rate) {
        totalCentsUSD = Math.round(totalCents / rateDoc.rate);
      }
    }

    const invoiceId = await ctx.db.insert("invoices", {
      userId: args.userId,
      customerId: args.customerId,
      
      // Snapshot customer details
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      customerTaxId: customer.taxId,
      customerGst: customer.gstNumber,

      invoiceNumber: args.invoiceNumber,
      issueDate: args.issueDate,
      dueDate: args.dueDate,
      currency: args.currency,
      subtotalCents,
      taxCents,
      discountCents,
      totalCents,
      totalCentsUSD,
      note: args.note,
      status: "draft",
    });

    await Promise.all(
      lineItemsWithAmounts.map((item) =>
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
    await ctx.db.patch(args.invoiceId, { status: "due" });
  },
});

export const update = mutation({
  args: {
    invoiceId: v.id("invoices"),
    userId: v.id("users"),
    customerId: v.id("customers"),
    invoiceNumber: v.string(),
    issueDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    currency: v.string(),
    taxCents: v.optional(v.number()),
    discountCents: v.optional(v.number()),
    note: v.optional(v.string()),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPriceCents: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== args.userId) {
      throw new Error("Invoice not found or access denied");
    }

    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    if (customer.userId !== args.userId) throw new Error("Access denied to customer");

    // Calculate amounts
    let subtotalCents = 0;
    const lineItemsWithAmounts = args.lineItems.map(item => {
      const amountCents = item.quantity * item.unitPriceCents;
      subtotalCents += amountCents;
      return { ...item, amountCents };
    });

    const taxCents = args.taxCents || 0;
    const discountCents = args.discountCents || 0;
    const totalCents = subtotalCents + taxCents - discountCents;

    // Calculate USD equivalent
    let totalCentsUSD: number | undefined;
    if (args.currency === "USD") {
      totalCentsUSD = totalCents;
    } else {
      const rateDoc = await ctx.db
        .query("rates")
        .withIndex("by_currency", (q) => q.eq("currency", args.currency))
        .unique();
      if (rateDoc?.rate) {
        totalCentsUSD = Math.round(totalCents / rateDoc.rate);
      }
    }

    await ctx.db.patch(args.invoiceId, {
      customerId: args.customerId,
      // Snapshot customer details
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      customerAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      customerTaxId: customer.taxId,
      customerGst: customer.gstNumber,

      invoiceNumber: args.invoiceNumber,
      issueDate: args.issueDate,
      dueDate: args.dueDate,
      currency: args.currency,
      subtotalCents,
      taxCents,
      discountCents,
      totalCents,
      totalCentsUSD,
      note: args.note,
    });

    // Delete existing line items
    const existingLineItems = await ctx.db
        .query("invoiceLineItems")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
        .collect();
    
    await Promise.all(existingLineItems.map(item => ctx.db.delete(item._id)));

    // Insert new line items
    await Promise.all(
      lineItemsWithAmounts.map((item) =>
        ctx.db.insert("invoiceLineItems", {
          invoiceId: args.invoiceId,
          ...item,
        })
      )
    );
  },
});

export const updateStatus = mutation({
  args: {
    invoiceId: v.id("invoices"),
    userId: v.id("users"),
    status: v.union(
      v.literal("draft"),
      v.literal("due"),
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("sent"),
      v.literal("overdue")
    ),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== args.userId) {
      throw new Error("Invoice not found or access denied");
    }
    if (args.status === "paid") {
      const payments = await ctx.db
        .query("payments")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
        .collect();
      const paidTotal = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
      const remainingCents = Math.max(invoice.totalCents - paidTotal, 0);
      if (remainingCents > 0) {
        await ctx.db.insert("payments", {
          userId: invoice.userId,
          invoiceId: args.invoiceId,
          amountCents: remainingCents,
          paidAt: new Date().toISOString(),
        });
      }
    }
    await ctx.db.patch(args.invoiceId, { status: args.status });
  },
});

export const remove = mutation({
  args: {
    invoiceId: v.id("invoices"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== args.userId) {
      throw new Error("Invoice not found or access denied");
    }
    // Also delete line items
    const lineItems = await ctx.db
        .query("invoiceLineItems")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
        .collect();
    
    await Promise.all(lineItems.map(item => ctx.db.delete(item._id)));
    await ctx.db.delete(args.invoiceId);
  },
});

export const get = query({
  args: {
    invoiceId: v.id("invoices"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== args.userId) {
      return null;
    }
    const lineItems = await ctx.db
      .query("invoiceLineItems")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();
    return { ...invoice, lineItems };
  },
});

export const getDashboardMetrics = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const user = await ctx.db.get(args.userId);
    const userCurrency = user?.defaultCurrency || "USD";
    
    const rates = await ctx.db.query("rates").collect();
    const rateMap = new Map(rates.map(r => [r.currency, r.rate]));
    const getRate = (curr: string) => (curr === "USD" ? 1 : rateMap.get(curr) || 0);
    
    const userRate = getRate(userCurrency);
    if (userRate === 0) {
      // Fallback or error? If user currency rate missing, return 0 or default to USD?
      // Let's return raw USD and maybe frontend handles it?
      // Or just return 0.
    }

    // Helper to normalize amount to USD
    const toUSD = (inv: typeof invoices[0]) => {
      if (inv.totalCentsUSD) return inv.totalCentsUSD;
      const r = getRate(inv.currency);
      return r > 0 ? inv.totalCents / r : 0;
    };

    const totalRevenueUSD = invoices
      .filter(i => i.status === "paid")
      .reduce((sum, i) => sum + toUSD(i), 0);

    const outstandingAmountUSD = invoices
      .filter(i => i.status === "due" || i.status === "unpaid" || i.status === "sent" || i.status === "overdue")
      .reduce((sum, i) => sum + toUSD(i), 0);
      
    const overdueAmountUSD = invoices
      .filter(i => i.status === "overdue")
      .reduce((sum, i) => sum + toUSD(i), 0);

    // Convert to User Currency
    const convert = (centsUSD: number) => Math.round(centsUSD * userRate);

    const customers = await ctx.db
      .query("customers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return {
      totalRevenue: convert(totalRevenueUSD),
      outstandingAmount: convert(outstandingAmountUSD),
      overdueAmount: convert(overdueAmountUSD),
      customerCount: customers.length,
      invoiceCount: invoices.length,
      currency: userCurrency,
    };
  },
});

export const getDashboardKpis = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Setup currency conversion
    const user = await ctx.db.get(args.userId);
    const userCurrency = user?.defaultCurrency || "USD";
    
    const rates = await ctx.db.query("rates").collect();
    const rateMap = new Map(rates.map(r => [r.currency, r.rate]));
    const getRate = (curr: string) => (curr === "USD" ? 1 : rateMap.get(curr) || 0);
    const userRate = getRate(userCurrency);

    const toUSD = (inv: typeof invoices[0]) => {
      if (inv.totalCentsUSD) return inv.totalCentsUSD;
      const r = getRate(inv.currency);
      return r > 0 ? inv.totalCents / r : 0;
    };

    const convert = (centsUSD: number) => Math.round(centsUSD * userRate);

    const totalRevenueUSD = invoices
      .filter(i => i.status === "paid")
      .reduce((sum, i) => sum + toUSD(i), 0);

    const outstandingAmountUSD = invoices
      .filter(i => i.status === "due" || i.status === "unpaid" || i.status === "sent" || i.status === "overdue")
      .reduce((sum, i) => sum + toUSD(i), 0);
      
    const overdueAmountUSD = invoices
      .filter(i => i.status === "overdue")
      .reduce((sum, i) => sum + toUSD(i), 0);

    const dueAmountCentsUSD = invoices
      .filter(i => i.status === "due" || i.status === "sent")
      .reduce((sum, i) => sum + toUSD(i), 0);

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const parseInvoiceDate = (value?: string) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date;
    };

    const sumInvoicesByStatus = (statuses: string[], start: Date, end: Date) => {
      return invoices.reduce((sum, invoice) => {
        const invoiceDate = parseInvoiceDate(invoice.issueDate);
        if (!invoiceDate || invoiceDate < start || invoiceDate > end) {
          return sum;
        }
        if (!statuses.includes(invoice.status)) {
          return sum;
        }
        return sum + toUSD(invoice);
      }, 0);
    };

    const formatTrend = (current: number, previous: number) => {
      if (previous === 0) {
        return current === 0 ? "+0%" : "+100%";
      }
      const percent = Math.round(((current - previous) / previous) * 100);
      return `${percent >= 0 ? "+" : ""}${percent}%`;
    };

    const outstandingStatuses = ["due", "unpaid", "sent", "overdue"];
    const dueStatuses = ["due", "sent"];
    const overdueStatuses = ["overdue"];
    const paidStatuses = ["paid"];

    // Calculate trends in USD first
    const currentOutstandingUSD = sumInvoicesByStatus(outstandingStatuses, currentMonthStart, currentMonthEnd);
    const previousOutstandingUSD = sumInvoicesByStatus(outstandingStatuses, previousMonthStart, previousMonthEnd);
    const currentDueUSD = sumInvoicesByStatus(dueStatuses, currentMonthStart, currentMonthEnd);
    const previousDueUSD = sumInvoicesByStatus(dueStatuses, previousMonthStart, previousMonthEnd);
    const currentOverdueUSD = sumInvoicesByStatus(overdueStatuses, currentMonthStart, currentMonthEnd);
    const previousOverdueUSD = sumInvoicesByStatus(overdueStatuses, previousMonthStart, previousMonthEnd);
    const currentPaidUSD = sumInvoicesByStatus(paidStatuses, currentMonthStart, currentMonthEnd);
    const previousPaidUSD = sumInvoicesByStatus(paidStatuses, previousMonthStart, previousMonthEnd);

    // Convert all values to user currency for display
    return {
      totals: {
        totalRevenue: convert(totalRevenueUSD),
        outstandingAmount: convert(outstandingAmountUSD),
        overdueAmount: convert(overdueAmountUSD),
        dueAmountCents: convert(dueAmountCentsUSD),
      },
      kpisByType: {
        kpi_total_outstanding: {
          label: "Total Outstanding",
          valueCents: convert(currentOutstandingUSD),
          trend: formatTrend(currentOutstandingUSD, previousOutstandingUSD),
        },
        kpi_due: {
          label: "Due Soon",
          valueCents: convert(currentDueUSD),
          trend: formatTrend(currentDueUSD, previousDueUSD),
        },
        kpi_overdue: {
          label: "Overdue",
          valueCents: convert(currentOverdueUSD),
          trend: formatTrend(currentOverdueUSD, previousOverdueUSD),
        },
        kpi_paid: {
          label: "Paid This Month",
          valueCents: convert(currentPaidUSD),
          trend: formatTrend(currentPaidUSD, previousPaidUSD),
        },
      },
      currency: userCurrency,
    };
  },
});
