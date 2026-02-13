import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    clerkUserId: v.string(),
    defaultCurrency: v.optional(v.string()),
    dashboardLayout: v.optional(v.array(v.string())),
    theme: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkUserId"]),

  customers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    shippingAddress: v.optional(v.string()),
    taxId: v.optional(v.string()), // This can serve as GST/VAT ID
    gstNumber: v.optional(v.string()), // Explicit GST number if needed separate from taxId, but let's use taxId or add both? User asked for GST. Let's add gstNumber to be explicit.
    paymentTermsDays: v.optional(v.number()),
    currency: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_name", ["userId", "name"])
    .searchIndex("search_all", {
      searchField: "name",
      filterFields: ["userId"],
    }),

  invoices: defineTable({
    userId: v.id("users"),
    customerId: v.id("customers"),
    // Snapshot fields
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerAddress: v.optional(v.string()), // Billing Address
    shippingAddress: v.optional(v.string()),
    customerTaxId: v.optional(v.string()),
    customerGst: v.optional(v.string()),
    
    invoiceNumber: v.string(),
    issueDate: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    currency: v.string(),
    subtotalCents: v.number(),
    taxCents: v.number(),
    discountCents: v.number(),
    totalCents: v.number(),
    // Store USD equivalent for reporting
    totalCentsUSD: v.optional(v.number()),
    status: v.union(
      v.literal("draft"),
      v.literal("due"),
      v.literal("unpaid"),
      v.literal("paid"),
      v.literal("void"),
      v.literal("sent"),
      v.literal("overdue")
    ),
    note: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_invoiceNumber", ["userId", "invoiceNumber"]),

  invoiceLineItems: defineTable({
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPriceCents: v.number(),
    amountCents: v.number(),
  }).index("by_invoice", ["invoiceId"]),

  payments: defineTable({
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
    amountCents: v.number(),
    paidAt: v.string(),
    method: v.optional(v.string()),
    reference: v.optional(v.string()),
  }).index("by_invoice", ["invoiceId"])
    .index("by_user", ["userId"]),

  aiRuns: defineTable({
    userId: v.id("users"),
    kind: v.union(v.literal("invoice_draft"), v.literal("risk_score"), v.literal("reminder_tone"), v.literal("chat")),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    model: v.string(),
    input: v.string(),
    output: v.optional(v.string()),
    tokenUsage: v.optional(v.number()),
    error: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  recurringInvoices: defineTable({
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
      v.literal("quarterly"), // 3 months
      v.literal("biannually"), // 6 months
      v.literal("yearly")
    ),
    nextRunDate: v.string(), // ISO YYYY-MM-DD
    lastRunDate: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("cancelled")),
  })
  .index("by_user", ["userId"])
  .index("by_status_next_run", ["status", "nextRunDate"]),

  rates: defineTable({
    currency: v.string(),
    rate: v.number(), // Exchange rate relative to USD (1 USD = rate CURRENCY)
    lastUpdated: v.string(),
  }).index("by_currency", ["currency"]),
});
