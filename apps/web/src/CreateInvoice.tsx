import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { customersApi, invoicesApi, usersApi, recurringApi } from "./lib/api";
import { CURRENCIES } from "./lib/constants";
import { AddCustomerModal } from "./AddCustomerModal";
import { generateInvoicePDF } from "./lib/pdf";
import { InvoicePreview } from "./InvoicePreview";
import { Loader } from "./components/Loader";
import { useFeedback } from "./components/Feedback";

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().min(1, "Currency is required"),
  lineItems: z.array(z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0, "Price cannot be negative"),
  })).min(1, "At least one line item is required"),
  note: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface CreateInvoiceProps {
  invoiceId?: string;
  onCancel: () => void;
  onSuccess: () => void;
  onView: (id: string) => void;
  onDeleteSuccess?: () => void;
}

const getLocalDateStr = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function CreateInvoice({ invoiceId, onCancel, onSuccess, onView, onDeleteSuccess }: CreateInvoiceProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!invoiceId);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [createdInvoiceData, setCreatedInvoiceData] = useState<any>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("monthly");
  const { showConfirm, showLoading, updateToast, showAlert } = useFeedback();

  const { register, control, handleSubmit, watch, formState: { errors }, setValue, reset } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      issueDate: getLocalDateStr(),
      dueDate: getLocalDateStr(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      currency: "USD",
      lineItems: [{ description: "", quantity: 1, unitPrice: 0 }],
      invoiceNumber: `INV-${Math.floor(Math.random() * 10000)}`,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const lineItems = watch("lineItems");
  const selectedCustomerId = watch("customerId");
  const selectedCurrency = watch("currency");
  const selectedCustomer = customers.find(c => c._id === selectedCustomerId);
  const currencySymbol = CURRENCIES.find(c => c.code === selectedCurrency)?.symbol || "$";

  const totalAmount = lineItems.reduce((sum, item) => {
    return sum + (item.quantity || 0) * (item.unitPrice || 0);
  }, 0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersRes, userRes] = await Promise.all([
        customersApi.list(),
        usersApi.getMe()
      ]);
      setCustomers(customersRes.customers || []);
      
      if (invoiceId) {
        const invoiceRes = await invoicesApi.get(invoiceId);
        const inv = invoiceRes.invoice;
        if (inv) {
          reset({
            customerId: inv.customerId,
            invoiceNumber: inv.invoiceNumber,
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            currency: inv.currency,
            note: inv.note,
            lineItems: inv.lineItems.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPriceCents / 100,
            })),
          });
        }
      } else {
        // Set default currency if not already modified
        const defaultCurrency = userRes.user?.defaultCurrency || "USD";
        if (watch("currency") === "USD" && defaultCurrency !== "USD") {
          setValue("currency", defaultCurrency);
        }
      }
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setInitialLoading(false);
    }
  };

  // Update currency when customer changes (only for new invoices)
  useEffect(() => {
    if (!invoiceId && selectedCustomer?.currency) {
      setValue("currency", selectedCustomer.currency);
    }
  }, [selectedCustomerId, invoiceId]);

  const handleDownloadPDF = () => {
    const data = allValues;
    const subtotalCents = Math.round(totalAmount * 100);
    const taxCents = 0;
    const discountCents = 0;
    const totalCents = subtotalCents + taxCents - discountCents;

    const pdfData = {
      ...data,
      customerName: selectedCustomer?.name,
      customerEmail: selectedCustomer?.email,
      customerPhone: selectedCustomer?.phone,
      customerAddress: selectedCustomer?.billingAddress,
      shippingAddress: selectedCustomer?.shippingAddress,
      customerGst: selectedCustomer?.gstNumber,
      subtotalCents,
      taxCents,
      discountCents,
      totalCents,
      status: "draft",
      lineItems: data.lineItems.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: Math.round(item.unitPrice * 100),
          amountCents: Math.round(item.quantity * item.unitPrice * 100),
      })),
    };

    generateInvoicePDF(pdfData);
  };

  const handleDelete = async () => {
    if (!invoiceId) return;
    
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
        onCancel();
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

  const onSubmit = async (data: InvoiceFormValues) => {
    const toastId = showLoading({
      title: invoiceId ? "Updating invoice" : "Saving invoice",
      message: "Finalizing invoice details...",
    });
    try {
      setLoading(true);
      
      const subtotalCents = Math.round(totalAmount * 100);
      const taxCents = 0;
      const discountCents = 0;
      const totalCents = subtotalCents + taxCents - discountCents;

      const lineItemsFormatted = data.lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: Math.round(item.unitPrice * 100),
        amountCents: Math.round(item.quantity * item.unitPrice * 100),
      }));

      if (isRecurring && !invoiceId) {
        const recurringPayload = {
            customerId: data.customerId,
            currency: data.currency,
            lineItems: lineItemsFormatted,
            note: data.note,
            interval: recurringInterval,
            generateFirstImmediately: true,
        };

        const res: any = await recurringApi.create(recurringPayload);
        const recurringId = res.recurringId;
        const generatedInvoiceId = res.invoiceId;
        
        const customer = customers.find(c => c._id === data.customerId);
        setCreatedInvoiceData({
            invoiceNumber: "RECURRING", 
            isRecurring: true,
            recurringInterval,
            customerName: customer?.name,
            _id: recurringId,
            generatedInvoiceId,
        });
        setCreatedInvoiceId(recurringId);
        onSuccess();
        updateToast(toastId, {
          variant: "success",
          title: "Recurring schedule set",
          message: "Recurring invoices are scheduled.",
          duration: 3000,
          persist: false,
        });
        return;
      }

      const payload = {
        customerId: data.customerId,
        invoiceNumber: data.invoiceNumber,
        issueDate: data.issueDate || undefined,
        dueDate: data.dueDate || undefined,
        currency: data.currency,
        subtotalCents,
        taxCents,
        discountCents,
        totalCents,
        status: "draft", 
        note: data.note,
        lineItems: lineItemsFormatted,
      };

      let resultId = invoiceId;

      if (invoiceId) {
        await invoicesApi.update(invoiceId, payload);
        setCreatedInvoiceData({ ...payload, _id: invoiceId, status: "draft" }); 
      } else {
        const res: any = await invoicesApi.create(payload);
        resultId = res.invoiceId;
        const customer = customers.find(c => c._id === data.customerId);
        setCreatedInvoiceData({ 
            ...payload, 
            _id: resultId, 
            customerName: customer?.name,
            customerEmail: customer?.email,
            customerPhone: customer?.phone,
            customerAddress: customer?.billingAddress,
            status: "draft"
        });
      }

      setCreatedInvoiceId(resultId || null);
      onSuccess();
      updateToast(toastId, {
        variant: "success",
        title: invoiceId ? "Invoice updated" : "Invoice saved",
        message: "Your invoice is ready.",
        duration: 3000,
        persist: false,
      });
      
    } catch (err) {
      console.error("Failed to save invoice", err);
      updateToast(toastId, {
        variant: "error",
        title: "Save failed",
        message: "Unable to save the invoice.",
        duration: 4000,
        persist: false,
      });
      await showAlert({
        title: "Save failed",
        message: "Unable to save the invoice. Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const allValues = watch();

  if (initialLoading) {
    return <Loader label="Loading..." />;
  }

  if (createdInvoiceId && createdInvoiceData) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            {createdInvoiceData?.isRecurring ? 'Recurring Invoice Scheduled!' : (invoiceId ? 'Updated Successfully!' : 'Created Successfully!')}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            {createdInvoiceData?.isRecurring 
              ? (
                <>
                  <span>The recurring invoice will run <strong>{createdInvoiceData.recurringInterval}</strong> starting from <strong>Today</strong>.</span>
                  {createdInvoiceData.generatedInvoiceId && (
                    <div style={{ marginTop: '0.5rem', color: 'var(--text-success)' }}>
                      ✨ First invoice has been generated immediately!
                    </div>
                  )}
                </>
              )
              : <span>Invoice <strong>{createdInvoiceData.invoiceNumber}</strong> has been saved.</span>
            }
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '300px', margin: '0 auto' }}>
             {(!createdInvoiceData?.isRecurring || createdInvoiceData?.generatedInvoiceId) && (
             <button 
              className="primaryButton"
              onClick={() => onView(createdInvoiceData?.generatedInvoiceId || createdInvoiceId)}
            >
              View Invoice
            </button>
            )}
            
            {!createdInvoiceData?.isRecurring && (
            <button 
              className="secondaryButton"
              onClick={() => generateInvoicePDF(createdInvoiceData)}
            >
              Download PDF
            </button>
            )}

            <button 
              className="ghostButton"
              onClick={onCancel}
            >
              Back to List
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
      <div className="page page-padded page-content-wide" style={{ display: 'block' }}>
      {showAddCustomerModal && (
        <AddCustomerModal 
          onClose={() => setShowAddCustomerModal(false)}
          onSuccess={(newCustomer) => {
            setCustomers([...customers, newCustomer]);
            setValue("customerId", newCustomer._id);
            setShowAddCustomerModal(false);
          }}
        />
      )}
      
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={onCancel} className="icon-button">
            ←
          </button>
          <h1 style={{ fontSize: '1.5rem' }}>{invoiceId ? 'Edit Invoice' : 'New Invoice'}</h1>
        </div>
        <div className="header-actions">
          <button className="ghostButton" onClick={onCancel}>Cancel</button>
          {invoiceId && (
            <button 
              type="button"
              className="secondaryButton" 
              onClick={handleDelete}
              style={{ color: "var(--text-error)", borderColor: "var(--border-error)" }}
            >
              Delete
            </button>
          )}
          <button 
            type="button"
            className="secondaryButton" 
            onClick={handleDownloadPDF}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download PDF
          </button>
          <button 
            onClick={handleSubmit(onSubmit)} 
            className="primaryButton" 
            disabled={loading}
          >
            {loading ? "Saving..." : (invoiceId ? "Save Changes" : "Create Invoice")}
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
        {/* LEFT COLUMN: EDITOR FORM */}
        <div className="form-section">
          <form onSubmit={handleSubmit(onSubmit)} id="invoice-form">
            
            {/* 1. Customer Selection */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>Client Details</h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddCustomerModal(true)}
                  style={{ fontSize: '0.85rem', color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
                >
                  + New Client
                </button>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Select Client</label>
                <select {...register("customerId")} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  <option value="">Select a customer...</option>
                  {customers.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
                {errors.customerId && <span style={{ color: 'var(--text-error)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>{errors.customerId.message}</span>}
              </div>

              {selectedCustomer && (
                <div style={{ padding: '1rem', backgroundColor: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                   <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{selectedCustomer.name}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>{selectedCustomer.email}</div>
                   </div>
                </div>
              )}
            </div>

            {/* 2. Invoice Details */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>Invoice Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                 <div>
                   <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Invoice Number</label>
                   <input {...register("invoiceNumber")} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
                   {errors.invoiceNumber && <span style={{ color: 'var(--text-error)', fontSize: '0.8rem' }}>{errors.invoiceNumber.message}</span>}
                 </div>
                 <div>
                   <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Currency</label>
                   <select {...register("currency")} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                     {CURRENCIES.map(c => (
                       <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                     ))}
                   </select>
                 </div>
                 <div>
                   <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Issue Date <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
                   <input type="date" {...register("issueDate")} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
                   {errors.issueDate && <span style={{ color: 'var(--text-error)', fontSize: '0.8rem' }}>{errors.issueDate.message}</span>}
                 </div>
                 <div>
                   <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Due Date <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span></label>
                   <input type="date" {...register("dueDate")} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
                   {errors.dueDate && <span style={{ color: 'var(--text-error)', fontSize: '0.8rem' }}>{errors.dueDate.message}</span>}
                 </div>
              </div>
            </div>

            {/* 2.5 Recurring Options (New) */}
            {!invoiceId && (
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isRecurring ? '1rem' : 0 }}>
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>Recurring Invoice</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      id="isRecurring" 
                      checked={isRecurring} 
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      style={{ width: '1.2rem', height: '1.2rem' }}
                    />
                    <label htmlFor="isRecurring" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Enable Recurring Schedule</label>
                  </div>
               </div>

               {isRecurring && (
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <div>
                       <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Interval</label>
                       <select 
                         value={recurringInterval} 
                         onChange={(e) => setRecurringInterval(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                       >
                         <option value="weekly">Weekly</option>
                         <option value="monthly">Monthly</option>
                         <option value="quarterly">Every 3 Months (Quarterly)</option>
                         <option value="biannually">Every 6 Months</option>
                         <option value="yearly">Yearly</option>
                       </select>
                    </div>
                 </div>
               )}
            </div>
            )}

            {/* 3. Line Items */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>Items</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {fields.map((field, index) => (
                  <div key={field.id} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 80px 100px 40px', 
                    gap: '0.75rem', 
                    alignItems: 'start',
                    paddingBottom: '1rem',
                    borderBottom: index < fields.length - 1 ? '1px solid var(--border-color)' : 'none'
                  }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Description</label>
                      <input 
                        {...register(`lineItems.${index}.description`)} 
                        placeholder="Item name"
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} 
                      />
                      {errors.lineItems?.[index]?.description && <span style={{ color: 'var(--text-error)', fontSize: '0.7rem' }}>Required</span>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Qty</label>
                      <input 
                        type="number" 
                        {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })} 
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'right', background: 'var(--bg-card)', color: 'var(--text-main)' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Price</label>
                      <input 
                        type="number" 
                        step="0.01"
                        {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })} 
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'right', background: 'var(--bg-card)', color: 'var(--text-main)' }} 
                      />
                    </div>
                    <div style={{ paddingTop: '1.5rem', textAlign: 'center' }}>
                      <button type="button" onClick={() => remove(index)} style={{ border: 0, background: 'transparent', color: 'var(--text-error)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                type="button" 
                onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  border: '1px dashed var(--border-color)', 
                  backgroundColor: 'var(--bg-subtle)', 
                  color: 'var(--text-secondary)', 
                  fontWeight: 500, 
                  cursor: 'pointer',
                  marginTop: '0.5rem'
                }}
              >
                + Add Another Item
              </button>
            </div>

            {/* 4. Notes */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Notes / Terms</label>
              <textarea 
                {...register("note")} 
                rows={4}
                placeholder="Enter any notes, payment terms, or thank you message..."
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', background: 'var(--bg-card)', color: 'var(--text-main)' }} 
              />
            </div>

          </form>
        </div>

        {/* RIGHT COLUMN: PREVIEW */}
        <div className="preview-section preview-panel">
           <div className="preview-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-green)' }}></span>
                 <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Preview</h2>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>A4 Format</div>
           </div>
           
           <InvoicePreview 
              data={allValues} 
              customer={selectedCustomer} 
              currencySymbol={currencySymbol} 
           />
        </div>
      </div>
    </div>
  );
}
