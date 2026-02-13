import { useState, useEffect } from "react";
import { usersApi } from "./lib/api";
import { CURRENCIES } from "./lib/constants";
import { useFeedback } from "./components/Feedback";

interface SettingsModalProps {
  onClose: () => void;
  onSuccess: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
}

export function SettingsModal({ onClose, onSuccess, theme, onThemeChange }: SettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState("USD");
  const [themeSelection, setThemeSelection] = useState<"light" | "dark">(theme);
  const { showLoading, updateToast, showAlert } = useFeedback();

  useEffect(() => {
    loadSettings();
  }, []);
  
  useEffect(() => {
    setThemeSelection(theme);
  }, [theme]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await usersApi.getMe();
      if (res.user?.defaultCurrency) {
        setDefaultCurrency(res.user.defaultCurrency);
      }
      if (res.user?.theme === "light" || res.user?.theme === "dark") {
        setThemeSelection(res.user.theme);
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const toastId = showLoading({
      title: "Saving settings",
      message: "Updating preferences...",
    });
    try {
      setLoading(true);
      await usersApi.updateSettings({ defaultCurrency, theme: themeSelection });
      onSuccess();
      onThemeChange(themeSelection);
      onClose();
      updateToast(toastId, {
        variant: "success",
        title: "Settings saved",
        message: "Your preferences are updated.",
        duration: 3000,
        persist: false,
      });
    } catch (err) {
      console.error("Failed to update settings", err);
      updateToast(toastId, {
        variant: "error",
        title: "Save failed",
        message: "Unable to update settings.",
        duration: 4000,
        persist: false,
      });
      await showAlert({
        title: "Save failed",
        message: "Unable to update settings. Please try again.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="card modal-card">
        <h2 style={{ marginTop: 0 }}>Settings</h2>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Default Currency</label>
          <select 
            value={defaultCurrency} 
            onChange={(e) => setDefaultCurrency(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
          >
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
            ))}
          </select>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            This currency will be used as the default for new invoices and customers.
          </p>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Theme</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setThemeSelection("light")}
              className={themeSelection === "light" ? "primaryButton" : "secondaryButton"}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => setThemeSelection("dark")}
              className={themeSelection === "dark" ? "primaryButton" : "secondaryButton"}
            >
              Dark
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Controls the appearance across the app.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="button" onClick={onClose} className="ghostButton">Cancel</button>
          <button 
            type="button" 
            onClick={handleSave} 
            className="primaryButton"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
