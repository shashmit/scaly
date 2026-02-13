import { useEffect, useState } from "react";
import { dashboardApi } from "./lib/api";
import { Loader } from "./components/Loader";
import { KPIWidget } from "./DashboardWidgets";

interface RevenueAnalyticsProps {
  onBack: () => void;
  currency: string;
}

export function RevenueAnalytics({ onBack, currency }: RevenueAnalyticsProps) {
  const [data, setData] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [allChartData, setAllChartData] = useState<any[]>([]);
  const [maxChartRevenue, setMaxChartRevenue] = useState(1);
  const [dashboardKpisByType, setDashboardKpisByType] = useState<Record<string, any>>({});
  const [analyticsKpisByType, setAnalyticsKpisByType] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const analyticsRes = await dashboardApi.getAnalytics();
      setData(analyticsRes.analytics || []);
      setChartData(analyticsRes.chartData || []);
      setForecastData(analyticsRes.forecastData || []);
      setAllChartData(analyticsRes.allChartData || []);
      setMaxChartRevenue(analyticsRes.maxChartRevenue || 1);
      setDashboardKpisByType(analyticsRes.dashboardKpisByType || {});
      setAnalyticsKpisByType(analyticsRes.analyticsKpisByType || {});
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(cents / 100);
  };

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  };

  if (loading) {
    return <Loader label="Loading analytics..." />;
  }

  if (error) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "red" }}>
        <p>Error: {error}</p>
        <button className="primaryButton" onClick={loadAnalytics}>Retry</button>
      </div>
    );
  }

  const getKpiDisplayValue = (kpi: any) => {
    if (!kpi) return "";
    if (typeof kpi.valueCents === "number") {
      return formatCurrency(kpi.valueCents);
    }
    if (typeof kpi.valueCount === "number") {
      return kpi.valueCount.toLocaleString();
    }
    return kpi.valueText || "";
  };

  // SVG Line Chart Helpers
  const chartHeight = 350;
  const chartWidth = 1000;
  const padding = 60; // Increased padding
  
  const getX = (index: number) => padding + (index * ((chartWidth - 2 * padding) / (Math.max(allChartData.length - 1, 1))));
  const getY = (revenue: number) => chartHeight - padding - ((revenue / maxChartRevenue) * (chartHeight - 2 * padding));

  // Catmull-Rom Spline to Cubic Bezier conversion for smooth path
  const getSmoothPath = (points: {x: number, y: number}[]) => {
    if (points.length < 2) return "";
    
    const p = points;
    let d = `M ${p[0].x} ${p[0].y}`;
    
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = i > 0 ? p[i - 1] : p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = i < p.length - 2 ? p[i + 2] : p[i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;

      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const chartPoints = chartData.map((d, i) => ({ x: getX(i), y: getY(d.revenue) }));
  const smoothPath = getSmoothPath(chartPoints);
  
  // Area path (closed loop for gradient fill)
  const areaPath = chartPoints.length > 0 
    ? `${smoothPath} L ${chartPoints[chartPoints.length-1].x} ${chartHeight - padding} L ${chartPoints[0].x} ${chartHeight - padding} Z`
    : "";

  return (
    <div className="page page-padded page-content">
      <header className="header" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Revenue Analytics</h1>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              Detailed breakdown of your revenue streams
            </p>
          </div>
        </div>
      </header>

      <div className="dashboard-grid" style={{ marginBottom: "2rem" }}>
        <KPIWidget 
          label="Total Revenue" 
          value={getKpiDisplayValue(analyticsKpisByType.kpi_month_revenue)} 
          trend={analyticsKpisByType.kpi_month_revenue?.trend || "+0%"}
          icon={null}
        />
        <KPIWidget 
          label="Transactions" 
          value={getKpiDisplayValue(analyticsKpisByType.kpi_transactions)} 
          trend={analyticsKpisByType.kpi_transactions?.trend || "+0%"}
          icon={null}
        />
        <KPIWidget 
          label="Avg. Transaction" 
          value={getKpiDisplayValue(analyticsKpisByType.kpi_avg_transaction)} 
          trend={analyticsKpisByType.kpi_avg_transaction?.trend || "+0%"}
          icon={null}
        />
        <KPIWidget 
          label="Forecast (Next Month)" 
          value={getKpiDisplayValue(analyticsKpisByType.kpi_forecast_next)} 
          trend={analyticsKpisByType.kpi_forecast_next?.trend || "+0%"}
          icon={null}
        />
      </div>

      <div className="card" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
               <h2 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
                 {getKpiDisplayValue(analyticsKpisByType.kpi_month_revenue)}
               </h2>
               <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontWeight: 500 }}>
                 Last 6 months
               </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-blue)' }}></div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Revenue</span>
            </div>
          </div>
        </div>
        
        <div style={{ width: "100%", overflowX: "auto" }}>
          <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ overflow: "visible" }}>
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* X-Axis Labels */}
            {allChartData.map((d, i) => (
              <text 
                key={i}
                x={getX(i)} 
                y={chartHeight - 20} 
                textAnchor="middle" 
                fontSize="12" 
                fontWeight="500"
                fill="var(--text-secondary)"
              >
                {formatMonth(d.month)}
              </text>
            ))}
            
            {/* Horizontal Grid Lines (Minimal) */}
             <line 
                x1={padding} 
                y1={chartHeight - padding} 
                x2={chartWidth - padding} 
                y2={chartHeight - padding} 
                stroke="var(--border-color)" 
                strokeDasharray="4 4"
                opacity="0.5"
              />

            {/* Area Fill */}
            <path 
              d={areaPath} 
              fill="url(#chartGradient)" 
              stroke="none"
            />

            {/* Smooth Line */}
            <path 
              d={smoothPath} 
              fill="none" 
              stroke="var(--accent-blue)" 
              strokeWidth="4" 
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Forecast (Dashed) - simplified to straight lines for now or would need to splice smooth path */}
            {/* For simplicity in this iteration, I'm focusing on the main smooth chart. 
                If forecast exists, we can draw it similarly but dashed. */}
            
            {/* Data Points (Only on hover ideally, but let's show small ones) */}
            {chartPoints.map((p, i) => (
              <circle 
                key={i}
                cx={p.x} 
                cy={p.y} 
                r="4" 
                fill="var(--bg-card)" 
                stroke="var(--accent-blue)"
                strokeWidth="2"
              />
            ))}

          </svg>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Detailed Breakdown</h2>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Revenue</th>
                <th>Transactions</th>
                <th>Avg. Transaction</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.month}>
                  <td style={{ fontWeight: 500 }}>{formatMonth(item.month)}</td>
                  <td style={{ fontWeight: 600, color: "var(--text-success)" }}>{formatCurrency(item.revenue)}</td>
                  <td>{item.count || 0}</td>
                  <td>{formatCurrency((item.count || 0) > 0 ? item.revenue / (item.count || 1) : 0)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "2rem", color: "var(--text-secondary)" }}>
                    No revenue data available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
