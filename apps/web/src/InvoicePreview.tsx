import React from "react";

interface InvoicePreviewProps {
  data: any;
  customer?: any;
  currencySymbol: string;
}

export function InvoicePreview({ data, customer, currencySymbol }: InvoicePreviewProps) {
  const subtotal = data.lineItems.reduce((sum: number, item: any) => {
    return sum + (item.quantity || 0) * (item.unitPrice || 0);
  }, 0);

  const formatMoney = (amount: number) => {
    return `${currencySymbol} ${amount.toFixed(2)}`;
  };

  return (
    <div className="invoice-preview">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3rem" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: "bold", margin: 0, color: "var(--text-main)", letterSpacing: "-0.025em" }}>INVOICE</h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>#{data.invoiceNumber || "INV-0000"}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.5rem 1.5rem", textAlign: "right", fontSize: "0.85rem" }}>
            {data.issueDate && (
              <>
                <span style={{ color: "var(--text-secondary)" }}>Issued</span>
                <span style={{ fontWeight: 500 }}>{data.issueDate}</span>
              </>
            )}
            {data.dueDate && (
              <>
                <span style={{ color: "var(--text-secondary)" }}>Due</span>
                <span style={{ fontWeight: 500 }}>{data.dueDate}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Addresses */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem", marginBottom: "3rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border-color)" }}>
        <div>
          <h3 style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>Bill To</h3>
          {customer ? (
            <div style={{ lineHeight: "1.5" }}>
              <p style={{ fontWeight: 600, color: "var(--text-main)", margin: 0 }}>{customer.name}</p>
              {customer.billingAddress && <p style={{ margin: 0, whiteSpace: "pre-line" }}>{customer.billingAddress}</p>}
              {customer.email && <p style={{ margin: 0 }}>{customer.email}</p>}
            </div>
          ) : (
            <p style={{ color: "var(--text-tertiary)", fontStyle: "italic", margin: 0 }}>Select a customer...</p>
          )}
        </div>
        <div>
           <h3 style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-tertiary)", marginBottom: "0.75rem" }}>Ship To</h3>
           {customer ? (
             <div style={{ lineHeight: "1.5" }}>
               {customer.shippingAddress ? (
                 <p style={{ margin: 0, whiteSpace: "pre-line" }}>{customer.shippingAddress}</p>
               ) : (
                 <p style={{ color: "var(--text-tertiary)", margin: 0 }}>Same as billing address</p>
               )}
               {customer.gstNumber && <p style={{ marginTop: "0.5rem", fontSize: "0.8rem" }}>GST: {customer.gstNumber}</p>}
             </div>
           ) : null}
        </div>
      </div>

      {/* Line Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "2rem" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "0.75rem 0", color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", borderBottom: "2px solid var(--border-color)" }}>Description</th>
            <th style={{ textAlign: "right", padding: "0.75rem 0", color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", borderBottom: "2px solid var(--border-color)", width: "10%" }}>Qty</th>
            <th style={{ textAlign: "right", padding: "0.75rem 0", color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", borderBottom: "2px solid var(--border-color)", width: "20%" }}>Price</th>
            <th style={{ textAlign: "right", padding: "0.75rem 0", color: "var(--text-secondary)", fontSize: "0.75rem", textTransform: "uppercase", borderBottom: "2px solid var(--border-color)", width: "20%" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.lineItems.map((item: any, i: number) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border-color)" }}>
              <td style={{ padding: "1rem 0", verticalAlign: "top" }}>
                <span style={{ display: "block", color: item.description ? "var(--text-main)" : "var(--text-tertiary)" }}>
                  {item.description || "Item description..."}
                </span>
              </td>
              <td style={{ textAlign: "right", padding: "1rem 0", verticalAlign: "top" }}>{item.quantity}</td>
              <td style={{ textAlign: "right", padding: "1rem 0", verticalAlign: "top" }}>{formatMoney(item.unitPrice || 0)}</td>
              <td style={{ textAlign: "right", padding: "1rem 0", fontWeight: 500, verticalAlign: "top" }}>
                {formatMoney((item.quantity || 0) * (item.unitPrice || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "2rem" }}>
        <div style={{ width: "280px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Subtotal</span>
            <span style={{ fontWeight: 500 }}>{formatMoney(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ color: "var(--text-secondary)" }}>Tax (0%)</span>
            <span style={{ fontWeight: 500 }}>{formatMoney(0)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid var(--border-strong)", paddingTop: "1rem", marginTop: "1rem" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{formatMoney(subtotal)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {data.note && (
        <div style={{ marginTop: "4rem", paddingTop: "2rem", borderTop: "1px solid var(--border-color)" }}>
          <h4 style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-tertiary)", margin: "0 0 0.5rem 0" }}>Notes</h4>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: "0.85rem" }}>{data.note}</p>
        </div>
      )}
      
      {/* Footer/Branding placeholder */}
      <div className="preview-footer">
        <p style={{ fontSize: "0.75rem", color: "var(--text-tertiary)", margin: 0 }}>Thank you for your business!</p>
      </div>
    </div>
  );
}
