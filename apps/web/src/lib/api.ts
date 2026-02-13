const API_URL = import.meta.env.VITE_API_URL;

// Auth configuration
let getAuthToken: () => Promise<string | null> = async () => null;

export const configureAuth = (
  tokenGetter: () => Promise<string | null>
) => {
  getAuthToken = tokenGetter;
};

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers as any,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    // Don't throw for 400-500 if we want to handle it in UI, but current logic expects throw.
    // However, user requested not to throw on backend. 
    // Backend now returns { error: ... } for some endpoints.
    // If status is not OK, we still throw here to let UI catch block handle it?
    // User said "backend throwing error... not throw a error on the backend".
    // So backend returns 200 with error field.
    // But if backend actually crashes/timeouts, we get 500.
    
    // If the response is not OK, it's a network/server level error.
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data && data.error) {
    // If backend returned a logical error structure
    throw new Error(data.error);
  }

  return data;
}

const createQueryString = (params?: Record<string, string | number | boolean | null | undefined>) => {
  if (!params) return "";
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "");
  const query = new URLSearchParams(entries as Array<[string, string]>).toString();
  return query ? `?${query}` : "";
};

// Customer API
export const customersApi = {
  list: (search?: string) => apiRequest<{ customers: any[] }>(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  get: (id: string) => apiRequest<{ customer: any }>(`/api/customers/${id}`),
  create: (data: any) => apiRequest("/api/customers", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/api/customers/${id}`, {
    method: "DELETE",
  }),
};

// Invoice API
export const invoicesApi = {
  list: (params?: { status?: string; customerId?: string }) => {
    const query = createQueryString(params);
    return apiRequest<{ invoices: any[] }>(`/api/invoices${query}`);
  },
  listHistory: (params?: { status?: string; customerId?: string; cursor?: string | null; limit?: number }) => {
    const query = createQueryString(params as Record<string, string | number | null | undefined>);
    return apiRequest<{ invoices: any[]; cursor?: string; isDone: boolean }>(`/api/invoices/history${query}`);
  },
  get: (id: string) => apiRequest<{ invoice: any }>(`/api/invoices/${id}`),
  create: (data: any) => apiRequest("/api/invoices", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/api/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  updateStatus: (id: string, status: string) => apiRequest(`/api/invoices/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
  delete: (id: string) => apiRequest(`/api/invoices/${id}`, {
    method: "DELETE",
  }),
};

// Recurring Invoice API
export const recurringApi = {
  list: () => apiRequest<{ recurring: any[] }>("/api/recurring"),
  create: (data: any) => apiRequest("/api/recurring", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id: string, data: any) => apiRequest(`/api/recurring/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
  delete: (id: string) => apiRequest(`/api/recurring/${id}`, {
    method: "DELETE",
  }),
};

// Payment API
export const paymentsApi = {
  listByInvoice: (invoiceId: string) => 
    apiRequest<{ payments: any[] }>(`/api/payments/invoice/${invoiceId}`),
  record: (data: any) => apiRequest("/api/payments", {
    method: "POST",
    body: JSON.stringify(data),
  }),
};

// Dashboard API
export const dashboardApi = {
  getMetrics: () => apiRequest<{ kpisByType: Record<string, any>; totals: any; currency: string }>("/api/dashboard/metrics"),
  getAnalytics: () => apiRequest<{ analytics: any[]; chartData: any[]; forecastData: any[]; allChartData: any[]; maxChartRevenue: number; analyticsKpisByType: Record<string, any>; dashboardKpisByType: Record<string, any> }>("/api/dashboard/analytics"),
};

// Users API
export const usersApi = {
  getMe: () => apiRequest<{ user: any }>("/api/users/me"),
  updateSettings: (data: any) => apiRequest("/api/users/me/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
};

export const chatApi = {
  send: (data: { message: string; conversationId?: string | null }) =>
    apiRequest<{ conversationId: string; message: string }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createInvoice: (data: { message: string; conversationId?: string | null }) =>
    apiRequest<{
      conversationId: string;
      created: boolean;
      intent: "invoice" | "other";
      message: string;
      invoice?: {
        id: string;
        invoiceNumber: string;
        customerName: string;
        title: string;
        totalCents: number;
        currency: string;
      };
    }>("/api/ai/invoice", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getHistory: (conversationId: string) =>
    apiRequest<{ conversationId: string; messages: Array<{ id: string; role: "user" | "assistant"; content: string }> }>(
      `/api/ai/chat/${conversationId}`
    ),
};
