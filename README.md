# Scaly Invoicing SaaS

Initial implementation scaffold for an AI-first invoicing platform built with **Convex + Bun + React**.

## Structure

- `apps/web`: React (Vite + TypeScript) frontend.
- `convex`: Convex schema and backend functions.
- `docs/saas-invoicing-plan.md`: product/architecture plan.

## Quick start

1. Install dependencies:
   ```bash
   bun install
   ```
2. Start frontend:
   ```bash
   bun run dev:web
   ```
3. Start Convex dev backend (after project init/login):
   ```bash
   bun run convex:dev
   ```

## Current scope implemented

- Frontend dashboard shell with invoice KPI cards and starter invoice list UI.
- Convex schema for organizations, customers, invoices, invoice line items, payments, and AI runs.
- Backend mutations/queries for customer and invoice CRUD foundations.
