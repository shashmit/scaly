import { useState, useEffect } from "react";
import { customersApi } from "./lib/api";
import { AddCustomerModal } from "./AddCustomerModal";
import { useFeedback } from "./components/Feedback";
import { Loader } from "./components/Loader";

export function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { showConfirm, showLoading, updateToast } = useFeedback();

  const loadCustomers = async (search?: string) => {
    try {
      setLoading(true);
      const res = await customersApi.list(search);
      setCustomers(res.customers || []);
    } catch (err: any) {
      console.error("Failed to load customers", err);
      updateToast("load-customers-error", {
        variant: "error",
        title: "Error loading customers",
        message: err.message || "Unknown error occurred",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(searchTerm);
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleDelete = async (customerId: string, customerName: string) => {
    const confirmed = await showConfirm({
      title: "Delete Customer?",
      message: `Are you sure you want to delete ${customerName}? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "error",
    });

    if (!confirmed) return;

    const toastId = showLoading({
      title: "Deleting customer",
      message: "Removing customer profile...",
    });

    try {
      await customersApi.delete(customerId);
      setCustomers(customers.filter(c => c._id !== customerId));
      updateToast(toastId, {
        variant: "success",
        title: "Customer deleted",
        message: `${customerName} has been removed.`,
        duration: 3000,
      });
    } catch (err) {
      updateToast(toastId, {
        variant: "error",
        title: "Delete failed",
        message: "Failed to delete customer.",
        duration: 4000,
      });
    }
  };

  const filteredCustomers = customers; // Server side filtered

  if (loading && customers.length === 0 && !searchTerm) {
    return <Loader label="Loading customers..." />;
  }

  return (
    <div className="page page-padded">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}>Customers</h1>
          <p className="text-muted" style={{ marginTop: "0.5rem" }}>Manage your client details</p>
        </div>
        <button className="primaryButton" onClick={() => setShowAddModal(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Customer
        </button>
      </div>

      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <input 
          type="text" 
          placeholder="Search customers..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '0.75rem', 
            borderRadius: '6px', 
            border: '1px solid var(--border-color)',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            fontSize: '1rem'
          }}
        />
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Currency</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer._id}>
                    <td style={{ fontWeight: 500 }}>{customer.name}</td>
                    <td>{customer.email || "-"}</td>
                    <td>{customer.phone || "-"}</td>
                    <td>{customer.billingAddress ? customer.billingAddress.split(',')[1] || customer.billingAddress : "-"}</td>
                    <td>{customer.currency || "USD"}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="ghostButton" 
                        style={{ padding: "0.25rem 0.5rem", marginRight: "0.5rem" }}
                        onClick={() => {
                          setEditingCustomer(customer);
                          setShowAddModal(true);
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        className="ghostButton" 
                        style={{ color: "var(--text-error)", padding: "0.25rem 0.5rem" }}
                        onClick={() => handleDelete(customer._id, customer.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--text-secondary)" }}>
                    {searchTerm ? "No customers found matching your search." : "No customers added yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddCustomerModal 
          onClose={() => {
            setShowAddModal(false);
            setEditingCustomer(null);
          }}
          customer={editingCustomer}
          onSuccess={(newCustomer) => {
            if (editingCustomer) {
              setCustomers(customers.map(c => c._id === newCustomer._id ? { ...newCustomer, _id: c._id } : c));
            } else {
              setCustomers([...customers, newCustomer]);
            }
            setShowAddModal(false);
            setEditingCustomer(null);
          }}
        />
      )}
    </div>
  );
}
