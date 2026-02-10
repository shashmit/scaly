# Invoicing SaaS Plan (Convex + Bun + React)

## 1) Product Vision
Build an AI-first invoicing platform for freelancers and SMBs that:
- Creates invoices quickly.
- Automates reminders and payment follow-up.
- Generates insights (cash-flow forecast, risk flags, payment behavior).
- Supports multi-tenant teams with secure role-based access.

## 2) Core MVP Scope

### Must-have (Phase 1)
- Authentication and organization/workspace setup.
- Customer management (CRUD).
- Product/service catalog (CRUD).
- Invoice creation/editing with tax, discount, due date, notes, and status.
- PDF invoice generation and download/share.
- Payment tracking (manual mark paid + optional payment gateway integration later).
- Dashboard with KPIs (outstanding, overdue, paid this month).
- Basic reminder scheduler and email templates.

### AI MVP Features
- **Invoice Draft Assistant**: generate line items, terms, and notes from a plain-language prompt.
- **Smart Due Date Suggestion**: recommend due date based on customer payment history.
- **Late Payment Risk Score**: score invoice/customer based on past behavior.
- **Reminder Tone Generator**: generate polite/firm reminder variants.
- **Expense-to-Invoice Suggestions** (optional MVP+): suggest billable items from uploaded notes/receipts.

## 3) Tech Stack & Architecture

### Backend
- **Runtime**: Bun for scripts/tooling and edge-friendly execution where relevant.
- **Database + API**: Convex functions + Convex DB as source of truth.
- **Auth**: Convex Auth (or Clerk/Auth.js bridged) with org-scoped identities.
- **Jobs/Scheduling**: Convex scheduled functions for reminders, recurring invoices, and AI backfills.
- **File storage**: Convex file storage for logos, attachments, and generated PDFs.
- **AI Orchestration**:
  - provider abstraction (OpenAI/Anthropic-compatible)
  - prompt templates versioned in code
  - structured output validation (zod)

### Frontend
- **Framework**: React (Vite + Bun package manager).
- **State/Data**: Convex React client hooks for real-time queries/mutations.
- **UI**: Component library (shadcn/ui or MUI), responsive dashboard layouts.
- **Forms**: React Hook Form + zod validation.
- **Charts**: Recharts for receivables and aging analysis.

### Cross-cutting
- TypeScript end-to-end.
- Shared validation schemas.
- Feature flags for staged AI rollout.
- Audit logs for critical events (invoice sent, status change, reminder sent).

## 4) Domain Model (Initial)

### Tenancy & Identity
- `organizations`
- `organizationMembers` (role: owner/admin/accountant/viewer)
- `users`

### Invoicing
- `customers`
- `catalogItems`
- `invoices`
- `invoiceLineItems`
- `payments`
- `invoiceEvents` (status timeline)
- `recurringInvoices`

### AI & Messaging
- `aiRuns` (input, model, output, status, token usage)
- `customerPaymentProfiles` (avg delay, risk indicators)
- `reminderTemplates`
- `scheduledReminders`

### Reporting
- `dailySnapshots` (denormalized metrics for fast dashboards)

## 5) API & Function Design in Convex

### Public queries/mutations
- `customers.create/update/list/get`
- `invoices.create/update/get/list`
- `invoices.send` (email + event creation)
- `payments.record`
- `dashboard.metrics`

### Internal functions/actions
- `ai.generateInvoiceDraft`
- `ai.scoreLateRisk`
- `ai.generateReminderCopy`
- `jobs.processReminders`
- `jobs.generateRecurringInvoices`
- `jobs.refreshSnapshots`

### Validation & Security
- Every function enforces org boundary (`organizationId` from auth context).
- Input validation via zod-like Convex validators.
- PII-safe logging with redaction.

## 6) Frontend App Structure

- `/auth` (login/signup/onboarding)
- `/app/dashboard`
- `/app/customers`
- `/app/catalog`
- `/app/invoices`
  - invoice list
  - invoice editor
  - invoice details/timeline
- `/app/reports`
- `/app/settings`
  - org settings
  - templates
  - team roles
  - AI controls

## 7) AI Feature Design Notes

### 7.1 Invoice Draft Assistant
Input:
- customer context
- recent invoice patterns
- prompt (“create a monthly maintenance invoice for ...”)

Output:
- proposed line items, quantities, prices, payment terms, note

Guardrails:
- enforce numeric constraints and currency formatting
- confidence score + “requires review” before saving

### 7.2 Smart Due Date
- Use customer historical payment delay distribution.
- Recommend due date to maximize on-time payment probability.
- Explain recommendation to user in UI.

### 7.3 Late Payment Risk
Signals:
- average delay days
- invoice amount percentile
- customer segment
- reminder response history

Output:
- score 0–100 + label (low/medium/high) + explanation text.

### 7.4 Reminder Tone Generator
- Multiple tones: friendly, neutral, firm.
- Locale-aware templates.
- Keep legal-safe language and opt-out link if required regionally.

## 8) Security, Compliance, and Reliability
- Row-level tenancy enforcement in every query/mutation.
- Data encryption at rest and in transit.
- Signed URLs for document sharing with expiration.
- Audit trails for financial changes.
- Backup/export strategy (CSV + PDF archive).
- Basic compliance roadmap: SOC2-ready controls and GDPR data deletion workflows.

## 9) Delivery Roadmap

### Sprint 0 (Foundation, 1 week)
- Monorepo setup with Bun, React app, Convex project.
- Auth + org model + base layout.
- CI with typecheck/lint/test.

### Sprint 1 (Core Invoicing, 2 weeks)
- Customers/catalog/invoice CRUD.
- Invoice PDF generation.
- Dashboard baseline metrics.

### Sprint 2 (Payments + Reminders, 1–2 weeks)
- Payment recording.
- Reminder scheduling and sending pipeline.
- Overdue and aging views.

### Sprint 3 (AI MVP, 2 weeks)
- Invoice Draft Assistant.
- Risk scoring + due date recommendation.
- Reminder tone generation.
- AI telemetry + fallback UX.

### Sprint 4 (Beta Hardening, 1–2 weeks)
- Permissions polishing.
- Performance and observability.
- Beta feedback loop and bugfixes.

## 10) Success Metrics
- Time-to-create-invoice (target: <2 minutes median).
- On-time payment improvement (% delta after reminders/AI suggestions).
- DSO reduction for active users.
- AI acceptance rate (suggestions accepted vs edited/rejected).
- Weekly active organizations and retention (W4/W8).

## 11) Suggested Immediate Next Steps
1. Initialize Bun + React + Convex scaffold.
2. Implement org-scoped auth and data model tables.
3. Build invoice CRUD + PDF pipeline first.
4. Add reminder jobs.
5. Layer in AI features behind feature flags.
