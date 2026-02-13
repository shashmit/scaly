# Scaly - AI-First Invoicing Platform

Scaly is a modern, AI-powered invoicing SaaS designed for freelancers and SMBs.
It streamlines the invoicing process with automation, smart insights, and
seamless payments.

## 🚀 Concept

An intelligent platform that not only lets you create and send invoices but also
helps you get paid faster through:

- **AI-Assisted Drafting**: Generate line items and terms from simple prompts.
- **Smart Reminders**: Automated, tone-adjusted payment follow-ups.
- **Risk Analysis**: Scores customers based on payment history.
- **Financial Insights**: Cash-flow forecasting and real-time metrics.

## 🛠 Tech Stack

Built with a high-performance modern stack:

- **Runtime & Manager**: [Bun](https://bun.sh)
- **Database & Backend**: [Convex](https://convex.dev)
- **Frontend**:
  - React (via [Vite](https://vitejs.dev))
  - TypeScript
  - Tailwind CSS & Shadcn/UI
  - Clerk (Authentication)
  - React Hook Form + Zod
- **AI & Logic**:
  - Vercel AI SDK
  - OpenAI Integration

## 📂 Project Structure

This project is a monorepo managed by Bun workspaces:

- `apps/web`: The main React frontend application.
- `apps/api`: Backend service for AI processing and external integrations.
- `convex`: Core backend logic, database schema, and serverless functions.
- `docs`: Project documentation and architecture plans.

## ⚡️ Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed.
- Convex account and project setup.
- Clerk account for authentication.

### Installation

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Environment Setup**:
   - Configure `.env.local` for `apps/web` with Clerk publishable key and Convex
     URL.
   - Configure `.env` for `apps/api` with OpenAI API key and Clerk secret key.
   - Initialize Convex with `bunx convex dev`.

3. **Run Development Servers**:

   - **Frontend**:
     ```bash
     bun run dev:web
     ```
   - **API Server**:
     ```bash
     bun run dev:api
     ```
   - **Convex**:
     ```bash
     bun run convex:dev
     ```

## 📝 Features (Current & Planned)

- [x] **Organization & User Management**: Secure multi-tenant architecture.
- [x] **Invoice Management**: Create, edit, and list invoices.
- [x] **PDF Generation**: Download invoices as PDF.
- [x] **Customer CRM**: Manage customer details.
- [ ] **AI Insights**: Risk scoring and smart due dates (In Progress).
- [ ] **Automated Reminders**: Configurable email follow-ups.

## 📄 License

MIT

---

_Based on the [Invoicing SaaS Plan](./docs/saas-invoicing-plan.md)._
