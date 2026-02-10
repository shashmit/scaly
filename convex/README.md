# Convex Backend

This folder contains the initial domain schema and core invoicing mutations/queries.

Current modules:
- `schema.ts`
- `customers.ts`
- `invoices.ts`
- `payments.ts`

Next implementation steps:
- add auth/tenant boundary checks from identity context
- add scheduled jobs for reminders and recurring invoices
- add AI actions for draft/risk/tone features
