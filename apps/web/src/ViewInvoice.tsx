import { useState, useEffect } from "react";
import { invoicesApi } from "./lib/api";
import { generateInvoicePDF } from "./lib/pdf";
import { InvoicePreview } from "./InvoicePreview";
import { Loader } from "./components/Loader";
import { useFeedback } from "./components/Feedback";

interface ViewInvoiceProps {
  invoiceId: string;
  onBack: () => void;
  onEdit?: (invoiceId: string) => void;
  onDeleteSuccess?: () => void;
  onStatusChange?: (status: string) => void;
  isSidePanel?: boolean;
  readOnly?: boolean;
}

export function ViewInvoice({ invoiceId, onBack, onEdit, onDeleteSuccess, onStatusChange, isSidePanel, readOnly = false }: ViewInvoiceProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { showConfirm, showLoading, updateToast, showAlert } = useFeedback();
  const statusOptions: Array<{ label: string; value: "paid" | "due" | "unpaid" | "overdue" }> = [
    { label: "Paid", value: "paid" },
    { label: "Due", value: "due" },
    { label: "Outstanding", value: "unpaid" },
    { label: "Overdue", value: "overdue" },
  ];

  const mapStatusToUi = (status?: string): "paid" | "due" | "unpaid" | "overdue" => {
    if (status === "paid") return "paid";
    if (status === "unpaid") return "unpaid";
    if (status === "overdue") return "overdue";
    if (status === "due") return "due";
    if (status === "sent") return "due";
    return "due";
  };

  const mapUiToApiStatus = (status: "paid" | "due" | "unpaid" | "overdue") => {
    if (status === "paid") return "paid";
    if (status === "unpaid") return "unpaid";
    if (status === "overdue") return "overdue";
    return "due";
  };

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const res = await invoicesApi.get(invoiceId);
      setInvoice(res.invoice);
    } catch (err) {
      console.error("Failed to load invoice", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (invoice) {
      // Need to ensure format matches what generateInvoicePDF expects
      // The invoice from API has cents, but generateInvoicePDF expects standard structure
      // Actually generateInvoicePDF in CreateInvoice was passed calculated values.
      // Let's check generateInvoicePDF implementation or usage in App.tsx
      // App.tsx calls generateInvoicePDF(response.invoice).
      // So passing the invoice object directly is likely correct if it matches the shape.
      generateInvoicePDF(invoice);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm({
      title: "Delete invoice?",
      message: "This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "error",
    });
    if (!confirmed) return;
    const toastId = showLoading({
      title: "Deleting invoice",
      message: "Removing invoice data...",
    });
    try {
      setLoading(true);
      await invoicesApi.delete(invoiceId);
      if (onDeleteSuccess) {
        onDeleteSuccess();
      } else {
        onBack();
      }
      updateToast(toastId, {
        variant: "success",
        title: "Invoice deleted",
        message: "The invoice has been removed.",
        duration: 3000,
        persist: false,
      });
    } catch (err) {
      console.error("Failed to delete invoice", err);
      updateToast(toastId, {
        variant: "error",
        title: "Delete failed",
        message: "Unable to delete the invoice.",
        duration: 4000,
        persist: false,
      });
      await showAlert({
        title: "Delete failed",
        message: "Unable to delete the invoice.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (value: "paid" | "due" | "unpaid" | "overdue") => {
    if (!invoice) return;
    const nextStatus = mapUiToApiStatus(value);
    if (nextStatus === invoice.status) return;
    const toastId = showLoading({
      title: "Updating status",
      message: "Saving invoice status...",
    });
    try {
      await invoicesApi.updateStatus(invoiceId, nextStatus);
      setInvoice((prev: any) => prev ? { ...prev, status: nextStatus } : prev);
      if (onStatusChange) {
        onStatusChange(nextStatus);
      }
      updateToast(toastId, {
        variant: "success",
        title: "Status updated",
        message: `Status set to ${value.toUpperCase()}.`,
        duration: 3000,
        persist: false,
      });
    } catch (err) {
      updateToast(toastId, {
        variant: "error",
        title: "Update failed",
        message: "Unable to update status.",
        duration: 4000,
        persist: false,
      });
      await showAlert({
        title: "Update failed",
        message: "Unable to update the invoice status.",
        variant: "error",
      });
    }
  };

  if (loading) {
    return <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-secondary)" }}>Loading invoice...</div>;
  }

  if (!invoice) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Invoice not found.</p>
        <button onClick={onBack} className="secondaryButton">Close</button>
      </div>
    );
  }

  const currencySymbol = invoice.currency === "USD" ? "$" : 
                         invoice.currency === "EUR" ? "€" : 
                         invoice.currency === "GBP" ? "£" : invoice.currency;

  // Map flat invoice fields to customer object for Preview
  const customerData = {
    name: invoice.customerName,
    email: invoice.customerEmail,
    billingAddress: invoice.customerAddress,
    phone: invoice.customerPhone,
    shippingAddress: invoice.shippingAddress,
    gstNumber: invoice.customerGst || invoice.gstNumber
  };

  // Ensure lineItems have unitPrice (backend might send unitPriceCents)
  const preparedInvoice = {
    ...invoice,
    lineItems: invoice.lineItems.map((item: any) => ({
      ...item,
      unitPrice: item.unitPriceCents / 100 
    }))
  };

  return (
    <div className={isSidePanel ? "" : "page page-padded page-content-narrow"} style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      padding: isSidePanel ? '0' : undefined,
      maxWidth: isSidePanel ? 'none' : undefined,
      margin: isSidePanel ? undefined : '0 auto'
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "1.5rem",
        padding: isSidePanel ? '0 0.5rem' : '0'
      }}>
        {isSidePanel ? (
           <h2 style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-main)' }}>Invoice Details</h2>
        ) : (
          <button onClick={onBack} className="ghostButton">
            ← Back to List
          </button>
        )}
        
        <div className="header-actions">
          {!readOnly && (
            <>
              <div className="status-selector">
                <span>Status</span>
                <select
                  value={mapStatusToUi(invoice.status)}
                  onChange={(event) => handleStatusChange(event.target.value as "paid" | "due" | "unpaid" | "overdue")}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={handleDelete} className="secondaryButton" style={{ color: "var(--text-error)", borderColor: "var(--border-error)" }}>
                Delete
              </button>
              {onEdit && (
                <button onClick={() => onEdit(invoiceId)} className="secondaryButton">
                  Edit
                </button>
              )}
            </>
          )}
          <button onClick={handleDownload} className="primaryButton" style={{ padding: '0.6rem 1rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            PDF
          </button>
          {isSidePanel && (
            <button onClick={onBack} className="icon-button" style={{ marginLeft: '0.5rem' }}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
         <InvoicePreview 
           data={preparedInvoice} 
           customer={customerData} 
           currencySymbol={currencySymbol} 
         />
      </div>
    </div>
  );
}
