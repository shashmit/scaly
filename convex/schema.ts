import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    createdBy: v.string(),
  }).index("by_slug", ["slug"]),

  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("accountant"), v.literal("viewer")),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"]),

  customers: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    email: v.optional(v.string()),
    billingAddress: v.optional(v.string()),
    taxId: v.optional(v.string()),
    paymentTermsDays: v.optional(v.number()),
  }).index("by_org", ["organizationId"]),

  invoices: defineTable({
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
    status: v.union(v.literal("draft"), v.literal("sent"), v.literal("paid"), v.literal("overdue"), v.literal("void")),
    note: v.optional(v.string()),
  })
    .index("by_org", ["organizationId"])
    .index("by_org_invoiceNumber", ["organizationId", "invoiceNumber"]),

  invoiceLineItems: defineTable({
    invoiceId: v.id("invoices"),
    description: v.string(),
    quantity: v.number(),
    unitPriceCents: v.number(),
    amountCents: v.number(),
  }).index("by_invoice", ["invoiceId"]),

  payments: defineTable({
    organizationId: v.id("organizations"),
    invoiceId: v.id("invoices"),
    amountCents: v.number(),
    paidAt: v.string(),
    method: v.optional(v.string()),
    reference: v.optional(v.string()),
  }).index("by_invoice", ["invoiceId"]),

  aiRuns: defineTable({
    organizationId: v.id("organizations"),
    kind: v.union(v.literal("invoice_draft"), v.literal("risk_score"), v.literal("reminder_tone")),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    model: v.string(),
    input: v.string(),
    output: v.optional(v.string()),
    tokenUsage: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_org", ["organizationId"]),
});
