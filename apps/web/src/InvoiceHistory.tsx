import { useEffect, useState } from "react";
import { invoicesApi } from "./lib/api";
import { Loader } from "./components/Loader";
import { ViewInvoice } from "./ViewInvoice";

export function InvoiceHistory() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [isDone, setIsDone] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    loadPage(null);
  }, []);

  const loadPage = async (cursor: string | null) => {
    try {
      setLoading(true);
      const res = await invoicesApi.listHistory({
        cursor: cursor ?? undefined,
        limit: pageSize,
      });
      setInvoices(res.invoices || []);
      setNextCursor(res.cursor);
      setIsDone(res.isDone);
    } catch (err: any) {
      setError(err.message || "Failed to load invoice history");
    } finally {
      setLoading(false);
    }
  };


  const fmtCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  const handleNext = () => {
    if (!nextCursor) return;
    const newIndex = currentIndex + 1;
    setPageCursors(prev => [...prev, nextCursor]);
    setCurrentIndex(newIndex);
    loadPage(nextCursor);
  };

  const handlePrev = () => {
    if (currentIndex === 0) return;
    const newIndex = currentIndex - 1;
    const cursor = pageCursors[newIndex] ?? null;
    setCurrentIndex(newIndex);
    loadPage(cursor);
  };

  if (loading) return <Loader label="Loading invoices..." />;
  if (error) return <div style={{ padding: "2rem", color: "red" }}>Error: {error}</div>;

  return (
    <div className="page page-padded page-content">
      <header className="header">
        <div>
          <h1 className="header-title">Invoice History</h1>
          <p className="header-subtitle">All invoices with pagination</p>
        </div>
        <div className="header-actions">
          <button className="secondaryButton" onClick={handlePrev} disabled={currentIndex === 0}>
            Prev
          </button>
          <span className="text-muted text-sm">Page {currentIndex + 1}</span>
          <button className="secondaryButton" onClick={handleNext} disabled={isDone || !nextCursor}>
            Next
          </button>
        </div>
      </header>

      {selectedInvoiceId ? (
        <div className="split-view">
          <div className="split-panel" style={{ width: "450px" }}>
            <div className="card" style={{ overflow: "hidden", height: "100%" }}>
              <div className="table-container" style={{ height: "100%", overflow: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice._id} onClick={() => setSelectedInvoiceId(invoice._id)} style={{ cursor: "pointer" }}>
                        <td>{invoice.invoiceNumber}</td>
                        <td>{invoice.customerName || "Unknown"}</td>
                        <td>{invoice.issueDate}</td>
                        <td>{fmtCurrency(invoice.totalCents, invoice.currency)}</td>
                        <td>
                          <span className={`status-pill ${invoice.statusClass}`}>
                            {invoice.statusLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                          No invoices found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div className="split-panel" style={{ flex: 1 }}>
            <ViewInvoice
              invoiceId={selectedInvoiceId}
              onBack={() => setSelectedInvoiceId(null)}
              onEdit={() => {}}
              isSidePanel={true}
              readOnly={true}
            />
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id} onClick={() => setSelectedInvoiceId(invoice._id)} style={{ cursor: "pointer" }}>
                    <td>{invoice.invoiceNumber}</td>
                    <td>{invoice.customerName || "Unknown"}</td>
                    <td>{invoice.issueDate}</td>
                    <td>{fmtCurrency(invoice.totalCents, invoice.currency)}</td>
                    <td>
                      <span className={`status-pill ${invoice.statusClass}`}>
                        {invoice.statusLabel}
                      </span>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                      No invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
