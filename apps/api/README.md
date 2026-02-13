# Scaly API Server

Backend API layer that sits between the React frontend and Convex backend, providing:
- Request validation with Zod
- Organization-scoped security
- Centralized error handling
- RESTful API endpoints

## Architecture

```
Frontend (React) → API Server (Express/Bun) → Convex Backend → Database
```

## Security Features

- **Organization Context Validation**: Every request requires `x-organization-id` header
- **Row-Level Security**: All Convex queries filtered by organization
- **Input Validation**: Zod schemas validate all incoming data
- **Error Sanitization**: Production errors don't leak sensitive info

## API Endpoints

### Customers

- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get customer by ID
- `POST /api/customers` - Create new customer
- `PATCH /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Invoices

- `GET /api/invoices` - List invoices (optional: ?status=sent&customerId=xxx)
- `GET /api/invoices/:id` - Get invoice with line items
- `POST /api/invoices` - Create invoice with line items
- `PATCH /api/invoices/:id/status` - Update invoice status
- `DELETE /api/invoices/:id` - Delete invoice and line items

### Payments

- `GET /api/payments/invoice/:invoiceId` - List payments for invoice
- `POST /api/payments` - Record a payment

### Dashboard

- `GET /api/dashboard/metrics` - Get KPI metrics

## Request Headers

All API requests require:
```
x-organization-id: <org-id>
x-user-id: <user-id>
Content-Type: application/json
```

## Example Requests

### Create Customer
```bash
curl -X POST http://localhost:3001/api/customers \
  -H "Content-Type: application/json" \
  -H "x-organization-id: org_123" \
  -H "x-user-id: user_456" \
  -d '{
    "name": "Acme Corp",
    "email": "billing@acme.com",
    "paymentTermsDays": 30
  }'
```

### Create Invoice
```bash
curl -X POST http://localhost:3001/api/invoices \
  -H "Content-Type: application/json" \
  -H "x-organization-id: org_123" \
  -H "x-user-id: user_456" \
  -d '{
    "customerId": "customer_id",
    "invoiceNumber": "INV-2026-001",
    "issueDate": "2026-02-10",
    "dueDate": "2026-03-10",
    "currency": "USD",
    "lineItems": [
      {
        "description": "Web Development",
        "quantity": 40,
        "unitPriceCents": 10000
      }
    ],
    "taxCents": 32000,
    "note": "Payment due within 30 days"
  }'
```

## Development

```bash
# Start API server
bun run dev:api

# Server runs on http://localhost:3001
```

## Environment Variables

See `.env.example` for required configuration.
