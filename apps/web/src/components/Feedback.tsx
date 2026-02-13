import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastVariant = "info" | "success" | "warning" | "error" | "loading";
type DialogVariant = "info" | "success" | "warning" | "error";

interface ToastOptions {
  title?: string;
  message?: string;
  variant?: ToastVariant;
  duration?: number;
  persist?: boolean;
}

interface DialogOptions {
  title?: string;
  message: string;
  variant?: DialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface Toast extends ToastOptions {
  id: string;
}

interface DialogState extends DialogOptions {
  type: "alert" | "confirm";
  resolve: (value: boolean) => void;
}

interface FeedbackContextValue {
  showAlert: (options: DialogOptions) => Promise<void>;
  showConfirm: (options: DialogOptions) => Promise<boolean>;
  showToast: (options: ToastOptions) => string;
  showLoading: (options: Omit<ToastOptions, "variant" | "duration" | "persist">) => string;
  updateToast: (id: string, options: Partial<ToastOptions>) => void;
  dismissToast: (id: string) => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const defaultDialogTitles: Record<DialogVariant, string> = {
  info: "Notice",
  success: "Success",
  warning: "Attention",
  error: "Something went wrong",
};

const defaultToastTitles: Record<ToastVariant, string> = {
  info: "Heads up",
  success: "Done",
  warning: "Check this",
  error: "Action failed",
  loading: "Working on it",
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const scheduleDismiss = useCallback((id: string, duration?: number, persist?: boolean) => {
    if (!duration || persist) return;
    const existing = timeoutsRef.current.get(id);
    if (existing) clearTimeout(existing);
    const timeout = window.setTimeout(() => dismissToast(id), duration);
    timeoutsRef.current.set(id, timeout);
  }, [dismissToast]);

  const showToast = useCallback((options: ToastOptions) => {
    const id = createId();
    const toast: Toast = {
      id,
      variant: options.variant || "info",
      duration: options.duration,
      persist: options.persist,
      title: options.title,
      message: options.message,
    };
    setToasts(prev => [toast, ...prev].slice(0, 5));
    scheduleDismiss(id, toast.duration || 3500, toast.persist);
    return id;
  }, [scheduleDismiss]);

  const showLoading = useCallback((options: Omit<ToastOptions, "variant" | "duration" | "persist">) => {
    return showToast({ ...options, variant: "loading", persist: true });
  }, [showToast]);

  const updateToast = useCallback((id: string, options: Partial<ToastOptions>) => {
    setToasts(prev => prev.map(toast => {
      if (toast.id !== id) return toast;
      return {
        ...toast,
        ...options,
      };
    }));
    scheduleDismiss(id, options.duration, options.persist);
  }, [scheduleDismiss]);

  const showAlert = useCallback((options: DialogOptions) => {
    return new Promise<void>(resolve => {
      setDialog({
        type: "alert",
        resolve: () => resolve(),
        message: options.message,
        title: options.title,
        variant: options.variant || "info",
        confirmLabel: options.confirmLabel,
      });
    });
  }, []);

  const showConfirm = useCallback((options: DialogOptions) => {
    return new Promise<boolean>(resolve => {
      setDialog({
        type: "confirm",
        resolve,
        message: options.message,
        title: options.title,
        variant: options.variant || "warning",
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
      });
    });
  }, []);

  const contextValue = useMemo<FeedbackContextValue>(() => ({
    showAlert,
    showConfirm,
    showToast,
    showLoading,
    updateToast,
    dismissToast,
  }), [dismissToast, showAlert, showConfirm, showLoading, showToast, updateToast]);

  const dialogTitle = dialog?.title || (dialog?.variant ? defaultDialogTitles[dialog.variant] : defaultDialogTitles.info);

  return (
    <FeedbackContext.Provider value={contextValue}>
      {children}
      {dialog && (
        <div className="modal-backdrop">
          <div className="card modal-card alert-card">
            <div className="alert-header">
              <div className={`alert-icon ${dialog.variant}`}>
                {dialog.variant === "success" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {dialog.variant === "error" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                {dialog.variant === "warning" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                {dialog.variant === "info" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="alert-title">{dialogTitle}</h3>
                <p className="alert-message">{dialog.message}</p>
              </div>
            </div>
            <div className="alert-actions">
              {dialog.type === "confirm" && (
                <button
                  type="button"
                  className="ghostButton"
                  onClick={() => {
                    dialog.resolve(false);
                    setDialog(null);
                  }}
                >
                  {dialog.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                type="button"
                className={dialog.variant === "error" ? "secondaryButton" : "primaryButton"}
                onClick={() => {
                  dialog.resolve(true);
                  setDialog(null);
                }}
              >
                {dialog.confirmLabel || "Okay"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.variant}`}>
            <div className={`toast-icon ${toast.variant}`}>
              {toast.variant === "loading" ? (
                <span className="toast-spinner" />
              ) : toast.variant === "success" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : toast.variant === "error" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              ) : toast.variant === "warning" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              )}
            </div>
            <div className="toast-body">
              <div className="toast-title">{toast.title || defaultToastTitles[toast.variant || "info"]}</div>
              {toast.message && <div className="toast-message">{toast.message}</div>}
            </div>
            <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return context;
}
