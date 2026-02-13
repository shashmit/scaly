export type WidgetType = "kpi_outstanding" | "kpi_due" | "kpi_overdue" | "kpi_paid" | "kpi_month_revenue" | "kpi_transactions" | "kpi_avg_transaction" | "kpi_forecast_next" | "recent_invoices" | "revenue_trend";

export const WIDGET_LABELS: Record<WidgetType, string> = {
  kpi_outstanding: "Outstanding Amount",
  kpi_due: "Due Amount",
  kpi_overdue: "Overdue Amount",
  kpi_paid: "Paid This Month",
  kpi_month_revenue: "This Month Revenue",
  kpi_transactions: "Transactions",
  kpi_avg_transaction: "Avg. Transaction",
  kpi_forecast_next: "Next Month Forecast",
  recent_invoices: "Recent Invoices",
  revenue_trend: "Revenue Trend (Mini)",
};

export interface WidgetProps {
  metrics?: {
    totalRevenue: number;
    outstandingAmount: number;
    overdueAmount: number;
    revenueTrend: number;
  };
  invoices: any[];
  customers: any[];
  selectedInvoices: string[];
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  onNewInvoice: () => void;
  onDownloadSelected: () => Promise<void>;
  onViewInvoice: (id: string) => void;
  onEditInvoice: (id: string) => void;
  onCardClick?: (type: string) => void;
  userCurrency: string;
}

export function KPIWidget({ label, value, trend, icon, onClick, isClickable }: { label: string, value: string, trend: string, icon: React.ReactNode, onClick?: () => void, isClickable?: boolean }) {
  return (
    <div 
      className={`card kpi-card ${isClickable ? "clickable" : ""}`}
      style={{ 
        cursor: isClickable ? 'pointer' : 'default',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ 
          color: "var(--text-secondary)", 
          fontSize: "0.85rem", 
          fontWeight: 500, 
          margin: 0,
        }}>
          {label}
        </h3>
        {icon && <div style={{ opacity: 0.7, transform: 'scale(0.9)' }}>{icon}</div>}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <span style={{ 
          fontSize: "2rem", 
          fontWeight: 700, 
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          display: 'block',
          marginBottom: '0.25rem'
        }}>
          {value}
        </span>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
           <span style={{ 
            fontSize: "0.75rem", 
            color: trend.includes("+") ? "var(--text-success)" : trend.includes("-") ? "var(--text-error)" : "var(--text-secondary)",
            fontWeight: 600,
            background: trend.includes("+") ? "var(--bg-success)" : trend.includes("-") ? "var(--bg-error)" : "var(--bg-subtle)",
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {trend}
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            from last month
          </span>
        </div>
      </div>
    </div>
  );
}

export function RecentInvoicesWidget({ invoices, selectedInvoices = [], toggleSelection, toggleSelectAll, onNewInvoice, onDownloadSelected, onViewInvoice, onEditInvoice, userCurrency }: WidgetProps) {
  const fmtCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <h2>Recent Invoices</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {selectedInvoices.length > 0 && onDownloadSelected ? (
            <button className="secondaryButton" onClick={onDownloadSelected}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download ({selectedInvoices.length})
            </button>
          ) : null}
          {onNewInvoice && (
            <button className="primaryButton" onClick={onNewInvoice}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Invoice
            </button>
          )}
        </div>
      </div>

      <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input 
                  type="checkbox" 
                  checked={invoices.length > 0 && selectedInvoices.length === invoices.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Invoice</th>
              <th>Client</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice._id}>
                <td>
                  <input 
                    type="checkbox" 
                    checked={selectedInvoices.includes(invoice._id)}
                    onChange={() => toggleSelection && toggleSelection(invoice._id)}
                  />
                </td>
                <td>{invoice.invoiceNumber}</td>
                <td>{invoice.customerName || "Unknown"}</td>
                <td>{invoice.issueDate}</td>
                <td>{fmtCurrency(invoice.totalCents, invoice.currency)}</td>
                <td>
                  <span className={`status-pill ${invoice.statusClass}`}>
                    {invoice.statusLabel}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button 
                      className="ghostButton" 
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                      onClick={() => onViewInvoice && onViewInvoice(invoice._id)}
                    >
                      View
                    </button>
                    <button 
                      className="ghostButton" 
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                      onClick={() => onEditInvoice && onEditInvoice(invoice._id)}
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                  No invoices found. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RevenueTrendWidget({ metrics, onClick, isClickable }: { metrics: any; onClick?: () => void; isClickable?: boolean }) {
  // Mock trend data if not available (since metrics might not have full history yet)
  // In a real app, we'd pass the full analytics data here.
  
  return (
    <div 
      className={`card ${isClickable ? "clickable" : ""}`} 
      style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        cursor: isClickable ? 'pointer' : 'default',
        padding: 0, // Reset padding to allow chart to bleed
        overflow: 'hidden'
      }}
      onClick={onClick}
    >
      <div style={{ padding: '1.25rem 1.25rem 0 1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Revenue Trend</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
          Revenue is trending <span style={{ color: 'var(--text-success)', fontWeight: 600 }}>up by 12%</span>
        </p>
      </div>
      
      <div style={{ flex: 1, position: 'relative', minHeight: '120px', marginTop: '1rem' }}>
         <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none" style={{ display: 'block' }}>
           <defs>
             <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
               <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.2" />
               <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
             </linearGradient>
           </defs>
           <path d="M0,80 C50,80 50,60 100,70 C150,80 150,40 200,50 C250,60 250,20 300,10 V100 H0 Z" fill="url(#trendGradient)" />
           <path d="M0,80 C50,80 50,60 100,70 C150,80 150,40 200,50 C250,60 250,20 300,10" fill="none" stroke="var(--accent-blue)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
         </svg>
      </div>
    </div>
  );
}
