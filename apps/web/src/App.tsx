import { useState, useEffect } from "react";
import { invoicesApi, dashboardApi, customersApi, configureAuth, usersApi, chatApi } from "./lib/api";
import { 
  SignedIn, 
  SignedOut, 
  SignInButton, 
  UserButton, 
  useAuth, 
} from "@clerk/clerk-react";

import { ViewInvoice } from "./ViewInvoice";
import { InvoiceHistory } from "./InvoiceHistory";
import { generateInvoicePDF } from "./lib/pdf";
import { RevenueAnalytics } from "./RevenueAnalytics";
import { 
  KPIWidget, 
  RecentInvoicesWidget, 
  RevenueTrendWidget, 
  WidgetType, 
  WIDGET_LABELS 
} from "./DashboardWidgets";

import { Sidebar } from './components/Sidebar';
import { Loader } from './components/Loader';
import { useFeedback } from "./components/Feedback";
import { CreateInvoice } from "./CreateInvoice";
import { SettingsModal } from "./SettingsModal";
import { RecurringInvoices } from "./RecurringInvoices";
import { Customers } from "./Customers";

export function App() {
  useEffect(() => {
    const storedTheme = localStorage.getItem("scalyTheme");
    if (storedTheme === "dark" || storedTheme === "light") {
      document.documentElement.setAttribute("data-theme", storedTheme);
    }
  }, []);

  return (
    <>
      <SignedIn>
        <Dashboard />
      </SignedIn>
      <SignedOut>
        <div className="auth-screen">
          <div className="auth-card">
            <h1>Welcome to Scaly</h1>
            <p className="text-muted">Sign in to manage your invoices</p>
          <SignInButton mode="modal">
            <button className="primaryButton">Sign In</button>
          </SignInButton>
          </div>
        </div>
      </SignedOut>
    </>
  );
}

function Dashboard() {
  const { getToken, isLoaded } = useAuth();
  const { showLoading, updateToast, showConfirm, showAlert } = useFeedback();
  
  const [view, setView] = useState<"list" | "create" | "view" | "edit" | "analytics" | "recurring" | "history" | "customers">("list");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const storedTheme = localStorage.getItem("scalyTheme");
    return storedTheme === "dark" ? "dark" : "light";
  });
  const [dashboardLayout, setDashboardLayout] = useState<WidgetType[]>([
    "kpi_overdue", "kpi_outstanding", "kpi_paid", "kpi_due",
    "revenue_trend", "kpi_month_revenue", "kpi_transactions",
    "kpi_forecast_next", "recent_invoices"
  ]);
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [dashboardKpisByType, setDashboardKpisByType] = useState<Record<string, any>>({});
  const [analyticsKpisByType, setAnalyticsKpisByType] = useState<Record<string, any>>({});
  const [userCurrency, setUserCurrency] = useState("USD");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    actions?: {
      invoiceId: string;
      invoiceNumber: string;
      customerName: string;
      title: string;
      totalCents: number;
      currency: string;
    };
  }>>([]);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);
  const [chatSending, setChatSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    configureAuth(
      async () => await getToken()
    );
  }, [getToken]);

  useEffect(() => {
    if (isLoaded) {
      loadData();
    }
  }, [isLoaded]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("scalyTheme", theme);
  }, [theme]);

  const loadChatHistory = async (conversationId: string) => {
    try {
      const response = await chatApi.getHistory(conversationId);
      setChatMessages(response.messages || []);
      setChatConversationId(response.conversationId);
    } catch (err) {
      localStorage.removeItem("scalyChatConversationId");
      setChatConversationId(null);
      setChatMessages([]);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    const storedConversationId = localStorage.getItem("scalyChatConversationId");
    if (storedConversationId) {
      loadChatHistory(storedConversationId);
    }
  }, [isLoaded]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [invoicesRes, customersRes, metricsRes, analyticsRes, userRes] = await Promise.all([
        invoicesApi.list(),
        customersApi.list(),
        dashboardApi.getMetrics(),
        dashboardApi.getAnalytics(),
        usersApi.getMe(),
      ]);
      
      setInvoices(invoicesRes.invoices || []);
      setCustomers(customersRes.customers || []);
      setDashboardKpisByType(metricsRes.kpisByType || {});
      setAnalyticsKpisByType(analyticsRes.analyticsKpisByType || {});
      setUserName(userRes.user?.name || "");
      
      // Prioritize currency returned by metrics API as it represents the actual calculated values
      if (metricsRes.currency) {
        setUserCurrency(metricsRes.currency);
      } else if (userRes.user?.defaultCurrency) {
        setUserCurrency(userRes.user.defaultCurrency);
      }

      if (userRes.user?.dashboardLayout) {
        setDashboardLayout(userRes.user.dashboardLayout);
      }
      if (userRes.user?.theme === "light" || userRes.user?.theme === "dark") {
        setTheme(userRes.user.theme);
      }
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleNewInvoice = () => {
    setSelectedInvoiceId(null);
    setView("create");
  };

  const handleChatSend = async () => {
    if (chatSending) return;
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const newMessage = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: "user" as const,
      content: trimmed,
    };
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput("");
    setChatOpen(true);
    const toastId = showLoading({
      title: "Sending message",
      message: "Waiting for Scaly Assistant...",
    });
    setChatSending(true);
    try {
      const invoiceResponse = await chatApi.createInvoice({
        message: trimmed,
        conversationId: chatConversationId ?? undefined,
      });
      if (invoiceResponse.intent === "other") {
        const response = await chatApi.send({
          message: trimmed,
          conversationId: invoiceResponse.conversationId,
        });
        const assistantMessage = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "assistant" as const,
          content: response.message,
        };
        setChatMessages(prev => [...prev, assistantMessage]);
        setChatConversationId(response.conversationId);
        localStorage.setItem("scalyChatConversationId", response.conversationId);
        updateToast(toastId, {
          variant: "success",
          title: "Response ready",
          message: "Scaly Assistant replied.",
          duration: 2000,
          persist: false,
        });
      } else {
        const assistantMessage = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          role: "assistant" as const,
          content: invoiceResponse.message,
          actions: invoiceResponse.invoice
            ? {
                invoiceId: invoiceResponse.invoice.id,
                invoiceNumber: invoiceResponse.invoice.invoiceNumber,
                customerName: invoiceResponse.invoice.customerName,
                title: invoiceResponse.invoice.title,
                totalCents: invoiceResponse.invoice.totalCents,
                currency: invoiceResponse.invoice.currency,
              }
            : undefined,
        };
        setChatMessages(prev => [...prev, assistantMessage]);
        setChatConversationId(invoiceResponse.conversationId);
        localStorage.setItem("scalyChatConversationId", invoiceResponse.conversationId);
        updateToast(toastId, {
          variant: invoiceResponse.created ? "success" : "warning",
          title: invoiceResponse.created ? "Invoice created" : "Missing details",
          message: invoiceResponse.created ? "Invoice is ready." : invoiceResponse.message,
          duration: 2500,
          persist: false,
        });
        if (invoiceResponse.created) {
          loadData();
        }
      }
    } catch (err) {
      updateToast(toastId, {
        variant: "error",
        title: "Chat failed",
        message: "Unable to send message.",
        duration: 3500,
        persist: false,
      });
    } finally {
      setChatSending(false);
    }
  };

  const handleChatDeleteInvoice = async (invoiceId: string) => {
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
      await invoicesApi.delete(invoiceId);
      setChatMessages(prev =>
        prev.map(message =>
          message.actions?.invoiceId === invoiceId
            ? { ...message, actions: undefined }
            : message
        )
      );
      await loadData();
      updateToast(toastId, {
        variant: "success",
        title: "Invoice deleted",
        message: "The invoice has been removed.",
        duration: 3000,
        persist: false,
      });
    } catch (err) {
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
    }
  };

  const handleViewInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    setView("view");
  };

  const handleEditInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    setView("edit");
  };

  const handleDownloadSelected = async () => {
    if (selectedInvoices.length === 0) return;
    const totalSelected = selectedInvoices.length;
    const toastId = showLoading({
      title: "Generating PDFs",
      message: `Preparing ${totalSelected} invoice${totalSelected === 1 ? "" : "s"}...`,
    });

    try {
      for (const id of selectedInvoices) {
        const response = await invoicesApi.get(id);
        if (response.invoice) {
          generateInvoicePDF(response.invoice);
        }
      }
      setSelectedInvoices([]);
      updateToast(toastId, {
        variant: "success",
        title: "PDFs ready",
        message: `Generated ${totalSelected} invoice${totalSelected === 1 ? "" : "s"}.`,
        duration: 3500,
        persist: false,
      });
    } catch (err) {
      console.error("Failed to generate PDFs", err);
      updateToast(toastId, {
        variant: "error",
        title: "PDF generation failed",
        message: "Some PDFs could not be generated.",
        duration: 4500,
        persist: false,
      });
    }
  };

  const toggleSelection = (id: string) => {
    if (selectedInvoices.includes(id)) {
      setSelectedInvoices(selectedInvoices.filter(i => i !== id));
    } else {
      setSelectedInvoices([...selectedInvoices, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === invoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(invoices.map(i => i._id));
    }
  };

  const saveDashboardLayout = async (newLayout: WidgetType[]) => {
    setDashboardLayout(newLayout);
    try {
      await usersApi.updateSettings({ dashboardLayout: newLayout });
    } catch (err) {
      console.error("Failed to save dashboard layout:", err);
    }
  };

  const toggleWidget = (widget: WidgetType) => {
    if (dashboardLayout.includes(widget)) {
      saveDashboardLayout(dashboardLayout.filter(w => w !== widget));
    } else {
      saveDashboardLayout([...dashboardLayout, widget]);
    }
  };

  const formatCurrency = (cents: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const getKpiDisplayValue = (kpi: any) => {
    if (!kpi) return "";
    if (typeof kpi.valueCents === "number") {
      return formatCurrency(kpi.valueCents, userCurrency);
    }
    if (typeof kpi.valueCount === "number") {
      return kpi.valueCount.toLocaleString();
    }
    return kpi.valueText || "";
  };

  const isSplitView = view === "view" && selectedInvoiceId;

  const renderContent = () => {
    if (loading && !invoices.length) {
      return <Loader label="Loading dashboard..." />;
    }

    if (error) {
      return (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: "red" }}>Error: {error}</p>
          <button onClick={loadData} className="primaryButton" style={{ marginTop: "1rem" }}>
            Retry
          </button>
        </div>
      );
    }

    if (view === "create" || view === "edit") {
      return (
        <CreateInvoice 
          invoiceId={selectedInvoiceId || undefined}
          onCancel={() => {
            setView("list");
            setSelectedInvoiceId(null);
          }} 
          onSuccess={() => {
            setView("list");
            setSelectedInvoiceId(null);
            loadData();
          }}
          onView={(id) => {
            setView("view");
            setSelectedInvoiceId(id);
            loadData();
          }}
          onDeleteSuccess={() => {
            setView("list");
            setSelectedInvoiceId(null);
            loadData();
          }}
        />
      );
    }
  
    if (view === "analytics") {
      return <RevenueAnalytics onBack={() => setView("list")} currency={userCurrency} />;
    }

    if (view === "recurring") {
      return <RecurringInvoices onBack={() => setView("list")} />;
    }

    if (view === "customers") {
      return <Customers />;
    }

    if (view === "history") {
      return <InvoiceHistory />;
    }

    // Default List/Dashboard View
    return (
      <>
        <header className="header">
          <div>
            <p className="header-subtitle">{todayDate}</p>
            <h1 className="header-title">{getGreeting()}, {userName || "there"}</h1>
          </div>
          <div className="header-actions">
            <button onClick={() => setIsCustomizing(!isCustomizing)} className={isCustomizing ? "primaryButton" : "ghostButton"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              {isCustomizing ? "Done" : "Customize"}
            </button>
          </div>
        </header>

        {isCustomizing && (
          <div className="card widget-panel" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <h3>Add/Remove Widgets</h3>
            </div>
            <div className="widget-toggle-group">
              {(Object.keys(WIDGET_LABELS) as WidgetType[]).map((type) => (
                <button 
                  key={type}
                  onClick={() => toggleWidget(type)}
                  className={`widget-toggle ${dashboardLayout.includes(type) ? "active" : ""}`}
                >
                  {WIDGET_LABELS[type]} {dashboardLayout.includes(type) ? '✓' : '+'}
                </button>
              ))}
            </div>
          </div>
        )}

        {isSplitView ? (
          <div className="split-view">
            <div className="split-panel" style={{ width: '450px' }}>
               <RecentInvoicesWidget 
                 invoices={invoices} 
                 customers={customers}
                 selectedInvoices={selectedInvoices}
                 toggleSelection={toggleSelection}
                 toggleSelectAll={toggleSelectAll}
                 onNewInvoice={handleNewInvoice}
                 onDownloadSelected={handleDownloadSelected}
                 onViewInvoice={handleViewInvoice}
                 onEditInvoice={handleEditInvoice}
                 userCurrency={userCurrency}
               />
            </div>
            <div className="split-panel" style={{ flex: 1 }}>
               <ViewInvoice 
                  invoiceId={selectedInvoiceId}
                  onBack={() => {
                    setView("list");
                    setSelectedInvoiceId(null);
                  }}
                  onEdit={(id) => {
                    setView("edit");
                    setSelectedInvoiceId(id);
                  }}
                  onDeleteSuccess={() => {
                    setView("list");
                    setSelectedInvoiceId(null);
                    loadData();
                  }}
                  onStatusChange={() => {
                    loadData();
                  }}
                  isSidePanel={true}
               />
            </div>
          </div>
        ) : (
          <div className="dashboard-grid">
            {dashboardLayout.map((widgetType) => {
              if (widgetType === 'kpi_outstanding') {
                 const kpi = dashboardKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-warning)' }}>
                           <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                         </svg>
                       )}
                     />
                   </div>
                 );
              }
              if (widgetType === 'kpi_overdue') {
                 const kpi = dashboardKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-error)' }}>
                           <circle cx="12" cy="12" r="10" />
                           <line x1="12" y1="8" x2="12" y2="12" />
                           <line x1="12" y1="16" x2="12.01" y2="16" />
                         </svg>
                       )}
                     />
                   </div>
                 );
              }
              if (widgetType === 'kpi_due') {
                 const kpi = dashboardKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-info)' }}>
                           <circle cx="12" cy="12" r="9" />
                           <path d="M12 7v5l3 3" />
                         </svg>
                       )}
                     />
                   </div>
                 );
              }
              if (widgetType === 'kpi_paid') {
                 const kpi = dashboardKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-success)' }}>
                           <polyline points="20 6 9 17 4 12" />
                         </svg>
                       )}
                       isClickable 
                       onClick={() => setView("analytics")} 
                     />
                   </div>
                 );
              }
              if (widgetType === 'kpi_month_revenue') {
                 const kpi = analyticsKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-blue)' }}>
                           <path d="M12 2v20" />
                           <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                         </svg>
                       )}
                     />
                   </div>
                 );
              }
              if (widgetType === 'kpi_transactions') {
                 const kpi = analyticsKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-success)' }}>
                           <rect x="3" y="4" width="18" height="14" rx="2" />
                           <line x1="7" y1="8" x2="17" y2="8" />
                           <line x1="7" y1="12" x2="12" y2="12" />
                         </svg>
                       )}
                     />
                   </div>
                 );
              }
              if (widgetType === 'kpi_avg_transaction') {
                 const kpi = analyticsKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-warning)' }}>
                           <circle cx="12" cy="12" r="9" />
                           <path d="M8 12h8" />
                           <path d="M12 8v8" />
                         </svg>
                       )}
                     />
                   </div>
                 );
              }
              if (widgetType === 'kpi_forecast_next') {
                 const kpi = analyticsKpisByType[widgetType];
                 if (!kpi) return null;
                 return (
                   <div key={widgetType} className="col-span-1">
                     <KPIWidget 
                       label={kpi.label}
                       value={getKpiDisplayValue(kpi)}
                       trend={kpi.trend}
                       icon={(
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-purple)' }}>
                           <path d="M3 3v18h18" />
                           <path d="M7 14l4-4 4 4 5-6" />
                         </svg>
                       )}
                     />
                   </div>
                 );
              }
              if (widgetType === 'revenue_trend') {
                 return (
                   <div key={widgetType} className="col-span-2">
                     <RevenueTrendWidget 
                       metrics={null} 
                       isClickable 
                       onClick={() => setView("analytics")} 
                     />
                   </div>
                 );
              }
              if (widgetType === 'recent_invoices') {
                 return (
                   <div key={widgetType} className="col-span-4" style={{ minHeight: '500px' }}>
                     <RecentInvoicesWidget 
                       invoices={invoices} 
                       customers={customers}
                       selectedInvoices={selectedInvoices}
                       toggleSelection={toggleSelection}
                       toggleSelectAll={toggleSelectAll}
                       onNewInvoice={handleNewInvoice}
                       onDownloadSelected={handleDownloadSelected}
                       onViewInvoice={handleViewInvoice}
                       onEditInvoice={handleEditInvoice}
                       userCurrency={userCurrency}
                     />
                   </div>
                 );
              }
              return null;
            })}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="app-container">
      <Sidebar currentView={view} onChangeView={(v) => {
         if (v === 'create') handleNewInvoice();
         else if (v === 'settings') setShowSettings(true);
         else setView(v as any);
      }} />
      <main className="main-content">
      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)} 
          onSuccess={() => {
            setShowSettings(false);
            loadData();
          }} 
          theme={theme}
          onThemeChange={setTheme}
        />
      )}
      {renderContent()}
      </main>
      {chatOpen && (
        <div className="chat-sheet-backdrop">
          <div className="card chat-sheet-card">
            <div className="chat-sheet-header">
              <div>
                <h3 className="chat-modal-title">Scaly Assistant</h3>
                <p className="chat-modal-subtitle">Ask anything about invoices, customers, or analytics.</p>
              </div>
              <button className="chat-close-button" type="button" onClick={() => setChatOpen(false)} aria-label="Close chat">
                ×
              </button>
            </div>
            <div className="chat-sheet-body">
              <div className="chat-sheet-main">
                <div className="chat-messages chat-messages-card">
                  {chatMessages.length === 0 ? (
                    <div className="empty-state">Start a conversation from the input below.</div>
                  ) : (
                    chatMessages.map(message => (
                      <div key={message.id} className={`chat-message chat-message-${message.role}`}>
                        <div className="chat-message-bubble">
                          <div>{message.content}</div>
                          {message.actions && (
                            <div className="chat-message-actions">
                              <button
                                className="secondaryButton"
                                type="button"
                                onClick={() => handleViewInvoice(message.actions!.invoiceId)}
                              >
                                View
                              </button>
                              <button
                                className="secondaryButton"
                                type="button"
                                onClick={() => handleEditInvoice(message.actions!.invoiceId)}
                              >
                                Edit
                              </button>
                              <button
                                className="secondaryButton"
                                type="button"
                                onClick={() => handleChatDeleteInvoice(message.actions!.invoiceId)}
                                style={{ color: "var(--text-error)", borderColor: "var(--border-error)" }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="chat-modal-input chat-sheet-input">
                  <input
                    type="text"
                    value={chatInput}
                    placeholder="Type a message..."
                    disabled={chatSending}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleChatSend();
                      }
                    }}
                  />
                  <button className="primaryButton" type="button" onClick={handleChatSend} disabled={chatSending}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="floating-chat-dock">
        <div className="floating-chat-input">
          <input
            type="text"
            value={chatInput}
            placeholder="Chat with Scaly..."
            disabled={chatSending}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleChatSend();
              }
            }}
          />
          <button className="primaryButton" type="button" onClick={handleChatSend} disabled={chatSending}>
            Send
          </button>
        </div>
        <button className="secondaryButton" type="button" onClick={handleNewInvoice}>
          New Invoice
        </button>
      </div>
    </div>
  );
}
