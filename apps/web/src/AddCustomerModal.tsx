import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { customersApi } from "./lib/api";
import { CURRENCIES } from "./lib/constants";
import { useFeedback } from "./components/Feedback";

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  taxId: z.string().optional(),
  gstNumber: z.string().optional(),
  currency: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface AddCustomerModalProps {
  onClose: () => void;
  onSuccess: (customer: any) => void;
  customer?: any;
}

export function AddCustomerModal({ onClose, onSuccess, customer }: AddCustomerModalProps) {
  const [loading, setLoading] = useState(false);
  const { showLoading, updateToast, showAlert } = useFeedback();
  const { register, handleSubmit, formState: { errors } } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer ? {
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      billingAddress: customer.billingAddress || "",
      shippingAddress: customer.shippingAddress || "",
      taxId: customer.taxId || customer.customerTaxId || "",
      gstNumber: customer.gstNumber || customer.customerGst || "",
      currency: customer.currency || "USD",
    } : undefined,
  });

  const onSubmit = async (data: CustomerFormValues) => {
    const isEdit = !!customer;
    const toastId = showLoading({
      title: isEdit ? "Updating customer" : "Creating customer",
      message: isEdit ? "Updating customer profile..." : "Saving customer profile...",
    });
    try {
      setLoading(true);
      const payload = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== "")
      );
      
      let res: any;
      if (isEdit) {
        await customersApi.update(customer._id, payload);
        res = { customerId: customer._id };
      } else {
        res = await customersApi.create(payload);
      }
      
      onSuccess({ ...payload, _id: res.customerId });
      updateToast(toastId, {
        variant: "success",
        title: isEdit ? "Customer updated" : "Customer added",
        message: isEdit ? "Customer profile updated." : "New customer profile created.",
        duration: 3000,
        persist: false,
      });
    } catch (err) {
      console.error(isEdit ? "Failed to update customer" : "Failed to create customer", err);
      updateToast(toastId, {
        variant: "error",
        title: isEdit ? "Update failed" : "Create failed",
        message: isEdit ? "Unable to update customer." : "Unable to create customer.",
        duration: 4000,
        persist: false,
      });
      await showAlert({
        title: isEdit ? "Update failed" : "Create failed",
        message: isEdit ? "Unable to update customer. Please try again." : "Unable to create customer. Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="card modal-card" style={{ width: 'min(520px, 100%)' }}>
        <h2 style={{ marginTop: 0 }}>{customer ? "Edit Customer" : "Add New Customer"}</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Name *</label>
            <input {...register("name")} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
            {errors.name && <span style={{ color: 'var(--text-error)', fontSize: '0.8rem' }}>{errors.name.message}</span>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email</label>
              <input {...register("email")} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
              {errors.email && <span style={{ color: 'var(--text-error)', fontSize: '0.8rem' }}>{errors.email.message}</span>}
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Phone</label>
              <input {...register("phone")} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Billing Address</label>
            <textarea {...register("billingAddress")} rows={3} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} placeholder="Street, City, State, Zip" />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Shipping Address</label>
            <textarea {...register("shippingAddress")} rows={3} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} placeholder="Street, City, State, Zip" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Tax ID / PAN</label>
              <input {...register("taxId")} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>GST Number</label>
              <input {...register("gstNumber")} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }} />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
             <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Currency</label>
             <select {...register("currency")} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}>
               <option value="">Select Currency</option>
               {CURRENCIES.map(c => (
                 <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
               ))}
             </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" onClick={onClose} className="ghostButton">Cancel</button>
            <button type="submit" disabled={loading} style={{
              backgroundColor: 'var(--primary)', color: 'var(--primary-fg)', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer'
            }}>
              {loading ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
