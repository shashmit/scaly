import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Helper to calculate next date using UTC to avoid timezone issues
function calculateNextDate(dateStr: string, interval: string): string {
  const date = new Date(dateStr);
  // Ensure we are working with the date components as provided in the string (YYYY-MM-DD)
  // treating them as UTC to avoid local timezone shifts.
  
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const newDate = new Date(date);

  switch (interval) {
    case "weekly":
      newDate.setUTCDate(day + 7);
      break;
    case "monthly":
      newDate.setUTCMonth(month + 1);
      // Handle month overflow (e.g. Jan 31 -> Feb 28/29 instead of March 2/3)
      if (newDate.getUTCDate() !== day) {
        newDate.setUTCDate(0); // Set to last day of previous month
      }
      break;
    case "quarterly":
      newDate.setUTCMonth(month + 3);
      if (newDate.getUTCDate() !== day) {
        newDate.setUTCDate(0);
      }
      break;
    case "biannually":
      newDate.setUTCMonth(month + 6);
      if (newDate.getUTCDate() !== day) {
        newDate.setUTCDate(0);
      }
      break;
    case "yearly":
      newDate.setUTCFullYear(year + 1);
      // Handle leap year (Feb 29 -> Feb 28 in non-leap year)
      if (month === 1 && day === 29 && newDate.getUTCMonth() !== 1) {
          newDate.setUTCDate(0);
      }
      break;
  }
  
  return newDate.toISOString().split('T')[0];
}

export const create = mutation({
  args: {
    userId: v.id("users"),
    customerId: v.id("customers"),
    currency: v.string(),
    lineItems: v.array(v.object({
      description: v.string(),
      quantity: v.number(),
      unitPriceCents: v.number(),
    })),
    note: v.optional(v.string()),
    interval: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("biannually"),
      v.literal("yearly")
    ),
    startDate: v.optional(v.string()), // YYYY-MM-DD, defaults to today
    generateFirstImmediately: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0];
    const startDate = args.startDate || today;

    const recurringId = await ctx.db.insert("recurringInvoices", {
      userId: args.userId,
      customerId: args.customerId,
      currency: args.currency,
      lineItems: args.lineItems,
      note: args.note,
      interval: args.interval,
      nextRunDate: startDate,
      status: "active",
    });

    // Check if we should generate the first invoice immediately
    // If generateFirstImmediately is explicitly true, we do it.
    // Otherwise, we fallback to the date logic:
    // We compare the date strings directly.
    // We allow the start date to be up to 24 hours in the future (relative to server UTC time)
    // to accommodate users in timezones ahead of UTC (e.g. Australia, Japan, NZ).
    
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const shouldGenerateImmediately = args.generateFirstImmediately || startDate <= tomorrow;

    let invoiceId = null;

    if (shouldGenerateImmediately) {
      console.log(`Generating immediate invoice for recurring ${recurringId} (Start: ${startDate}, Cutoff: ${tomorrow})`);
      
      // 1. Get Customer Details
      const customer = await ctx.db.get(args.customerId);
      if (!customer) {
        throw new Error("Customer not found");
      }

      // 2. Generate Invoice Number
      const invoiceNumber = `INV-${Math.floor(Math.random() * 1000000)}`;

      // 3. Calculate Totals
      let subtotalCents = 0;
      args.lineItems.forEach(item => {
        subtotalCents += item.quantity * item.unitPriceCents;
      });
      const taxCents = 0;
      const discountCents = 0;
      const totalCents = subtotalCents + taxCents - discountCents;

      // 4. Create Invoice
      invoiceId = await ctx.db.insert("invoices", {
        userId: args.userId,
        customerId: args.customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        customerTaxId: customer.taxId,
        customerGst: customer.gstNumber,
        
        invoiceNumber,
        issueDate: startDate,
        dueDate: new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: args.currency,
        subtotalCents,
        taxCents,
        discountCents,
        totalCents,
        status: "draft",
        note: args.note,
      });

      // 5. Create Invoice Line Items
      for (const item of args.lineItems) {
        await ctx.db.insert("invoiceLineItems", {
          invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          amountCents: item.quantity * item.unitPriceCents,
        });
      }

      // 6. Update Recurring Record
      const nextDate = calculateNextDate(startDate, args.interval);
      await ctx.db.patch(recurringId, {
        lastRunDate: startDate,
        nextRunDate: nextDate,
      });
    } else {
      console.log(`Skipping immediate generation. Start: ${startDate}, Cutoff: ${tomorrow} (UTC)`);
    }

    return { recurringId, invoiceId };
  },
});

export const list = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("recurringInvoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const update = mutation({
  args: {
    id: v.id("recurringInvoices"),
    userId: v.id("users"),
    interval: v.optional(v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("biannually"),
      v.literal("yearly")
    )),
    nextRunDate: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("paused"), v.literal("cancelled"))),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // We could verify ownership here but for now relying on implicit trust or we can fetch the record
    const recurring = await ctx.db.get(args.id);
    if (!recurring) throw new Error("Recurring invoice not found");

    if (recurring.userId !== args.userId) {
        throw new Error("Unauthorized");
    }

    const updates: any = {};
    if (args.interval) updates.interval = args.interval;
    if (args.nextRunDate) updates.nextRunDate = args.nextRunDate;
    if (args.status) updates.status = args.status;
    if (args.note !== undefined) updates.note = args.note;

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: {
    id: v.id("recurringInvoices"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const recurring = await ctx.db.get(args.id);
    if (!recurring) throw new Error("Recurring invoice not found");

    if (recurring.userId !== args.userId) {
        throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

export const processRecurring = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Use tomorrow as cutoff to handle timezone differences (users ahead of UTC)
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const cutoffDate = now.toISOString().split('T')[0];
    
    console.log(`Processing recurring invoices due on or before ${cutoffDate}`);
    
    // Find all active recurring invoices due cutoffDate or earlier
    const dueInvoices = await ctx.db
      .query("recurringInvoices")
      .withIndex("by_status_next_run", (q) => 
        q.eq("status", "active").lte("nextRunDate", cutoffDate)
      )
      .collect();

    for (const recurring of dueInvoices) {
      // 1. Get Customer Details (for snapshot)
      const customer = await ctx.db.get(recurring.customerId);
      if (!customer) {
          console.log(`Customer ${recurring.customerId} not found for recurring invoice ${recurring._id}`);
          continue;
      }

      // 2. Generate Invoice Number
      const invoiceNumber = `INV-${Math.floor(Math.random() * 1000000)}`;

      // 3. Calculate Totals
      let subtotalCents = 0;
      recurring.lineItems.forEach(item => {
        subtotalCents += item.quantity * item.unitPriceCents;
      });
      const taxCents = 0;
      const discountCents = 0;
      const totalCents = subtotalCents + taxCents - discountCents;

      // 4. Create Invoice
      const invoiceId = await ctx.db.insert("invoices", {
        userId: recurring.userId,
        customerId: recurring.customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        customerAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        customerTaxId: customer.taxId,
        customerGst: customer.gstNumber,
        
        invoiceNumber,
        issueDate: recurring.nextRunDate,
        dueDate: new Date(new Date(recurring.nextRunDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: recurring.currency,
        subtotalCents,
        taxCents,
        discountCents,
        totalCents,
        status: "draft", // Created as draft so user can review/send
        note: recurring.note,
      });

      // 5. Create Invoice Line Items
      for (const item of recurring.lineItems) {
        await ctx.db.insert("invoiceLineItems", {
          invoiceId,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          amountCents: item.quantity * item.unitPriceCents,
        });
      }

      // 6. Update Recurring Record
      const nextDate = calculateNextDate(recurring.nextRunDate, recurring.interval);
      await ctx.db.patch(recurring._id, {
        lastRunDate: recurring.nextRunDate,
        nextRunDate: nextDate,
      });
    }
  },
});
