import { useState, useEffect } from "react";
import { recurringApi, customersApi } from "./lib/api";
import { Loader } from "./components/Loader";
import { useFeedback } from "./components/Feedback";

export function RecurringInvoices({ onBack }: { onBack?: () => void }) {
  const [recurring, setRecurring] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showConfirm, showLoading, updateToast } = useFeedback();
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recurringRes, customersRes] = await Promise.all([
        recurringApi.list(),
        customersApi.list(),
      ]);
      setRecurring(recurringRes.recurring || []);
      setCustomers(customersRes.customers || []);
    } catch (err: any) {
      setError(err.message || "Failed to load recurring invoices");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
    const toastId = showLoading({
      title: "Updating schedule",
      message: `Setting status to ${statusLabel.toLowerCase()}...`,
    });
    try {
      await recurringApi.update(id, { status: newStatus });
      setRecurring(prev => prev.map(item => 
        item._id === id ? { ...item, status: newStatus } : item
      ));
      updateToast(toastId, {
        variant: "success",
        title: "Schedule updated",
        message: `Status set to ${statusLabel}.`,
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
    }
  };

  const startEditing = (item: any) => {
    setEditingId(item._id);
    setEditForm({
      interval: item.interval,
      nextRunDate: item.nextRunDate,
      note: item.note || "",
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const toastId = showLoading({
      title: "Saving schedule",
      message: "Applying changes...",
    });
    try {
      await recurringApi.update(editingId, editForm);
      setRecurring(prev => prev.map(item => 
        item._id === editingId ? { ...item, ...editForm } : item
      ));
      setEditingId(null);
      updateToast(toastId, {
        variant: "success",
        title: "Schedule saved",
        message: "Recurring invoice updated.",
        duration: 3000,
        persist: false,
      });
    } catch (err) {
      updateToast(toastId, {
        variant: "error",
        title: "Save failed",
        message: "Unable to update schedule.",
        duration: 4000,
        persist: false,
      });
    }
  };

  const deleteRecurring = async (id: string) => {
    const confirmed = await showConfirm({
      title: "Delete recurring invoice?",
      message: "This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "error",
    });
    if (!confirmed) return;
    const toastId = showLoading({
      title: "Deleting schedule",
      message: "Removing recurring invoice...",
    });
    try {
      await recurringApi.delete(id);
      setRecurring(prev => prev.filter(item => item._id !== id));
      if (editingId === id) setEditingId(null);
      updateToast(toastId, {
        variant: "success",
        title: "Schedule deleted",
        message: "Recurring invoice removed.",
        duration: 3000,
        persist: false,
      });
    } catch (err) {
      updateToast(toastId, {
        variant: "error",
        title: "Delete failed",
        message: "Unable to delete schedule.",
        duration: 4000,
        persist: false,
      });
    }
  };

  const handleStop = async (id: string) => {
    const confirmed = await showConfirm({
      title: "Stop recurring invoice?",
      message: "This will cancel the schedule and stop future invoices.",
      confirmLabel: "Stop",
      cancelLabel: "Keep",
      variant: "warning",
    });
    if (!confirmed) return;
    await handleStatusChange(id, "cancelled");
  };

  const getCustomerName = (id: string) => {
    return customers.find(c => c._id === id)?.name || "Unknown Customer";
  };

  const getAmount = (lineItems: any[]) => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPriceCents), 0) / 100;
  };

  if (loading) return <Loader label="Loading schedules..." />;
  if (error) return <div style={{ padding: '2rem', color: 'var(--text-error)' }}>Error: {error}</div>;

  return (
    <div className="page page-padded page-content">
      <header className="header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Recurring Invoices</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your automated invoice schedules</p>
        </div>
      </header>

      {recurring.length === 0 ? (
        <div className="card empty-state">
          <p>No recurring invoices found.</p>
          <p>Create a new invoice and select "Enable Recurring Schedule" to get started.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-subtle)', textAlign: 'left' }}>
                <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Customer</th>
                <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Amount</th>
                <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Interval</th>
                <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Next Run</th>
                <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Status</th>
                <th style={{ padding: '1rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurring.map(item => (
                <tr key={item._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 500 }}>{getCustomerName(item.customerId)}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.lineItems.length} items</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency }).format(getAmount(item.lineItems))}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {editingId === item._id ? (
                       <select 
                         value={editForm.interval}
                         onChange={e => setEditForm({...editForm, interval: e.target.value})}
                        style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                       >
                         <option value="weekly">Weekly</option>
                         <option value="monthly">Monthly</option>
                         <option value="quarterly">Quarterly</option>
                         <option value="biannually">Biannually</option>
                         <option value="yearly">Yearly</option>
                       </select>
                    ) : (
                       <span style={{ textTransform: 'capitalize' }}>{item.interval}</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {editingId === item._id ? (
                       <input 
                         type="date"
                         value={editForm.nextRunDate}
                         onChange={e => setEditForm({...editForm, nextRunDate: e.target.value})}
                        style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                       />
                    ) : (
                       <span>{item.nextRunDate}</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`status-pill ${item.status}`}>
                      {item.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {editingId === item._id ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={saveEdit} style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={() => deleteRecurring(item._id)} style={{ color: 'var(--text-error)', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button 
                          onClick={() => startEditing(item)}
                          style={{ color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                          Edit
                        </button>
                        
                        {item.status === 'active' && (
                          <button 
                            onClick={() => handleStatusChange(item._id, 'paused')}
                            style={{ color: 'var(--text-warning)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            Pause
                          </button>
                        )}
                        
                        {item.status === 'paused' && (
                          <button 
                            onClick={() => handleStatusChange(item._id, 'active')}
                            style={{ color: 'var(--text-success)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            Resume
                          </button>
                        )}

                        {item.status === 'cancelled' && (
                          <button 
                            onClick={() => handleStatusChange(item._id, 'active')}
                            style={{ color: 'var(--text-success)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            Restart
                          </button>
                        )}

                        {item.status !== 'cancelled' && (
                          <button 
                            onClick={() => handleStop(item._id)}
                            style={{ color: 'var(--text-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            Stop
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
