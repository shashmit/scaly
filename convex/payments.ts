import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
    amountCents: v.number(),
    paidAt: v.string(),
    method: v.optional(v.string()),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    
    if (invoice.userId !== args.userId) {
       throw new Error("Access denied");
    }

    const paymentId = await ctx.db.insert("payments", args);

    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();

    const paidTotal = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    if (paidTotal >= invoice.totalCents) {
      await ctx.db.patch(args.invoiceId, { status: "paid" });
    }

    return paymentId;
  },
});

export const listByInvoice = query({
  args: {
    invoiceId: v.id("invoices"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.userId !== args.userId) {
      throw new Error("Invoice not found or access denied");
    }
    
    return await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .collect();
  },
});

export const getRevenueAnalytics = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Fetch all payments for the user
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Group by month
    const monthlyData: Record<string, { revenue: number; count: number }> = {};
    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Initialize last 12 months
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = { revenue: 0, count: 0 };
    }

    for (const payment of payments) {
      // Assuming paidAt is ISO string or YYYY-MM-DD
      const date = new Date(payment.paidAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].revenue += payment.amountCents;
        monthlyData[monthKey].count += 1;
      }
    }

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        count: data.count,
      }))
      .sort((a, b) => b.month.localeCompare(a.month)); // Descending order
  },
});

export const getRevenueAnalyticsComputed = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const invoiceMap = new Map(invoices.map(i => [i._id, i]));

    const user = await ctx.db.get(args.userId);
    const userCurrency = user?.defaultCurrency || "USD";
    
    const rates = await ctx.db.query("rates").collect();
    const rateMap = new Map(rates.map(r => [r.currency, r.rate]));
    const getRate = (curr: string) => (curr === "USD" ? 1 : rateMap.get(curr) || 0);
    const userRate = getRate(userCurrency);

    const convertToUserCurrency = (centsUSD: number) => Math.round(centsUSD * userRate);

    const monthlyData: Record<string, { revenue: number; count: number }> = {};
    const today = new Date();

    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[monthKey] = { revenue: 0, count: 0 };
    }

    for (const payment of payments) {
      const invoice = invoiceMap.get(payment.invoiceId);
      if (!invoice) continue;

      // Convert payment amount to USD
      const rate = getRate(invoice.currency);
      const amountUSD = rate > 0 ? payment.amountCents / rate : 0;
      const amountUserCurrency = convertToUserCurrency(amountUSD);

      const date = new Date(payment.paidAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].revenue += amountUserCurrency;
        monthlyData[monthKey].count += 1;
      }
    }

    const analytics = Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        count: data.count,
      }))
      .sort((a, b) => b.month.localeCompare(a.month));

    const chartData = [...analytics].reverse();

    const formatTrend = (current: number, previous: number) => {
      if (previous === 0) {
        return current === 0 ? "+0%" : "+100%";
      }
      const percent = Math.round(((current - previous) / previous) * 100);
      return `${percent >= 0 ? "+" : ""}${percent}%`;
    };

    const calculateForecast = () => {
      if (chartData.length < 2) return [];
      const recentData = chartData.slice(-6);
      let totalGrowthRate = 0;
      let growthCounts = 0;

      for (let i = 1; i < recentData.length; i++) {
        const prev = recentData[i - 1].revenue;
        const curr = recentData[i].revenue;
        if (prev > 0) {
          totalGrowthRate += (curr - prev) / prev;
          growthCounts++;
        }
      }

      const avgGrowthRate = growthCounts > 0 ? totalGrowthRate / growthCounts : 0;
      const lastMonth = recentData[recentData.length - 1];
      const lastDate = new Date(`${lastMonth.month}-01`);
      const forecast = [];
      let currentRevenue = lastMonth.revenue;

      for (let i = 1; i <= 3; i++) {
        currentRevenue = currentRevenue * (1 + avgGrowthRate);
        const nextDate = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
        forecast.push({
          month: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`,
          revenue: currentRevenue,
          isForecast: true,
        });
      }
      return forecast;
    };

    const forecastData = calculateForecast();
    const allChartData = [...chartData, ...forecastData];
    const maxChartRevenue = Math.max(...allChartData.map(d => d.revenue), 1);

    const currentMonth = analytics[0];
    const previousMonth = analytics[1];
    const currentRevenue = currentMonth?.revenue ?? 0;
    const previousRevenue = previousMonth?.revenue ?? 0;
    const currentCount = currentMonth?.count ?? 0;
    const previousCount = previousMonth?.count ?? 0;
    const currentAvg = currentCount > 0 ? currentRevenue / currentCount : 0;
    const previousAvg = previousCount > 0 ? previousRevenue / previousCount : 0;
    const nextMonthForecast = forecastData[0]?.revenue ?? 0;

    return {
      analytics,
      chartData,
      forecastData,
      allChartData,
      maxChartRevenue,
      analyticsKpisByType: {
        kpi_month_revenue: {
          label: "This Month Revenue",
          valueCents: currentRevenue,
          trend: formatTrend(currentRevenue, previousRevenue),
        },
        kpi_transactions: {
          label: "Transactions",
          valueCount: currentCount,
          trend: formatTrend(currentCount, previousCount),
        },
        kpi_avg_transaction: {
          label: "Avg. Transaction",
          valueCents: currentAvg,
          trend: formatTrend(currentAvg, previousAvg),
        },
        kpi_forecast_next: {
          label: "Next Month Forecast",
          valueCents: nextMonthForecast,
          trend: formatTrend(nextMonthForecast, currentRevenue),
        },
      },
    };
  },
});
